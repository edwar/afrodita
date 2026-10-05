"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { REASONS, type Reason } from "@/lib/tryon/feedback-core"

/**
 * Asks what did not work in a look. The reasons are optional: they help the
 * stylist learn, but the look is rejected either way.
 */
export function DislikeDialog({
  lookTitle,
  onCancel,
  onConfirm,
}: {
  lookTitle: string | null
  onCancel: () => void
  onConfirm: (reasons: Reason[]) => void
}) {
  // Mounted only while open, so every look starts with no reasons selected
  if (lookTitle === null) return null
  return (
    <DislikeDialogBody
      lookTitle={lookTitle}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

function DislikeDialogBody({
  lookTitle,
  onCancel,
  onConfirm,
}: {
  lookTitle: string
  onCancel: () => void
  onConfirm: (reasons: Reason[]) => void
}) {
  const { t } = useTranslation()
  const [reasons, setReasons] = useState<Reason[]>([])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  const toggle = (reason: Reason) =>
    setReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason],
    )

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1A1A1A]/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dislike-dialog-title"
    >
      <div
        className="w-full max-w-md border border-[#E0D9CF] bg-[#F8F5F0] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 pb-2">
          <h2
            id="dislike-dialog-title"
            className="mb-2 font-editorial text-2xl font-light"
          >
            {t("looks.dislikeTitle")}
          </h2>
          <p className="mb-1 text-xs uppercase tracking-[0.15em] text-[#6B6B6B]">
            {lookTitle}
          </p>
          <p className="text-sm leading-relaxed text-[#6B6B6B]">
            {t("looks.dislikeHint")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 px-6 pb-2 pt-3">
          {REASONS.map((reason) => {
            const on = reasons.includes(reason)
            return (
              <button
                key={reason}
                onClick={() => toggle(reason)}
                aria-pressed={on}
                className={`border px-3 py-2 text-xs transition-colors ${
                  on
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                    : "border-[#E0D9CF] hover:border-[#1A1A1A]"
                }`}
              >
                {t(`looks.reasons.${reason}`)}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 p-6 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-fashion-outline flex-1"
            autoFocus
          >
            {t("wardrobe.deleteCancel")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reasons)}
            className="flex-1 bg-[#1A1A1A] px-4 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#2D2D2D]"
          >
            {t("looks.dislikeConfirm")}
          </button>
        </div>
      </div>
    </div>
  )
}
