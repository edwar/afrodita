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

/** A look the user voted on, as the stylist needs to see it. */
export interface PreferenceExample {
  items: { name: string; category: string }[]
  /** What the user asked for when it was proposed. */
  request?: string
  /** Why it was rejected (already in words). */
  reasons?: string[]
}

export interface Preferences {
  liked: PreferenceExample[]
  disliked: PreferenceExample[]
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
  /** Garments the user chose to build the outfits around (at most 2). */
  anchors?: WardrobeItem[]
  /** Looks the user liked and rejected so far. */
  preferences?: Preferences
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
