import { NextResponse, after } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId, unauthorized } from "@/lib/require-user"
import { generateWardrobe3D } from "@/lib/three-d/generate-wardrobe-3d"

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

    const wardrobe = await prisma.wardrobe.create({
      data: {
        name,
        category,
        color,
        material,
        brand,
        season,
        imageUrl,
        model3dStatus: "generating",
        userId,
      },
    })

    const id = wardrobe.id
    try {
      after(async () => {
        try {
          await generateWardrobe3D(id)
        } catch (error) {
          console.error("Auto 3D generation failed:", error)
        }
      })
    } catch (error) {
      console.error("after() failed, generation deferred:", error)
    }

    return NextResponse.json(wardrobe, { status: 201 })
  } catch (error) {
    console.error("POST /api/wardrobe failed:", error)
    const message = error instanceof Error ? error.message : "Error desconocido"
    return NextResponse.json(
      { error: `Error al crear la prenda: ${message}` },
      { status: 500 },
    )
  }
}
