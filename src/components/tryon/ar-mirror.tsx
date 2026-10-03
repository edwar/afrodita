"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  FilesetResolver,
  PoseLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision"
import { Loader2, VideoOff, RefreshCw, Camera } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

export interface TryOnGarment {
  id: string
  name: string
  category: string
  color: string
  material?: string
  imageUrl?: string
  modelUrl?: string
  /** Rigged GLB (Blender pipeline) — used by the skinned try-on path. */
  riggedModelUrl?: string
  /** Skeleton contract version; skinned path requires "vto-skeleton-v1". */
  skeletonMapVersion?: string
}

interface ARMirrorProps {
  garments: TryOnGarment[]
}

type MirrorState = "loading" | "active" | "error"

interface Smoothed {
  landmarks: NormalizedLandmark[] | null
}

function P(x: number, y: number) {
  return { x, y }
}

const MAX_CANVAS_WIDTH = 640
const MIN_INFERENCE_INTERVAL_MS = 50 // ~20fps max inference rate

export function ARMirror({ garments }: ARMirrorProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const smoothedRef = useRef<Smoothed>({ landmarks: null })
  const rafRef = useRef<number>(0)
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const lastVideoTimeRef = useRef(-1)
  const lastInferenceTimeRef = useRef(0)
  const smoothedBufferRef = useRef<NormalizedLandmark[]>([])

  const [state, setState] = useState<MirrorState>("loading")
  const [error, setError] = useState("")
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [attempt, setAttempt] = useState(0)
  const drawRef = useRef<() => void>(() => {})

  const smoothLandmarks = useCallback((raw: NormalizedLandmark[]): NormalizedLandmark[] => {
    const prev = smoothedRef.current.landmarks
    const buf = smoothedBufferRef.current

    if (!prev || prev.length !== raw.length || buf.length !== raw.length) {
      smoothedRef.current.landmarks = raw
      smoothedBufferRef.current = raw.map((l) => ({ ...l }))
      return smoothedBufferRef.current
    }

    for (let i = 0; i < raw.length; i++) {
      buf[i].x = prev[i].x + (raw[i].x - prev[i].x) * 0.55
      buf[i].y = prev[i].y + (raw[i].y - prev[i].y) * 0.55
      buf[i].z = prev[i].z + (raw[i].z - prev[i].z) * 0.55
      buf[i].visibility = raw[i].visibility
    }
    smoothedRef.current.landmarks = buf
    return buf
  }, [])

  const draw = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current
    if (!video || !canvas || !landmarker) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) {
      rafRef.current = requestAnimationFrame(() => drawRef.current())
      return
    }

    // Cap canvas backing store for performance on basic devices
    const scale = Math.min(1, MAX_CANVAS_WIDTH / vw)
    const cw = Math.round(vw * scale)
    const ch = Math.round(vh * scale)
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }

    ctx.save()
    ctx.translate(cw, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, cw, ch)
    ctx.restore()

    // Only run pose inference when video frame changed AND enough time passed
    const now = performance.now()
    const videoChanged = video.currentTime !== lastVideoTimeRef.current
    const intervalOk = now - lastInferenceTimeRef.current >= MIN_INFERENCE_INTERVAL_MS

    if (videoChanged && intervalOk) {
      lastVideoTimeRef.current = video.currentTime
      lastInferenceTimeRef.current = now
      try {
        const result = landmarker.detectForVideo(video, now)
        const raw = result.landmarks?.[0] ?? null
        if (raw) {
          smoothLandmarks(raw)
        }
      } catch {
        // frame descartado, timestamp fuera de orden
      }
    }

    const lm = smoothedRef.current.landmarks
    if (!lm) {
      rafRef.current = requestAnimationFrame(() => drawRef.current())
      return
    }

    // Map landmarks to canvas coordinates (mirrored, scaled)
    const pt = (i: number) => P((1 - lm[i].x) * cw, lm[i].y * ch)
    const cropImage = imagesRef.current

    const drawQuad = (
      img: HTMLImageElement,
      p0: { x: number; y: number },
      p1: { x: number; y: number },
      p2: { x: number; y: number }
    ) => {
      if (!img.complete || img.naturalWidth === 0) return
      const a = p1.x - p0.x
      const b = p1.y - p0.y
      const c = p2.x - p0.x
      const d = p2.y - p0.y
      ctx.save()
      ctx.transform(a, b, c, d, p0.x, p0.y)
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 1, 1)
      ctx.restore()
    }

    const silhouette = (
      color: string,
      build: (c: CanvasRenderingContext2D) => void,
      lineWidth?: number
    ) => {
      ctx.save()
      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.88
      ctx.beginPath()
      if (lineWidth) {
        ctx.lineWidth = lineWidth
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
      }
      build(ctx)
      if (lineWidth) {
        ctx.stroke()
      } else {
        ctx.fill()
      }
      ctx.restore()
    }

    for (const g of garments) {
      const img = g.imageUrl ? cropImage.get(g.imageUrl) : undefined
      const color = g.color || "#C9B99A"

      if (g.category === "camisa" || g.category === "chaqueta") {
        const ls = pt(11)
        const rs = pt(12)
        const rh = pt(24)
        const lh = pt(23)
        const pad = (lh.y - ls.y) * 0.12
        const p0 = P(ls.x - pad, ls.y - pad)
        const p1 = P(rs.x + pad, rs.y - pad)
        const p2 = P(lh.x - pad * 0.5, lh.y + pad * 0.5)
        const p3 = P(rh.x + pad * 0.5, rh.y + pad * 0.5)
        if (img) drawQuad(img, p0, p1, p2)
        else {
          silhouette(color, (c) => {
            c.moveTo(p0.x, p0.y)
            c.lineTo(p1.x, p1.y)
            c.lineTo(p3.x, p3.y)
            c.lineTo(p2.x, p2.y)
            c.closePath()
          })
        }
      }

      if (g.category === "vestido") {
        const ls = pt(11)
        const rs = pt(12)
        const rk = pt(26)
        const lk = pt(25)
        if (img) drawQuad(img, ls, rs, lk)
        else {
          silhouette(color, (c) => {
            c.moveTo(ls.x, ls.y)
            c.lineTo(rs.x, rs.y)
            c.lineTo(rk.x, rk.y)
            c.lineTo(lk.x, lk.y)
            c.closePath()
          })
        }
      }

      if (g.category === "falda") {
        const lh = pt(23)
        const rh = pt(24)
        const rk = pt(26)
        const lk = pt(25)
        if (img) drawQuad(img, lh, rh, lk)
        else {
          silhouette(color, (c) => {
            c.moveTo(lh.x, lh.y)
            c.lineTo(rh.x, rh.y)
            c.lineTo(rk.x, rk.y)
            c.lineTo(lk.x, lk.y)
            c.closePath()
          })
        }
      }

      if (g.category === "pantalon") {
        const hipL = pt(23)
        const hipR = pt(24)
        const kneeL = pt(25)
        const kneeR = pt(26)
        const ankleL = pt(27)
        const ankleR = pt(28)
        const crotch = P((hipL.x + hipR.x) / 2, (hipL.y + hipR.y) / 2)
        if (img) {
          drawQuad(img, hipL, crotch, ankleL)
          drawQuad(img, hipR, crotch, ankleR)
        } else {
          const lw = Math.max(Math.abs(hipR.x - hipL.x) * 0.28, 8)
          silhouette(
            color,
            (c) => {
              c.moveTo(hipL.x, hipL.y)
              c.lineTo(kneeL.x, kneeL.y)
              c.lineTo(ankleL.x, ankleL.y)
            },
            lw
          )
          silhouette(
            color,
            (c) => {
              c.moveTo(hipR.x, hipR.y)
              c.lineTo(kneeR.x, kneeR.y)
              c.lineTo(ankleR.x, ankleR.y)
            },
            lw
          )
        }
      }

      if (g.category === "zapato") {
        const heelL = pt(29)
        const toeL = pt(31)
        const heelR = pt(30)
        const toeR = pt(32)
        if (img) {
          drawQuad(img, heelL, toeL, pt(27))
          drawQuad(img, heelR, toeR, pt(28))
        } else {
          ctx.save()
          ctx.fillStyle = color
          ctx.globalAlpha = 0.9
          for (const [a, b] of [
            [heelL, toeL],
            [heelR, toeR],
          ] as const) {
            const cx = (a.x + b.x) / 2
            const cy = (a.y + b.y) / 2
            const w = Math.abs(b.x - a.x) * 0.7
            ctx.beginPath()
            ctx.ellipse(cx, cy, w, w * 0.32, 0, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        }
      }

      if (g.category === "sombrero") {
        const nose = pt(0)
        const earL = pt(7)
        const earR = pt(8)
        const headW = Math.abs(earR.x - earL.x)
        const p0 = P(earL.x - headW * 0.15, nose.y - headW * 1.1)
        const p1 = P(earR.x + headW * 0.15, nose.y - headW * 1.1)
        const p2 = P(earL.x, nose.y - headW * 0.45)
        if (img) drawQuad(img, p0, p1, p2)
        else {
          silhouette(color, (c) => {
            c.moveTo(p0.x, p0.y)
            c.lineTo(p1.x, p1.y)
            c.lineTo(p2.x, p2.y)
            c.closePath()
          })
        }
      }

      if (g.category === "bolso") {
        const wrist = pt(15)
        const elbow = pt(13)
        const p0 = P(wrist.x - 30, wrist.y)
        const p1 = P(wrist.x + 30, wrist.y)
        const p2 = P(elbow.x - 30, elbow.y)
        if (img) drawQuad(img, p0, p1, p2)
      }
    }

    rafRef.current = requestAnimationFrame(() => drawRef.current())
  }, [garments, smoothLandmarks])

  useEffect(() => {
    drawRef.current = draw
  }, [draw])

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null

    const preloadImages = () => {
      for (const g of garments) {
        if (g.imageUrl && !imagesRef.current.has(g.imageUrl)) {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = g.imageUrl
          imagesRef.current.set(g.imageUrl, img)
        }
      }
    }

    const setup = async () => {
      try {
        setState("loading")
        setError("")
        preloadImages()

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
        )
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        })
        landmarkerRef.current = landmarker

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop())
          return
        }

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        // Reset inference state
        lastVideoTimeRef.current = -1
        lastInferenceTimeRef.current = 0
        smoothedRef.current.landmarks = null
        smoothedBufferRef.current = []

        setState("active")
        rafRef.current = requestAnimationFrame(() => drawRef.current())
      } catch {
        if (!cancelled) {
          setState("error")
          setError(t("tryon.error"))
        }
      }
    }

    setup()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      stream?.getTracks().forEach((tr) => tr.stop())
      const video = videoRef.current
      if (video) {
        video.srcObject = null
      }
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      imagesRef.current.clear()
      smoothedRef.current.landmarks = null
      smoothedBufferRef.current = []
      lastVideoTimeRef.current = -1
      lastInferenceTimeRef.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, attempt])

  const retry = () => {
    setAttempt((a) => a + 1)
  }

  const switchCamera = () => {
    setFacingMode((f) => (f === "user" ? "environment" : "user"))
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1A1A1A]">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="w-full h-full object-cover" />

      {state === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-[#1A1A1A]/80">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9B99A]" />
          <p className="text-xs tracking-[0.2em] uppercase">
            {t("tryon.loading")}
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-white bg-[#1A1A1A]/90">
          <VideoOff className="w-8 h-8 text-[#C9B99A]" />
          <p className="text-sm max-w-xs">{error}</p>
          <button
            onClick={retry}
            className="btn-fashion inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t("tryon.retry")}
          </button>
        </div>
      )}

      {state === "active" && (
        <>
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#1A1A1A]/60 backdrop-blur-sm px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] tracking-[0.2em] uppercase text-white">
              {t("tryon.live")}
            </span>
          </div>
          <button
            onClick={switchCamera}
            className="absolute top-4 right-4 p-2 bg-[#1A1A1A]/60 backdrop-blur-sm text-white hover:bg-[#1A1A1A]/80 transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/70 bg-[#1A1A1A]/50 backdrop-blur-sm px-4 py-1.5">
              {t("tryon.hint")}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
