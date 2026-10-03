import { describe, expect, it } from "vitest"
import { JointResolver } from "../skeleton"
import { makeWorldLandmarks } from "./fixtures"

describe("JointResolver", () => {
  it("resolves joints from world landmarks deterministically", () => {
    const resolver = new JointResolver()
    const output = JointResolver.createOutput()
    resolver.resolve(makeWorldLandmarks(), output)

    const hip = output.get("hip_center")!
    expect(hip.x).toBeCloseTo(0)
    expect(hip.y).toBeCloseTo(0.16)

    const shoulderL = output.get("shoulder_l")!
    expect(shoulderL.x).toBeCloseTo(-0.18)
    expect(shoulderL.y).toBeCloseTo(0.46)

    const neck = output.get("neck_base")!
    // chest_center = mid(11,12) = (0, 0.46, 0); ear_center = (0, 0.62, 0)
    // lerp(chest_center, ear_center, 0.35) = 0.46 + 0.16 * 0.35 = 0.516
    expect(neck.y).toBeCloseTo(0.46 + (0.62 - 0.46) * 0.35, 5)

    const headTop = output.get("head_top")!
    // extrapolate(neck_base, ear_center, 1.6)
    const expectedTop = neck.y + (0.62 - neck.y) * 1.6
    expect(headTop.y).toBeCloseTo(expectedTop, 5)
  })

  it("produces stable output with zero per-frame allocation", () => {
    const resolver = new JointResolver()
    const output = JointResolver.createOutput()
    const src = makeWorldLandmarks()

    resolver.resolve(src, output)
    const first = output.get("chest_center")!
    const ref = first

    src[11 * 4] = -0.3
    resolver.resolve(src, output)
    const second = output.get("chest_center")!

    expect(second).toBe(ref)
  })
})
