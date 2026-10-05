import { afterEach, describe, expect, it, vi } from "vitest"
import {
  TryOnError,
  buildTryOnRequest,
  closestAspectRatio,
  extractImage,
  generateTryOnImage,
} from "../gemini"

const person = { bytes: Buffer.from("person"), mimeType: "image/jpeg" }
const shirt = {
  bytes: Buffer.from("shirt"),
  mimeType: "image/jpeg",
  name: "Camisa negra",
  category: "camisa",
}
const trousers = { ...shirt, bytes: Buffer.from("jeans"), name: "Jeans", category: "pantalon" }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("buildTryOnRequest", () => {
  it("sends the person first, then every garment with its label", () => {
    const { contents, generationConfig } = buildTryOnRequest(person, [shirt, trousers])
    const parts = contents[0].parts as { text?: string; inlineData?: { data: string } }[]

    const images = parts.filter((part) => part.inlineData).map((part) => part.inlineData!.data)
    expect(images).toEqual(
      [person, shirt, trousers].map((item) => item.bytes.toString("base64"))
    )
    const text = parts.map((part) => part.text ?? "").join("\n")
    expect(text).toContain('shirt / top ("Camisa negra")')
    expect(text).toContain('trousers ("Jeans")')
    expect(text).toMatch(/photo EDITING task/)
    expect(text).toMatch(/Never draw a different person/)
    // clothing wins over visible skin: a sleeve is never cut to show a tattoo
    expect(text).toMatch(/Never cut, shorten, roll up, open or make a hole/)
    expect(text).toMatch(/under a garment are hidden by it/)
    expect(generationConfig.responseModalities).toContain("IMAGE")
  })
})

describe("closestAspectRatio", () => {
  it("keeps the photo's framing", () => {
    expect(closestAspectRatio(428, 612)).toBe("2:3")
    expect(closestAspectRatio(1080, 1920)).toBe("9:16")
    expect(closestAspectRatio(1200, 1600)).toBe("3:4")
    expect(closestAspectRatio(1000, 1000)).toBe("1:1")
    expect(closestAspectRatio(1600, 1200)).toBe("4:3")
  })

  it("is sent to the model when given", () => {
    const body = buildTryOnRequest(person, [shirt], "2:3")
    expect(body.generationConfig).toMatchObject({ imageConfig: { aspectRatio: "2:3" } })
    expect(buildTryOnRequest(person, [shirt]).generationConfig).not.toHaveProperty("imageConfig")
  })
})

describe("extractImage", () => {
  it("returns the image part, skipping text", () => {
    const image = extractImage({
      candidates: [
        {
          content: {
            parts: [
              { text: "Here you go" },
              { inlineData: { mimeType: "image/png", data: Buffer.from("png").toString("base64") } },
            ],
          },
        },
      ],
    })
    expect(image.mimeType).toBe("image/png")
    expect(image.bytes.toString()).toBe("png")
  })

  it("explains a blocked photo differently from an empty answer", () => {
    expect(() => extractImage({ promptFeedback: { blockReason: "SAFETY" } })).toThrow(
      /otra foto/
    )
    expect(() => extractImage({ candidates: [{ finishReason: "STOP" }] })).toThrow(
      /no devolvió/
    )
  })
})

describe("generateTryOnImage", () => {
  it("refuses to call the API without a real key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "your-gemini-key")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(generateTryOnImage(person, [shirt])).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("maps a quota error to a 429 the UI can show", async () => {
    vi.stubEnv("GEMINI_API_KEY", "real-key")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 })
      )
    )
    const error = await generateTryOnImage(person, [shirt]).catch((e) => e)
    expect(error).toBeInstanceOf(TryOnError)
    expect(error.status).toBe(429)
  })

  it("tells a free plan without image quota apart from a used-up quota", async () => {
    vi.stubEnv("GEMINI_API_KEY", "real-key")
    const message =
      "You exceeded your current quota.\n* Quota exceeded for metric: " +
      "generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: x"
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message } }), { status: 429 })
      )
    )
    const error = await generateTryOnImage(person, [shirt]).catch((e) => e)
    expect(error.status).toBe(402)
    expect(error.message).toMatch(/plan gratuito/)
  })

  it("posts to the configured model with the key in a header", async () => {
    vi.stubEnv("GEMINI_API_KEY", "real-key")
    vi.stubEnv("GEMINI_IMAGE_MODEL", "some-image-model")
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "aGk=" } }] } }],
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const image = await generateTryOnImage(person, [shirt])
    expect(image.bytes.toString()).toBe("hi")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain("/models/some-image-model:generateContent")
    expect(url).not.toContain("real-key")
    expect(init.headers["x-goog-api-key"]).toBe("real-key")
  })
})
