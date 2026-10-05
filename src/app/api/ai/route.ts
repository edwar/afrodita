import { NextResponse } from "next/server"
import { getAIOrchestrator } from "@/lib/ai"
import type { ChatMessage } from "@/lib/ai"
import { MAX_ANCHORS, REASON_WORDS, dropDisliked, ensureAnchors } from "@/lib/ai/prompts"
import type { Preferences, PreferenceExample } from "@/lib/ai"
import { getFeedback } from "@/lib/tryon/feedback"
import { dislikedKeys, recentVotes, type Feedback } from "@/lib/tryon/feedback-core"
import { prisma } from "@/lib/prisma"
import { requireUserId, unauthorized } from "@/lib/require-user"

/** Votes that feed the prompt: the most recent of each kind. */
const EXAMPLES_PER_KIND = 8

function buildPreferences(
  feedback: Feedback,
  wardrobe: { id: string; name: string; category: string }[]
): Preferences {
  const byId = new Map(wardrobe.map((item) => [item.id, item]))
  const examples = (vote: "like" | "dislike"): PreferenceExample[] =>
    recentVotes(feedback, vote, EXAMPLES_PER_KIND).flatMap(({ record }) => {
      const items = record.garments.map((id) => byId.get(id))
      // A look with a garment that was deleted says nothing useful anymore
      if (items.some((item) => !item)) return []
      return [
        {
          items: items.map((item) => ({ name: item!.name, category: item!.category })),
          request: record.request || undefined,
          reasons: record.reasons.map((reason) => REASON_WORDS[reason]).filter(Boolean),
        },
      ]
    })
  return { liked: examples("like"), disliked: examples("dislike") }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request.headers)
    if (!userId) return unauthorized()

    const body = await request.json()
    const { messages, locale, anchorIds } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "El mensaje es requerido" },
        { status: 400 }
      )
    }

    const chatMessages: ChatMessage[] = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      })
    )

    const wardrobe = await prisma.wardrobe.findMany({
      where: { userId },
    })

    const wardrobeItems = wardrobe.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      color: item.color,
      material: item.material || undefined,
      brand: item.brand || undefined,
      season: item.season || undefined,
      imageUrl: item.imageUrl,
    }))

    // Only garments the user owns count as base garments
    const wantedAnchors = Array.isArray(anchorIds)
      ? new Set(anchorIds.map(String))
      : new Set<string>()
    const anchors = wardrobeItems
      .filter((item) => wantedAnchors.has(item.id))
      .slice(0, MAX_ANCHORS)

    // Taste memory is a bonus: if storage hiccups the stylist still answers
    const feedback = await getFeedback(userId).catch((error) => {
      console.error("getFeedback failed:", error)
      return {} as Feedback
    })

    const orchestrator = getAIOrchestrator()
    const response = await orchestrator.chat({
      messages: chatMessages,
      wardrobe: wardrobeItems,
      anchors,
      preferences: buildPreferences(feedback, wardrobeItems),
      locale: locale === "en" ? "en" : "es",
    })
    // Whatever the model answered, every option wears the chosen garments
    if (response.options) {
      const wearing = ensureAnchors(response.options, anchors)
      // ...and none repeats a look the user already rejected
      response.options = dropDisliked(wearing, dislikedKeys(feedback))
      if (wearing.length > 0 && response.options.length === 0) {
        return NextResponse.json({
          type: "message",
          message:
            locale === "en"
              ? "Every combination I could put together is one you rejected before. Try another occasion, or add more garments to your closet."
              : "Todas las combinaciones que pude armar son looks que descartaste antes. Prueba con otra ocasión o agrega más prendas a tu closet.",
          modelUsed: response.modelUsed,
          tokensUsed: response.tokensUsed,
        })
      }
    }

    if (response.type === "message") {
      return NextResponse.json({
        type: "message",
        message: response.message,
        modelUsed: response.modelUsed,
        tokensUsed: response.tokensUsed,
      })
    }

    if (wardrobe.length === 0) {
      return NextResponse.json({
        type: "message",
        message:
          "Tu closet está vacío. Agrega prendas primero para poder recomendarte outfits.",
        modelUsed: response.modelUsed,
        tokensUsed: response.tokensUsed,
      })
    }

    const lastUserMessage =
      chatMessages.filter((m) => m.role === "user").pop()?.content || ""

    const wardrobeIds = new Set(wardrobe.map((item) => item.id))
    // An outfit whose options link to no garment cannot be shown or tried on
    const linked = (response.options || []).filter((opt) =>
      opt.items.some((item) => wardrobeIds.has(item.id))
    )
    if (linked.length === 0) {
      return NextResponse.json({
        type: "message",
        message:
          locale === "en"
            ? "I couldn't build outfits from the garments in your closet. Try again, or add more garments."
            : "No pude armar outfits con las prendas de tu closet. Intenta de nuevo o agrega más prendas.",
        modelUsed: response.modelUsed,
        tokensUsed: response.tokensUsed,
      })
    }

    const outfit = await prisma.outfit.create({
      data: {
        userId,
        prompt: lastUserMessage,
        context: null,
        options: {
          create: (response.options || []).map((opt) => ({
            title: opt.title,
            description: opt.description,
            items: {
              connect: opt.items
                .filter((item) => wardrobeIds.has(item.id))
                .map((item) => ({ id: item.id })),
            },
          })),
        },
      },
      include: { options: { include: { items: true } } },
    })

    return NextResponse.json({
      type: "outfit",
      message: response.message,
      outfit,
      modelUsed: response.modelUsed,
      tokensUsed: response.tokensUsed,
    })
  } catch (error) {
    console.error("AI chat error:", error)
    return NextResponse.json(
      { error: "Error al procesar tu mensaje. Intenta de nuevo." },
      { status: 500 }
    )
  }
}
