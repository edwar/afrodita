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

    const { body, contentType, contentLength } = await getModelObject(key)
    const stream =
      body instanceof Readable ? Readable.toWeb(body) : (body as ReadableStream)

    const headers: Record<string, string> = {
      "Content-Type": contentType || "model/gltf-binary",
      "Cache-Control": "public, max-age=31536000, immutable",
    }
    // Un Content-Length vacío es inválido: Vercel responde 500 antes de streamear
    if (contentLength != null) headers["Content-Length"] = String(contentLength)

    return new Response(stream as ReadableStream, { headers })
  } catch (error) {
    // El error real es clave para diagnosticar credenciales de storage en Vercel
    console.error(`[api/models] ${key} no disponible:`, error)
    return new Response("Model not found", { status: 404 })
  }
}
