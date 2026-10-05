import type { OutfitOption, WardrobeItem } from "./types"

export function buildWardrobeList(wardrobe: WardrobeItem[]): string {
  // The id goes first: the model must return it back to link each garment
  return wardrobe
    .map(
      (item) =>
        `- id: ${item.id} | ${item.name} (${item.category}, color: ${item.color}, material: ${item.material || "N/A"}, marca: ${item.brand || "N/A"}, estación: ${item.season || "todo"})`
    )
    .join("\n")
}

/**
 * Rules shared by every outfit prompt. Without them models describe garments
 * the user does not own and return made-up ids, which leaves outfits empty.
 */
const CLOSET_RULES = `- Usa ÚNICAMENTE las prendas de la lista del closet. Nunca menciones ni inventes prendas que no estén en ella.
- En "itemIds" copia EXACTAMENTE el valor "id" de cada prenda de la lista. No uses nombres ni ids inventados.
- Cada opción debe incluir al menos una prenda. La descripción solo puede nombrar las prendas incluidas en sus "itemIds".
- Si el closet tiene pocas prendas, arma los looks con las que hay (puedes repetir prendas entre opciones) en vez de inventar.`

/** Garments the user can pick as the base of their outfits. */
export const MAX_ANCHORS = 2

/**
 * Prompt section for the garments the user chose to wear no matter what.
 * Empty when there are none, so it can be dropped into any prompt.
 */
export function buildAnchorsSection(anchors: WardrobeItem[] | undefined): string {
  if (!anchors?.length) return ""
  return `PRENDAS BASE ELEGIDAS POR EL USUARIO (obligatorias):
${buildWardrobeList(anchors)}
- El usuario quiere usar sí o sí estas prendas: las 3 opciones de outfit deben incluirlas TODAS (con su "id" en "itemIds").
- Arma el resto de cada look alrededor de ellas, con prendas distintas del closet entre una opción y otra.
- No pongas otra prenda de la misma categoría que una prenda base (por ejemplo, dos camisas).
- El último mensaje del usuario describe lo que busca: si ya trae ocasión o estilo, genera los outfits ahora, sin hacer más preguntas.

`
}

/**
 * Guarantees every option wears the chosen garments, whatever the model
 * answered: adds the ones it left out and drops other garments of the same
 * category. Accessories are the exception, since several fit in one look.
 */
export function ensureAnchors(
  options: OutfitOption[],
  anchors: WardrobeItem[]
): OutfitOption[] {
  if (anchors.length === 0) return options
  const anchorIds = new Set(anchors.map((anchor) => anchor.id))
  const taken = new Set(
    anchors.filter((anchor) => anchor.category !== "accesorio").map((anchor) => anchor.category)
  )
  return options.map((option) => ({
    ...option,
    items: [
      ...anchors,
      ...option.items.filter(
        (item) => !anchorIds.has(item.id) && !taken.has(item.category)
      ),
    ],
  }))
}

/**
 * Resolves the ids a model returned to closet garments. Tolerates a model
 * answering with the garment name instead of its id.
 */
export function mapItemIds(
  itemIds: string[] | undefined,
  wardrobe: WardrobeItem[]
): WardrobeItem[] {
  if (!Array.isArray(itemIds)) return []
  const wanted = new Set(itemIds.map((value) => String(value).trim().toLowerCase()))
  return wardrobe.filter(
    (item) =>
      wanted.has(item.id.toLowerCase()) || wanted.has(item.name.trim().toLowerCase())
  )
}

export function buildConversationalSystemPrompt(): string {
  return `Eres una estilista profesional de moda, cálida y cercana. Tu trabajo es ayudar al usuario a encontrar el outfit perfecto para su ocasión.

FLUJO DE CONVERSACIÓN:
1. Saluda amigablemente y pregúntale para qué ocasión se viste (trabajo, cita, evento, gimnasio, día a día, etc.)
2. Haz 1-2 preguntas cortas por mensaje para conocer sus preferencias: estilo (casual, elegante, deportivo), colores, nivel de formalidad, si prefiere algo relajado o sofisticado.
3. Cuando tengas CLARO la ocasión y al menos una preferencia de estilo, analiza su closet y genera los outfits.
4. Si el usuario da información suficiente desde el primer mensaje (ej: "necesito algo elegante para una boda el sábado"), genera los outfits directamente sin preguntar de más.

REGLAS IMPORTANTES:
- NO generes outfits hasta tener clara la ocasión y estilo preferido
- Máximo 2-3 intercambios antes de generar outfits
- Sé concisa: respuestas de 1-3 oraciones
- Si el usuario saluda o dice algo social, responde con calidez y redirige a la consulta de ocasión
- Cuando generes outfits, da una frase breve de transición (ej: "¡Perfecto! Basándome en lo que me contaste...")
- Genera exactamente 3 opciones de outfit
${CLOSET_RULES}

FORMATO DE RESPUESTA (JSON válido, sin texto adicional):
Para mensaje conversacional:
{"type": "message", "message": "Tu respuesta conversacional aquí"}

Para generar outfits:
{"type": "outfit", "message": "Frase breve de transición", "options": [{"title": "Nombre del Look", "description": "Descripción breve", "itemIds": ["<id de la lista>", "<id de la lista>"]}]}
`
}

export function buildOutfitSystemPrompt(): string {
  return `Eres un estilista profesional de moda. Tu tarea es crear outfits combinando las prendas disponibles en el closet del usuario.

REGLAS:
${CLOSET_RULES}
- Genera exactamente 3 opciones de outfit
- Cada outfit debe tener un título creativo y descripción
- Cada outfit incluye de 1 a 5 prendas del closet, según las que haya
- Considera la ocasión, estilo y temporada
- Responde en formato JSON válido

FORMATO DE RESPUESTA:
{
  "options": [
    {
      "title": "Nombre del Look",
      "description": "Descripción breve del outfit y por qué funciona",
      "itemIds": ["<id de la lista>", "<id de la lista>"]
    }
  ]
}`
}
