"use client"

import Link from "next/link"
import { Lock, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { OutfitPreview } from "@/components/preview/outfit-preview"
import { ARMirror, TryOnGarment } from "@/components/tryon/ar-mirror"
import { TryOn3D } from "@/components/tryon/tryon-3d"

interface OutfitItem {
  id: string
  name: string
  category: string
  color: string
  material?: string | null
  imageUrl: string
  modelUrl?: string | null
  riggedModelUrl?: string | null
  skeletonMapVersion?: string | null
}

interface OutfitOption {
  id: string
  title: string
  description: string
  items: OutfitItem[]
}

interface Outfit {
  id: string
  options: OutfitOption[]
}

type PageStatus = "loading" | "locked" | "ready"

export default function PreviewPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<PageStatus>("loading")
  const [outfit, setOutfit] = useState<Outfit | null>(null)
  const [selectedOption, setSelectedOption] = useState(0)

  useEffect(() => {
    const fetchLatestOutfit = async () => {
      try {
        const res = await fetch("/api/outfits")
        if (!res.ok) throw new Error("Failed to load outfit")
        const data: Outfit | null = await res.json()

        if (data && data.options.length === 3) {
          setOutfit(data)
          setStatus("ready")
        } else {
          setStatus("locked")
        }
      } catch (error) {
        console.error("Error loading outfit:", error)
        setStatus("locked")
      }
    }
    fetchLatestOutfit()
  }, [])

  const options = outfit?.options ?? []
  const currentOption = options[selectedOption] ?? options[0]

  const selectedGarments: TryOnGarment[] = useMemo(
    () =>
      (currentOption?.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        color: item.color,
        material: item.material ?? undefined,
        imageUrl: item.imageUrl,
        modelUrl: item.modelUrl ?? undefined,
        riggedModelUrl: item.riggedModelUrl ?? undefined,
        skeletonMapVersion: item.skeletonMapVersion ?? undefined,
      })),
    [currentOption]
  )

  return (
    <main className="pt-16">
        {status === "loading" && (
          <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
            <div className="w-8 h-8 border border-[#C9B99A] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === "locked" && (
          <div className="max-w-md mx-auto px-6 py-24 text-center">
            <div className="w-14 h-14 bg-[#C9B99A]/20 flex items-center justify-center mx-auto mb-8">
              <Lock className="w-6 h-6 text-[#C9B99A]" />
            </div>
            <h1 className="font-editorial text-4xl font-light mb-4">
              {t("preview.locked.title")}
            </h1>
            <p className="text-sm text-[#6B6B6B] leading-relaxed mb-8">
              {t("preview.locked.description")}
            </p>
            <Link href="/chat" className="btn-fashion inline-flex items-center gap-3">
              {t("preview.locked.cta")}
            </Link>
          </div>
        )}

        {status === "ready" && currentOption && (
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-3">
                  Generated Looks
                </p>
                <h1 className="font-editorial text-5xl md:text-6xl font-light">
                  {t("preview.title")}
                </h1>
                <p className="text-sm text-[#6B6B6B] mt-3">
                  {t("preview.subtitle")}
                </p>
              </div>
              <Link
                href="/chat"
                className="btn-fashion-outline inline-flex items-center gap-3 self-start"
              >
                <RefreshCw className="w-4 h-4" />
                {t("preview.regenerate")}
              </Link>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Options list */}
              <div className="space-y-4">
                {options.map((option, index) => (
                  <OutfitPreview
                    key={option.id}
                    option={option}
                    index={index}
                    isSelected={selectedOption === index}
                    onSelect={() => setSelectedOption(index)}
                  />
                ))}
              </div>

              {/* AR Try-On */}
              <div className="lg:col-span-2">
                <div className="bg-white border border-[#E0D9CF] p-8 sticky top-24">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-1">
                        {t("preview.selectedLook")}
                      </p>
                      <h2 className="font-editorial text-2xl font-light">
                        {currentOption.title}
                      </h2>
                    </div>
                    <span className="text-[10px] tracking-[0.2em] uppercase text-[#C9B99A] bg-[#C9B99A]/10 px-4 py-2">
                      {t("preview.arPreview")}
                    </span>
                  </div>

                  {selectedGarments.length > 0 &&
                  selectedGarments.every((g) => g.modelUrl) ? (
                    <div className="bg-[#1A1A1A]">
                      <TryOn3D garments={selectedGarments} />
                    </div>
                  ) : (
                    <div className="aspect-[3/4] bg-[#EDE8E1]">
                      <ARMirror garments={selectedGarments} />
                    </div>
                  )}

                  <p className="text-xs text-[#6B6B6B] text-center mt-4">
                    {t("preview.arHint")}
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-4 mt-8">
                    <button className="btn-fashion-outline flex-1">
                      {t("preview.saveLook")}
                    </button>
                    <button className="btn-fashion flex-1">
                      {t("preview.useOutfit")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
  )
}
