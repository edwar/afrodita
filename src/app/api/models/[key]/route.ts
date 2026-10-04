import { Readable } from "node:stream"
import { getModelObject } from "@/lib/storage"

// Allows suffixes used by the VTO pipeline: `<id>.rigged.glb`, `<id>.lod0.glb`, …
const KEY_PATTERN = /^[A-Za-z0-9_.-]+\.glb$/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params
  try {
    if (!KEY_PATTERN.test(key)) {
      return new Response("Invalid key", { status: 400 })
    }

    const { body, contentType } = await getModelObject(key)
    const stream =
      body instanceof Readable ? Readable.toWeb(body) : (body as ReadableStream)

    return new Response(stream as ReadableStream, {
      headers: {
        "Content-Type": contentType || "model/gltf-binary",
        "Content-Length": String((body as { length?: number }).length ?? ""),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    // El error real es clave para diagnosticar credenciales de storage en Vercel
    console.error(`[api/models] ${key} no disponible:`, error)
    return new Response("Model not found", { status: 404 })
  }
}
