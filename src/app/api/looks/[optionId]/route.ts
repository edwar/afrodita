import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser, unauthorized } from "@/lib/require-user"
import { lookKey } from "@/lib/tryon/feedback-core"
import { removeLike } from "@/lib/tryon/feedback"
import { deleteLookImage } from "@/lib/tryon/looks"

/**
 * Deletes a look: every outfit option of the user made of exactly the same
 * garments (the gallery shows them as one) and its generated image. Outfits
 * left without options go too. The garments themselves are not touched.
 * A "like" goes with the look; a "dislike" stays so it is not proposed again.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ optionId: string }> },
) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const { optionId } = await params
  try {
    const options = await prisma.outfitOption.findMany({
      where: { outfit: { userId: user.id } },
      include: { items: { select: { id: true, imageUrl: true } } },
    })
    const target = options.find((option) => option.id === optionId)
    if (!target) {
      return NextResponse.json({ error: "Look no encontrado" }, { status: 404 })
    }

    const key = lookKey(target.items)
    const same = options.filter((option) => lookKey(option.items) === key)

    await prisma.outfitOption.deleteMany({
      where: { id: { in: same.map((option) => option.id) } },
    })
    await prisma.outfit.deleteMany({
      where: { userId: user.id, options: { none: {} } },
    })
    await deleteLookImage(user.id, target.items)
    await removeLike(user.id, key)

    return NextResponse.json({ deleted: same.length })
  } catch (error) {
    console.error(`DELETE /api/looks/${optionId} failed:`, error)
    return NextResponse.json({ error: "No se pudo eliminar el look" }, { status: 500 })
  }
}
