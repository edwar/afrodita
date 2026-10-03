"use client"

import { Check } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

interface OutfitItem {
  id: string
  name: string
  category: string
  color: string
  imageUrl: string
}

interface OutfitOption {
  id: string
  title: string
  description: string
  items: OutfitItem[]
}

interface OutfitPreviewProps {
  option: OutfitOption
  index: number
  isSelected: boolean
  onSelect: () => void
}

export function OutfitPreview({
  option,
  index,
  isSelected,
  onSelect,
}: OutfitPreviewProps) {
  const { t } = useTranslation()

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-6 border transition-all duration-300 ${
        isSelected
          ? "border-[#C9B99A] bg-[#C9B99A]/5"
          : "border-[#E0D9CF] hover:border-[#C9B99A]/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-2">
            {t("preview.option", { number: index + 1 })}
          </p>
          <h3 className="font-editorial text-xl font-light">{option.title}</h3>
        </div>
        {isSelected && (
          <div className="w-6 h-6 bg-[#C9B99A] flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-[#6B6B6B] mb-6 leading-relaxed">{option.description}</p>

      {/* Items */}
      <div className="space-y-3">
        <p className="text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B]">
          {t("preview.includedPieces")}
        </p>
        <div className="flex flex-wrap gap-2">
          {option.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 bg-[#EDE8E1] px-3 py-1.5"
            >
              <div
                className="w-2 h-2 rounded-full border border-[#E0D9CF]"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </button>
  )
}
