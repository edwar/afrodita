import { describe, expect, it } from "vitest"
import {
  buildConversationalSystemPrompt,
  buildOutfitSystemPrompt,
  buildWardrobeList,
  mapItemIds,
} from "../prompts"
import type { WardrobeItem } from "../types"

const closet: WardrobeItem[] = [
  { id: "cm1shirt", name: "Camisa negra", category: "camisa", color: "#000", imageUrl: "/a.jpg" },
  { id: "cm2jeans", name: "Jean azul", category: "pantalon", color: "#00f", imageUrl: "/b.jpg" },
]

describe("buildWardrobeList", () => {
  it("gives the model the id of every garment", () => {
    const list = buildWardrobeList(closet)
    expect(list).toContain("id: cm1shirt | Camisa negra")
    expect(list).toContain("id: cm2jeans | Jean azul")
  })
})

describe("outfit prompts", () => {
  it.each([buildConversationalSystemPrompt(), buildOutfitSystemPrompt()])(
    "require real ids and forbid invented garments",
    (prompt) => {
      expect(prompt).toMatch(/copia EXACTAMENTE el valor "id"/)
      expect(prompt).toMatch(/Nunca menciones ni inventes prendas/)
      // no placeholder ids a model could echo back
      expect(prompt).not.toContain('"id1"')
    }
  )
})

describe("mapItemIds", () => {
  it("links ids, ignoring the ones the model made up", () => {
    expect(mapItemIds(["cm2jeans", "id1", "nope"], closet).map((i) => i.id)).toEqual([
      "cm2jeans",
    ])
  })

  it("accepts a garment name when the model returns it instead of the id", () => {
    expect(mapItemIds([" camisa NEGRA "], closet).map((i) => i.id)).toEqual(["cm1shirt"])
  })

  it("returns nothing for a missing or malformed list", () => {
    expect(mapItemIds(undefined, closet)).toEqual([])
    expect(mapItemIds("cm1shirt" as unknown as string[], closet)).toEqual([])
  })
})
