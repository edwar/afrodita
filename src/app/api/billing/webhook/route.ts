import { NextResponse } from "next/server"
import {
  getPreapproval,
  preapprovalOfPayment,
  verifyWebhookSignature,
} from "@/lib/billing/mercadopago"
import { syncPreapproval } from "@/lib/billing/subscription"

/**
 * Mercado Pago tells us a subscription or one of its charges changed. The
 * notification only says *which* one: we ask their API for its state, so a
 * forged call cannot grant a plan. The signature, when the secret is set,
 * just rejects strangers early.
 */
export async function POST(request: Request) {
  const url = new URL(request.url)
  const body = await request.json().catch(() => ({}))
  const type: string = url.searchParams.get("type") ?? body?.type ?? body?.topic ?? ""
  const dataId: string = String(url.searchParams.get("data.id") ?? body?.data?.id ?? "")
  if (!dataId) return NextResponse.json({ ok: true })

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
  if (secret) {
    const valid = verifyWebhookSignature({
      signature: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      dataId,
      secret,
    })
    if (!valid) {
      return NextResponse.json({ error: "Firma no válida" }, { status: 401 })
    }
  }

  try {
    if (type === "subscription_preapproval") {
      await syncPreapproval(await getPreapproval(dataId))
    } else if (type === "subscription_authorized_payment") {
      const preapprovalId = await preapprovalOfPayment(dataId)
      if (preapprovalId) await syncPreapproval(await getPreapproval(preapprovalId))
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    // A non-2xx makes Mercado Pago retry later, which is what we want here
    console.error(`[api/billing/webhook] ${type} ${dataId} failed:`, error)
    return NextResponse.json({ error: "No se pudo procesar" }, { status: 500 })
  }
}
