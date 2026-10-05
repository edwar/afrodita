import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/storage", () => ({}))
vi.mock("sharp", () => ({ default: vi.fn() }))

import { describeLook, lookHash, photoTag, resolveLook, type LookIndex } from "../looks"

const shirt = { id: "a", imageUrl: "/api/images/a.jpg" }
const jeans = { id: "b", imageUrl: "/api/images/b.jpg" }

describe("lookHash", () => {
  it("is the same for the same garments, in any order", () => {
    expect(lookHash([shirt, jeans])).toBe(lookHash([jeans, shirt]))
  })

  it("changes when the garments or a garment picture change", () => {
    const base = lookHash([shirt, jeans])
    expect(lookHash([shirt])).not.toBe(base)
    expect(lookHash([{ ...shirt, imageUrl: "/api/images/new.jpg" }, jeans])).not.toBe(base)
  })
})

/** An index holding one image of [shirt, jeans], made from photo `tag`. */
function indexWith(photoVersion: string | null, tag: string): LookIndex {
  const stored = { key: "k", version: '"etag-1"', lastModified: 1, photoTag: tag }
  return { photoVersion, stored: new Map([[lookHash([shirt, jeans]), [stored]]]) }
}

describe("resolveLook", () => {
  it("uses the look made from the current photo", async () => {
    const index = indexWith("photo-1", photoTag("photo-1"))
    const state = await resolveLook("user", [shirt, jeans], index)
    expect(state.image?.current).toBe(true)
    expect(describeLook("opt", state)).toMatchObject({ photo: true, outdated: false })
  })

  it("keeps showing a look after the photo is deleted", async () => {
    const state = await resolveLook("user", [shirt, jeans], indexWith(null, "anything"))
    expect(state.photo).toBe(false)
    expect(state.image?.key).toBe("k")
    expect(describeLook("opt", state)).toMatchObject({
      photo: false,
      outdated: true,
      imageUrl: expect.stringContaining("/api/tryon/looks/opt/image?v="),
    })
  })

  it("marks a look made from an earlier photo as outdated", async () => {
    const state = await resolveLook("user", [shirt, jeans], indexWith("photo-2", "old-tag"))
    expect(state.photo).toBe(true)
    expect(state.image?.current).toBe(false)
    expect(describeLook("opt", state).outdated).toBe(true)
  })

  it("reports nothing for a look never generated", async () => {
    const state = await resolveLook("user", [shirt], {
      photoVersion: "photo-1",
      stored: new Map(),
    })
    expect(state.image).toBeNull()
    expect(describeLook("opt", state)).toEqual({ photo: true, imageUrl: null, outdated: false })
  })
})
