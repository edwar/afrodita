import { createHash } from "node:crypto"
import { prisma } from "@/lib/prisma"
import {
  generate3D,
  formatProviderError,
  getTripoApiBalance,
} from "./orchestrator"
import { uploadModel, getImageObject } from "@/lib/storage"

export type Model3dStatus = "generating" | "ready" | "failed"

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function contentTypeFor(filename: string): string {
  return filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"
}

async function downloadImage(imageUrl: string): Promise<{ buffer: Buffer; filename: string }> {
  if (imageUrl.startsWith("/api/images/")) {
    const key = imageUrl.replace("/api/images/", "")
    const { body } = await getImageObject(key)
    return { buffer: await streamToBuffer(body), filename: key }
  }

  if (imageUrl.startsWith("http")) {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`)
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      filename: imageUrl.split("?")[0].split("/").pop() || "image.jpg",
    }
  }

  throw new Error(`URL de imagen no soportada: ${imageUrl}`)
}

export async function generateWardrobe3D(id: string): Promise<void> {
  const item = await prisma.wardrobe.findUnique({ where: { id } })
  if (!item?.imageUrl) return

  await prisma.wardrobe.update({
    where: { id },
    data: { model3dStatus: "generating", model3dError: null },
  })

  try {
    const { buffer, filename } = await downloadImage(item.imageUrl)
    if (buffer.length === 0) throw new Error("Imagen vacía")

    const result = await generate3D({
      buffer,
      filename,
      contentType: contentTypeFor(filename),
      meta: {
        name: item.name,
        category: item.category,
        color: item.color,
        material: item.material ?? undefined,
        brand: item.brand ?? undefined,
        season: item.season ?? undefined,
      },
    })

    const downloadRes = await fetch(result.modelUrl, {
      headers:
        result.provider === "tripo"
          ? { Authorization: `Bearer ${process.env.TRIPO_API_KEY}` }
          : undefined,
    })
    if (!downloadRes.ok) {
      throw new Error(`No se pudo descargar el modelo (${downloadRes.status})`)
    }

    const modelBuffer = Buffer.from(await downloadRes.arrayBuffer())
    if (modelBuffer.length === 0) throw new Error("Modelo GLB vacío")

    // Model URLs are served with long-lived immutable caching. Use a content
    // hash in the object key so regenerating an asset always gets a fresh URL.
    const contentHash = createHash("sha256")
      .update(modelBuffer)
      .digest("hex")
      .slice(0, 12)
    const modelUrl = await uploadModel(`${item.id}.${contentHash}.glb`, modelBuffer)

    await prisma.wardrobe.update({
      where: { id },
      data: { modelUrl, model3dStatus: "ready", model3dError: null },
    })
  } catch (error) {
    console.error(`generateWardrobe3D(${id}) failed:`, error)
    let friendly = formatProviderError(error)

    // Si es error de créditos, adjunta el balance real de la API
    if (/créditos|credit|2010/i.test(friendly) || /2010|enough credit/i.test(String(error))) {
      const balance = await getTripoApiBalance()
      if (balance !== null) {
        friendly = `${friendly} (balance API actual: ${balance})`
      }
    }

    await prisma.wardrobe.update({
      where: { id },
      data: { model3dStatus: "failed", model3dError: friendly },
    })
    throw new Error(friendly)
  }
}
