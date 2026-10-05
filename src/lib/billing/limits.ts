import { prisma } from "@/lib/prisma"
import { TryOnError } from "@/lib/tryon/gemini"
import { billingEnabled } from "./config"
import type { Plan } from "./plans"
import { addUsage, getEntitlement, getUsage, type UsageField } from "./subscription"

/**
 * A cap or a missing plan. It is a TryOnError so the try-on routes already
 * turn it into a response with this status (402 no plan, 429 cap reached).
 */
export class PlanLimitError extends TryOnError {}

const NEEDS_PLAN =
  "Necesitas un plan activo para usar esta función. Elígelo en Mi cuenta."

/** The user's plan, or null when billing is off. Throws when a plan is required and missing. */
async function planFor(userId: string): Promise<Plan | null> {
  const entitlement = await getEntitlement(userId)
  if (!entitlement.enforced) return null
  if (!entitlement.plan) throw new PlanLimitError(NEEDS_PLAN, 402)
  return entitlement.plan
}

/** Before generating a look. Returns the plan's daily cap, if plans apply. */
export async function checkLookAllowance(userId: string): Promise<{ dailyLimit?: number }> {
  const plan = await planFor(userId)
  if (!plan) return {}
  const usage = await getUsage(userId)
  if (usage.looks >= plan.limits.looksPerMonth) {
    throw new PlanLimitError(
      `Usaste los ${plan.limits.looksPerMonth} looks de tu plan este mes. Se renuevan el próximo mes o puedes cambiar de plan.`,
      429
    )
  }
  return { dailyLimit: plan.limits.looksPerDay }
}

/** Before reviewing and storing a new base photo. */
export async function checkPhotoAllowance(userId: string): Promise<void> {
  const plan = await planFor(userId)
  if (!plan) return
  const usage = await getUsage(userId)
  if (usage.photoChanges >= plan.limits.photosPerMonth) {
    throw new PlanLimitError(
      `Ya subiste las ${plan.limits.photosPerMonth} fotos base de tu plan este mes.`,
      429
    )
  }
}

/** Before adding a garment to the closet. */
export async function checkGarmentAllowance(userId: string): Promise<void> {
  const plan = await planFor(userId)
  if (!plan) return
  const [usage, closet] = await Promise.all([
    getUsage(userId),
    prisma.wardrobe.count({ where: { userId } }),
  ])
  if (usage.garments >= plan.limits.garmentsPerMonth) {
    throw new PlanLimitError(
      `Ya cargaste las ${plan.limits.garmentsPerMonth} prendas de tu plan este mes.`,
      429
    )
  }
  if (closet >= plan.limits.closetMax) {
    throw new PlanLimitError(
      `Tu closet llegó al máximo de ${plan.limits.closetMax} prendas de tu plan.`,
      429
    )
  }
}

/** Counts a finished action against the month. A no-op while billing is off. */
export async function recordUsage(userId: string, field: UsageField): Promise<void> {
  if (!billingEnabled()) return
  await addUsage(userId, field)
}
