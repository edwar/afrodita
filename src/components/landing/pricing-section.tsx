"use client"

import Link from "next/link"
import { Check } from "lucide-react"
import { PLAN_IDS, PLANS } from "@/lib/billing/plans"
import { planFeatures } from "@/components/billing/plan-features"
import { useTranslation } from "@/lib/i18n"

/** Plans and prices. The buttons lead to Mi cuenta, where payment starts. */
export function PricingSection() {
  const { t } = useTranslation()

  return (
    <section
      id="planes"
      className="border-t border-[#E0D9CF] py-24 md:py-32"
      aria-labelledby="pricing-title"
    >
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <div className="mb-16 max-w-2xl">
          <p className="mb-6 text-[10px] uppercase tracking-[0.3em] text-[#6B6B6B]">
            {t("pricing.eyebrow")}
          </p>
          <h2
            id="pricing-title"
            className="mb-6 font-editorial text-5xl font-light leading-[0.95] md:text-6xl"
          >
            {t("pricing.title1")}{" "}
            <span className="italic">{t("pricing.title2")}</span>
          </h2>
          <p className="leading-relaxed text-[#6B6B6B]">{t("pricing.description")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLAN_IDS.map((id) => {
            const plan = PLANS[id]
            return (
              <div
                key={id}
                className={`relative flex flex-col p-8 ${
                  plan.highlighted
                    ? "bg-[#1A1A1A] text-white"
                    : "border border-[#E0D9CF]"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-8 bg-[#C9B99A] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A]">
                    {t("pricing.popular")}
                  </span>
                )}
                <h3 className="font-editorial text-3xl font-light">
                  {t(`pricing.plans.${id}.name`)}
                </h3>
                <p
                  className={`mt-2 min-h-10 text-sm leading-relaxed ${
                    plan.highlighted ? "text-white/60" : "text-[#6B6B6B]"
                  }`}
                >
                  {t(`pricing.plans.${id}.tagline`)}
                </p>

                <p className="mt-8 flex items-baseline gap-2">
                  <span className="font-editorial text-6xl font-light">
                    ${plan.priceUsd}
                  </span>
                  <span
                    className={`text-xs uppercase tracking-[0.15em] ${
                      plan.highlighted ? "text-white/50" : "text-[#6B6B6B]"
                    }`}
                  >
                    USD {t("pricing.perMonth")}
                  </span>
                </p>

                <ul className="mt-8 flex-1 space-y-3 text-sm">
                  {planFeatures(t, id).map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          plan.highlighted ? "text-[#C9B99A]" : "text-[#1A1A1A]"
                        }`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/account#planes"
                  className={`mt-10 inline-flex items-center justify-center px-6 py-4 text-[11px] font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-80 ${
                    plan.highlighted
                      ? "bg-white text-[#1A1A1A]"
                      : "bg-[#1A1A1A] text-white"
                  }`}
                >
                  {t("pricing.cta")}
                </Link>
              </div>
            )
          })}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-[#6B6B6B]">
          {t("pricing.cacheNote")} {t("pricing.billingNote")}
        </p>
      </div>
    </section>
  )
}
