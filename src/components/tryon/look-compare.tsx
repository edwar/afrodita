"use client"

import { useEffect } from "react"
import Image from "next/image"
import { Heart, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { GarmentCollage, type Look } from "./look-parts"

/** Most looks that fit side by side and stay readable. */
export const MAX_COMPARED = 4

/**
 * Side-by-side view of a few looks. Garments every compared look shares are
 * toned down, so what actually differs between them stands out.
 */
export function LookCompare({
  looks,
  onClose,
  onOpen,
  onToggleLike,
}: {
  looks: Look[]
  onClose: () => void
  onOpen: (look: Look) => void
  onToggleLike: (look: Look) => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    // The page behind must not scroll while the comparison is open
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const shared = new Set(
    looks[0]?.garments
      .filter((garment) =>
        looks.every((look) =>
          look.garments.some((item) => item.id === garment.id),
        ),
      )
      .map((garment) => garment.id),
  )

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#F8F5F0]"
      role="dialog"
      aria-modal="true"
      aria-label={t("looks.compareTitle")}
    >
      <div className="flex items-center justify-between gap-6 border-b border-[#E0D9CF] px-6 py-4 md:px-12">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#6B6B6B]">
            {t("looks.compareCount", { count: looks.length })}
          </p>
          <h2 className="font-editorial text-2xl font-light md:text-3xl">
            {t("looks.compareTitle")}
          </h2>
        </div>
        <button onClick={onClose} aria-label={t("looks.close")} className="p-2">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-8 md:px-12">
        <div
          className="mx-auto grid max-w-[1400px] gap-6"
          style={{
            // Columns never get too narrow: on a phone they scroll sideways
            gridTemplateColumns: `repeat(${looks.length}, minmax(13rem, 1fr))`,
          }}
        >
          {looks.map((look) => (
            <article key={look.optionId} className="flex min-w-0 flex-col">
              <button
                onClick={() => onOpen(look)}
                className="group relative mb-4 block aspect-[2/3] w-full overflow-hidden bg-[#EDE8E1]"
                title={t("looks.compareOpen")}
              >
                {look.imageUrl ? (
                  <Image
                    src={look.imageUrl}
                    alt={look.title}
                    fill
                    sizes="(min-width: 1024px) 25vw, 60vw"
                    className="object-cover object-top"
                  />
                ) : (
                  <GarmentCollage garments={look.garments} />
                )}
                {(!look.imageUrl || look.outdated) && (
                  <span className="absolute bottom-3 left-3 bg-[#1A1A1A]/70 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                    {t(look.imageUrl ? "looks.outdated" : "looks.notGenerated")}
                  </span>
                )}
              </button>

              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="font-editorial text-xl font-light leading-tight">
                  {look.title}
                </h3>
                <button
                  onClick={() => onToggleLike(look)}
                  aria-label={t(look.liked ? "looks.unlike" : "looks.like")}
                  aria-pressed={look.liked}
                  className="shrink-0 p-1 text-[#1A1A1A]"
                >
                  <Heart
                    className={`h-4 w-4 ${look.liked ? "fill-current" : ""}`}
                  />
                </button>
              </div>
              {look.description && (
                <p className="mb-4 text-xs leading-relaxed text-[#6B6B6B]">
                  {look.description}
                </p>
              )}

              <ul className="mt-auto space-y-2 border-t border-[#E0D9CF] pt-4">
                {look.garments.map((garment) => {
                  const common = looks.length > 1 && shared.has(garment.id)
                  return (
                    <li
                      key={garment.id}
                      className={`flex items-center gap-3 text-xs ${
                        common ? "text-[#6B6B6B]/70" : "text-[#1A1A1A]"
                      }`}
                    >
                      <span
                        className={`relative h-10 w-8 shrink-0 overflow-hidden bg-white ${
                          common ? "opacity-50" : ""
                        }`}
                      >
                        <Image
                          src={garment.imageUrl}
                          alt=""
                          fill
                          sizes="32px"
                          className="object-contain"
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {garment.name}
                      </span>
                      {common && (
                        <span className="shrink-0 text-[9px] uppercase tracking-[0.15em]">
                          {t("looks.compareShared")}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
