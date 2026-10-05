"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { JsonLd } from "@/components/json-ld"
import { FAQ } from "@/lib/faq"
import { useTranslation } from "@/lib/i18n"
import { faqJsonLd } from "@/lib/json-ld"

/**
 * Frequently asked questions. Native <details>: every answer is in the HTML
 * (so crawlers and AI engines read it) even while it is collapsed. The
 * structured data is built from the same list, so it matches what is shown.
 */
export function FaqSection() {
  const { t, locale } = useTranslation()
  const items = FAQ[locale]

  return (
    <section
      id="faq"
      className="border-t border-[#E0D9CF] py-24 md:py-32"
      aria-labelledby="faq-title"
    >
      <JsonLd data={faqJsonLd(items, locale)} />
      <div className="mx-auto grid max-w-[1400px] gap-12 px-6 md:px-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="mb-6 text-[10px] uppercase tracking-[0.3em] text-[#6B6B6B]">
            {t("faq.eyebrow")}
          </p>
          <h2
            id="faq-title"
            className="font-editorial text-5xl font-light leading-[0.95] md:text-6xl"
          >
            {t("faq.title")}
          </h2>
        </div>

        <div className="lg:col-span-8">
          {items.map((item) => (
            <details
              key={item.question}
              className="group border-b border-[#E0D9CF]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                <h3 className="font-editorial text-xl font-light md:text-2xl">
                  {item.question}
                </h3>
                <Plus className="h-5 w-5 shrink-0 text-[#6B6B6B] transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <div className="max-w-2xl pb-8 leading-relaxed text-[#6B6B6B]">
                <p>{item.answer}</p>
                {item.policyLink && (
                  <p className="mt-3">
                    <Link
                      href="/seguridad"
                      className="text-[#1A1A1A] underline underline-offset-4"
                    >
                      {t("faq.policyLink")}
                    </Link>
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
