import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  subscription: { upsert: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const search = vi.hoisted(() => vi.fn())
vi.mock("../mercadopago", async (importActual) => ({
  ...(await importActual<typeof import("../mercadopago")>()),
  searchPreapprovals: search,
}))

import { syncUserSubscription } from "../subscription"

const stored = () => prismaMock.subscription.upsert.mock.calls[0]?.[0]

beforeEach(() => {
  vi.clearAllMocks()
})

describe("syncUserSubscription", () => {
  it("stores the authorized subscription even if a newer one was cancelled", async () => {
    search.mockResolvedValue([
      { id: "new-failed", status: "cancelled", external_reference: "u1:basic", date_created: "2026-10-05T02:58:52" },
      {
        id: "paid",
        status: "authorized",
        external_reference: "u1:pro",
        date_created: "2026-10-05T03:07:44",
        next_payment_date: "2026-11-05T03:08:40.000-04:00",
      },
      { id: "old", status: "pending", external_reference: "u1:basic", date_created: "2026-10-05T02:56:06" },
    ])
    await syncUserSubscription("u1", "a@b.test")
    expect(stored().update).toMatchObject({ plan: "pro", status: "active", mpPreapprovalId: "paid" })
  })

  it("falls back to the newest one when none is authorized", async () => {
    search.mockResolvedValue([
      { id: "older", status: "pending", external_reference: "u1:basic", date_created: "2026-10-05T01:00:00" },
      { id: "newer", status: "cancelled", external_reference: "u1:standard", date_created: "2026-10-05T02:00:00" },
    ])
    await syncUserSubscription("u1", "a@b.test")
    expect(stored().update).toMatchObject({ mpPreapprovalId: "newer", status: "cancelled" })
  })

  it("never takes a subscription that belongs to someone else", async () => {
    search.mockResolvedValue([
      { id: "other", status: "authorized", external_reference: "u2:pro", date_created: "2026-10-05T03:00:00" },
      { id: "foreign", status: "authorized", external_reference: "no-reference", date_created: "2026-10-05T03:00:00" },
    ])
    await syncUserSubscription("u1", "a@b.test")
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled()
  })

  it("does nothing when Mercado Pago has none", async () => {
    search.mockResolvedValue([])
    await syncUserSubscription("u1", "a@b.test")
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled()
  })
})
