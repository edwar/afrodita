import { NextResponse } from "next/server"
import { requireUser, unauthorized } from "@/lib/require-user"
import { billingEnabled, currency, localPrice, mercadoPagoConfigured } from "@/lib/billing/config"
import { PLAN_IDS } from "@/lib/billing/plans"
import { getEntitlement, getUsage } from "@/lib/billing/subscription"

/** Plan, consumption and prices of the signed-in user. */
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const prices = Object.fromEntries(PLAN_IDS.map((id) => [id, localPrice(id)]))
  const base = {
    enabled: billingEnabled(),
    configured: mercadoPagoConfigured(),
    currency: currency(),
    prices,
  }
  if (!base.enabled) return NextResponse.json({ ...base, plan: null })

  const [entitlement, usage] = await Promise.all([
    getEntitlement(user.id),
    getUsage(user.id),
  ])
  if (!entitlement.enforced) return NextResponse.json({ ...base, plan: null })
  return NextResponse.json({
    ...base,
    plan: entitlement.plan?.id ?? null,
    status: entitlement.status,
    periodEnd: entitlement.periodEnd,
    usage,
  })
}
