"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "@/lib/i18n"

/**
 * Strip under the navbar for someone who is signed in but has no plan, so
 * they learn it before an upload fails. Not shown while billing is off, to
 * people with a plan or exempt, or on Mi cuenta, where the plans already are.
 */
export function PlanNotice() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const { data } = useQuery({
    queryKey: ["billing"],
    queryFn: () =>
      fetch("/api/billing/status").then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("billing status")),
      ),
    retry: false,
  })

  if (!data?.enabled || data.plan || pathname.startsWith("/account")) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-16 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[#1A1A1A] px-6 py-2.5 text-center text-xs text-white"
    >
      <span>{t("account.plan.notice")}</span>
      <Link
        href="/account#planes"
        className="font-medium uppercase tracking-[0.15em] underline underline-offset-4 hover:opacity-80"
      >
        {t("account.plan.noticeCta")}
      </Link>
    </div>
  )
}
