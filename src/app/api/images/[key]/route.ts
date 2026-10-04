import { Readable } from "node:stream"
import { getImageObject } from "@/lib/storage"

const KEY_PATTERN = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params
  try {
    if (!KEY_PATTERN.test(key)) {
      return new Response("Invalid key", { status: 400 })
    }

    const { body, contentType } = await getImageObject(key)
    const stream =
      body instanceof Readable ? Readable.toWeb(body) : (body as ReadableStream)

    return new Response(stream as ReadableStream, {
      headers: {
        "Content-Type": contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error(`[api/images] ${key} no disponible:`, error)
    return new Response("Image not found", { status: 404 })
  }
}
