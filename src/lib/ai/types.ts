export interface WardrobeItem {
  id: string
  name: string
  category: string
  color: string
  material?: string
  brand?: string
  season?: string
  imageUrl: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface OutfitRequest {
  prompt: string
  context?: string
  style?: string
  season?: string
  wardrobe: WardrobeItem[]
}

export interface ChatRequest {
  messages: ChatMessage[]
  wardrobe: WardrobeItem[]
  locale?: "es" | "en"
}

export interface OutfitResponse {
  options: OutfitOption[]
  modelUsed: string
  tokensUsed: number
}

export interface ChatResponse {
  type: "message" | "outfit"
  message?: string
  options?: OutfitOption[]
  modelUsed?: string
  tokensUsed?: number
}

export interface OutfitOption {
  title: string
  description: string
  items: WardrobeItem[]
}

export interface AIProvider {
  name: string
  generate(request: OutfitRequest): Promise<OutfitResponse>
  chat(request: ChatRequest): Promise<ChatResponse>
  isAvailable(): boolean
  costPerToken: number
}

export type AIProviderName = "gemini" | "openai" | "anthropic" | "fallback"
