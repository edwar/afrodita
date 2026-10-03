/**
 * Per-frame pose source shared by try-on layers.
 *
 * Consumers call `sync(now)` inside `useFrame`; the first caller in a frame
 * samples the interpolated pose (worker -> PoseBuffer) and the rest reuse it.
 * Zero allocations after construction.
 */
import { LANDMARK_COUNT, POSE_STRIDE } from "@/lib/vto/types"

export interface LandmarkLike {
  x: number
  y: number
  z: number
  visibility: number
}

const BUFFER_LENGTH = LANDMARK_COUNT * POSE_STRIDE

export class PoseSource {
  readonly landmarks: LandmarkLike[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }))
  readonly world = new Float32Array(BUFFER_LENGTH)
  valid = false

  private readonly flat = new Float32Array(BUFFER_LENGTH)
  private lastSync = -1

  constructor(
    public sampleFn: (
      nowMs: number,
      outLandmarks: Float32Array,
      outWorld: Float32Array
    ) => boolean,
    public latestFn: () => Float32Array | null,
    /** Called once per new sampled frame with the smoothed world buffer. */
    private readonly onFrame?: (world: Float32Array) => void
  ) {}

  sync(nowMs: number): void {
    if (nowMs === this.lastSync) return
    this.lastSync = nowMs

    const fresh = this.sampleFn(nowMs, this.flat, this.world)
    for (let i = 0; i < 33; i++) {
      const landmark = this.landmarks[i]
      const o = i * POSE_STRIDE
      landmark.x = this.flat[o]
      landmark.y = this.flat[o + 1]
      landmark.z = this.flat[o + 2]
      landmark.visibility = this.flat[o + 3]
    }
    if (fresh || this.latestFn() !== null) this.valid = true
    if (this.valid) this.onFrame?.(this.world)
  }
}
