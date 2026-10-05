import { describe, expect, it } from "vitest"
import {
  dislikedKeys,
  lookKey,
  parseFeedback,
  recentVotes,
  sanitizeReasons,
  withVote,
  type Feedback,
  type VoteRecord,
} from "../feedback-core"

const record = (over: Partial<VoteRecord> = {}): VoteRecord => ({
  vote: "like",
  reasons: [],
  request: "",
  garments: ["a", "b"],
  at: "2026-10-01T00:00:00.000Z",
  ...over,
})

describe("lookKey", () => {
  it("identifies a look by its garments, in any order", () => {
    expect(lookKey([{ id: "b" }, { id: "a" }])).toBe(lookKey([{ id: "a" }, { id: "b" }]))
    expect(lookKey([{ id: "a" }])).not.toBe(lookKey([{ id: "a" }, { id: "b" }]))
  })
})

describe("sanitizeReasons", () => {
  it("keeps known reasons once, in a stable order", () => {
    expect(sanitizeReasons(["too_formal", "colors", "colors", "nope", 3])).toEqual([
      "colors",
      "too_formal",
    ])
  })
  it("tolerates anything that is not a list", () => {
    expect(sanitizeReasons(undefined)).toEqual([])
    expect(sanitizeReasons("colors")).toEqual([])
  })
})

describe("parseFeedback", () => {
  it("reads the current file", () => {
    const stored = { "a|b": record({ vote: "dislike", reasons: ["colors"] }) }
    expect(parseFeedback(JSON.stringify({ votes: stored }), null)).toEqual(stored)
  })

  it("adopts old likes as likes, until a vote is saved", () => {
    const parsed = parseFeedback(null, JSON.stringify({ looks: ["a|b", "c"] }))
    expect(Object.keys(parsed)).toEqual(["a|b", "c"])
    expect(parsed["a|b"]).toMatchObject({ vote: "like", garments: ["a", "b"] })
  })

  it("ignores the old file once the new one exists", () => {
    const parsed = parseFeedback(JSON.stringify({ votes: {} }), JSON.stringify({ looks: ["a"] }))
    expect(parsed).toEqual({})
  })

  it("survives damaged files and empty storage", () => {
    expect(parseFeedback("{not json", null)).toEqual({})
    expect(parseFeedback(null, "][")).toEqual({})
    expect(parseFeedback(null, null)).toEqual({})
  })
})

describe("withVote", () => {
  it("sets, replaces and clears without touching the original", () => {
    const original: Feedback = { "a|b": record() }
    const disliked = withVote(original, "a|b", record({ vote: "dislike" }))
    expect(disliked["a|b"].vote).toBe("dislike")
    expect(original["a|b"].vote).toBe("like")
    expect(withVote(disliked, "a|b", null)).toEqual({})
  })
})

describe("recentVotes / dislikedKeys", () => {
  const feedback: Feedback = {
    old: record({ at: "2026-09-01T00:00:00.000Z" }),
    new: record({ at: "2026-10-03T00:00:00.000Z" }),
    mid: record({ at: "2026-09-20T00:00:00.000Z" }),
    no1: record({ vote: "dislike" }),
  }
  it("returns the newest of one kind first, capped", () => {
    expect(recentVotes(feedback, "like", 2).map((v) => v.key)).toEqual(["new", "mid"])
  })
  it("collects every rejected look", () => {
    expect([...dislikedKeys(feedback)]).toEqual(["no1"])
  })
})
