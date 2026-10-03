/**
 * Coordinate conversion: MediaPipe world landmarks -> canonical Three.js space.
 *
 * Canonical space (right-handed):
 *   +X = subject's right
 *   +Y = up
 *   +Z = toward the camera (subject facing the viewer)
 * Origin at the hip center. Units: meters.
 */
import { POSE_STRIDE, type Calibration, type Vec3 } from "./types"
import type { JointResolver } from "./skeleton"

export function applyCalibrationToPoint(
  x: number,
  y: number,
  z: number,
  cal: Calibration,
  out: Vec3
): Vec3 {
  const dx = x - cal.originX
  const dy = y - cal.originY
  const dz = z - cal.originZ
  const { m, scale } = cal
  out.x = scale * (m[0] * dx + m[1] * dy + m[2] * dz)
  out.y = scale * (m[3] * dx + m[4] * dy + m[5] * dz)
  out.z = scale * (m[6] * dx + m[7] * dy + m[8] * dz)
  return out
}

export function applyCalibrationToLandmark(
  src: Float32Array,
  index: number,
  cal: Calibration,
  out: Vec3
): Vec3 {
  const o = index * POSE_STRIDE
  return applyCalibrationToPoint(src[o], src[o + 1], src[o + 2], cal, out)
}

/**
 * Resolves joints from a pose buffer and converts them to canonical space
 * in place. Zero allocations after first call.
 */
export function resolveCanonicalJoints(
  src: Float32Array,
  resolver: JointResolver,
  cal: Calibration,
  out: Map<string, Vec3>,
  visibility?: Float32Array
): Map<string, Vec3> {
  resolver.resolve(src, out, visibility)
  for (const point of out.values()) {
    applyCalibrationToPoint(point.x, point.y, point.z, cal, point)
  }
  return out
}

/** Element-wise average of world-landmark samples (used by T-pose calibration). */
export function averagePoseSamples(samples: Float32Array[], out: Float32Array): Float32Array {
  out.fill(0)
  for (const sample of samples) {
    for (let i = 0; i < out.length; i++) out[i] += sample[i]
  }
  const inv = 1 / Math.max(samples.length, 1)
  for (let i = 0; i < out.length; i++) out[i] *= inv
  return out
}
