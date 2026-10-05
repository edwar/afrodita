"use client"

import Image from "next/image"
import type { Reason, Vote } from "@/lib/tryon/feedback-core"

export interface Garment {
  id: string
  name: string
  category: string
  color: string
  imageUrl: string
}

export interface Look {
  optionId: string
  title: string
  description: string | null
  /** What the user asked the stylist for. */
  request: string
  createdAt: string
  garments: Garment[]
  imageUrl: string | null
  /** Made from a photo the user has since changed or deleted. */
  outdated: boolean
  /** What the user thinks of it: liked, rejected, or nothing yet. */
  vote: Vote | null
  /** Why it was rejected (only for "dislike"). */
  reasons: Reason[]
}

/** Stand-in for a look without a generated image: its garments, tiled. */
export function GarmentCollage({ garments }: { garments: Garment[] }) {
  const shown = garments.slice(0, 4)
  return (
    <div
      className={`grid h-full w-full gap-px ${shown.length > 1 ? "grid-cols-2" : ""}`}
    >
      {shown.map((item) => (
        <div key={item.id} className="relative bg-white">
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="20vw"
            className="object-contain p-2"
          />
        </div>
      ))}
    </div>
  )
}
