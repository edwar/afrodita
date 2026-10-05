"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2 } from "lucide-react"
import { sileo } from "sileo"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PLAN_IDS, PLANS, type PlanId } from "@/lib/billing/plans"
import { planFeatures } from "@/components/billing/plan-features"
import { useTranslation } from "@/lib/i18n"

interface BillingStatus {
  enabled: boolean
  configured: boolean
  currency: string
  prices: Record<PlanId, number>
  plan: PlanId | null
  status?: "pending" | "active" | "paused" | "cancelled" | "exempt" | "none"
  periodEnd?: string | null
  usage?: { looks: number; photoChanges: number; garments: number }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error ?? "Error")
  return data as T
}

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100))
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-[#6B6B6B]">{label}</span>
        <span>
          {used} / {max}
        </span>
      </div>
      <div className="h-1 bg-[#E0D9CF]">
        <div
          className={`h-full ${pct >= 100 ? "bg-red-700" : "bg-[#1A1A1A]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Subscription of the account: current plan and use, or the plans to pick. */
export function PlanSection() {
  const { t, locale } = useTranslation()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const returning = searchParams.get("checkout") === "return"

  const { data } = useQuery({
    queryKey: ["billing", "account"],
    // sync=1: if there is no plan yet, the server checks Mercado Pago itself, so a
    // payment made a moment ago shows up even if the webhook is late
    queryFn: () =>
      fetch("/api/billing/status?sync=1").then((r) => readJson<BillingStatus>(r)),
    // Coming back from paying it can take a few seconds: retry a handful of times
    refetchInterval: (query) =>
      returning && !query.state.data?.plan && query.state.dataUpdateCount < 10
        ? 3000
        : false,
  })

  const checkout = useMutation({
    mutationFn: (plan: PlanId) =>
      fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      }).then((r) => readJson<{ url: string }>(r)),
    onSuccess: ({ url }) => {
      window.location.href = url
    },
    onError: (error) => sileo.error({ title: error.message }),
  })

  const cancel = useMutation({
    mutationFn: () =>
      fetch("/api/billing/cancel", { method: "POST" }).then((r) => readJson(r)),
    onSuccess: () => {
      sileo.success({ title: t("account.plan.cancelled") })
      queryClient.invalidateQueries({ queryKey: ["billing"] })
    },
    onError: (error) => sileo.error({ title: error.message }),
  })

  if (!data?.enabled) return null

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat(locale === "es" ? "es-CO" : "en-US").format(amount)
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "es" ? "es-CO" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  const plan = data.plan ? PLANS[data.plan] : null
  const active = data.status === "active"
  const choosing = !active && data.status !== "exempt"

  return (
    <section id="planes" className="mt-2 pt-8">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="font-editorial text-3xl font-light">{t("account.plan.title")}</h2>
        <span
          className={`px-3 py-1 text-[10px] uppercase tracking-[0.15em] ${
            plan ? "bg-[#1A1A1A] text-white" : "border border-[#E0D9CF] text-[#6B6B6B]"
          }`}
        >
          {plan
            ? t("account.plan.current", { plan: t(`pricing.plans.${plan.id}.name`) })
            : t("account.plan.none")}
        </span>
      </div>

      {returning && !plan && (
        <p className="mb-4 flex items-center gap-2 text-sm text-[#6B6B6B]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("account.plan.confirming")}
        </p>
      )}

      {plan && data.usage && (
        <>
          <p className="mb-6 text-sm leading-relaxed text-[#6B6B6B]">
            {data.status === "cancelled"
              ? data.periodEnd
                ? t("account.plan.cancelledUntil", { date: formatDate(data.periodEnd) })
                : t("account.plan.cancelledNoDate")
              : data.status === "paused"
                ? t("account.plan.paused")
                : data.periodEnd
                  ? t("account.plan.renews", { date: formatDate(data.periodEnd) })
                  : ""}
          </p>
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#6B6B6B]">
            {t("account.plan.usage")}
          </p>
          <div className="mb-6 grid gap-5 sm:grid-cols-3">
            <Meter
              label={t("account.plan.usageLooks")}
              used={data.usage.looks}
              max={plan.limits.looksPerMonth}
            />
            <Meter
              label={t("account.plan.usagePhotos")}
              used={data.usage.photoChanges}
              max={plan.limits.photosPerMonth}
            />
            <Meter
              label={t("account.plan.usageGarments")}
              used={data.usage.garments}
              max={plan.limits.garmentsPerMonth}
            />
          </div>
        </>
      )}

      {active && (
        <>
          <p className="mb-4 text-xs text-[#6B6B6B]">{t("account.plan.changeHint")}</p>
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="text-xs uppercase tracking-[0.15em] underline underline-offset-4 hover:text-[#1A1A1A] text-[#6B6B6B]"
          >
            {t("account.plan.cancel")}
          </button>
        </>
      )}

      {choosing && (
        <>
          {!plan && (
            <p className="mb-6 text-sm leading-relaxed text-[#6B6B6B]">
              {t("account.plan.noneDesc")}
            </p>
          )}
          {!data.configured ? (
            <p className="text-sm text-[#6B6B6B]">{t("account.plan.unavailable")}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {PLAN_IDS.map((id) => (
                <div
                  key={id}
                  className={`flex flex-col p-6 ${
                    PLANS[id].highlighted
                      ? "border-2 border-[#1A1A1A]"
                      : "border border-[#E0D9CF]"
                  }`}
                >
                  <h3 className="font-editorial text-2xl font-light">
                    {t(`pricing.plans.${id}.name`)}
                  </h3>
                  <p className="mt-1 font-editorial text-4xl font-light">
                    ${PLANS[id].priceUsd}
                    <span className="ml-1 text-[10px] uppercase tracking-[0.15em] text-[#6B6B6B]">
                      USD
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    {t("account.plan.charge", {
                      amount: formatMoney(data.prices[id]),
                      currency: data.currency,
                    })}
                  </p>
                  <ul className="my-5 flex-1 space-y-2 text-xs">
                    {planFeatures(t, id).map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3 w-3 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={checkout.isPending}
                    onClick={() => checkout.mutate(id)}
                    className="btn-fashion inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {checkout.isPending && checkout.variables === id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {t("account.plan.subscribe")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title={t("account.plan.cancelTitle")}
        description={t("account.plan.cancelDesc")}
        confirmLabel={t("account.plan.cancelConfirm")}
        cancelLabel={t("account.plan.keep")}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false)
          cancel.mutate()
        }}
      />
    </section>
  )
}
