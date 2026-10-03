import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser, unauthorized } from "@/lib/require-user"
import { generateWardrobe3D } from "@/lib/three-d/generate-wardrobe-3d"

export const maxDuration = 300

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request)
    if (!user) return unauthorized()

    const { id } = await params

    const item = await prisma.wardrobe.findUnique({ where: { id } })
    if (!item || item.userId !== user.id) {
      return NextResponse.json(
        { error: "Prenda no encontrada" },
        { status: 404 },
      )
    }
    if (!item.imageUrl) {
      return NextResponse.json(
        { error: "La prenda no tiene imagen" },
        { status: 400 },
      )
    }

    await generateWardrobe3D(id)

    const updated = await prisma.wardrobe.findUnique({ where: { id } })
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json(
      { error: `Fallo al generar modelo 3D: ${message}` },
      { status: 500 },
    )
  }
}
