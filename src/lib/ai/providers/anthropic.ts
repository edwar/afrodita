import {
  AIProvider,
  ChatRequest,
  ChatResponse,
  OutfitRequest,
  OutfitResponse,
  OutfitOption,
  WardrobeItem,
} from "../types"
import { hasValidApiKey } from "../env"
import {
  buildWardrobeList,
  buildConversationalSystemPrompt,
  buildOutfitSystemPrompt,
} from "../prompts"

function mapItemIds(
  itemIds: string[] | undefined,
  wardrobe: WardrobeItem[]
): OutfitOption["items"] {
  if (!itemIds) return []
  return wardrobe.filter((item) => itemIds.includes(item.id))
}

export class AnthropicProvider implements AIProvider {
  name = "anthropic"
  costPerToken = 0.000015

  private apiKey: string

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || ""
  }

  isAvailable(): boolean {
    return hasValidApiKey(this.apiKey)
  }

  private async callAnthropic(
    system: string,
    messages: { role: string; content: string }[]
  ): Promise<{ text: string; tokens: number }> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 2048,
        system,
        messages,
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`)
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ""
    const tokens = data.usage?.input_tokens + data.usage?.output_tokens || 0
    return { text, tokens }
  }

  private extractJson(text: string): {
    type?: string
    message?: string
    options?: { title: string; description: string; itemIds?: string[] }[]
  } {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Invalid response format from Anthropic")
    }
    return JSON.parse(jsonMatch[0])
  }

  async generate(request: OutfitRequest): Promise<OutfitResponse> {
    const wardrobeList = buildWardrobeList(request.wardrobe)
    const systemPrompt = buildOutfitSystemPrompt()

    const userPrompt = `Ocasión: ${request.context || "No especificada"}
Estilo: ${request.style || "Casual"}
Temporada: ${request.season || "Actual"}

PRENDAS:
${wardrobeList}

Solicitud: ${request.prompt}`

    const { text, tokens } = await this.callAnthropic(systemPrompt, [
      { role: "user", content: userPrompt },
    ])
    const parsed = this.extractJson(text)

    const options = (parsed.options || []).map((opt) => ({
      title: opt.title,
      description: opt.description,
      items: mapItemIds(opt.itemIds, request.wardrobe),
    }))

    return {
      options,
      modelUsed: "claude-3-5-haiku",
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

Responde al último mensaje del usuario siguiendo las instrucciones del sistema.`

    const { text, tokens } = await this.callAnthropic(systemPrompt, [
      { role: "user", content: userPrompt },
    ])
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
        modelUsed: "claude-3-5-haiku",
        tokensUsed: tokens,
      }
    }

    return {
      type: "message",
      message: parsed.message || text.replace(/```json|```/g, "").trim(),
      modelUsed: "claude-3-5-haiku",
      tokensUsed: tokens,
    }
  }
}
