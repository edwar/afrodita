"use client"

import { useTranslation } from "@/lib/i18n"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

/** Try-on actions that cost money or change the user's photo. */
export type TryOnAction = "regenerate" | "refresh" | "change" | "delete"

/**
 * Asks before a try-on action runs, spelling out what it does and what it
 * leaves alone, so the photo is never replaced or removed by a stray click.
 */
export function TryOnConfirm({
  action,
  onCancel,
  onConfirm,
}: {
  action: TryOnAction | null
  onCancel: () => void
  onConfirm: (action: TryOnAction) => void
}) {
  const { t } = useTranslation()
  // Keeps the texts stable while the dialog is closed
  const shown = action ?? "regenerate"

  return (
    <ConfirmDialog
      open={action !== null}
      title={t(`tryon.confirm.${shown}.title`)}
      description={t(`tryon.confirm.${shown}.description`)}
      confirmLabel={t(`tryon.confirm.${shown}.confirm`)}
      tone={shown === "delete" ? "danger" : "default"}
      onCancel={onCancel}
      onConfirm={() => action && onConfirm(action)}
    />
  )
}
