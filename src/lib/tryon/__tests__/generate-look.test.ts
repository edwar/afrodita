import sharp from "sharp"
import { Readable } from "node:stream"
import { beforeEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, Buffer>()
vi.mock("@/lib/storage", () => ({
  putObject: vi.fn(async (key: string, bytes: Buffer) => void store.set(key, bytes)),
  getObject: vi.fn(async (key: string) => (store.has(key) ? { bytes: store.get(key)! } : null)),
  getObjectVersion: vi.fn(async (key: string) => (store.has(key) ? '"etag"' : null)),
  listObjects: vi.fn(async () => []),
  deleteObject: vi.fn(),
  getImageObject: vi.fn(async (key: string) => ({ body: Readable.from([store.get(key)!]) })),
}))

const generate = vi.fn()
vi.mock("../gemini", async (importActual) => ({
  ...(await importActual<typeof import("../gemini")>()),
  generateTryOnImage: (...args: unknown[]) => generate(...args),
}))
vi.mock("../photo-check", () => ({ checkPhoto: vi.fn() }))

const recordUsage = vi.fn()
vi.mock("@/lib/billing/limits", () => ({
  checkLookAllowance: vi.fn(async () => ({})),
  checkPhotoAllowance: vi.fn(),
  recordUsage: (...args: unknown[]) => recordUsage(...args),
}))

import { TryOnError } from "../gemini"
import { generateLook } from "../looks"

const garment = { id: "g1", name: "Camisa", category: "camisa", imageUrl: "/api/images/g1.jpg" }
const usageKeys = () => [...store.keys()].filter((key) => key.includes("/usage-"))

beforeEach(async () => {
  store.clear()
  vi.clearAllMocks()
  const jpeg = await sharp({ create: { width: 200, height: 300, channels: 3, background: "#999" } })
    .jpeg()
    .toBuffer()
  store.set("tryon/u1/base.jpg", jpeg)
  store.set("g1.jpg", jpeg)
  generate.mockResolvedValue({ bytes: jpeg, mimeType: "image/jpeg" })
})

describe("generateLook and what it counts", () => {
  it("counts a look that was delivered", async () => {
    await generateLook("u1", [garment])
    expect(recordUsage).toHaveBeenCalledWith("u1", "looks")
    expect(usageKeys()).toHaveLength(1)
  })

  it("does not count a look the customer never received", async () => {
    generate.mockRejectedValue(new TryOnError("Servicio no disponible ahora. Inténtalo luego.", 503))

    await expect(generateLook("u1", [garment])).rejects.toMatchObject({ status: 503 })
    expect(recordUsage).not.toHaveBeenCalled()
    expect(usageKeys()).toHaveLength(0)
  })
})
