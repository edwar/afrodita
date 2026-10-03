import {
  AIProvider,
  AIProviderName,
  ChatRequest,
  ChatResponse,
  OutfitRequest,
  OutfitResponse,
} from "./types"
import { GeminiProvider } from "./providers/gemini"
import { OpenAIProvider } from "./providers/openai"
import { AnthropicProvider } from "./providers/anthropic"
import { FallbackProvider } from "./providers/fallback"

export class AIOrchestrator {
  private providers: Map<AIProviderName, AIProvider>
  private activeProvider: AIProviderName

  constructor() {
    this.providers = new Map()
    this.providers.set("gemini", new GeminiProvider())
    this.providers.set("openai", new OpenAIProvider())
    this.providers.set("anthropic", new AnthropicProvider())
    this.providers.set("fallback", new FallbackProvider())

    // Default to Gemini (free tier) for MVP
    this.activeProvider = this.selectBestProvider()
  }

  private selectBestProvider(): AIProviderName {
    // Priority: check availability and cost
    // Gemini is free, so prefer it if available
    if (this.providers.get("gemini")?.isAvailable()) {
      return "gemini"
    }
    if (this.providers.get("openai")?.isAvailable()) {
      return "openai"
    }
    if (this.providers.get("anthropic")?.isAvailable()) {
      return "anthropic"
    }
    // Sin API key válida: generación local determinista
    return "fallback"
  }

  getActiveProvider(): AIProviderName {
    return this.activeProvider
  }

  setProvider(name: AIProviderName): void {
    const provider = this.providers.get(name)
    if (!provider?.isAvailable()) {
      throw new Error(`Provider ${name} is not available. Check API key.`)
    }
    this.activeProvider = name
  }

  getAvailableProviders(): AIProviderName[] {
    const available: AIProviderName[] = []
    this.providers.forEach((provider, name) => {
      if (provider.isAvailable()) {
        available.push(name)
      }
    })
    return available
  }

  async generateOutfit(request: OutfitRequest): Promise<OutfitResponse> {
    const provider = this.providers.get(this.activeProvider)
    if (!provider) {
      throw new Error(`Provider ${this.activeProvider} not found`)
    }

    if (this.activeProvider !== "fallback") {
      try {
        return await provider.generate(request)
      } catch (error) {
        console.warn(
          `AI provider "${this.activeProvider}" failed, using local fallback:`,
          error instanceof Error ? error.message : error
        )
      }
    }

    return this.providers.get("fallback")!.generate(request)
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const provider = this.providers.get(this.activeProvider)
    if (!provider) {
      throw new Error(`Provider ${this.activeProvider} not found`)
    }

    if (this.activeProvider !== "fallback") {
      try {
        return await provider.chat(request)
      } catch (error) {
        console.warn(
          `AI provider "${this.activeProvider}" chat failed, using local fallback:`,
          error instanceof Error ? error.message : error
        )
      }
    }

    return this.providers.get("fallback")!.chat(request)
  }

  // Force a specific provider for this request only
  async generateWith(
    providerName: AIProviderName,
    request: OutfitRequest
  ): Promise<OutfitResponse> {
    const provider = this.providers.get(providerName)
    if (!provider?.isAvailable()) {
      throw new Error(`Provider ${providerName} is not available`)
    }
    return provider.generate(request)
  }
}

// Singleton instance
let orchestrator: AIOrchestrator | null = null

export function getAIOrchestrator(): AIOrchestrator {
  if (!orchestrator) {
    orchestrator = new AIOrchestrator()
  }
  return orchestrator
}
