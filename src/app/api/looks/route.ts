import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser, unauthorized } from "@/lib/require-user"
import { getLikes, lookKey } from "@/lib/tryon/likes"
import { describeLook, getLookIndex, resolveLook } from "@/lib/tryon/looks"

/**
 * Every outfit the stylist has proposed to the user, newest first, each with
 * its generated image when there is one (even if made from an earlier
 * photo). It never triggers a generation.
 */
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  try {
    const [outfits, index, likes] = await Promise.all([
      prisma.outfit.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { options: { include: { items: true } } },
      }),
      getLookIndex(user.id),
      getLikes(user.id),
    ])

    const options = outfits.flatMap((outfit) =>
      outfit.options
        .filter((option) => option.items.length > 0)
        .map((option) => ({ outfit, option }))
    )
    const looks = await Promise.all(
      options.map(async ({ outfit, option }) => {
        const garments = option.items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          color: item.color,
          imageUrl: item.imageUrl,
        }))
        const look = describeLook(option.id, await resolveLook(user.id, garments, index))
        return {
          optionId: option.id,
          title: option.title,
          description: option.description,
          request: outfit.prompt,
          createdAt: outfit.createdAt,
          garments,
          imageUrl: look.imageUrl,
          outdated: look.outdated,
          liked: likes.has(lookKey(garments)),
        }
      })
    )

    return NextResponse.json({ photo: index.photoVersion !== null, looks })
  } catch (error) {
    console.error("GET /api/looks failed:", error)
    return NextResponse.json({ error: "Error al obtener tus looks" }, { status: 500 })
  }
}
