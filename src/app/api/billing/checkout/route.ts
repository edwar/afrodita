import { NextResponse } from "next/server"
import { requireUser, unauthorized } from "@/lib/require-user"
import { billingEnabled, mercadoPagoConfigured } from "@/lib/billing/config"
import { isPlanId } from "@/lib/billing/plans"
import { MercadoPagoError, createSubscription } from "@/lib/billing/mercadopago"
import { getEntitlement } from "@/lib/billing/subscription"

/** Starts a subscription and returns the Mercado Pago page to pay on. */
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  if (!billingEnabled() || !mercadoPagoConfigured()) {
    return NextResponse.json({ error: "Los pagos aún no están disponibles." }, { status: 503 })
  }
  const { plan } = await request.json().catch(() => ({}))
  if (!isPlanId(plan)) {
    return NextResponse.json({ error: "Plan no válido." }, { status: 400 })
  }

  const entitlement = await getEntitlement(user.id)
  if (entitlement.enforced && entitlement.status === "active") {
    return NextResponse.json(
      { error: "Ya tienes un plan activo. Cancélalo para elegir otro." },
      { status: 409 }
    )
  }

  try {
    const origin = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin
    const { url } = await createSubscription({
      userId: user.id,
      email: user.email,
      plan,
      backUrl: `${origin}/account?checkout=return`,
    })
    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error("[api/billing/checkout] failed:", error)
    return NextResponse.json({ error: "No se pudo iniciar el pago." }, { status: 500 })
  }
}
