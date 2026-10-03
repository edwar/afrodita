import type { Generate3DResult, ImageTo3DProvider } from "../types"
import { sleep } from "../types"

const BASE_URL = "https://api.meshy.ai/openapi/v2"
const POLL_INTERVAL = 5000
const MAX_POLLS = 60 // ~5 minutos

interface MeshyTask {
  status: string
  model_urls?: { glb?: string }
}

export class MeshyProvider implements ImageTo3DProvider {
  name = "meshy"

  private get apiKey(): string {
    return process.env.MESHY_API_KEY || ""
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  async generate(imageUrl: string): Promise<Generate3DResult> {
    const createRes = await fetch(`${BASE_URL}/image-to-3d`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        image_url: imageUrl,
        enable_pbr: true,
        topology: "triangle",
        target_polycount: 30000,
      }),
    })

    if (!createRes.ok) {
      const body = await createRes.text()
      throw new Error(`Meshy create task failed (${createRes.status}): ${body}`)
    }

    const { result: taskId } = await createRes.json()
    if (!taskId) throw new Error("Meshy no devolvió id de tarea")

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL)

      const statusRes = await fetch(`${BASE_URL}/image-to-3d/${taskId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      if (!statusRes.ok) continue

      const task = (await statusRes.json()) as MeshyTask

      if (task.status === "SUCCEEDED") {
        const modelUrl = task.model_urls?.glb
        if (!modelUrl) throw new Error("Meshy terminó sin modelo GLB")
        return { modelUrl, taskId, provider: this.name }
      }

      if (["FAILED", "CANCELED"].includes(task.status)) {
        throw new Error(`Meshy generación falló: ${task.status}`)
      }
    }

    throw new Error("Meshy: timeout de generación (5 min)")
  }
}
