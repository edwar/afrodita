import { createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const sync = vi.hoisted(() => vi.fn())
const getPreapproval = vi.hoisted(() => vi.fn())
const preapprovalOfPayment = vi.hoisted(() => vi.fn())
vi.mock("@/lib/billing/subscription", () => ({ syncPreapproval: sync }))
vi.mock("@/lib/billing/mercadopago", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/billing/mercadopago")>()),
  getPreapproval,
  preapprovalOfPayment,
}))

import { POST } from "../webhook/route"

const secret = "whsec"
const signed = (id: string, requestId = "req-1", ts = "1700000000") => ({
  "x-request-id": requestId,
  "x-signature": `ts=${ts},v1=${createHmac("sha256", secret)
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest("hex")}`,
})
const call = (query: string, headers: Record<string, string> = {}, body: unknown = {}) =>
  POST(
    new Request(`http://localhost/api/billing/webhook?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", secret)
  getPreapproval.mockResolvedValue({ id: "pre1", status: "authorized" })
})

describe("POST /api/billing/webhook", () => {
  it("rejects a call with a bad signature without touching anything", async () => {
    const response = await call("type=subscription_preapproval&data.id=pre1", {
      "x-request-id": "req-1",
      "x-signature": "ts=1,v1=deadbeef",
    })
    expect(response.status).toBe(401)
    expect(getPreapproval).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
  })

  it("asks Mercado Pago for the subscription and stores it", async () => {
    const response = await call("type=subscription_preapproval&data.id=pre1", signed("pre1"))
    expect(response.status).toBe(200)
    expect(getPreapproval).toHaveBeenCalledWith("pre1")
    expect(sync).toHaveBeenCalledWith({ id: "pre1", status: "authorized" })
  })

  it("follows a recurring charge back to its subscription", async () => {
    preapprovalOfPayment.mockResolvedValue("pre1")
    const response = await call(
      "type=subscription_authorized_payment&data.id=pay9",
      signed("pay9")
    )
    expect(response.status).toBe(200)
    expect(preapprovalOfPayment).toHaveBeenCalledWith("pay9")
    expect(getPreapproval).toHaveBeenCalledWith("pre1")
  })

  it("ignores events it does not handle", async () => {
    const response = await call("type=payment&data.id=7", signed("7"))
    expect(response.status).toBe(200)
    expect(sync).not.toHaveBeenCalled()
  })

  it("answers 500 when Mercado Pago cannot be reached, so it retries", async () => {
    getPreapproval.mockRejectedValue(new Error("down"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    const response = await call("type=subscription_preapproval&data.id=pre1", signed("pre1"))
    expect(response.status).toBe(500)
  })
})
