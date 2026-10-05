import { NextResponse } from "next/server"
import { requireUser, unauthorized } from "@/lib/require-user"
import { lookKey, sanitizeReasons, type VoteRecord } from "@/lib/tryon/feedback-core"
import { setVote } from "@/lib/tryon/feedback"
import { getOptionContext } from "@/lib/tryon/option"

/**
 * Body `{ "vote": "like" | "dislike" | null, "reasons"?: Reason[] }`.
 * `null` takes the vote back. A disliked look is never proposed again.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ optionId: string }> },
) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const { optionId } = await params
  const body = await request.json().catch(() => null)
  const vote = body?.vote
  if (vote !== "like" && vote !== "dislike" && vote !== null) {
    return NextResponse.json({ error: "Voto no válido" }, { status: 400 })
  }

  const context = await getOptionContext(optionId, user.id)
  if (!context) {
    return NextResponse.json({ error: "Look no encontrado" }, { status: 404 })
  }

  const record: VoteRecord | null =
    vote === null
      ? null
      : {
          vote,
          reasons: vote === "dislike" ? sanitizeReasons(body?.reasons) : [],
          request: context.request,
          garments: context.garments.map((garment) => garment.id),
          at: new Date().toISOString(),
        }

  try {
    await setVote(user.id, lookKey(context.garments), record)
    return NextResponse.json({ vote, reasons: record?.reasons ?? [] })
  } catch (error) {
    console.error(`PUT /api/looks/${optionId}/feedback failed:`, error)
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 })
  }
}
