import { createHmac } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn(), upsert: vi.fn() },
  usageMonth: { findUnique: vi.fn(), upsert: vi.fn(), aggregate: vi.fn() },
  wardrobe: { count: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { localPrice } from "../config"
import {
  checkGarmentAllowance,
  checkLookAllowance,
  checkPhotoAllowance,
  globalMonthlyLimit,
  PlanLimitError,
} from "../limits"
import {
  mapStatus,
  parseReference,
  referenceFor,
  verifyWebhookSignature,
} from "../mercadopago"
import { PLANS } from "../plans"
import { getEntitlement, hasAccess, syncPreapproval } from "../subscription"

const future = new Date(Date.now() + 86_400_000)
const past = new Date(Date.now() - 86_400_000)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("BILLING_ENABLED", "true")
  vi.stubEnv("BILLING_EXEMPT_EMAILS", "")
  prismaMock.usageMonth.findUnique.mockResolvedValue(null)
  prismaMock.wardrobe.count.mockResolvedValue(0)
  prismaMock.usageMonth.aggregate.mockResolvedValue({ _sum: { looks: 0 } })
})
afterEach(() => vi.unstubAllEnvs())

const subscribed = (plan: string, status = "active", end: Date | null = future) =>
  prismaMock.subscription.findUnique.mockResolvedValue({ plan, status, currentPeriodEnd: end })

describe("plans", () => {
  it("cost more and allow more as they go up", () => {
    const { basic, standard, pro } = PLANS
    expect(basic.priceUsd).toBeLessThan(standard.priceUsd)
    expect(standard.priceUsd).toBeLessThan(pro.priceUsd)
    expect(basic.limits.looksPerMonth).toBeLessThan(standard.limits.looksPerMonth)
    expect(standard.limits.looksPerMonth).toBeLessThan(pro.limits.looksPerMonth)
  })

  it("never allow more looks in a day than in the month", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.limits.looksPerDay).toBeLessThanOrEqual(plan.limits.looksPerMonth)
    }
  })
})

describe("localPrice", () => {
  it("follows the USD rate, rounded to thousands", () => {
    expect(localPrice("basic", { BILLING_USD_RATE: "4000" } as never)).toBe(40000)
    expect(localPrice("pro", { BILLING_USD_RATE: "4123" } as never)).toBe(206000)
  })

  it("uses 4000 without a rate", () => {
    expect(localPrice("standard", {} as never)).toBe(100000)
  })

  it("lets a plan be priced by hand", () => {
    expect(
      localPrice("basic", { PLAN_BASIC_PRICE_COP: "35900", BILLING_USD_RATE: "4000" } as never)
    ).toBe(35900)
  })
})

describe("subscription status", () => {
  it("maps Mercado Pago statuses", () => {
    expect(mapStatus("authorized")).toBe("active")
    expect(mapStatus("paused")).toBe("paused")
    expect(mapStatus("cancelled")).toBe("cancelled")
    expect(mapStatus("pending")).toBe("pending")
    expect(mapStatus("something-new")).toBe("pending")
  })

  it("reads the user and plan back from the reference", () => {
    expect(parseReference(referenceFor("u1", "pro"))).toEqual({ userId: "u1", plan: "pro" })
    expect(parseReference("u1:enterprise")).toBeNull()
    expect(parseReference(undefined)).toBeNull()
  })

  it("keeps access while active, or cancelled inside the paid month", () => {
    expect(hasAccess({ status: "active", currentPeriodEnd: null })).toBe(true)
    expect(hasAccess({ status: "cancelled", currentPeriodEnd: future })).toBe(true)
    expect(hasAccess({ status: "cancelled", currentPeriodEnd: past })).toBe(false)
    expect(hasAccess({ status: "cancelled", currentPeriodEnd: null })).toBe(false)
    expect(hasAccess({ status: "pending", currentPeriodEnd: future })).toBe(false)
    expect(hasAccess({ status: "paused", currentPeriodEnd: future })).toBe(false)
  })
})

describe("syncPreapproval", () => {
  it("stores the plan from the reference and the mapped status", async () => {
    const ok = await syncPreapproval({
      id: "pre_1",
      status: "authorized",
      external_reference: "u1:standard",
      next_payment_date: "2026-11-05T10:00:00.000-05:00",
    })
    expect(ok).toBe(true)
    const call = prismaMock.subscription.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ userId: "u1" })
    expect(call.update).toMatchObject({ plan: "standard", status: "active", mpPreapprovalId: "pre_1" })
    expect(call.update.currentPeriodEnd).toBeInstanceOf(Date)
  })

  it("does not wipe the paid period when a cancellation has no next date", async () => {
    await syncPreapproval({ id: "pre_1", status: "cancelled", external_reference: "u1:basic" })
    expect(prismaMock.subscription.upsert.mock.calls[0][0].update.currentPeriodEnd).toBeUndefined()
  })

  it("ignores subscriptions that are not ours", async () => {
    expect(await syncPreapproval({ id: "x", status: "authorized" })).toBe(false)
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled()
  })
})

describe("entitlement", () => {
  it("does not enforce anything while billing is off", async () => {
    vi.stubEnv("BILLING_ENABLED", "false")
    expect(await getEntitlement("u1")).toEqual({ enforced: false })
    await expect(checkLookAllowance("u1")).resolves.toEqual({})
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled()
  })

  it("treats listed emails as Pro", async () => {
    vi.stubEnv("BILLING_EXEMPT_EMAILS", "Dueña@Example.com, otra@example.com")
    prismaMock.user.findUnique.mockResolvedValue({ email: "dueña@example.com" })
    const result = await getEntitlement("u1")
    expect(result).toMatchObject({ enforced: true, status: "exempt" })
    expect(result.enforced && result.plan?.id).toBe("pro")
  })

  it("gives no plan to someone who never subscribed", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null)
    expect(await getEntitlement("u1")).toMatchObject({ enforced: true, plan: null })
  })
})

describe("plan caps", () => {
  it("asks for a plan (402) when there is none", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null)
    await expect(checkLookAllowance("u1")).rejects.toMatchObject({ status: 402 })
    await expect(checkPhotoAllowance("u1")).rejects.toBeInstanceOf(PlanLimitError)
    await expect(checkGarmentAllowance("u1")).rejects.toMatchObject({ status: 402 })
  })

  it("returns the plan's daily cap for looks", async () => {
    subscribed("standard")
    await expect(checkLookAllowance("u1")).resolves.toEqual({
      dailyLimit: PLANS.standard.limits.looksPerDay,
    })
  })

  it("stops looks at the monthly cap (429)", async () => {
    subscribed("basic")
    prismaMock.usageMonth.findUnique.mockResolvedValue({
      looks: PLANS.basic.limits.looksPerMonth,
      photoChanges: 0,
      garments: 0,
    })
    await expect(checkLookAllowance("u1")).rejects.toMatchObject({ status: 429 })
  })

  it("stops base photos at the monthly cap", async () => {
    subscribed("basic")
    prismaMock.usageMonth.findUnique.mockResolvedValue({
      looks: 0,
      photoChanges: PLANS.basic.limits.photosPerMonth,
      garments: 0,
    })
    await expect(checkPhotoAllowance("u1")).rejects.toMatchObject({ status: 429 })
  })

  it("stops garments at the monthly cap and at the closet size", async () => {
    subscribed("basic")
    prismaMock.usageMonth.findUnique.mockResolvedValue({
      looks: 0,
      photoChanges: 0,
      garments: PLANS.basic.limits.garmentsPerMonth,
    })
    await expect(checkGarmentAllowance("u1")).rejects.toMatchObject({ status: 429 })

    prismaMock.usageMonth.findUnique.mockResolvedValue(null)
    prismaMock.wardrobe.count.mockResolvedValue(PLANS.basic.limits.closetMax)
    await expect(checkGarmentAllowance("u1")).rejects.toMatchObject({ status: 429 })
  })

  it("lets a cancelled plan work until the paid month ends, not after", async () => {
    subscribed("basic", "cancelled", future)
    await expect(checkLookAllowance("u1")).resolves.toBeDefined()
    subscribed("basic", "cancelled", past)
    await expect(checkLookAllowance("u1")).rejects.toMatchObject({ status: 402 })
  })
})

describe("webhook signature", () => {
  const secret = "whsec"
  const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex")

  it("accepts a valid signature", () => {
    const v1 = sign("id:abc123;request-id:req-1;ts:1700000000;")
    expect(
      verifyWebhookSignature({
        signature: `ts=1700000000,v1=${v1}`,
        requestId: "req-1",
        dataId: "ABC123",
        secret,
      })
    ).toBe(true)
  })

  it("rejects a different id, secret, or a missing header", () => {
    const v1 = sign("id:abc123;request-id:req-1;ts:1700000000;")
    const base = { signature: `ts=1700000000,v1=${v1}`, requestId: "req-1", dataId: "abc123", secret }
    expect(verifyWebhookSignature({ ...base, dataId: "other" })).toBe(false)
    expect(verifyWebhookSignature({ ...base, secret: "nope" })).toBe(false)
    expect(verifyWebhookSignature({ ...base, signature: null })).toBe(false)
    expect(verifyWebhookSignature({ ...base, signature: "garbage" })).toBe(false)
  })
})

describe("global monthly ceiling", () => {
  it("reads TRYON_GLOBAL_MONTHLY_LIMIT, and ignores nonsense", () => {
    expect(globalMonthlyLimit({ TRYON_GLOBAL_MONTHLY_LIMIT: "1500" } as never)).toBe(1500)
    expect(globalMonthlyLimit({} as never)).toBeNull()
    expect(globalMonthlyLimit({ TRYON_GLOBAL_MONTHLY_LIMIT: "0" } as never)).toBeNull()
    expect(globalMonthlyLimit({ TRYON_GLOBAL_MONTHLY_LIMIT: "abc" } as never)).toBeNull()
  })

  it("lets looks through while everyone together is under it", async () => {
    vi.stubEnv("TRYON_GLOBAL_MONTHLY_LIMIT", "100")
    subscribed("pro")
    prismaMock.usageMonth.aggregate.mockResolvedValue({ _sum: { looks: 99 } })
    await expect(checkLookAllowance("u1")).resolves.toBeDefined()
  })

  it("stops everyone at the ceiling with a 503, even someone with room in their plan", async () => {
    vi.stubEnv("TRYON_GLOBAL_MONTHLY_LIMIT", "100")
    subscribed("pro")
    prismaMock.usageMonth.aggregate.mockResolvedValue({ _sum: { looks: 100 } })
    vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(checkLookAllowance("u1")).rejects.toMatchObject({ status: 503 })
  })

  it("does nothing, and asks nothing, without a ceiling", async () => {
    subscribed("pro")
    await checkLookAllowance("u1")
    expect(prismaMock.usageMonth.aggregate).not.toHaveBeenCalled()
  })
})
