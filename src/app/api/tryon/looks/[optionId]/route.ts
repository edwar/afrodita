import { NextResponse } from "next/server"
import { requireUser, unauthorized } from "@/lib/require-user"
import { TryOnError } from "@/lib/tryon/gemini"
import { describeLook, generateLook, getLookState } from "@/lib/tryon/looks"
import { getOptionGarments } from "@/lib/tryon/option"

// Image generation usually takes 10-30 s
export const maxDuration = 120

type Params = { params: Promise<{ optionId: string }> }

/** Whether the user has a photo and whether this look is already generated. */
export async function GET(request: Request, { params }: Params) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const { optionId } = await params
  const garments = await getOptionGarments(optionId, user.id)
  if (!garments) {
    return NextResponse.json({ error: "Look no encontrado" }, { status: 404 })
  }

  return NextResponse.json(describeLook(optionId, await getLookState(user.id, garments)))
}

/**
 * Generates the look, or returns it if it is already up to date with the
 * user's photo. Body `{ "regenerate": true }` asks for another attempt.
 */
export async function POST(request: Request, { params }: Params) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const { optionId } = await params
  const garments = await getOptionGarments(optionId, user.id)
  if (!garments) {
    return NextResponse.json({ error: "Look no encontrado" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  try {
    const state = await generateLook(user.id, garments, body?.regenerate === true)
    return NextResponse.json(describeLook(optionId, state))
  } catch (error) {
    if (error instanceof TryOnError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(`[api/tryon/looks] ${optionId} failed:`, error)
    return NextResponse.json(
      { error: "No se pudo generar el look. Intenta de nuevo." },
      { status: 500 },
    )
  }
}
