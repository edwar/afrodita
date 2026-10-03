import type { Generate3DResult, ImageInput, ImageTo3DProvider } from "./types"
import { TripoProvider } from "./providers/tripo"
import { MeshyProvider } from "./providers/meshy"

const providers: ImageTo3DProvider[] = [new TripoProvider(), new MeshyProvider()]

export function getAvailableProviders(): ImageTo3DProvider[] {
  return providers.filter((p) => p.isAvailable())
}

export function getAvailableProvider(): ImageTo3DProvider {
  const provider = getAvailableProviders()[0]
  if (!provider) {
    throw new Error(
      "No hay ningún provider 3D configurado. Define TRIPO_API_KEY o MESHY_API_KEY en .env.local",
    )
  }
  return provider
}

export function formatProviderError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)

  if (/enough credit|don't have enough credit|2010|insufficient credit/i.test(raw)) {
    return (
      "Tripo API sin créditos (balance = 0). " +
      "Los créditos del Studio web no se usan en la API. " +
      "Recarga en https://developers.tripo3d.ai y usa esa misma API key."
    )
  }
  if (/timeout/i.test(raw)) {
    return "La generación 3D tardó demasiado. Intenta de nuevo."
  }
  if (/Falta el provider|No hay ningún provider/i.test(raw)) {
    return raw
  }
  if (/401|unauthorized|invalid.*api.?key/i.test(raw)) {
    return "API key de Tripo inválida. Usa una key que empiece con tsk_ desde developers.tripo3d.ai."
  }
  if (raw.length > 220) return `${raw.slice(0, 220)}…`
  return raw
}

/** Consulta el balance de la API de Tripo (si hay key configurada). */
export async function getTripoApiBalance(): Promise<number | null> {
  const key = process.env.TRIPO_API_KEY
  if (!key) return null
  try {
    const res = await fetch("https://openapi.tripo3d.ai/v3/account/balance", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { balance?: number }
    }
    return typeof json.data?.balance === "number" ? json.data.balance : null
  } catch {
    return null
  }
}

/** Intenta todos los providers disponibles (p.ej. Tripo sin créditos → Meshy). */
export async function generate3D(
  input: ImageInput | string,
): Promise<Generate3DResult> {
  const available = getAvailableProviders()
  if (available.length === 0) {
    throw new Error(
      "No hay ningún provider 3D configurado. Define TRIPO_API_KEY o MESHY_API_KEY en .env.local",
    )
  }

  const errors: string[] = []
  for (const provider of available) {
    try {
      return await provider.generate(input)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Provider ${provider.name} failed:`, message)
      errors.push(`${provider.name}: ${message}`)
    }
  }

  throw new Error(errors.join(" | ") || "Todos los providers 3D fallaron")
}
