import { describe, expect, it } from "vitest"
import { OneEuro, PoseSmoother } from "../filters"
import { makeWorldLandmarks } from "./fixtures"

describe("OneEuro", () => {
  it("converges to a constant signal", () => {
    const filter = new OneEuro()
    let value = 0
    for (let i = 0; i < 120; i++) {
      value = filter.filter(5, i * (1000 / 60))
    }
    expect(value).toBeCloseTo(5, 2)
  })

  it("smooths a noisy signal", () => {
    const filter = new OneEuro()
    const raw: number[] = []
    const filtered: number[] = []
    for (let i = 0; i < 200; i++) {
      const noise = i % 2 === 0 ? 0.05 : -0.05
      const sample = 1 + noise
      raw.push(sample)
      filtered.push(filter.filter(sample, i * (1000 / 60)))
    }
    const variance = (values: number[]) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
    }
    expect(variance(filtered)).toBeLessThan(variance(raw))
  })

  it("ignores non-finite input", () => {
    const filter = new OneEuro()
    filter.filter(3, 0)
    const out = filter.filter(Number.NaN, 16)
    expect(out).toBe(3)
  })
})

describe("PoseSmoother", () => {
  it("holds the last value when a landmark is occluded", () => {
    const smoother = new PoseSmoother()
    const visible = makeWorldLandmarks()
    smoother.filter(visible, 0)

    const occluded = makeWorldLandmarks({
      11: [10, 10, 10], // wild jump while occluded
    })
    occluded[11 * 4 + 3] = 0.1

    const out = smoother.filter(occluded, 16)
    expect(out[11 * 4]).toBeCloseTo(-0.18, 1)
    expect(out[11 * 4 + 3]).toBeCloseTo(0.1)
  })

  it("returns the same buffer (zero allocation)", () => {
    const smoother = new PoseSmoother()
    const first = smoother.filter(makeWorldLandmarks(), 0)
    const second = smoother.filter(makeWorldLandmarks(), 16)
    expect(second).toBe(first)
  })
})
