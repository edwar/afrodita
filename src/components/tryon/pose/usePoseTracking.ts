"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { PoseSmoother } from "@/lib/vto/filters"
import { PoseBuffer, createPoseFrame } from "@/lib/vto/interpolate"
import {
  LANDMARK_COUNT,
  POSE_STRIDE,
  type PoseWorkerInbound,
  type PoseWorkerOutbound,
} from "@/lib/vto/types"

export type PoseTrackingState = "idle" | "loading" | "active" | "error"

export interface UsePoseTrackingOptions {
  enabled?: boolean
  /** Pose inference rate; keep at or below TIER_SETTINGS[tier].inferenceHz. */
  inferenceHz?: number
  /** Additional delay (ms) applied to render sampling so interpolation never extrapolates. */
  interpolationDelayMs?: number
  /** Consecutive missed detections before bodyDetected flips to false. */
  missThreshold?: number
  wasmPath?: string
  modelPath?: string
}

export interface UsePoseTrackingResult {
  videoRef: RefObject<HTMLVideoElement | null>
  state: PoseTrackingState
  error: string
  bodyDetected: boolean
  delegate: "GPU" | "CPU" | null
  /**
   * Samples the interpolated pose for the given `performance.now()` timestamp.
   * Applies the internal interpolation delay. Returns false when stale/empty.
   */
  samplePose: (
    nowMs: number,
    outLandmarks: Float32Array,
    outWorld: Float32Array
  ) => boolean
  /** Latest smoothed world-landmark buffer (for calibration sampling). */
  latestWorld: () => Float32Array | null
  switchCamera: () => void
  retry: () => void
}

const POOL_SIZE = 16
const BUFFER_LENGTH = LANDMARK_COUNT * POSE_STRIDE

interface VideoFrameLike {
  requestVideoFrameCallback?: (cb: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

export function usePoseTracking(
  options: UsePoseTrackingOptions = {}
): UsePoseTrackingResult {
  const {
    enabled = true,
    inferenceHz = 15,
    interpolationDelayMs,
    missThreshold = 12,
    wasmPath = "/wasm",
    modelPath = "/models/pose_landmarker_lite.task",
  } = options

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const poseBufferRef = useRef(new PoseBuffer(8))
  const smootherRef = useRef(new PoseSmoother())
  const worldSmootherRef = useRef(new PoseSmoother())
  const inFlightRef = useRef(false)
  const frameIdRef = useRef(0)
  const sentAtRef = useRef(new Map<number, number>())
  const lastInferenceRef = useRef(0)
  const missesRef = useRef(0)
  const gpuFailedRef = useRef(false)
  const stoppedRef = useRef(false)
  const rvfcHandleRef = useRef(0)
  const stateRef = useRef<PoseTrackingState>("idle")
  const bodyDetectedRef = useRef(false)

  const landmarkPoolRef = useRef<Float32Array[]>(
    Array.from({ length: POOL_SIZE }, () => new Float32Array(BUFFER_LENGTH))
  )
  const worldPoolRef = useRef<Float32Array[]>(
    Array.from({ length: POOL_SIZE }, () => new Float32Array(BUFFER_LENGTH))
  )

  const [state, setState] = useState<PoseTrackingState>("idle")
  const [error, setError] = useState("")
  const [bodyDetected, setBodyDetected] = useState(false)
  const [delegate, setDelegate] = useState<"GPU" | "CPU" | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [attempt, setAttempt] = useState(0)

  const updateState = useCallback((next: PoseTrackingState) => {
    if (stateRef.current !== next) {
      stateRef.current = next
      setState(next)
    }
  }, [])

  const updateBodyDetected = useCallback((next: boolean) => {
    if (bodyDetectedRef.current !== next) {
      bodyDetectedRef.current = next
      setBodyDetected(next)
    }
  }, [])

  const samplePose = useCallback(
    (nowMs: number, outLandmarks: Float32Array, outWorld: Float32Array): boolean => {
      const delay =
        interpolationDelayMs ?? Math.max(Math.round(1000 / inferenceHz), 33)
      return poseBufferRef.current.sample(nowMs - delay, outLandmarks, outWorld)
    },
    [interpolationDelayMs, inferenceHz]
  )

  const latestWorld = useCallback((): Float32Array | null => {
    return poseBufferRef.current.latest?.world ?? null
  }, [])

  useEffect(() => {
    if (!enabled) return

    stoppedRef.current = false
    const minIntervalMs = Math.max(1000 / inferenceHz - 2, 10)
    const videoEl = videoRef.current as (HTMLVideoElement & VideoFrameLike) | null

    const poseBuffer = poseBufferRef.current
    const sentAt = sentAtRef.current
    poseBuffer.clear()
    smootherRef.current.reset()
    worldSmootherRef.current.reset()
    sentAt.clear()
    inFlightRef.current = false
    missesRef.current = 0
    bodyDetectedRef.current = false

    // Intentional resets when camera/attempt changes; these are discrete UI
    // states, not per-frame updates.
    /* eslint-disable react-hooks/set-state-in-effect */
    setBodyDetected(false)
    updateState("loading")
    setError("")
    /* eslint-enable react-hooks/set-state-in-effect */

    // --- Worker setup -------------------------------------------------------
    const worker = new Worker(new URL("../../../workers/pose.worker.ts", import.meta.url))
    workerRef.current = worker

    const sendInit = (delegateMode: "GPU" | "CPU") => {
      const message: PoseWorkerInbound = {
        type: "init",
        wasmPath,
        modelPath,
        delegate: delegateMode,
      }
      worker.postMessage(message)
    }

    worker.onmessage = (event: MessageEvent<PoseWorkerOutbound>) => {
      const message = event.data

      if (message.type === "ready") {
        setDelegate(message.delegate)
        return
      }

      if (message.type === "error") {
        if (message.stage === "init" && !gpuFailedRef.current) {
          // GPU delegate unavailable (common in workers on some Androids):
          // retry once with CPU.
          gpuFailedRef.current = true
          console.warn("[vto] GPU delegate failed, retrying with CPU:", message.message)
          sendInit("CPU")
          return
        }
        setError(message.message)
        updateState("error")
        return
      }

      if (message.type === "pose") {
        inFlightRef.current = false
        const sentAtMs = sentAt.get(message.frameId) ?? message.tsMs
        sentAt.delete(message.frameId)

        if (message.landmarks && message.world) {
          const smoothedLandmarks = smootherRef.current.filter(
            message.landmarks,
            sentAtMs
          )
          const smoothedWorld = worldSmootherRef.current.filter(message.world, sentAtMs)

          const slot = message.frameId % POOL_SIZE
          const landmarksCopy = landmarkPoolRef.current[slot]
          const worldCopy = worldPoolRef.current[slot]
          landmarksCopy.set(smoothedLandmarks)
          worldCopy.set(smoothedWorld)

          poseBuffer.push(createPoseFrame(sentAtMs, landmarksCopy, worldCopy))

          missesRef.current = 0
          updateBodyDetected(true)
        } else {
          missesRef.current += 1
          if (missesRef.current >= missThreshold) updateBodyDetected(false)
        }
      }
    }

    sendInit("GPU")

    // --- Camera + video frame loop -----------------------------------------
    let stream: MediaStream | null = null

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        })

        if (stoppedRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        updateState("active")

        const loop = () => {
          if (stoppedRef.current) return
          const now = performance.now()
          const v = videoRef.current
          if (
            v &&
            !inFlightRef.current &&
            now - lastInferenceRef.current >= minIntervalMs &&
            v.readyState >= 2 &&
            v.videoWidth > 0
          ) {
            inFlightRef.current = true
            lastInferenceRef.current = now
            const frameId = ++frameIdRef.current
            sentAt.set(frameId, now)
            createImageBitmap(v)
              .then((bitmap) => {
                if (stoppedRef.current) {
                  bitmap.close()
                  inFlightRef.current = false
                  return
                }
                const message: PoseWorkerInbound = {
                  type: "detect",
                  bitmap,
                  frameId,
                  tsMs: now,
                }
                worker.postMessage(message, [bitmap])
              })
              .catch(() => {
                inFlightRef.current = false
              })
          }

          const vfl = videoRef.current as (HTMLVideoElement & VideoFrameLike) | null
          if (vfl?.requestVideoFrameCallback) {
            rvfcHandleRef.current = vfl.requestVideoFrameCallback(() => loop())
          } else {
            requestAnimationFrame(() => loop())
          }
        }

        const vfl = video as HTMLVideoElement & VideoFrameLike
        if (vfl.requestVideoFrameCallback) {
          rvfcHandleRef.current = vfl.requestVideoFrameCallback(() => loop())
        } else {
          requestAnimationFrame(() => loop())
        }
      } catch (err) {
        if (!stoppedRef.current) {
          setError(err instanceof Error ? err.message : String(err))
          updateState("error")
        }
      }
    }

    void startCamera()

    return () => {
      stoppedRef.current = true
      const video = videoEl
      if (video?.cancelVideoFrameCallback && rvfcHandleRef.current) {
        try {
          video.cancelVideoFrameCallback(rvfcHandleRef.current)
        } catch {
          // ignore
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      if (video) video.srcObject = null
      worker.terminate()
      workerRef.current = null
      poseBuffer.clear()
      sentAt.clear()
      inFlightRef.current = false
      updateState("idle")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, facingMode, attempt, inferenceHz, wasmPath, modelPath, missThreshold])

  const switchCamera = useCallback(() => {
    setFacingMode((mode) => (mode === "user" ? "environment" : "user"))
  }, [])

  const retry = useCallback(() => {
    gpuFailedRef.current = false
    setAttempt((value) => value + 1)
  }, [])

  return {
    videoRef,
    state,
    error,
    bodyDetected,
    delegate,
    samplePose,
    latestWorld,
    switchCamera,
    retry,
  }
}
