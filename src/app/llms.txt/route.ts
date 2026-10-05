import { FAQ } from "@/lib/faq"
import { getSiteUrl } from "@/lib/seo"

// Rebuilt only on deploy: the content never depends on the request
export const dynamic = "force-static"

/**
 * /llms.txt: a plain-text map of the site for AI assistants, following the
 * llms.txt convention (title, summary, then sections of links). The questions
 * come from the same list as the landing page.
 */
export function GET() {
  const { origin } = getSiteUrl()

  const body = [
    "# Afrodita",
    "",
    "> Afrodita es un estilista personal con inteligencia artificial. Combina las prendas que ya tienes y muestra cada look sobre una foto tuya. Idiomas: español e inglés.",
    "",
    "## Páginas públicas",
    "",
    `- [Inicio](${origin}/): qué es Afrodita, cómo funciona y preguntas frecuentes.`,
    `- [Términos y condiciones](${origin}/terminos): reglas de uso, contenido generado por IA y reglas de la foto base.`,
    `- [Política de seguridad y privacidad](${origin}/seguridad): qué datos se tratan, con quién se comparten y cómo se protegen.`,
    "",
    "## Preguntas frecuentes",
    "",
    ...FAQ.es.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
    "## Notas",
    "",
    "- El closet, el estilista, el probador y la galería de looks requieren una cuenta y no son públicos.",
    "- Las imágenes de looks son aproximaciones generadas con IA; no garantizan talla ni ajuste real.",
    "- Afrodita es solo para mayores de 18 años.",
    "",
  ].join("\n")

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  })
}
