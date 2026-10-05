import { NextResponse } from "next/server"
import { requireUser, unauthorized } from "@/lib/require-user"
import { TryOnError } from "@/lib/tryon/gemini"
import { deletePhoto, getPhoto, savePhoto } from "@/lib/tryon/looks"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** The signed-in user's own try-on photo. Never cached by shared caches. */
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const photo = await getPhoto(user.id)
  if (!photo) return NextResponse.json({ error: "Sin foto" }, { status: 404 })
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(photo.bytes.length),
      "Cache-Control": "private, no-store",
    },
  })
}

export async function PUT(request: Request) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Sube una imagen" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "La imagen no puede superar 10MB" },
        { status: 400 },
      )
    }
    await savePhoto(user.id, Buffer.from(await file.arrayBuffer()), form.get("consent") === "true")
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof TryOnError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[api/tryon/photo] upload failed:", error)
    return NextResponse.json({ error: "No se pudo guardar la foto" }, { status: 500 })
  }
}

/** Removes the photo. Looks already generated are kept. */
export async function DELETE(request: Request) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  try {
    await deletePhoto(user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/tryon/photo] delete failed:", error)
    return NextResponse.json({ error: "No se pudo eliminar la foto" }, { status: 500 })
  }
}
