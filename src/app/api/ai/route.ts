import { NextResponse } from "next/server"
import { getAIOrchestrator } from "@/lib/ai"
import type { ChatMessage } from "@/lib/ai"
import { prisma } from "@/lib/prisma"
import { requireUserId, unauthorized } from "@/lib/require-user"

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request.headers)
    if (!userId) return unauthorized()

    const body = await request.json()
    const { messages, locale } = body

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

    const orchestrator = getAIOrchestrator()
    const response = await orchestrator.chat({
      messages: chatMessages,
      wardrobe: wardrobeItems,
      locale: locale === "en" ? "en" : "es",
    })

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
