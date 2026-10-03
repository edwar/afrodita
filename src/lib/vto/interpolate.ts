/**
 * Temporal interpolation: pose inference runs at 10-20 Hz while rendering
 * runs at 60 Hz. PoseBuffer keeps a short history of timestamped poses and
 * samples them at render time (with a fixed interpolation delay so we never
 * extrapolate).
 */
import { LANDMARK_COUNT, POSE_STRIDE, type PoseFrame } from "./types"

const FLAT_LENGTH = LANDMARK_COUNT * POSE_STRIDE

export class PoseBuffer {
  private readonly frames: PoseFrame[] = []
  private readonly capacity: number

  constructor(capacity = 8) {
    this.capacity = capacity
  }

  push(frame: PoseFrame): void {
    this.frames.push(frame)
    if (this.frames.length > this.capacity) this.frames.shift()
  }

  clear(): void {
    this.frames.length = 0
  }

  get latest(): PoseFrame | null {
    return this.frames.length > 0 ? this.frames[this.frames.length - 1] : null
  }

  get size(): number {
    return this.frames.length
  }

  /**
   * Samples the pose at `renderTsMs`. Output buffers must be length 132.
   * Returns true when the sample is fresh; when stale it still copies the
   * latest pose (so the caller can freeze) and returns false.
   */
  sample(
    renderTsMs: number,
    outLandmarks: Float32Array,
    outWorld: Float32Array,
    maxStaleMs = 300
  ): boolean {
    const frames = this.frames
    if (frames.length === 0) {
      outLandmarks.fill(0)
      outWorld.fill(0)
      return false
    }

    const last = frames[frames.length - 1]
    const fresh = renderTsMs - last.tsMs <= maxStaleMs
    if (!fresh) {
      outLandmarks.set(last.landmarks)
      outWorld.set(last.world)
      return false
    }

    if (frames.length === 1 || renderTsMs >= last.tsMs) {
      outLandmarks.set(last.landmarks)
      outWorld.set(last.world)
      return true
    }

    // Find the pair (a, b) with a.ts <= renderTs <= b.ts
    let a = frames[0]
    let b = last
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].tsMs <= renderTsMs && frames[i + 1].tsMs >= renderTsMs) {
        a = frames[i]
        b = frames[i + 1]
        break
      }
    }

    const span = b.tsMs - a.tsMs
    const alpha = span > 1e-6 ? Math.min(1, Math.max(0, (renderTsMs - a.tsMs) / span)) : 1

    for (let i = 0; i < FLAT_LENGTH; i++) {
      const av = a.landmarks[i]
      const bv = b.landmarks[i]
      outLandmarks[i] = av + (bv - av) * alpha
      const aw = a.world[i]
      const bw = b.world[i]
      outWorld[i] = aw + (bw - aw) * alpha
    }

    return true
  }
}

export function createPoseFrame(
  tsMs: number,
  landmarks: Float32Array,
  world: Float32Array
): PoseFrame {
  return { tsMs, landmarks, world }
}
