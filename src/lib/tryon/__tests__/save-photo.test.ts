import sharp from "sharp"
import { beforeEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, Buffer>()
vi.mock("@/lib/storage", () => ({
  putObject: vi.fn(async (key: string, bytes: Buffer) => void store.set(key, bytes)),
  getObject: vi.fn(async (key: string) => (store.has(key) ? { bytes: store.get(key)! } : null)),
  deleteObject: vi.fn(),
  getObjectVersion: vi.fn(),
  listObjects: vi.fn(async () => []),
  getImageObject: vi.fn(),
}))
const checkPhoto = vi.fn()
vi.mock("../photo-check", () => ({ checkPhoto: (...args: unknown[]) => checkPhoto(...args) }))

import { TryOnError } from "../gemini"
import { savePhoto } from "../looks"

let upload: Buffer
const keys = () => [...store.keys()]
const stored = (suffix: string) => keys().some((key) => key.endsWith(suffix))

beforeEach(async () => {
  store.clear()
  checkPhoto.mockReset()
  upload = await sharp({ create: { width: 200, height: 300, channels: 3, background: "#aaa" } })
    .jpeg()
    .toBuffer()
})

const fails = async (promise: Promise<unknown>) => promise.then(() => null, (error) => error)

describe("savePhoto", () => {
  it("stores the photo and the consent record once the review accepts it", async () => {
    checkPhoto.mockResolvedValue({ ok: true })
    await savePhoto("u1", upload, true)

    expect(stored("/base.jpg")).toBe(true)
    const consent = JSON.parse(store.get("tryon/u1/consent.json")!.toString())
    expect(consent.version).toBeTruthy()
    expect(new Date(consent.at).getTime()).toBeGreaterThan(0)
  })

  it("reviews exactly the bytes it stores", async () => {
    checkPhoto.mockResolvedValue({ ok: true })
    await savePhoto("u1", upload, true)
    expect(checkPhoto.mock.calls[0][0].equals(store.get("tryon/u1/base.jpg")!)).toBe(true)
  })

  it("stores nothing without the consent, and does not even review", async () => {
    const error = await fails(savePhoto("u1", upload, false))
    expect(error).toBeInstanceOf(TryOnError)
    expect(error.status).toBe(400)
    expect(checkPhoto).not.toHaveBeenCalled()
    expect(stored("/base.jpg")).toBe(false)
  })

  it("stores nothing when the review rejects the photo", async () => {
    checkPhoto.mockResolvedValue({ ok: false, reason: "nudity", message: "no se puede" })
    const error = await fails(savePhoto("u1", upload, true))
    expect(error).toMatchObject({ status: 422, message: "no se puede" })
    expect(stored("/base.jpg")).toBe(false)
    expect(stored("/consent.json")).toBe(false)
    // the only thing written is the attempt counter: no image bytes anywhere
    expect(keys().every((key) => key.includes("photochecks-"))).toBe(true)
  })

  it("stores nothing when the review cannot be done (fails closed)", async () => {
    checkPhoto.mockRejectedValue(new TryOnError("sin verificar", 503))
    const error = await fails(savePhoto("u1", upload, true))
    expect(error).toMatchObject({ status: 503 })
    expect(stored("/base.jpg")).toBe(false)
  })

  it("rejects a file that is not an image before reviewing anything", async () => {
    const error = await fails(savePhoto("u1", Buffer.from("not an image"), true))
    expect(error).toMatchObject({ status: 400 })
    expect(checkPhoto).not.toHaveBeenCalled()
    expect(keys()).toEqual([])
  })

  it("stops reviewing after the daily limit of attempts", async () => {
    vi.stubEnv("PHOTO_CHECK_DAILY_LIMIT", "2")
    checkPhoto.mockResolvedValue({ ok: false, reason: "no_person", message: "x" })
    await fails(savePhoto("u1", upload, true))
    await fails(savePhoto("u1", upload, true))
    const third = await fails(savePhoto("u1", upload, true))
    expect(third).toMatchObject({ status: 429 })
    expect(checkPhoto).toHaveBeenCalledTimes(2)
    // other users are not affected
    checkPhoto.mockResolvedValue({ ok: true })
    await savePhoto("u2", upload, true)
    expect(stored("tryon/u2/base.jpg")).toBe(true)
    vi.unstubAllEnvs()
  })
})
