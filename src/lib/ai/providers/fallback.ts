import {
  AIProvider,
  ChatRequest,
  ChatResponse,
  OutfitOption,
  OutfitRequest,
  OutfitResponse,
  WardrobeItem,
} from "../types"

const KEYWORDS: Record<string, string[]> = {
  outer: ["chaqueta", "abrigo", "saco", "cardigan", "cortaviento", "blazer"],
  top: ["camisa", "camiseta", "blusa", "polo", "sudadera", "jersey", "sueter", "top", "vestido", "tunica"],
  bottom: ["pantalon", "jean", "falda", "short", "bermuda", "jogger", "legging"],
  shoes: ["zapato", "zapatilla", "bota", "sneaker", "tenis", "sandalia", "mocasin"],
  acc: ["accesorio", "bolso", "sombrero", "gorro", "collar", "pulsera", "bufanda", "cinturon", "gafas", "reloj", "panuelo"],
}

const OCCASION_KEYWORDS = [
  "trabajo", "oficina", "reunion", "meeting", "cita", "date", "cena", "dinner",
  "gimnasio", "gym", "running", "deporte", "evento", "boda", "wedding", "fiesta",
  "party", "viaje", "travel", "playa", "beach", "diario", "casual", "clase",
  "universidad", "estudio", "salir", "amigos", "familia", "entrevista", "interview",
]

const GREETING_KEYWORDS = [
  "hola", "hello", "hi", "buenos dias", "buenas", "hey", "que tal",
  "como estas", "como andas", "saludos", "que onda",
]

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = normalize(text)
  return keywords.some((keyword) => normalized.includes(normalize(keyword)))
}

function hasOccasion(text: string): boolean {
  return includesAny(text, OCCASION_KEYWORDS)
}

function isGreeting(text: string): boolean {
  return includesAny(text, GREETING_KEYWORDS)
}

function bucket(item: WardrobeItem): string | null {
  const category = item.category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  for (const [group, words] of Object.entries(KEYWORDS)) {
    if (words.some((word) => category.includes(word))) return group
  }
  return null
}

function groupByBucket(wardrobe: WardrobeItem[]): Record<string, WardrobeItem[]> {
  const groups: Record<string, WardrobeItem[]> = {}
  for (const item of wardrobe) {
    const group = bucket(item)
    if (!group) continue
    ;(groups[group] ||= []).push(item)
  }
  return groups
}

function pick(groups: Record<string, WardrobeItem[]>, group: string, rotation: number): WardrobeItem | null {
  const list = groups[group]
  if (!list || list.length === 0) return null
  return list[rotation % list.length]
}

function compose(
  groups: Record<string, WardrobeItem[]>,
  rotation: number,
  slots: string[]
): WardrobeItem[] {
  const items: WardrobeItem[] = []
  for (const slot of slots) {
    const item = pick(groups, slot, rotation)
    if (item && !items.includes(item)) items.push(item)
  }
  if (items.length === 0) {
    const all = Object.values(groups).flat()
    const fallback = all[rotation % all.length]
    if (fallback) items.push(fallback)
  }
  return items
}

const LOOKS: {
  title: string
  description: string
  slots: string[]
}[] = [
  {
    title: "Look casual de diario",
    description: "Combinación relajada y funcional para salir, estudiar o trabajar sin perder estilo.",
    slots: ["bottom", "top", "shoes"],
  },
  {
    title: "Look con capas",
    description: "Capas ligeras que dan estructura al conjunto y funcionan si cambia la temperatura.",
    slots: ["bottom", "top", "outer", "acc"],
  },
  {
    title: "Look completo",
    description: "Outfit armado de punta a punta, listo para una cita o una tarde con amigos.",
    slots: ["top", "bottom", "shoes", "acc", "outer"],
  },
]

function generateOutfits(wardrobe: WardrobeItem[]): OutfitOption[] {
  const groups = groupByBucket(wardrobe)

  const options: OutfitOption[] = LOOKS.map((look, index) => ({
    title: look.title,
    description: look.description,
    items: compose(groups, index, look.slots),
  })).filter((option) => option.items.length > 0)

  while (options.length < 3) {
    const index = options.length
    options.push({
      title: `Variación ${index + 1}`,
      description: "Alternativa armada con las prendas disponibles en tu closet.",
      items: compose(groups, index, ["top", "bottom", "shoes", "acc"]),
    })
  }

  return options.slice(0, 3)
}

export class FallbackProvider implements AIProvider {
  name = "fallback"
  costPerToken = 0

  isAvailable(): boolean {
    return true
  }

  async generate(request: OutfitRequest): Promise<OutfitResponse> {
    const options = generateOutfits(request.wardrobe)
    return {
      options,
      modelUsed: "local-fallback",
      tokensUsed: 0,
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const lastMessage = request.messages[request.messages.length - 1]?.content || ""
    const userMessages = request.messages.filter((m) => m.role === "user")
    const hasMentionedOccasion = userMessages.some((m) => hasOccasion(m.content))
    const isEn = request.locale === "en"

    if (isGreeting(lastMessage) && userMessages.length <= 1) {
      return {
        type: "message",
        message: isEn
          ? "Hi! 👋 I'm your personal stylist. I'd love to help you find the perfect look. What are you dressing for today? (work, a date, a special event, the gym...)"
          : "¡Hola! 👋 Soy tu estilista personal. Me encantaría ayudarte a encontrar el look perfecto. ¿Para qué ocasión te vistes hoy? (trabajo, una cita, un evento especial, el gimnasio...)",
        modelUsed: "local-fallback",
        tokensUsed: 0,
      }
    }

    if (!hasMentionedOccasion) {
      return {
        type: "message",
        message: isEn
          ? "Great! To give you the best recommendations, tell me: what's the occasion? For example, a work meeting, dinner, a trip, or everyday wear."
          : "¡Genial! Para poder recomendarte lo mejor, cuéntame: ¿para qué ocasión es el outfit? Por ejemplo, una reunión de trabajo, una cena, un viaje o algo para el día a día.",
        modelUsed: "local-fallback",
        tokensUsed: 0,
      }
    }

    const options = generateOutfits(request.wardrobe)
    return {
      type: "outfit",
      message: isEn
        ? "Perfect! Based on what you told me, I put together these options using your closet pieces:"
        : "¡Perfecto! Con eso que me contaste, preparé estas opciones usando las prendas de tu closet:",
      options,
      modelUsed: "local-fallback",
      tokensUsed: 0,
    }
  }
}
