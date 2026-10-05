import sharp from "sharp"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  REJECTION_MESSAGES,
  analyzePhoto,
  checkPhoto,
  judgePhoto,
  type PhotoAnalysis,
} from "../photo-check"

const GOOD: PhotoAnalysis = {
  people: 1,
  real_photo: true,
  nudity_or_sexual: false,
  apparent_minor: false,
  harmful_content: false,
  body_visible: "full",
}

describe("judgePhoto", () => {
  it("accepts one clothed adult with enough of the body in view", () => {
    expect(judgePhoto(GOOD)).toBeNull()
    expect(judgePhoto({ ...GOOD, body_visible: "partial" })).toBeNull()
  })

  it.each([
    [{ nudity_or_sexual: true }, "nudity"],
    [{ apparent_minor: true }, "minor"],
    [{ harmful_content: true }, "harmful"],
    [{ people: 0 }, "no_person"],
    [{ real_photo: false }, "no_person"],
    [{ people: 2 }, "several_people"],
    [{ body_visible: "face_only" }, "too_little_body"],
    [{ body_visible: "none" }, "too_little_body"],
  ] as [Partial<PhotoAnalysis>, string][])("rejects %j as %s", (change, reason) => {
    expect(judgePhoto({ ...GOOD, ...change })).toBe(reason)
  })

  it("reports the gravest reason when there are several", () => {
    const everything = { ...GOOD, people: 3, body_visible: "none" as const }
    expect(judgePhoto({ ...everything, nudity_or_sexual: true, apparent_minor: true })).toBe(
      "nudity"
    )
    expect(judgePhoto({ ...everything, harmful_content: true, nudity_or_sexual: true })).toBe(
      "harmful"
    )
    expect(judgePhoto({ ...everything, apparent_minor: true })).toBe("minor")
  })

  it("has a message for every reason", () => {
    for (const message of Object.values(REJECTION_MESSAGES)) {
      expect(message.length).toBeGreaterThan(20)
    }
  })
})

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const answer = (analysis: unknown) =>
  reply({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(analysis) }] } }] })

let photo: Buffer
beforeEach(async () => {
  vi.stubEnv("GEMINI_API_KEY", "real-key")
  photo = await sharp({ create: { width: 64, height: 96, channels: 3, background: "#888" } })
    .jpeg()
    .toBuffer()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("analyzePhoto", () => {
  it("sends the image with a strict schema, deterministic, key in a header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(answer(GOOD))
    vi.stubGlobal("fetch", fetchMock)
    expect(await analyzePhoto(photo)).toEqual(GOOD)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).not.toContain("real-key")
    expect(init.headers["x-goog-api-key"]).toBe("real-key")
    const body = JSON.parse(init.body)
    expect(body.generationConfig).toMatchObject({
      temperature: 0,
      responseMimeType: "application/json",
    })
    expect(body.generationConfig.responseSchema.required).toContain("nudity_or_sexual")
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe("image/jpeg")
  })

  it("treats Gemini's own safety refusal as blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } }))
    )
    expect(await analyzePhoto(photo)).toBe("blocked")

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply({ candidates: [{ finishReason: "SAFETY" }] }))
    )
    expect(await analyzePhoto(photo)).toBe("blocked")
  })

  it("retries once on a transient error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({}, 503))
      .mockResolvedValueOnce(answer(GOOD))
    vi.stubGlobal("fetch", fetchMock)
    expect(await analyzePhoto(photo)).toEqual(GOOD)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("fails closed when the review cannot be completed", async () => {
    // still down after the retry
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({}, 503)))
    await expect(analyzePhoto(photo)).rejects.toMatchObject({ status: 503 })

    // network failure
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    await expect(analyzePhoto(photo)).rejects.toMatchObject({ status: 503 })

    // answer that is not the expected shape
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer({ people: "one" })))
    await expect(analyzePhoto(photo)).rejects.toMatchObject({ status: 503 })

    // not JSON at all
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }))
    )
    await expect(analyzePhoto(photo)).rejects.toMatchObject({ status: 503 })
  })

  it("does not call the API without a configured key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "your-gemini-key")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(analyzePhoto(photo)).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("checkPhoto", () => {
  it("accepts a good photo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(GOOD)))
    expect(await checkPhoto(photo)).toEqual({ ok: true })
  })

  it("rejects with the reason and a message for the user", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer({ ...GOOD, people: 2 })))
    expect(await checkPhoto(photo)).toEqual({
      ok: false,
      reason: "several_people",
      message: REJECTION_MESSAGES.several_people,
    })
  })

  it("rejects what Gemini refuses to look at", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply({ promptFeedback: { blockReason: "SAFETY" } }))
    )
    expect(await checkPhoto(photo)).toMatchObject({ ok: false, reason: "blocked" })
  })
})
