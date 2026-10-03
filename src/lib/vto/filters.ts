/**
 * Signal filtering for pose data.
 *
 * One Euro Filter: adaptive low-pass that keeps latency low during fast motion
 * while removing jitter at rest. Applied per component (x, y, z) per landmark.
 */

const TWO_PI = Math.PI * 2

export interface OneEuroOptions {
  minCutoff?: number
  beta?: number
  dCutoff?: number
}

export class OneEuro {
  private readonly minCutoff: number
  private readonly beta: number
  private readonly dCutoff: number

  private xPrev = 0
  private dxPrev = 0
  private tPrev = 0
  private initialized = false

  constructor(options: OneEuroOptions = {}) {
    this.minCutoff = options.minCutoff ?? 1.5
    this.beta = options.beta ?? 0.02
    this.dCutoff = options.dCutoff ?? 1.0
  }

  reset(): void {
    this.initialized = false
  }

  filter(x: number, tMs: number): number {
    if (!Number.isFinite(x)) return this.xPrev
    if (!this.initialized) {
      this.initialized = true
      this.xPrev = x
      this.dxPrev = 0
      this.tPrev = tMs
      return x
    }

    const dt = Math.max((tMs - this.tPrev) / 1000, 1 / 240)
    this.tPrev = tMs

    const dx = (x - this.xPrev) / dt
    const aD = this.alpha(this.dCutoff, dt)
    const dxHat = aD * dx + (1 - aD) * this.dxPrev

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat)
    const a = this.alpha(cutoff, dt)
    const xHat = a * x + (1 - a) * this.xPrev

    this.xPrev = xHat
    this.dxPrev = dxHat
    return xHat
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (TWO_PI * cutoff)
    return 1 / (1 + tau / dt)
  }
}

/**
 * Smooths a full 33x4 pose buffer (x, y, z per landmark) with per-component
 * One Euro filters. Visibility passes through untouched (consumers gate on it).
 *
 * The smoother owns a persistent output buffer: `filter(src, ts)` returns it.
 */
export class PoseSmoother {
  private readonly filters: OneEuro[][]
  private readonly hasPrev: boolean[]
  private readonly outBuf = new Float32Array(33 * 4)
  private smoothWorld = true

  constructor(options: OneEuroOptions = {}) {
    this.filters = Array.from({ length: 33 }, () =>
      Array.from({ length: 3 }, () => new OneEuro(options))
    )
    this.hasPrev = new Array(33).fill(false)
  }

  setSmoothWorld(enabled: boolean): void {
    this.smoothWorld = enabled
  }

  reset(): void {
    for (const group of this.filters) for (const f of group) f.reset()
    this.hasPrev.fill(false)
    this.outBuf.fill(0)
  }

  /**
   * Filters `src` into the internal buffer and returns it.
   * When a landmark is occluded (visibility <= 0.5) its last value is held and
   * the raw outlier is discarded.
   */
  filter(src: Float32Array, tsMs: number): Float32Array {
    const out = this.outBuf
    for (let i = 0; i < 33; i++) {
      const o = i * 4
      const visibility = src[o + 3]
      const visible = visibility > 0.5

      if (visible || !this.hasPrev[i]) {
        out[o] = this.filters[i][0].filter(src[o], tsMs)
        out[o + 1] = this.filters[i][1].filter(src[o + 1], tsMs)
        out[o + 2] = this.smoothWorld
          ? this.filters[i][2].filter(src[o + 2], tsMs)
          : src[o + 2]
        if (visible) this.hasPrev[i] = true
      }
      // Occluded: keep held value from previous frame (no assignment needed),
      // and do not advance the filter state with unreliable data.

      out[o + 3] = visibility
    }
    return out
  }
}
