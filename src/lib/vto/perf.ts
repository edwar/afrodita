/**
 * Device tiers and adaptive quality.
 *
 * Targets (plan §3.1):
 *  - high:   desktop / recent flagship — dpr up to 2, antialias, 20 Hz pose
 *  - medium: mid-range Android (floor target) — dpr 1.25, no AA, 15 Hz pose
 *  - low:    weak devices — dpr 1.0, no AA, 10 Hz pose, 2D fallback soon
 */
import type { QualityTier } from "./types"

export interface TierSettings {
  dpr: [number, number]
  antialias: boolean
  inferenceHz: number
  maxTrisPerGarment: number
  texturesMax: number
}

export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  high: {
    dpr: [1, 2],
    antialias: false,
    inferenceHz: 20,
    maxTrisPerGarment: 20000,
    texturesMax: 2048,
  },
  medium: {
    dpr: [1, 1.25],
    antialias: false,
    inferenceHz: 15,
    maxTrisPerGarment: 12000,
    texturesMax: 1024,
  },
  low: {
    dpr: [0.75, 1],
    antialias: false,
    inferenceHz: 10,
    maxTrisPerGarment: 6000,
    texturesMax: 1024,
  },
}

export interface DeviceInfo {
  deviceMemoryGB?: number
  coarsePointer: boolean
  hardwareConcurrency?: number
  gpuRenderer?: string
}

export function detectTier(info: DeviceInfo): QualityTier {
  const gpu = (info.gpuRenderer ?? "").toLowerCase()
  const isSoftware = /swiftshader|software|llvmpipe/.test(gpu)
  if (isSoftware) return "low"

  const memory = info.deviceMemoryGB ?? 4
  const cores = info.hardwareConcurrency ?? 4

  if (!info.coarsePointer) {
    // Desktop-class
    return memory >= 8 ? "high" : "medium"
  }
  // Mobile: floor target is mid-range Android
  return memory >= 6 && cores >= 6 ? "medium" : "low"
}

export interface AdaptiveQualityOptions {
  downgradeFps?: number
  upgradeFps?: number
  downgradeMs?: number
  upgradeMs?: number
}

/**
 * Rolling-window FPS monitor with hysteresis. `sample()` returns a new tier
 * when a sustained threshold crossing is detected, otherwise null.
 */
export class AdaptiveQuality {
  private readonly downgradeFps: number
  private readonly upgradeFps: number
  private readonly downgradeMs: number
  private readonly upgradeMs: number

  private belowSince: number | null = null
  private aboveSince: number | null = null

  constructor(
    private tier: QualityTier,
    options: AdaptiveQualityOptions = {}
  ) {
    this.downgradeFps = options.downgradeFps ?? 24
    this.upgradeFps = options.upgradeFps ?? 52
    this.downgradeMs = options.downgradeMs ?? 2500
    this.upgradeMs = options.upgradeMs ?? 6000
  }

  get current(): QualityTier {
    return this.tier
  }

  sample(fps: number, nowMs: number): QualityTier | null {
    const order: QualityTier[] = ["low", "medium", "high"]
    const index = order.indexOf(this.tier)

    if (fps < this.downgradeFps && index > 0) {
      if (this.belowSince === null) this.belowSince = nowMs
      this.aboveSince = null
      if (nowMs - this.belowSince >= this.downgradeMs) {
        this.tier = order[index - 1]
        this.reset()
        return this.tier
      }
    } else if (fps > this.upgradeFps && index < order.length - 1) {
      if (this.aboveSince === null) this.aboveSince = nowMs
      this.belowSince = null
      if (nowMs - this.aboveSince >= this.upgradeMs) {
        this.tier = order[index + 1]
        this.reset()
        return this.tier
      }
    } else {
      this.reset()
    }

    return null
  }

  private reset(): void {
    this.belowSince = null
    this.aboveSince = null
  }
}
