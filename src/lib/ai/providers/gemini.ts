import {
  AIProvider,
  ChatRequest,
  ChatResponse,
  OutfitRequest,
  OutfitResponse,
} from "../types"
import { hasValidApiKey } from "../env"
import {
  buildAnchorsSection,
  buildWardrobeList,
  mapItemIds,
  buildConversationalSystemPrompt,
  buildOutfitSystemPrompt,
} from "../prompts"

// gemini-2.0-flash y 2.5-flash fueron retirados; se puede cambiar sin tocar código
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash"

export class GeminiProvider implements AIProvider {
  name = "gemini"
  costPerToken = 0

  private apiKey: string

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || ""
  }

  isAvailable(): boolean {
    return hasValidApiKey(this.apiKey)
  }

  private async callGemini(prompt: string): Promise<{ text: string; tokens: number }> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
    return { text, tokens: data.usageMetadata?.totalTokenCount || 0 }
  }

  private extractJson(text: string): {
    type?: string
    message?: string
    options?: { title: string; description: string; itemIds?: string[] }[]
  } {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Invalid response format from Gemini")
    }
    return JSON.parse(jsonMatch[0])
  }

  async generate(request: OutfitRequest): Promise<OutfitResponse> {
    const wardrobeList = buildWardrobeList(request.wardrobe)
    const systemPrompt = buildOutfitSystemPrompt()

    const userPrompt = `Ocasión: ${request.context || "No especificada"}
Estilo: ${request.style || "Casual"}
Temporada: ${request.season || "Actual"}

PRENDAS DISPONIBLES:
${wardrobeList}

Solicitud del usuario: ${request.prompt}

Genera 3 opciones de outfit usando las prendas listadas.`

    const { text, tokens } = await this.callGemini(
      `${systemPrompt}\n\n${userPrompt}`
    )
    const parsed = this.extractJson(text)

    const options = (parsed.options || []).map((opt) => ({
      title: opt.title,
      description: opt.description,
      items: mapItemIds(opt.itemIds, request.wardrobe),
    }))

    return {
      options,
      modelUsed: CHAT_MODEL,
      tokensUsed: tokens,
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const wardrobeList = buildWardrobeList(request.wardrobe)
    const systemPrompt = buildConversationalSystemPrompt()

    const conversation = request.messages
      .map((msg) => `${msg.role === "user" ? "Usuario" : "Estilista"}: ${msg.content}`)
      .join("\n")

    const userPrompt = `CONVERSACIÓN HASTA AHORA:
${conversation}

PRENDAS DISPONIBLES EN EL CLOSET DEL USUARIO:
${wardrobeList}

${buildAnchorsSection(request.anchors)}Responde al último mensaje del usuario siguiendo las instrucciones del sistema.`

    const { text, tokens } = await this.callGemini(
      `${systemPrompt}\n\n${userPrompt}`
    )
    const parsed = this.extractJson(text)

    const type = parsed.type === "outfit" ? "outfit" : "message"

    if (type === "outfit") {
      const options = (parsed.options || []).map((opt) => ({
        title: opt.title,
        description: opt.description,
        items: mapItemIds(opt.itemIds, request.wardrobe),
      }))
      return {
        type: "outfit",
        message: parsed.message,
        options,
        modelUsed: CHAT_MODEL,
        tokensUsed: tokens,
      }
    }

    return {
      type: "message",
      message: parsed.message || text.replace(/```json|```/g, "").trim(),
      modelUsed: CHAT_MODEL,
      tokensUsed: tokens,
    }
  }
}
