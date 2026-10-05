/**
 * Review of the user's base photo BEFORE it is stored.
 *
 * Gemini looks at the photo and describes it (how many people, whether it
 * shows nudity, whether the person looks under 18...); this module turns that
 * description into an accept/reject decision. The model never decides: it
 * answers factual questions and the rules live here, where they are tested.
 *
 * Policy: clothed people are fine (swimwear, underwear covering intimate
 * areas and a bare male torso included). Rejected: nudity or sexual content,
 * apparent minors, harmful content, no person / several people, and photos
 * that do not show enough of the body to try clothes on.
 *
 * Fails closed: if the review cannot be done, the photo is NOT accepted.
 */
import sharp from "sharp"
import { TryOnError } from "./gemini"

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
const TIMEOUT_MS = 25_000
const RETRY_DELAY_MS = 400
const RETRIABLE = new Set([429, 500, 502, 503, 504])
/** Enough detail to judge a photo; more only costs tokens. */
const CHECK_MAX_SIDE = 1024

export interface PhotoAnalysis {
  /** Different real people clearly visible. */
  people: number
  /** A photograph of a real person (not a drawing, render, screenshot...). */
  real_photo: boolean
  nudity_or_sexual: boolean
  apparent_minor: boolean
  harmful_content: boolean
  body_visible: "full" | "partial" | "face_only" | "none"
}

export type RejectReason =
  | "nudity"
  | "minor"
  | "harmful"
  | "blocked"
  | "no_person"
  | "several_people"
  | "too_little_body"

/** What the user is told. Worded to say what to fix, not to accuse. */
export const REJECTION_MESSAGES: Record<RejectReason, string> = {
  nudity:
    "La foto no puede mostrar desnudez ni contenido sexual. Sube una foto en la que lleves ropa puesta.",
  minor:
    "Solo se admiten fotos de personas mayores de 18 años. Si eres mayor de edad, prueba con otra foto donde se te vea con claridad.",
  harmful: "La foto contiene contenido que no se permite en Afrodita. Prueba con otra.",
  blocked: "No pudimos aceptar esta foto. Prueba con otra.",
  no_person:
    "No detectamos a una persona en la foto. Sube una foto tuya, de frente y con el cuerpo a la vista.",
  several_people: "En la foto aparece más de una persona. Sube una foto en la que salgas solo tú.",
  too_little_body:
    "Necesitamos ver más de tu cuerpo, al menos de la cabeza a la cintura. Sube una foto de cuerpo entero.",
}

/**
 * The decision. Order matters: the serious reasons come first, so a photo
 * with several problems is reported for the gravest one.
 */
export function judgePhoto(a: PhotoAnalysis): RejectReason | null {
  if (a.harmful_content) return "harmful"
  if (a.nudity_or_sexual) return "nudity"
  if (a.apparent_minor) return "minor"
  if (!a.real_photo || a.people < 1) return "no_person"
  if (a.people > 1) return "several_people"
  if (a.body_visible === "face_only" || a.body_visible === "none") return "too_little_body"
  return null
}

export type PhotoVerdict =
  | { ok: true }
  | { ok: false; reason: RejectReason; message: string }

const BODY_VALUES = ["full", "partial", "face_only", "none"]

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    people: { type: "INTEGER" },
    real_photo: { type: "BOOLEAN" },
    nudity_or_sexual: { type: "BOOLEAN" },
    apparent_minor: { type: "BOOLEAN" },
    harmful_content: { type: "BOOLEAN" },
    body_visible: { type: "STRING", enum: BODY_VALUES },
  },
  required: [
    "people",
    "real_photo",
    "nudity_or_sexual",
    "apparent_minor",
    "harmful_content",
    "body_visible",
  ],
}

const PROMPT = [
  "You review photos for a virtual clothing try-on app. Describe the photo by answering these fields; reply only with the JSON.",
  "- people: how many people appear in the image. Count every person, including people in the background and each appearance of the same person if the image is a collage or shows them more than once. Do NOT count a person's own reflection in a mirror. 0 if there is no person, or if the image is a drawing, an illustration, a render, a screenshot or a product photo.",
  "- real_photo: true only for a photograph of a real person.",
  "- nudity_or_sexual: true if exposed genitals, exposed breasts or buttocks are visible, or the image is sexual or sexually explicit. Swimwear, underwear that covers the intimate areas, and a bare male torso are NOT nudity.",
  "- apparent_minor: true if any person looks younger than 18.",
  "- harmful_content: true if the image shows brandished weapons, gore or serious injury, drugs, hate symbols, or anything else clearly illegal or harmful.",
  "- body_visible: 'full' (head to feet), 'partial' (at least head to waist), 'face_only' (face or head and shoulders only) or 'none'.",
  "When in doubt about nudity, minors or harmful content, answer true.",
].join("\n")

function model(): string {
  return (
    process.env.GEMINI_MODERATION_MODEL || process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash"
  )
}

const BLOCKED_FINISH = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "IMAGE_SAFETY",
  "BLOCKLIST",
  "SPII",
  "RECITATION",
])

interface GeminiReply {
  candidates?: {
    finishReason?: string
    content?: { parts?: { text?: string }[] }
  }[]
  promptFeedback?: { blockReason?: string }
}

const unavailable = () =>
  new TryOnError(
    "No pudimos verificar la foto en este momento. Intenta de nuevo en unos minutos.",
    503
  )

function parseAnalysis(text: string): PhotoAnalysis | null {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  const { people, real_photo, nudity_or_sexual, apparent_minor, harmful_content, body_visible } =
    raw
  if (
    typeof people !== "number" ||
    typeof real_photo !== "boolean" ||
    typeof nudity_or_sexual !== "boolean" ||
    typeof apparent_minor !== "boolean" ||
    typeof harmful_content !== "boolean" ||
    typeof body_visible !== "string" ||
    !BODY_VALUES.includes(body_visible)
  ) {
    return null
  }
  return {
    people,
    real_photo,
    nudity_or_sexual,
    apparent_minor,
    harmful_content,
    body_visible: body_visible as PhotoAnalysis["body_visible"],
  }
}

/**
 * Asks Gemini to describe the photo. Returns "blocked" when Gemini's own
 * safety filters refuse to look at it (treated as a rejection). Throws the
 * 503 `TryOnError` when the review could not be completed.
 */
export async function analyzePhoto(jpeg: Buffer): Promise<PhotoAnalysis | "blocked"> {
  const key = process.env.GEMINI_API_KEY
  if (!key || key.startsWith("your-")) {
    console.error("[photo-check] GEMINI_API_KEY is not configured")
    throw unavailable()
  }

  const small = await sharp(jpeg)
    .resize(CHECK_MAX_SIDE, CHECK_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  })

  let response: Response | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(`${API_BASE}/${model()}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      response = null
    }
    const retry = response === null || RETRIABLE.has(response.status)
    if (!retry || attempt === 1) break
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }

  if (!response || !response.ok) {
    console.error(`[photo-check] Gemini unavailable (${response?.status ?? "no response"})`)
    throw unavailable()
  }

  const data = (await response.json().catch(() => ({}))) as GeminiReply
  if (data.promptFeedback?.blockReason) return "blocked"
  const candidate = data.candidates?.[0]
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? ""
  if (!text && candidate?.finishReason && BLOCKED_FINISH.has(candidate.finishReason)) {
    return "blocked"
  }
  const analysis = parseAnalysis(text)
  if (!analysis) {
    console.error(`[photo-check] unreadable answer (${candidate?.finishReason ?? "no candidate"})`)
    throw unavailable()
  }
  return analysis
}

/**
 * Reviews a photo. Resolves with the decision; throws the 503 `TryOnError`
 * when the review is not possible, so the photo is not stored either way.
 */
export async function checkPhoto(jpeg: Buffer): Promise<PhotoVerdict> {
  const analysis = await analyzePhoto(jpeg)
  const reason = analysis === "blocked" ? "blocked" : judgePhoto(analysis)
  if (!reason) return { ok: true }
  return { ok: false, reason, message: REJECTION_MESSAGES[reason] }
}
