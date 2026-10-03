import type {
  Generate3DResult,
  GarmentMeta,
  ImageInput,
  ImageTo3DProvider,
} from "../types"
import { sleep } from "../types"
import { buildTexturePrompt } from "../garment-material"

const BASE_URL = "https://openapi.tripo3d.ai/v3"
const POLL_INTERVAL = 5000
const MAX_POLLS = 72 // ~6 min

// H3: mejor fidelidad fotográfica que H2 (v2.5)
const MODEL_VERSION = "v3.1-20260211"
const TEXTURE_VERSION = "v3.0-20250812"

interface TripoTask {
  status: string
  output?: {
    model_url?: string
  }
  error_code?: number
  error_message?: string
}

async function pollTask(taskId: string, label: string): Promise<string> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL)

    const statusRes = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${process.env.TRIPO_API_KEY}` },
    })
    if (!statusRes.ok) continue

    const { data: task } = (await statusRes.json()) as { data: TripoTask }

    if (task.status === "success") {
      const modelUrl = task.output?.model_url
      if (!modelUrl) throw new Error(`Tripo ${label}: sin modelo`)
      return modelUrl
    }

    if (["failed", "cancelled"].includes(task.status)) {
      const detail = task.error_code
        ? ` (error ${task.error_code}: ${task.error_message})`
        : ""
      throw new Error(`Tripo ${label} falló: ${task.status}${detail}`)
    }
  }

  throw new Error(`Tripo ${label}: timeout de generación`)
}

export class TripoProvider implements ImageTo3DProvider {
  name = "tripo"

  private get apiKey(): string {
    return process.env.TRIPO_API_KEY || ""
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  private async uploadFile(buffer: Buffer, filename: string): Promise<string> {
    const formData = new FormData()
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg"
    const mimeType = ext === "png" ? "image/png" : "image/jpeg"
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType })
    formData.append("file", blob, filename)

    const res = await fetch(`${BASE_URL}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Tripo upload failed (${res.status}): ${body}`)
    }

    const { data } = await res.json()
    const fileToken: string = data.file_token
    if (!fileToken) throw new Error("Tripo no devolvió file_token")
    return fileToken
  }

  private resolveFileObj(
    input: ImageInput | string,
  ): Promise<{ type: string; url?: string; file_token?: string }> {
    if (typeof input === "string") {
      const ext = input.split("?")[0].split(".").pop()?.toLowerCase() || ""
      const fileType = ext === "png" ? "png" : "jpg"
      return Promise.resolve({ type: fileType, url: input })
    }

    if (input.buffer && input.filename) {
      return this.uploadFile(input.buffer, input.filename).then(
        (file_token) => {
          const ext = input.filename!.split(".").pop()?.toLowerCase() || ""
          const fileType = ext === "png" ? "png" : "jpg"
          return { type: fileType, file_token }
        },
      )
    }

    if (input.url) {
      const ext = input.url.split("?")[0].split(".").pop()?.toLowerCase() || ""
      const fileType = ext === "png" ? "png" : "jpg"
      return Promise.resolve({ type: fileType, url: input.url })
    }

    throw new Error("Input inválido: se requiere url o buffer+filename")
  }

  /**
   * 1) image_to_model H3 con textura PBR de alta calidad
   * 2) Si hay meta de prenda, retextura con prompt de material (textura realista)
   */
  async generate(input: ImageInput | string): Promise<Generate3DResult> {
    const meta: GarmentMeta | undefined =
      typeof input === "string" ? undefined : input.meta
    const fileObj = await this.resolveFileObj(input)

    const createRes = await fetch(`${BASE_URL}/generation/image-to-model`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        type: "image_to_model",
        file: fileObj,
        model_version: MODEL_VERSION,
        texture: true,
        pbr: true,
        texture_quality: "detailed",
        texture_alignment: "original_image",
        enable_image_autofix: true,
        auto_size: true,
        orientation: "align_image",
      }),
    })

    if (!createRes.ok) {
      const body = await createRes.text()
      throw new Error(`Tripo create task failed (${createRes.status}): ${body}`)
    }

    const { data } = await createRes.json()
    const taskId: string = data.task_id
    if (!taskId) throw new Error("Tripo no devolvió task_id")

    let modelUrl = await pollTask(taskId, "image-to-model")

    // Retextura con características de la prenda (si hay material/color)
    const shouldRetexture =
      process.env.TRIPO_RETEXTURE !== "false" &&
      !!(meta?.material || meta?.color || meta?.name)

    if (shouldRetexture) {
      const texturePrompt = buildTexturePrompt(meta)
      const texRes = await fetch(`${BASE_URL}/generation/texture-model`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          type: "texture_model",
          model_version: TEXTURE_VERSION,
          original_model_task_id: taskId,
          texture_prompt: { text: texturePrompt },
          texture: true,
          pbr: true,
          texture_quality: "detailed",
          texture_alignment: "original_image",
          bake: true,
        }),
      })

      if (texRes.ok) {
        const texData = (await texRes.json()) as { data?: { task_id?: string } }
        const texTaskId = texData.data?.task_id
        if (texTaskId) {
          modelUrl = await pollTask(texTaskId, "texture-model")
          return {
            modelUrl,
            taskId: texTaskId,
            provider: this.name,
            baseTaskId: taskId,
          }
        }
      } else {
        // No cortamos el flujo si la retextura falla: el modelo base sirve
        const body = await texRes.text()
        console.warn("Tripo retexture skipped:", body)
      }
    }

    return { modelUrl, taskId, provider: this.name }
  }
}
