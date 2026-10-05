import { NextResponse } from "next/server"
import { requireUser, unauthorized } from "@/lib/require-user"
import { getLookImage, getLookState } from "@/lib/tryon/looks"
import { getOptionGarments } from "@/lib/tryon/option"

/** The generated image of the signed-in user wearing this outfit option. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ optionId: string }> },
) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const { optionId } = await params
  const garments = await getOptionGarments(optionId, user.id)
  const state = garments ? await getLookState(user.id, garments) : null
  const image = state ? await getLookImage(user.id, state) : null
  if (!image) return NextResponse.json({ error: "Sin imagen" }, { status: 404 })

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(image.bytes.length),
      // The URL carries the look hash and version (?v=): its bytes never change
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
