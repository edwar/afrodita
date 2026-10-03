/// <reference lib="webworker" />
/**
 * Pose inference worker: keeps MediaPipe off the main thread.
 *
 * Protocol (see src/lib/vto/types.ts):
 *   in:  { type: "init", wasmPath, modelPath, delegate }
 *   in:  { type: "detect", bitmap, frameId, tsMs }
 *   out: { type: "ready", delegate } | { type: "error", stage, message }
 *   out: { type: "pose", frameId, tsMs, landmarks, world }
 *
 * Pose buffers are flat Float32Array(33*4) transferred zero-copy.
 */
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision"
import { POSE_STRIDE, type PoseWorkerInbound, type PoseWorkerOutbound } from "../lib/vto/types"

type Landmark = NormalizedLandmark

let landmarker: PoseLandmarker | null = null

function post(message: PoseWorkerOutbound, transfer: Transferable[] = []): void {
  ;(self as DedicatedWorkerGlobalScope).postMessage(message, transfer)
}

function flatten(landmarks: Landmark[]): Float32Array {
  const out = new Float32Array(landmarks.length * POSE_STRIDE)
  for (let i = 0; i < landmarks.length; i++) {
    const l = landmarks[i]
    out[i * POSE_STRIDE] = l.x
    out[i * POSE_STRIDE + 1] = l.y
    out[i * POSE_STRIDE + 2] = l.z
    out[i * POSE_STRIDE + 3] = l.visibility ?? 1
  }
  return out
}

async function init(
  wasmPath: string,
  modelPath: string,
  delegate: "GPU" | "CPU"
): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(wasmPath)
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
  })
  post({ type: "ready", delegate })
}

self.onmessage = async (event: MessageEvent<PoseWorkerInbound>) => {
  const data = event.data

  if (data.type === "init") {
    try {
      await init(data.wasmPath, data.modelPath, data.delegate)
    } catch (error) {
      post({
        type: "error",
        stage: "init",
        message: error instanceof Error ? error.message : String(error),
      })
    }
    return
  }

  if (data.type === "detect") {
    const { bitmap, frameId, tsMs } = data
    if (!landmarker) {
      bitmap.close()
      post({ type: "pose", frameId, tsMs, landmarks: null, world: null })
      return
    }

    try {
      const result = landmarker.detectForVideo(bitmap, tsMs)
      bitmap.close()

      const lm = result.landmarks?.[0]
      const wl = result.worldLandmarks?.[0]
      const landmarks = lm ? flatten(lm) : null
      const world = wl ? flatten(wl) : null

      const transfer: Transferable[] = []
      if (landmarks) transfer.push(landmarks.buffer)
      if (world) transfer.push(world.buffer)

      post({ type: "pose", frameId, tsMs, landmarks, world }, transfer)
    } catch (error) {
      bitmap.close()
      post({
        type: "error",
        stage: "detect",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export {}
