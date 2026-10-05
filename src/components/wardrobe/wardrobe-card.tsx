"use client"

import { useState } from "react"
import { Edit, Trash2 } from "lucide-react"
import Image from "next/image"
import { useTranslation } from "@/lib/i18n"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { WardrobeItem } from "@/hooks/use-wardrobe"

interface WardrobeCardProps {
  item: WardrobeItem
  onEdit: () => void
  onDelete: () => void
  /** Imagen above-the-fold (primeras filas del grid) */
  priority?: boolean
}

export function WardrobeCard({
  item,
  onEdit,
  onDelete,
  priority = false,
}: WardrobeCardProps) {
  const { t } = useTranslation()
  const [deleteOpen, setDeleteOpen] = useState(false)

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
