import { NextResponse } from "next/server"
import { requireUser, unauthorized } from "@/lib/require-user"
import { lookKey, setLike } from "@/lib/tryon/likes"
import { getOptionGarments } from "@/lib/tryon/option"

/** Body `{ "liked": boolean }`: marks or unmarks the look as liked. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ optionId: string }> },
) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const { optionId } = await params
  const body = await request.json().catch(() => null)
  if (typeof body?.liked !== "boolean") {
    return NextResponse.json({ error: "Falta el campo liked" }, { status: 400 })
  }

  const garments = await getOptionGarments(optionId, user.id)
  if (!garments) {
    return NextResponse.json({ error: "Look no encontrado" }, { status: 404 })
  }

  try {
    await setLike(user.id, lookKey(garments), body.liked)
    return NextResponse.json({ liked: body.liked })
  } catch (error) {
    console.error(`PUT /api/looks/${optionId}/like failed:`, error)
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 })
  }
}
