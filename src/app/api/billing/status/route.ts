import { NextResponse } from "next/server"
import { requireUser, unauthorized } from "@/lib/require-user"
import { billingEnabled, currency, localPrice, mercadoPagoConfigured } from "@/lib/billing/config"
import { PLAN_IDS } from "@/lib/billing/plans"
import { getEntitlement, getUsage, syncUserSubscription } from "@/lib/billing/subscription"

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

  // Mi cuenta asks to catch up with Mercado Pago, but only while there is no
  // plan: someone who already has one costs no extra call
  let entitlement = await getEntitlement(user.id)
  if (
    new URL(request.url).searchParams.get("sync") === "1" &&
    entitlement.enforced &&
    !entitlement.plan &&
    base.configured
  ) {
    try {
      await syncUserSubscription(user.id, user.email)
      entitlement = await getEntitlement(user.id)
    } catch (error) {
      console.error("[api/billing/status] sync failed:", error)
    }
  }
  const usage = await getUsage(user.id)
  if (!entitlement.enforced) return NextResponse.json({ ...base, plan: null })
  return NextResponse.json({
    ...base,
    plan: entitlement.plan?.id ?? null,
    status: entitlement.status,
    periodEnd: entitlement.periodEnd,
    usage,
  })
}
