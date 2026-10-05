import { prisma } from "@/lib/prisma"
import type { LookGarment } from "./looks"

/** Garments of an outfit option, or null if it is not the user's. */
export async function getOptionGarments(
  optionId: string,
  userId: string
): Promise<LookGarment[] | null> {
  const option = await prisma.outfitOption.findUnique({
    where: { id: optionId },
    include: { items: true, outfit: { select: { userId: true } } },
  })
  if (!option || option.outfit.userId !== userId) return null
  return option.items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    imageUrl: item.imageUrl,
  }))
}
