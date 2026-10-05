import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId, unauthorized } from "@/lib/require-user"
import { PlanLimitError, checkGarmentAllowance, recordUsage } from "@/lib/billing/limits"

export const maxDuration = 300

export async function GET(request: Request) {
  try {
    const userId = await requireUserId(request.headers)
    if (!userId) return unauthorized()

    const wardrobe = await prisma.wardrobe.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(
      wardrobe.map((item) => ({
        ...item,
        name: item.name ?? "",
        category: item.category ?? "",
        color: item.color ?? "",
      })),
    )
  } catch (error) {
    console.error("GET /api/wardrobe failed:", error)
    return NextResponse.json(
      { error: "Error al obtener el wardrobe" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request.headers)
    if (!userId) return unauthorized()

    const body = await request.json()
    const { name, category, color, material, brand, season, imageUrl } = body

    if (!name || !category || !color || !imageUrl) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: name, category, color, imageUrl" },
        { status: 400 },
      )
    }

    await checkGarmentAllowance(userId)

    const wardrobe = await prisma.wardrobe.create({
      data: {
        name,
        category,
        color,
        material,
        brand,
        season,
        imageUrl,
        userId,
      },
    })

    await recordUsage(userId, "garments")
    return NextResponse.json(wardrobe, { status: 201 })
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("POST /api/wardrobe failed:", error)
    const message = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json(
      { error: `Error al crear la prenda: ${message}` },
      { status: 500 },
    )
  }
}
