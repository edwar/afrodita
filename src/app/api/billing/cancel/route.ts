import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser, unauthorized } from "@/lib/require-user"
import { MercadoPagoError, cancelPreapproval } from "@/lib/billing/mercadopago"
import { syncPreapproval } from "@/lib/billing/subscription"

/** Stops future charges. The plan stays until the month already paid ends. */
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } })
  if (!sub || sub.status === "cancelled") {
    return NextResponse.json({ error: "No tienes una suscripción activa." }, { status: 404 })
  }

  try {
    await syncPreapproval(await cancelPreapproval(sub.mpPreapprovalId))
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error("[api/billing/cancel] failed:", error)
    return NextResponse.json({ error: "No se pudo cancelar la suscripción." }, { status: 500 })
  }
}
