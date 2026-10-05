/**
 * Plans and their caps. Pure data, safe to import from client components.
 *
 * Prices are in USD for display; what Mercado Pago charges comes from
 * `config.ts`. Caps are sized from the cost of a generated look (about
 * US$0.07-0.11 with gemini-3.1-flash-image): the monthly cap bounds the cost
 * per customer, the daily one stops a whole month being spent in an evening.
 */
export type PlanId = "basic" | "standard" | "pro"

export interface PlanLimits {
  /** Looks with an image generated per calendar month (cached ones are free). */
  looksPerMonth: number
  looksPerDay: number
  /** Base photos uploaded per month; a new photo can regenerate looks. */
  photosPerMonth: number
  garmentsPerMonth: number
  /** Garments in the closet at any time. */
  closetMax: number
}

export interface Plan {
  id: PlanId
  priceUsd: number
  limits: PlanLimits
  highlighted?: boolean
}

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: "basic",
    priceUsd: 10,
    limits: {
      looksPerMonth: 25,
      looksPerDay: 3,
      photosPerMonth: 3,
      garmentsPerMonth: 40,
      closetMax: 100,
    },
  },
  standard: {
    id: "standard",
    priceUsd: 25,
    highlighted: true,
    limits: {
      looksPerMonth: 60,
      looksPerDay: 6,
      photosPerMonth: 5,
      garmentsPerMonth: 100,
      closetMax: 250,
    },
  },
  pro: {
    id: "pro",
    priceUsd: 50,
    limits: {
      looksPerMonth: 150,
      looksPerDay: 10,
      photosPerMonth: 10,
      garmentsPerMonth: 300,
      closetMax: 600,
    },
  },
}

export const PLAN_IDS = Object.keys(PLANS) as PlanId[]

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS
}
