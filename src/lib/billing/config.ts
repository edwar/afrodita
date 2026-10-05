import { hasValidApiKey } from "@/lib/ai/env"
import { PLANS, type PlanId } from "./plans"

/**
 * Billing is opt-in. Until BILLING_ENABLED=true nothing is enforced and the
 * app behaves as before, so this can be deployed before charging anyone.
 */
export function billingEnabled(env = process.env): boolean {
  return env.BILLING_ENABLED === "true"
}

/** Emails that use the app without paying (the owner, testers), as Pro. */
export function exemptEmails(env = process.env): string[] {
  return (env.BILLING_EXEMPT_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function mercadoPagoToken(env = process.env): string | null {
  const token = env.MERCADOPAGO_ACCESS_TOKEN?.trim()
  return hasValidApiKey(token) ? token! : null
}

export function mercadoPagoConfigured(env = process.env): boolean {
  return mercadoPagoToken(env) !== null
}

export function currency(env = process.env): string {
  return env.MERCADOPAGO_CURRENCY?.trim().toUpperCase() || "COP"
}

/**
 * What a plan charges each month, in the billing currency. Set it per plan
 * (PLAN_STANDARD_PRICE_COP, ...) or let it follow BILLING_USD_RATE, rounded
 * to thousands so the price looks like a price.
 */
export function localPrice(plan: PlanId, env = process.env): number {
  const explicit = Number(env[`PLAN_${plan.toUpperCase()}_PRICE_${currency(env)}`])
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit)
  const rate = Number(env.BILLING_USD_RATE)
  const usdRate = Number.isFinite(rate) && rate > 0 ? rate : 4000
  return Math.round((PLANS[plan].priceUsd * usdRate) / 1000) * 1000
}
