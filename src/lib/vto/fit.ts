/**
 * Body fitting: matches garment proportions to the user's real limb lengths.
 *
 * MVP strategy: per-bone stretch ratio (user segment length / garment rest
 * length), clamped to a safe range to avoid skinning artifacts, optionally
 * damped so it converges over a few seconds instead of snapping.
 */
import type * as THREE from "three"
import type { SkeletonRestPose } from "./retarget"
import type { Vec3 } from "./types"

export const MIN_FIT_SCALE = 0.8
export const MAX_FIT_SCALE = 1.25

export function clampFitScale(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1
  return Math.min(MAX_FIT_SCALE, Math.max(MIN_FIT_SCALE, ratio))
}

/**
 * Computes per-bone length ratios from observed joints.
 * Bones without rest length (leaves) are skipped.
 */
export function computeLimbScales(
  rest: SkeletonRestPose,
  joints: Map<string, Vec3>
): Map<string, number> {
  const scales = new Map<string, number>()

  for (const def of rest.order) {
    const info = rest.info.get(def.name)
    if (!info || info.restLength < 1e-6) continue
    const from = joints.get(def.from)
    const to = joints.get(def.to)
    if (!from || !to) continue
    const userLength = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z)
    scales.set(def.name, clampFitScale(userLength / info.restLength))
  }

  return scales
}

/**
 * Applies limb scales to bones with exponential damping.
 * `damping` in [0,1]: 0 = frozen, 1 = snap instantly.
 */
export function applyLimbScales(
  bones: Map<string, THREE.Bone>,
  scales: Map<string, number>,
  damping = 0.08
): void {
  for (const [name, ratio] of scales) {
    const bone = bones.get(name)
    if (!bone) continue
    const current = bone.scale.y
    const next = current + (ratio - current) * damping
    bone.scale.set(next, next, next)
  }
}
