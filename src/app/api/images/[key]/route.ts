import { Readable } from "node:stream"
import { requireUser, unauthorized } from "@/lib/require-user"
import { getImageObject } from "@/lib/storage"

const KEY_PATTERN = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/

/**
 * Garment photos. Keys are `<userId>-<timestamp>-<random>.<ext>` (see
 * /api/upload), so a signed-in user is served only the files that start with
 * their own id: knowing or guessing another key gets nothing.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const { key } = await params
  try {
    if (!KEY_PATTERN.test(key)) {
      return new Response("Invalid key", { status: 400 })
    }
    if (!key.startsWith(`${user.id}-`)) {
      // Same answer as a missing file: do not reveal that it exists
      return new Response("Image not found", { status: 404 })
    }

    const { body, contentType } = await getImageObject(key)
    const stream =
      body instanceof Readable ? Readable.toWeb(body) : (body as ReadableStream)

    return new Response(stream as ReadableStream, {
      headers: {
        "Content-Type": contentType || "image/jpeg",
        // Per-user content: the browser may keep it, shared caches must not
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error(`[api/images] ${key} no disponible:`, error)
    return new Response("Image not found", { status: 404 })
  }
}
