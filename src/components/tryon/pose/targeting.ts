/**
 * Screen-space anchoring for garment layers (mirrored video coordinates).
 * Used by both the rigid (unrigged) and skinned rendering paths to place the
 * garment container on the body.
 */
import type { LandmarkLike } from "./pose-source"

// Pose Landmarker landmark indices (33 puntos)
const L_EAR = 7
const R_EAR = 8
const L_SHOULDER = 11
const R_SHOULDER = 12
const L_WRIST = 15
const R_WRIST = 16
const L_HIP = 23
const R_HIP = 24
const L_ANKLE = 27
const R_ANKLE = 28
const L_FOOT_INDEX = 31
const R_FOOT_INDEX = 32

export const GARMENT_Z = -1.8
export const CAMERA_FOV = 55
export const INFERENCE_HZ = 15

export type Anchor = "shoulders" | "hips" | "feet" | "head" | "wrist"

export interface Target {
  x: number
  y: number
  rz: number
  s: number
}

export function anchorFor(category: string): Anchor {
  switch (category) {
    case "pantalon":
    case "falda":
      return "hips"
    case "zapato":
      return "feet"
    case "sombrero":
      return "head"
    case "bolso":
    case "accesorio":
      return "wrist"
    default:
      return "shoulders"
  }
}

export function computeTargets(
  lm: LandmarkLike[],
  anchor: Anchor,
  viewW: number,
  viewH: number,
  modelW: number,
  modelH: number
): Target[] {
  // Landmarks en espacio de pantalla espejo (el video se muestra reflejado)
  const mirror = (i: number) => ({ x: 1 - lm[i].x, y: lm[i].y })
  const world = (sx: number, sy: number) => ({
    x: (sx - 0.5) * viewW,
    y: (0.5 - sy) * viewH,
  })
  const tilt = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    -Math.atan2(b.y - a.y, b.x - a.x)
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  })

  switch (anchor) {
    case "shoulders": {
      const a = mirror(L_SHOULDER)
      const b = mirror(R_SHOULDER)
      const m = mid(a, b)
      const { x, y } = world(m.x, m.y)
      // Scale based on shoulder width, but more conservatively
      const s = (Math.abs(b.x - a.x) * viewW * 1.15) / Math.max(modelW, 1e-4)
      // Shift down slightly so garment sits on torso, not floating at neck
      const yOff = viewH * 0.04
      return [{ x, y: y - yOff, rz: tilt(a, b), s }]
    }
    case "hips": {
      const a = mirror(L_HIP)
      const b = mirror(R_HIP)
      const m = mid(a, b)
      const { x, y } = world(m.x, m.y)
      const s = (Math.abs(b.x - a.x) * viewW * 1.1) / Math.max(modelW, 1e-4)
      return [{ x, y, rz: tilt(a, b), s }]
    }
    case "head": {
      const a = mirror(L_EAR)
      const b = mirror(R_EAR)
      const m = mid(a, b)
      const { x, y } = world(m.x, m.y)
      const s = (Math.abs(b.x - a.x) * viewW * 2.2) / Math.max(modelW, 1e-4)
      return [{ x, y: y + (modelH * s) / 2, rz: tilt(a, b), s }]
    }
    case "wrist": {
      const a = mirror(L_WRIST)
      const b = mirror(R_WRIST)
      const m = mid(a, b)
      const { x, y } = world(m.x, m.y)
      const s = (viewW * 0.05) / Math.max(modelW, 1e-4)
      return [{ x, y, rz: 0, s }]
    }
    case "feet": {
      const foot = (ankleIdx: number, toeIdx: number): Target => {
        const a = mirror(ankleIdx)
        const t = mirror(toeIdx)
        const { x, y } = world(a.x, a.y)
        const len = Math.hypot((t.x - a.x) * viewW, (t.y - a.y) * viewH)
        const s = (len * 1.3) / Math.max(modelW, 1e-4)
        return { x, y, rz: 0, s }
      }
      return [foot(L_ANKLE, L_FOOT_INDEX), foot(R_ANKLE, R_FOOT_INDEX)]
    }
  }
}
