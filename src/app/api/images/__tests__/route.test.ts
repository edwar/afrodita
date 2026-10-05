import { Readable } from "node:stream"
import { beforeEach, describe, expect, it, vi } from "vitest"

const requireUser = vi.fn()
const getImageObject = vi.fn()
vi.mock("@/lib/require-user", () => ({
  requireUser: (...args: unknown[]) => requireUser(...args),
  unauthorized: () => new Response(JSON.stringify({ error: "no" }), { status: 401 }),
}))
vi.mock("@/lib/storage", () => ({ getImageObject: (...args: unknown[]) => getImageObject(...args) }))

import { GET } from "../[key]/route"

const call = (key: string) =>
  GET(new Request("http://localhost/api/images/" + key), { params: Promise.resolve({ key }) })

beforeEach(() => {
  requireUser.mockReset()
  getImageObject.mockReset()
  getImageObject.mockResolvedValue({ body: Readable.from(Buffer.from("img")), contentType: "image/png" })
})

describe("GET /api/images/[key]", () => {
  it("serves a file to its owner, privately cached", async () => {
    requireUser.mockResolvedValue({ id: "user1" })
    const response = await call("user1-1700000000-ab12cd.png")
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Cache-Control")).toMatch(/^private/)
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("img")
  })

  it("answers 401 without a session and never touches storage", async () => {
    requireUser.mockResolvedValue(null)
    expect((await call("user1-1-a.png")).status).toBe(401)
    expect(getImageObject).not.toHaveBeenCalled()
  })

  it("gives another user's file the same 404 as a missing one, without reading it", async () => {
    requireUser.mockResolvedValue({ id: "user2" })
    const response = await call("user1-1700000000-ab12cd.png")
    expect(response.status).toBe(404)
    expect(getImageObject).not.toHaveBeenCalled()
  })

  it("does not let an id that merely starts the same way through", async () => {
    // user "abc" must not read files of user "abc-evil"... keys use "<id>-", so "abcd-" is not "abc-"
    requireUser.mockResolvedValue({ id: "abc" })
    expect((await call("abcd-1-a.png")).status).toBe(404)
  })

  it("rejects malformed keys", async () => {
    requireUser.mockResolvedValue({ id: "user1" })
    expect((await call("../secret.png")).status).toBe(400)
    expect((await call("user1-1.exe")).status).toBe(400)
  })

  it("answers 404 when the file is missing in storage", async () => {
    requireUser.mockResolvedValue({ id: "user1" })
    getImageObject.mockRejectedValue(new Error("NoSuchKey"))
    expect((await call("user1-1-a.png")).status).toBe(404)
  })
})
