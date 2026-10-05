import { afterEach, describe, expect, it, vi } from "vitest"
import { GeminiProvider } from "../providers/gemini"
import type { WardrobeItem } from "../types"

const wardrobe: WardrobeItem[] = [
  { id: "a1", name: "Camisa", category: "camisa", color: "#000", imageUrl: "/a.jpg" },
]
const request = {
  wardrobe,
  messages: [{ role: "user" as const, content: "algo casual" }],
}

const reply = (text: string, status = 200) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { totalTokenCount: 5 } }),
    { status }
  )
const GOOD = JSON.stringify({ type: "message", message: "hola" })

afterEach(() => vi.unstubAllGlobals())

describe("GeminiProvider JSON handling", () => {
  it("asks for strict JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(GOOD))
    vi.stubGlobal("fetch", fetchMock)
    await new GeminiProvider().chat(request)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.generationConfig.responseMimeType).toBe("application/json")
  })

  it("retries once when the answer is not valid JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply('{"type": "outfit", "options": [{"title": "x" "oops"}]}'))
      .mockResolvedValueOnce(reply(GOOD))
    vi.stubGlobal("fetch", fetchMock)
    const result = await new GeminiProvider().chat(request)
    expect(result).toMatchObject({ type: "message", message: "hola" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("gives up after the second bad answer so the orchestrator can fall back", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply("not json at all"))
    vi.stubGlobal("fetch", fetchMock)
    await expect(new GeminiProvider().chat(request)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry an API error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply("", 503))
    vi.stubGlobal("fetch", fetchMock)
    await expect(new GeminiProvider().chat(request)).rejects.toThrow(/Gemini API error/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
