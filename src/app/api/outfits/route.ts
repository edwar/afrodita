import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId, unauthorized } from "@/lib/require-user"

export async function GET(request: Request) {
  try {
    const userId = await requireUserId(request.headers)
    if (!userId) return unauthorized()

    const outfit = await prisma.outfit.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { options: { include: { items: true } } },
    })

    return NextResponse.json(outfit)
  } catch (error) {
    console.error("GET /api/outfits failed:", error)
    return NextResponse.json(
      { error: "Error al obtener el último outfit" },
      { status: 500 },
    )
  }
}
