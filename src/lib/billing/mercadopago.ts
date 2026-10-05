import { createHmac, timingSafeEqual } from "node:crypto"
import { currency, localPrice, mercadoPagoToken } from "./config"
import { isPlanId, type PlanId } from "./plans"

const API = "https://api.mercadopago.com"

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

export interface Preapproval {
  id: string
  /** authorized | pending | paused | cancelled */
  status: string
  external_reference?: string
  payer_email?: string
  next_payment_date?: string
  init_point?: string
}

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const token = mercadoPagoToken()
  if (!token) throw new MercadoPagoError("Los pagos no están configurados.", 503)
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error(`[mercadopago] ${init?.method ?? "GET"} ${path} -> ${response.status}`, data)
    throw new MercadoPagoError(
      typeof data?.message === "string" ? data.message : "Mercado Pago rechazó la solicitud.",
      response.status
    )
  }
  return data as T
}

/**
 * Creates a monthly subscription and returns the Mercado Pago page where the
 * customer enters the card. Nothing is charged until they authorize it there;
 * we learn the outcome from the webhook.
 */
export async function createSubscription(input: {
  userId: string
  email: string
  plan: PlanId
  backUrl: string
}): Promise<{ id: string; url: string }> {
  const result = await mp<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: `Afrodita ${input.plan}`,
      external_reference: referenceFor(input.userId, input.plan),
      payer_email: input.email,
      back_url: input.backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: localPrice(input.plan),
        currency_id: currency(),
      },
    }),
  })
  if (!result.init_point) {
    throw new MercadoPagoError("Mercado Pago no devolvió el enlace de pago.", 502)
  }
  return { id: result.id, url: result.init_point }
}

export const getPreapproval = (id: string) =>
  mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`)

export const cancelPreapproval = (id: string) =>
  mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  })

/** The id of the subscription a recurring charge belongs to. */
export async function preapprovalOfPayment(paymentId: string): Promise<string | null> {
  const payment = await mp<{ preapproval_id?: string }>(
    `/authorized_payments/${encodeURIComponent(paymentId)}`
  )
  return payment.preapproval_id ?? null
}

// The user and plan travel in the subscription itself, so the webhook knows
// whose it is without trusting anything the browser sent.
export const referenceFor = (userId: string, plan: PlanId) => `${userId}:${plan}`

export function parseReference(
  reference: string | undefined
): { userId: string; plan: PlanId } | null {
  const [userId, plan] = (reference ?? "").split(":")
  return userId && isPlanId(plan) ? { userId, plan } : null
}

export type SubscriptionStatus = "pending" | "active" | "paused" | "cancelled"

export function mapStatus(mpStatus: string): SubscriptionStatus {
  switch (mpStatus) {
    case "authorized":
      return "active"
    case "paused":
      return "paused"
    case "cancelled":
      return "cancelled"
    default:
      return "pending"
  }
}

/**
 * Checks the `x-signature` header of a webhook against the secret from the
 * Mercado Pago panel (HMAC-SHA256 of "id:<data.id>;request-id:<id>;ts:<ts>;").
 */
export function verifyWebhookSignature(input: {
  signature: string | null
  requestId: string | null
  dataId: string
  secret: string
}): boolean {
  if (!input.signature) return false
  const fields = new Map(
    input.signature.split(",").map((part) => {
      const at = part.indexOf("=")
      return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const
    })
  )
  const ts = fields.get("ts")
  const received = fields.get("v1")
  if (!ts || !received) return false

  const id = /^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId
  const manifest =
    `id:${id};` + (input.requestId ? `request-id:${input.requestId};` : "") + `ts:${ts};`
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex")

  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
