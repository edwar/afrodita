import { PLANS, type PlanId } from "@/lib/billing/plans"

type T = (key: string, params?: Record<string, string | number>) => string

/** What a plan includes, in the words shown on the landing and in the account. */
export function planFeatures(t: T, id: PlanId): string[] {
  const { limits } = PLANS[id]
  return [
    t("pricing.features.looks", { n: limits.looksPerMonth }),
    t("pricing.features.looksDay", { n: limits.looksPerDay }),
    t("pricing.features.photos", { n: limits.photosPerMonth }),
    t("pricing.features.garments", { n: limits.garmentsPerMonth }),
    t("pricing.features.closet", { n: limits.closetMax }),
    t("pricing.features.stylist"),
  ]
}
