import {
  AIProvider,
  ChatMessage,
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

function toOpenAIMessages(
  systemPrompt: string,
  messages: ChatMessage[]
): { role: string; content: string }[] {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  ]
}

export class OpenAIProvider implements AIProvider {
  name = "openai"
  costPerToken = 0.00001

  private apiKey: string

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || ""
  }

  isAvailable(): boolean {
    return hasValidApiKey(this.apiKey)
  }

  private async callOpenAI(
    messages: { role: string; content: string }[]
  ): Promise<{ text: string; tokens: number }> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.8,
        max_tokens: 2048,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ""
    return { text, tokens: data.usage?.total_tokens || 0 }
  }

  private extractJson(text: string): {
    type?: string
    message?: string
    options?: { title: string; description: string; itemIds?: string[] }[]
  } {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Invalid response format from OpenAI")
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

Solicitud: ${request.prompt}`

    const { text, tokens } = await this.callOpenAI([
      { role: "system", content: systemPrompt },
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
      modelUsed: "gpt-4o-mini",
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

    const { text, tokens } = await this.callOpenAI(
      toOpenAIMessages(systemPrompt, [
        { role: "user", content: userPrompt },
      ])
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
        modelUsed: "gpt-4o-mini",
        tokensUsed: tokens,
      }
    }

    return {
      type: "message",
      message: parsed.message || text.replace(/```json|```/g, "").trim(),
      modelUsed: "gpt-4o-mini",
      tokensUsed: tokens,
    }
  }
}
