"use client"

import { useEffect } from "react"
import { useTranslation } from "@/lib/i18n"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  tone?: "danger" | "default"
}

/**
 * Diálogo de confirmación con el mismo lenguaje visual de la app
 * (fondo crema, bordes editoriales, botones fashion).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "danger",
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#1A1A1A]/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="bg-[#F8F5F0] w-full max-w-md border border-[#E0D9CF] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-2">
          <h2
            id="confirm-dialog-title"
            className="font-editorial text-2xl font-light mb-2"
          >
            {title}
          </h2>
          {description && (
            <p className="text-sm text-[#6B6B6B] leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-fashion-outline flex-1"
            autoFocus
          >
            {cancelLabel || t("wardrobe.deleteCancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              tone === "danger"
                ? "flex-1 px-4 py-3 text-[11px] tracking-[0.15em] uppercase font-medium bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] transition-colors"
                : "btn-fashion flex-1"
            }
          >
            {confirmLabel || t("wardrobe.deleteConfirm")}
          </button>
        </div>
      </div>
    </div>
  )
}
