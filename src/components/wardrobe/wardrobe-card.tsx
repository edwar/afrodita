"use client"

import { useState } from "react"
import { Box, Edit, Loader2, RefreshCw, Trash2 } from "lucide-react"
import Image from "next/image"
import { useTranslation } from "@/lib/i18n"
import { ModelPreviewModal } from "./model-preview-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { WardrobeItem } from "@/hooks/use-wardrobe"

interface WardrobeCardProps {
  item: WardrobeItem
  onEdit: () => void
  onDelete: () => void
  onGenerate3D?: () => void
  /** Imagen above-the-fold (primeras filas del grid) */
  priority?: boolean
}

export function WardrobeCard({
  item,
  onEdit,
  onDelete,
  onGenerate3D,
  priority = false,
}: WardrobeCardProps) {
  const { t } = useTranslation()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const status = item.model3dStatus
  const hasModel = !!item.modelUrl && status !== "generating"
  const isGenerating = status === "generating"
  const canPreview = hasModel

  const handleBoxClick = () => {
    if (canPreview) {
      setPreviewOpen(true)
      return
    }
    if (!isGenerating) {
      onGenerate3D?.()
    }
  }

  const handleConfirmDelete = () => {
    setDeleteOpen(false)
    onDelete()
  }

  return (
    <div className="group">
      {/* Image */}
      <div className="aspect-[3/4] bg-[#EDE8E1] relative overflow-hidden mb-4">
        <Image
          width={500}
          height={500}
          src={item.imageUrl}
          alt={item.name}
          loading={priority ? "eager" : "lazy"}
          priority={priority}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* Badge 3D */}
        {hasModel && (
          <div className="absolute top-3 right-3 bg-[#1A1A1A]/70 backdrop-blur-sm px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-white">
            3D
          </div>
        )}

        {isGenerating && (
          <div className="absolute top-3 right-3 bg-[#C9B99A]/90 backdrop-blur-sm px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-[#1A1A1A] flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            3D
          </div>
        )}

        {status === "failed" && (
          <div
            className="absolute top-3 left-3 right-3 bg-[#1A1A1A]/85 backdrop-blur-sm px-2 py-1.5 text-[10px] text-white/90 leading-snug"
            title={item.model3dError || undefined}
          >
            {item.model3dError || t("wardrobe.model3dFailed")}
          </div>
        )}

        {/* Actions overlay */}
        <div className="absolute inset-0 bg-[#1A1A1A]/0 group-hover:bg-[#1A1A1A]/20 transition-all duration-500 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="p-3 bg-white/90 hover:bg-white transition-colors"
            aria-label={t("wardrobe.edit")}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="p-3 bg-white/90 hover:bg-white transition-colors text-[#1A1A1A]"
            aria-label={t("wardrobe.delete")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleBoxClick}
            disabled={isGenerating}
            className="p-3 bg-white/90 hover:bg-white transition-colors text-[#1A1A1A] disabled:opacity-60"
            aria-label={
              canPreview
                ? t("wardrobe.preview3d")
                : isGenerating
                  ? t("wardrobe.generating3d")
                  : t("wardrobe.generate3d")
            }
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : canPreview ? (
              <Box className="w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div>
        <h3 className="font-editorial text-lg font-light mb-1">{item.name}</h3>
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full border border-[#E0D9CF]"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-[#6B6B6B] capitalize">
            {item.category}
          </span>
        </div>
        {item.brand && (
          <p className="text-xs text-[#6B6B6B] mt-1">{item.brand}</p>
        )}
      </div>

      {previewOpen && (
        <ModelPreviewModal
          open
          onClose={() => setPreviewOpen(false)}
          modelUrl={item.modelUrl ?? ""}
          riggedModelUrl={item.riggedModelUrl}
          name={item.name}
          material={item.material}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title={t("wardrobe.deleteTitle")}
        description={t("wardrobe.deleteDescription", { name: item.name })}
        confirmLabel={t("wardrobe.deleteConfirm")}
        cancelLabel={t("wardrobe.deleteCancel")}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
