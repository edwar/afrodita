/**
 * Pose tracking confidence and gating.
 *
 * MediaPipe landmark visibility drops when limbs leave the frame or the person
 * turns side-on; applying noisy landmarks in those moments makes the rig
 * thrash. ConfidenceGate freezes pose updates until tracking is stable again,
 * with hysteresis to avoid flickering between frozen and updating.
 */

/** Key landmarks used for the confidence score (shoulders, hips, ears, knees). */
const KEY_LANDMARKS = [7, 8, 11, 12, 23, 24, 25, 26]

/** Average visibility of the key landmarks (0..1). */
export function poseConfidence(world: Float32Array): number {
  let sum = 0
  for (const index of KEY_LANDMARKS) {
    sum += world[index * 4 + 3]
  }
  return sum / KEY_LANDMARKS.length
}

export class ConfidenceGate {
  private frozen = false

  constructor(
    private readonly freezeBelow = 0.55,
    private readonly resumeAbove = 0.7
  ) {}

  /**
   * Returns true when the pose should be applied. Once frozen, stays frozen
   * until confidence climbs above `resumeAbove` (hysteresis).
   */
  update(confidence: number): boolean {
    if (this.frozen) {
      if (confidence >= this.resumeAbove) {
        this.frozen = false
      }
    } else if (confidence < this.freezeBelow) {
      this.frozen = true
    }
    return !this.frozen
  }

  get isFrozen(): boolean {
    return this.frozen
  }

  reset(): void {
    this.frozen = false
  }
}
