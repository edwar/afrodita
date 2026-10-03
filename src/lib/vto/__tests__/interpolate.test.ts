import { describe, expect, it } from "vitest"
import { PoseBuffer, createPoseFrame } from "../interpolate"
import { LANDMARK_COUNT, POSE_STRIDE } from "../types"

const LENGTH = LANDMARK_COUNT * POSE_STRIDE

function fill(value: number): Float32Array {
  return new Float32Array(LENGTH).fill(value)
}

describe("PoseBuffer", () => {
  it("interpolates linearly between frames", () => {
    const buffer = new PoseBuffer()
    buffer.push(createPoseFrame(0, fill(0), fill(0)))
    buffer.push(createPoseFrame(100, fill(1), fill(2)))

    const outLandmarks = new Float32Array(LENGTH)
    const outWorld = new Float32Array(LENGTH)
    const fresh = buffer.sample(50, outLandmarks, outWorld)

    expect(fresh).toBe(true)
    expect(outLandmarks[0]).toBeCloseTo(0.5, 5)
    expect(outWorld[0]).toBeCloseTo(1, 5)
  })

  it("clamps to the latest frame when sampling in the future", () => {
    const buffer = new PoseBuffer()
    buffer.push(createPoseFrame(0, fill(0), fill(0)))
    buffer.push(createPoseFrame(100, fill(1), fill(1)))

    const outLandmarks = new Float32Array(LENGTH)
    const outWorld = new Float32Array(LENGTH)
    buffer.sample(90, outLandmarks, outWorld)
    expect(outLandmarks[0]).toBeCloseTo(0.9, 5)
  })

  it("reports stale data and still returns the last pose", () => {
    const buffer = new PoseBuffer()
    buffer.push(createPoseFrame(0, fill(0), fill(0)))
    buffer.push(createPoseFrame(100, fill(4), fill(4)))

    const outLandmarks = new Float32Array(LENGTH)
    const outWorld = new Float32Array(LENGTH)
    const fresh = buffer.sample(100 + 500, outLandmarks, outWorld, 300)

    expect(fresh).toBe(false)
    expect(outLandmarks[0]).toBe(4)
  })

  it("returns false with empty history", () => {
    const buffer = new PoseBuffer()
    const fresh = buffer.sample(0, new Float32Array(LENGTH), new Float32Array(LENGTH))
    expect(fresh).toBe(false)
  })

  it("evicts old frames beyond capacity", () => {
    const buffer = new PoseBuffer(3)
    for (let i = 0; i < 6; i++) buffer.push(createPoseFrame(i * 10, fill(i), fill(i)))
    expect(buffer.size).toBe(3)
  })
})
