/**
 * Photorealistic try-on with a Gemini image model: one request carrying the
 * user's photo and the photos of every garment of the outfit, answered with
 * an edited photo of the user wearing them.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
// Chosen by testing on a 5-garment outfit: this one kept the person's face
// and pose in 4 of 4 runs; gemini-2.5-flash-image and gemini-3-pro-image
// drew a different person.
const DEFAULT_MODEL = "gemini-3.1-flash-image"
const TIMEOUT_MS = 90_000

/** Bump when the prompt changes so cached looks are regenerated. */
export const PROMPT_VERSION = "v3"

export interface TryOnImage {
  bytes: Buffer
  mimeType: string
}

export interface TryOnGarmentInput extends TryOnImage {
  name: string
  category: string
}

/** A failure the user can do something about; `message` is shown as is. */
export class TryOnError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export function tryOnModel(): string {
  return process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL
}

function imageSize(): string | undefined {
  return process.env.GEMINI_IMAGE_SIZE || undefined
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key || key.startsWith("your-")) {
    throw new TryOnError("El probador no está configurado: falta GEMINI_API_KEY.", 503)
  }
  return key
}

const CATEGORY_LABELS: Record<string, string> = {
  camisa: "shirt / top",
  chaqueta: "jacket / outerwear",
  vestido: "dress",
  pantalon: "trousers",
  falda: "skirt",
  zapato: "shoes",
  sombrero: "hat",
  bolso: "bag",
  accesorio: "accessory",
}

/** Output shapes the image models accept, as width / height. */
const ASPECT_RATIOS: [label: string, value: number][] = [
  ["9:16", 9 / 16],
  ["2:3", 2 / 3],
  ["3:4", 3 / 4],
  ["4:5", 4 / 5],
  ["1:1", 1],
  ["5:4", 5 / 4],
  ["4:3", 4 / 3],
  ["3:2", 3 / 2],
  ["16:9", 16 / 9],
]

/** Supported aspect ratio closest to the photo's, so the framing is kept. */
export function closestAspectRatio(width: number, height: number): string {
  const target = width / height
  return ASPECT_RATIOS.reduce((best, candidate) =>
    Math.abs(Math.log(candidate[1] / target)) < Math.abs(Math.log(best[1] / target))
      ? candidate
      : best
  )[0]
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } }

const image = (source: TryOnImage): Part => ({
  inlineData: { mimeType: source.mimeType, data: source.bytes.toString("base64") },
})

/** Request body for `generateContent` (exported for tests). */
export function buildTryOnRequest(
  person: TryOnImage,
  garments: TryOnGarmentInput[],
  aspectRatio?: string
) {
  // Framed as an EDIT of the person's photo. Asked to "generate" someone
  // wearing several garments, the model redraws the whole scene with a new
  // face and pose; the identity rules come before and after the garments.
  const parts: Part[] = [
    {
      text: [
        "This is a photo EDITING task. IMAGE 1 is the photo to edit: a real person.",
        "The result must be this same photograph, with only the clothing changed.",
      ].join("\n"),
    },
    image(person),
    {
      text: "The following images are product photos of garments. They are references for clothing only.",
    },
  ]
  garments.forEach((garment, index) => {
    const label = CATEGORY_LABELS[garment.category] ?? garment.category
    parts.push(
      { text: `IMAGE ${index + 2}: ${label} ("${garment.name}").` },
      image(garment)
    )
  })
  parts.push({
    text: [
      "Edit IMAGE 1 so the person wears every garment above.",
      "",
      "Do NOT change the person. Keep from IMAGE 1:",
      "- the face and its expression, the hair, the beard and the skin tone",
      "- the body shape and proportions",
      "- the pose, the position of arms, hands and legs, and where the person looks",
      "- the camera angle, framing, crop, background and lighting",
      "",
      "Change ONLY the clothing:",
      "- Replace what the person wears with the garments provided, each in its natural place.",
      "- Keep any piece of clothing for which no replacement is provided.",
      "- Reproduce each garment faithfully: color, fabric, cut, length, prints and logos. Do not invent details.",
      "- Fit the garments to this body in this pose, with realistic folds and shadows.",
      "",
      "Garments cover the body exactly as real clothes do, and that takes priority over showing skin:",
      "- Every garment is complete and continuous. Never cut, shorten, roll up, open or make a hole in a garment.",
      "- A long sleeve covers the whole arm down to the wrist; long trousers cover the legs down to the ankle.",
      "- Skin, tattoos, marks or accessories that end up under a garment are hidden by it. Show them only where the new clothing leaves the body uncovered.",
      "",
      "It must be recognizably the same person in the same photo. Never draw a different person or a new pose.",
      "No text, borders, collages or extra people. Return only the edited image.",
    ].join("\n"),
  })

  return {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      // Without an aspect ratio the model answers with a square image and
      // reframes. GEMINI_IMAGE_SIZE="512" trades sharpness for ~25% less cost.
      ...((aspectRatio || imageSize()) && {
        imageConfig: {
          ...(aspectRatio && { aspectRatio }),
          ...(imageSize() && { imageSize: imageSize() }),
        },
      }),
    },
  }
}

interface GeminiResponse {
  candidates?: {
    finishReason?: string
    content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] }
  }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

/** Pulls the generated image out of a response (exported for tests). */
export function extractImage(response: GeminiResponse): TryOnImage {
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return {
          bytes: Buffer.from(part.inlineData.data, "base64"),
          mimeType: part.inlineData.mimeType ?? "image/png",
        }
      }
    }
  }
  const reason =
    response.promptFeedback?.blockReason ?? response.candidates?.[0]?.finishReason
  if (reason && reason !== "STOP") {
    throw new TryOnError(
      "El modelo no pudo generar la imagen con esta foto. Prueba con otra foto tuya, de cuerpo entero y bien iluminada.",
      422
    )
  }
  throw new TryOnError("El modelo no devolvió ninguna imagen. Intenta de nuevo.", 502)
}

export async function generateTryOnImage(
  person: TryOnImage,
  garments: TryOnGarmentInput[],
  aspectRatio?: string
): Promise<TryOnImage> {
  const key = apiKey()
  let response: Response
  try {
    response = await fetch(`${API_BASE}/${tryOnModel()}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(buildTryOnRequest(person, garments, aspectRatio)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new TryOnError("La generación tardó demasiado. Intenta de nuevo.", 504)
  }

  const data = (await response.json().catch(() => ({}))) as GeminiResponse
  if (!response.ok) {
    console.error(`[tryon] Gemini ${response.status}:`, data.error?.message)
    if (response.status === 429) {
      // "limit: 0" on a free_tier metric is not a used-up quota: the free
      // plan simply has none for image models.
      const message = data.error?.message ?? ""
      if (/free_tier/i.test(message) && /limit:\s*0\b/.test(message)) {
        throw new TryOnError(
          "El plan gratuito de Gemini no incluye generación de imágenes. Activa la facturación del proyecto en Google AI Studio.",
          402
        )
      }
      throw new TryOnError(
        "Se alcanzó el límite de uso de Gemini para generar imágenes. Intenta de nuevo más tarde.",
        429
      )
    }
    const badKey =
      response.status === 401 ||
      response.status === 403 ||
      /API key/i.test(data.error?.message ?? "")
    if (badKey) {
      throw new TryOnError(
        "La GEMINI_API_KEY no es válida o no tiene acceso al modelo de imagen.",
        503
      )
    }
    throw new TryOnError("Gemini no pudo generar la imagen. Intenta de nuevo.", 502)
  }
  return extractImage(data)
}
