import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId, unauthorized } from "@/lib/require-user"

export const maxDuration = 300

async function getOwnedItem(id: string, userId: string) {
  const item = await prisma.wardrobe.findUnique({ where: { id } })
  if (!item || item.userId !== userId) return null
  return item
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId(request.headers)
    if (!userId) return unauthorized()

    const { id } = await params
    const wardrobe = await getOwnedItem(id, userId)
    if (!wardrobe) {
      return NextResponse.json(
        { error: "Prenda no encontrada" },
        { status: 404 },
      )
    }
    return NextResponse.json(wardrobe)
  } catch (error) {
    console.error("GET wardrobe item failed:", error)
    return NextResponse.json(
      { error: "Error al obtener la prenda" },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId(request.headers)
    if (!userId) return unauthorized()

    const { id } = await params
    const body = await request.json()
    const { name, category, color, material, brand, season, imageUrl } = body

    const existing = await getOwnedItem(id, userId)
    if (!existing) {
      return NextResponse.json(
        { error: "Prenda no encontrada" },
        { status: 404 },
      )
    }

    const wardrobe = await prisma.wardrobe.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(color && { color }),
        ...(material !== undefined && { material }),
        ...(brand !== undefined && { brand }),
        ...(season !== undefined && { season }),
        ...(imageUrl && { imageUrl }),
      },
    })

    return NextResponse.json(wardrobe)
  } catch (error) {
    console.error("PUT wardrobe item failed:", error)
    return NextResponse.json(
      { error: "Error al actualizar la prenda" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId(request.headers)
    if (!userId) return unauthorized()

    const { id } = await params
    const existing = await getOwnedItem(id, userId)
    if (!existing) {
      return NextResponse.json(
        { error: "Prenda no encontrada" },
        { status: 404 },
      )
    }

    await prisma.wardrobe.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE wardrobe item failed:", error)
    return NextResponse.json(
      { error: "Error al eliminar la prenda" },
      { status: 500 },
    )
  }
}
