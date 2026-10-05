import { describe, expect, it } from "vitest"
import { fullRect, outputSize, toSourceRect } from "../image-crop"

describe("toSourceRect", () => {
  it("scales a crop on the displayed image up to the real pixels", () => {
    // shown at 400x300, really 2000x1500 (x5)
    expect(
      toSourceRect(
        { x: 40, y: 30, width: 200, height: 150 },
        { width: 400, height: 300 },
        { width: 2000, height: 1500 }
      )
    ).toEqual({ x: 200, y: 150, width: 1000, height: 750 })
  })

  it("keeps the crop's shape when the image is shown at another scale per axis", () => {
    const rect = toSourceRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 200, height: 400 },
      { width: 1000, height: 1000 }
    )
    expect(rect).toEqual({ x: 0, y: 0, width: 500, height: 250 })
  })

  it("never leaves the image, even when the crop overshoots by a pixel", () => {
    const rect = toSourceRect(
      { x: -3, y: 290, width: 420, height: 40 },
      { width: 400, height: 300 },
      { width: 800, height: 600 }
    )
    expect(rect.x).toBe(0)
    expect(rect.y + rect.height).toBeLessThanOrEqual(600)
    expect(rect.x + rect.width).toBeLessThanOrEqual(800)
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })

  it("returns whole pixels and at least one", () => {
    const rect = toSourceRect(
      { x: 10.4, y: 10.6, width: 0.2, height: 0.2 },
      { width: 100, height: 100 },
      { width: 333, height: 333 }
    )
    for (const value of Object.values(rect)) expect(Number.isInteger(value)).toBe(true)
    expect(rect.width).toBeGreaterThanOrEqual(1)
    expect(rect.height).toBeGreaterThanOrEqual(1)
  })
})

describe("fullRect", () => {
  it("covers the whole image", () => {
    expect(fullRect({ width: 640, height: 480 })).toEqual({ x: 0, y: 0, width: 640, height: 480 })
  })
})

describe("outputSize", () => {
  it("scales down so the longest side fits, keeping the shape", () => {
    expect(outputSize({ width: 3200, height: 2400 }, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(outputSize({ width: 1000, height: 4000 }, 2000)).toEqual({ width: 500, height: 2000 })
  })

  it("never scales up", () => {
    expect(outputSize({ width: 300, height: 200 }, 1600)).toEqual({ width: 300, height: 200 })
  })
})
