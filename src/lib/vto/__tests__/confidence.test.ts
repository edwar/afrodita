import { describe, expect, it } from "vitest"
import { ConfidenceGate, poseConfidence } from "../confidence"
import { LANDMARK_COUNT, POSE_STRIDE } from "../types"

function makeWorld(visibility: number): Float32Array {
  const buffer = new Float32Array(LANDMARK_COUNT * POSE_STRIDE)
  for (let i = 0; i < LANDMARK_COUNT; i++) buffer[i * POSE_STRIDE + 3] = visibility
  return buffer
}

const KEY_LANDMARKS = [7, 8, 11, 12, 23, 24, 25, 26]

describe("poseConfidence", () => {
  it("averages the key landmark visibilities", () => {
    const buffer = makeWorld(1)
    for (let k = 0; k < KEY_LANDMARKS.length / 2; k++) {
      buffer[KEY_LANDMARKS[k] * POSE_STRIDE + 3] = 0
    }
    expect(poseConfidence(buffer)).toBeCloseTo(0.5, 5)
  })

  it("returns 1 for a fully visible pose", () => {
    expect(poseConfidence(makeWorld(1))).toBeCloseTo(1, 5)
  })
})

describe("ConfidenceGate", () => {
  it("freezes below the threshold and resumes with hysteresis", () => {
    const gate = new ConfidenceGate(0.55, 0.7)
    expect(gate.update(0.9)).toBe(true)

    expect(gate.update(0.5)).toBe(false)
    expect(gate.isFrozen).toBe(true)

    // Still frozen between the freeze and resume thresholds
    expect(gate.update(0.6)).toBe(false)

    // Resumes only above resumeAbove
    expect(gate.update(0.75)).toBe(true)

    // Stays live down to freezeBelow
    expect(gate.update(0.6)).toBe(true)
    expect(gate.update(0.5)).toBe(false)
  })

  it("supports reset", () => {
    const gate = new ConfidenceGate()
    gate.update(0.1)
    expect(gate.isFrozen).toBe(true)
    gate.reset()
    expect(gate.isFrozen).toBe(false)
  })
})
