"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "@/lib/i18n"

/**
 * Conditions the user accepts before choosing a photo. Opened every time:
 * each photo is its own declaration. Choosing the file only happens after
 * "Continue", from the same click, so the browser still allows the picker.
 */
export function PhotoConsentDialog({
  open,
  onCancel,
  onAccept,
}: {
  open: boolean
  onCancel: () => void
  onAccept: () => void
}) {
  // Mounted only while open, so the box always starts unchecked
  if (!open) return null
  return <ConsentBody onCancel={onCancel} onAccept={onAccept} />
}

function ConsentBody({
  onCancel,
  onAccept,
}: {
  onCancel: () => void
  onAccept: () => void
}) {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1A1A1A]/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-consent-title"
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto border border-[#E0D9CF] bg-[#F8F5F0] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 pb-2">
          <h2
            id="photo-consent-title"
            className="mb-3 font-editorial text-2xl font-light"
          >
            {t("tryon.consent.title")}
          </h2>
          <p className="mb-3 text-sm text-[#6B6B6B]">
            {t("tryon.consent.intro")}
          </p>
          <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            <li>{t("tryon.consent.itself")}</li>
            <li>{t("tryon.consent.adult")}</li>
            <li>{t("tryon.consent.clothed")}</li>
          </ul>
          <p className="mb-4 text-xs leading-relaxed text-[#6B6B6B]">
            {t("tryon.consent.review")}
          </p>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#1A1A1A]"
            />
            <span>{t("tryon.consent.confirm")}</span>
          </label>
        </div>

        <div className="flex gap-3 p-6 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-fashion-outline flex-1"
          >
            {t("wardrobe.deleteCancel")}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!checked}
            className="btn-fashion flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("tryon.consent.continue")}
          </button>
        </div>
      </div>
    </div>
  )
}
