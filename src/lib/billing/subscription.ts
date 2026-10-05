import { prisma } from "@/lib/prisma"
import { billingEnabled, exemptEmails } from "./config"
import { PLANS, type Plan } from "./plans"
import {
  mapStatus,
  parseReference,
  type Preapproval,
  type SubscriptionStatus,
} from "./mercadopago"

export type Entitlement =
  /** Billing is off: no plan caps, the old global limits apply. */
  | { enforced: false }
  | {
      enforced: true
      plan: Plan | null
      status: SubscriptionStatus | "exempt" | "none"
      periodEnd: Date | null
    }

/** Active, or cancelled but still inside the month already paid. */
export function hasAccess(
  sub: { status: string; currentPeriodEnd: Date | null },
  now = new Date()
): boolean {
  if (sub.status === "active") return true
  return sub.status === "cancelled" && !!sub.currentPeriodEnd && sub.currentPeriodEnd > now
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  if (!billingEnabled()) return { enforced: false }

  const exempt = exemptEmails()
  if (exempt.length > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (user && exempt.includes(user.email.toLowerCase())) {
      return { enforced: true, plan: PLANS.pro, status: "exempt", periodEnd: null }
    }
  }

  const sub = await prisma.subscription.findUnique({ where: { userId } })
  if (!sub) return { enforced: true, plan: null, status: "none", periodEnd: null }
  const status = sub.status as SubscriptionStatus
  return {
    enforced: true,
    plan: hasAccess(sub) ? (PLANS[sub.plan as Plan["id"]] ?? null) : null,
    status,
    periodEnd: sub.currentPeriodEnd,
  }
}

/** Saves what Mercado Pago says about a subscription. Returns false if it is not ours. */
export async function syncPreapproval(preapproval: Preapproval): Promise<boolean> {
  const reference = parseReference(preapproval.external_reference)
  if (!reference) return false

  // A cancelled subscription may come back without a next charge date: keep
  // the one we had, it is how long the customer still has what they paid for.
  const data = {
    plan: reference.plan,
    status: mapStatus(preapproval.status),
    mpPreapprovalId: preapproval.id,
    payerEmail: preapproval.payer_email ?? null,
    currentPeriodEnd: preapproval.next_payment_date
      ? new Date(preapproval.next_payment_date)
      : undefined,
  }
  await prisma.subscription.upsert({
    where: { userId: reference.userId },
    create: { userId: reference.userId, ...data },
    update: data,
  })
  return true
}

// --- Monthly usage ------------------------------------------------------------

export type UsageField = "looks" | "photoChanges" | "garments"

export const monthPeriod = (date = new Date()) => date.toISOString().slice(0, 7)

export async function getUsage(userId: string) {
  const row = await prisma.usageMonth.findUnique({
    where: { userId_period: { userId, period: monthPeriod() } },
  })
  return {
    looks: row?.looks ?? 0,
    photoChanges: row?.photoChanges ?? 0,
    garments: row?.garments ?? 0,
  }
}

export async function addUsage(userId: string, field: UsageField): Promise<void> {
  const period = monthPeriod()
  await prisma.usageMonth.upsert({
    where: { userId_period: { userId, period } },
    create: { userId, period, [field]: 1 },
    update: { [field]: { increment: 1 } },
  })
}
