"use client"

import { useTranslation } from "@/lib/i18n"

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()

  return (
    <div className="flex items-center gap-1 border border-[#E0D9CF]">
      <button
        onClick={() => setLocale("es")}
        className={`px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition-colors ${
          locale === "es"
            ? "bg-[#1A1A1A] text-white"
            : "text-[#6B6B6B] hover:text-[#1A1A1A]"
        }`}
      >
        ES
      </button>
      <button
        onClick={() => setLocale("en")}
        className={`px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase transition-colors ${
          locale === "en"
            ? "bg-[#1A1A1A] text-white"
            : "text-[#6B6B6B] hover:text-[#1A1A1A]"
        }`}
      >
        EN
      </button>
    </div>
  )
}
