import { APIError } from "better-auth/api"
import { beforeEach, describe, expect, it, vi } from "vitest"

const requireUser = vi.fn()
const setPassword = vi.fn()
const findMany = vi.fn()
vi.mock("@/lib/require-user", () => ({
  requireUser: (...args: unknown[]) => requireUser(...args),
  unauthorized: () => new Response(JSON.stringify({ error: "no" }), { status: 401 }),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { setPassword: (...a: unknown[]) => setPassword(...a) } } }))
vi.mock("@/lib/prisma", () => ({ prisma: { account: { findMany: (...a: unknown[]) => findMany(...a) } } }))

import { POST as postPassword } from "../password/route"
import { GET as getMethods } from "../methods/route"

const post = (body: unknown) =>
  postPassword(
    new Request("http://localhost/api/account/password", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  )
const get = () => getMethods(new Request("http://localhost/api/account/methods"))

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ id: "u1", name: "Ana", email: "ana@example.com" })
  setPassword.mockReset().mockResolvedValue({ status: true })
  findMany.mockReset()
  vi.unstubAllEnvs()
})

describe("POST /api/account/password", () => {
  it("needs a session", async () => {
    requireUser.mockResolvedValue(null)
    expect((await post({ password: "Abcdef1!" })).status).toBe(401)
    expect(setPassword).not.toHaveBeenCalled()
  })

  it.each([undefined, "", "short", 12345678, "x".repeat(129)])("refuses %s", async (password) => {
    expect((await post({ password })).status).toBe(400)
    expect(setPassword).not.toHaveBeenCalled()
  })

  it("sets the password for the signed-in user only", async () => {
    const response = await post({ password: "Abcdef1!" })
    expect(response.status).toBe(200)
    expect(setPassword).toHaveBeenCalledTimes(1)
    expect(setPassword.mock.calls[0][0].body).toEqual({ newPassword: "Abcdef1!" })
  })

  it("answers 409 when the account already has a password", async () => {
    setPassword.mockRejectedValue(
      new APIError("BAD_REQUEST", { message: "Password already set", code: "PASSWORD_ALREADY_SET" })
    )
    const response = await post({ password: "Abcdef1!" })
    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/ya tiene una contraseña/)
  })
})

describe("GET /api/account/methods", () => {
  it("needs a session", async () => {
    requireUser.mockResolvedValue(null)
    expect((await get()).status).toBe(401)
  })

  it("reports a password-only account", async () => {
    findMany.mockResolvedValue([{ providerId: "credential", password: "hash" }])
    expect(await (await get()).json()).toMatchObject({ hasPassword: true, hasGoogle: false })
  })

  it("reports a Google-only account", async () => {
    findMany.mockResolvedValue([{ providerId: "google", password: null }])
    expect(await (await get()).json()).toMatchObject({ hasPassword: false, hasGoogle: true })
  })

  it("reports both, and does not count a credential row without a password", async () => {
    findMany.mockResolvedValue([
      { providerId: "credential", password: "hash" },
      { providerId: "google", password: null },
    ])
    expect(await (await get()).json()).toMatchObject({ hasPassword: true, hasGoogle: true })
    findMany.mockResolvedValue([{ providerId: "credential", password: null }])
    expect((await (await get()).json()).hasPassword).toBe(false)
  })

  it("never exposes the password hash or tokens", async () => {
    findMany.mockResolvedValue([{ providerId: "credential", password: "SECRET-HASH" }])
    expect(JSON.stringify(await (await get()).json())).not.toContain("SECRET-HASH")
  })

  it("only offers Google when it is configured", async () => {
    findMany.mockResolvedValue([])
    vi.stubEnv("GOOGLE_CLIENT_ID", "")
    expect((await (await get()).json()).googleAvailable).toBe(false)
    vi.stubEnv("GOOGLE_CLIENT_ID", "real.apps")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "GOCSPX-real")
    expect((await (await get()).json()).googleAvailable).toBe(true)
  })
})
