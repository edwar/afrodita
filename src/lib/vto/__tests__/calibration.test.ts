import { describe, expect, it } from "vitest"
import {
  CalibrationGatherer,
  buildCalibrationFromWorld,
  estimateFovY,
  poseLooksSane,
} from "../calibration"
import { applyCalibrationToPoint } from "../coords"
import { JointResolver } from "../skeleton"
import { makeWorldLandmarks } from "./fixtures"

describe("estimateFovY", () => {
  it("derives vertical FOV from horizontal FOV and aspect", () => {
    const fovY = estimateFovY(640, 480, 65)
    const expected = 2 * Math.atan(Math.tan((65 * Math.PI) / 180 / 2) / (640 / 480))
    expect(fovY).toBeCloseTo(expected, 6)
    expect(fovY).toBeGreaterThan(0.7)
    expect(fovY).toBeLessThan(1.1)
  })
})

describe("poseLooksSane", () => {
  it("accepts a metric T-pose", () => {
    expect(poseLooksSane(makeWorldLandmarks())).toBe(true)
  })

  it("rejects low-visibility poses", () => {
    const buffer = makeWorldLandmarks()
    for (let i = 0; i < 33; i++) buffer[i * 4 + 3] = 0.1
    expect(poseLooksSane(buffer)).toBe(false)
  })

  it("rejects implausible metric sizes", () => {
    const buffer = makeWorldLandmarks({
      11: [0, 0, 0],
      12: [0.02, 0, 0], // 2 cm shoulder width
    })
    expect(poseLooksSane(buffer)).toBe(false)
  })
})

describe("buildCalibrationFromWorld", () => {
  it("maps a canonical T-pose to the identity basis", () => {
    const resolver = new JointResolver()
    const cal = buildCalibrationFromWorld(makeWorldLandmarks(), resolver, 0.9)

    expect(cal.valid).toBe(true)
    expect(cal.m[0]).toBeCloseTo(1, 5)
    expect(cal.m[4]).toBeCloseTo(1, 5)
    expect(cal.m[8]).toBeCloseTo(1, 5)
    expect(Math.abs(cal.m[1])).toBeLessThan(1e-5)

    const out = { x: 0, y: 0, z: 0 }
    applyCalibrationToPoint(0.18, 0.46, 0, cal, out)
    expect(out.x).toBeCloseTo(0.18, 5)
    expect(out.y).toBeCloseTo(0.46, 5)
    expect(out.z).toBeCloseTo(0, 5)
  })

  it("flips the X axis when mirrorX is enabled", () => {
    const resolver = new JointResolver()
    const cal = buildCalibrationFromWorld(makeWorldLandmarks(), resolver, 0.9, true)
    expect(cal.valid).toBe(true)
    expect(cal.m[0]).toBeCloseTo(-1, 5)
    expect(cal.m[1]).toBeCloseTo(0, 5)

    const out = { x: 0, y: 0, z: 0 }
    applyCalibrationToPoint(0.18, 0.46, 0, cal, out)
    expect(out.x).toBeCloseTo(-0.18, 5)
  })

  it("returns an invalid calibration for unusable poses", () => {
    const resolver = new JointResolver()
    const buffer = makeWorldLandmarks()
    for (let i = 0; i < 33; i++) buffer[i * 4 + 3] = 0
    const cal = buildCalibrationFromWorld(buffer, resolver, 0.9)
    expect(cal.valid).toBe(false)
  })
})

describe("CalibrationGatherer", () => {
  it("produces a valid calibration after enough sane samples", () => {
    const resolver = new JointResolver()
    const gatherer = new CalibrationGatherer(resolver, () => 0.9, {
      maxSamples: 16,
    })
    for (let i = 0; i < 16; i++) gatherer.push(makeWorldLandmarks())

    expect(gatherer.calibration).not.toBeNull()
    expect(gatherer.calibration?.valid).toBe(true)
    expect(gatherer.isCollecting).toBe(false)
  })

  it("ignores unusable poses", () => {
    const resolver = new JointResolver()
    const gatherer = new CalibrationGatherer(resolver, () => 0.9, {
      maxSamples: 16,
    })
    const bad = makeWorldLandmarks()
    for (let i = 0; i < 33; i++) bad[i * 4 + 3] = 0
    for (let i = 0; i < 32; i++) gatherer.push(bad)

    expect(gatherer.calibration).toBeNull()
    expect(gatherer.isCollecting).toBe(false)
  })

  it("reports collection progress", () => {
    const resolver = new JointResolver()
    const gatherer = new CalibrationGatherer(resolver, () => 0.9, {
      maxSamples: 16,
    })
    gatherer.push(makeWorldLandmarks())
    gatherer.push(makeWorldLandmarks())
    expect(gatherer.isCollecting).toBe(true)
    expect(gatherer.progress).toBeCloseTo(2 / 16, 5)
  })
})
