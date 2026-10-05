import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/storage", () => ({}))

import { lookKey, withLike } from "../likes"

describe("lookKey", () => {
  it("identifies a look by its garments, in any order", () => {
    expect(lookKey([{ id: "b" }, { id: "a" }])).toBe(lookKey([{ id: "a" }, { id: "b" }]))
    expect(lookKey([{ id: "a" }])).not.toBe(lookKey([{ id: "a" }, { id: "b" }]))
  })
})

describe("withLike", () => {
  it("adds and removes without touching the original set", () => {
    const likes = new Set(["a|b"])
    const added = withLike(likes, "c", true)
    expect([...added].sort()).toEqual(["a|b", "c"])
    expect([...withLike(added, "a|b", false)]).toEqual(["c"])
    expect([...likes]).toEqual(["a|b"])
  })
})
