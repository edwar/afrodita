import { describe, expect, it } from "vitest"
import { buildAnchorsSection, ensureAnchors } from "../prompts"
import type { OutfitOption, WardrobeItem } from "../types"

const item = (id: string, category: string): WardrobeItem => ({
  id,
  name: id,
  category,
  color: "#000",
  imageUrl: `/${id}.jpg`,
})
const shirt = item("shirt", "camisa")
const otherShirt = item("other-shirt", "camisa")
const jeans = item("jeans", "pantalon")
const boots = item("boots", "zapato")
const watch = item("watch", "accesorio")
const glasses = item("glasses", "accesorio")

const option = (items: WardrobeItem[]): OutfitOption => ({
  title: "Look",
  description: "",
  items,
})
const ids = (o: OutfitOption) => o.items.map((i) => i.id)

describe("ensureAnchors", () => {
  it("adds the chosen garments to every option that left them out", () => {
    const result = ensureAnchors([option([jeans]), option([boots])], [shirt])
    expect(result.map(ids)).toEqual([["shirt", "jeans"], ["shirt", "boots"]])
  })

  it("does not duplicate a garment the option already had", () => {
    expect(ids(ensureAnchors([option([shirt, jeans])], [shirt])[0])).toEqual(["shirt", "jeans"])
  })

  it("replaces another garment of the same category as a chosen one", () => {
    expect(ids(ensureAnchors([option([otherShirt, jeans])], [shirt])[0])).toEqual([
      "shirt",
      "jeans",
    ])
  })

  it("lets several accessories coexist", () => {
    expect(ids(ensureAnchors([option([glasses, boots])], [watch])[0])).toEqual([
      "watch",
      "glasses",
      "boots",
    ])
  })

  it("handles two chosen garments", () => {
    expect(ids(ensureAnchors([option([otherShirt])], [shirt, jeans])[0])).toEqual([
      "shirt",
      "jeans",
    ])
  })

  it("leaves the options alone when nothing was chosen", () => {
    const options = [option([jeans])]
    expect(ensureAnchors(options, [])).toBe(options)
  })
})

describe("buildAnchorsSection", () => {
  it("is empty without chosen garments", () => {
    expect(buildAnchorsSection(undefined)).toBe("")
    expect(buildAnchorsSection([])).toBe("")
  })

  it("names the garments by id and makes them mandatory", () => {
    const section = buildAnchorsSection([shirt, jeans])
    expect(section).toContain("id: shirt")
    expect(section).toContain("id: jeans")
    expect(section).toMatch(/deben incluirlas TODAS/)
  })
})
