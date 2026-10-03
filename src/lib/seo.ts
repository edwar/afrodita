/** Public canonical origin used by metadata, sitemap and robots routes. */
export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  const candidate = configured || vercelHost || "http://localhost:3000"
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`

  return new URL(withProtocol)
}

export const DEFAULT_SITE_TITLE = "Afrodita — Tu estilista personal con IA"
export const DEFAULT_SITE_DESCRIPTION =
  "Combina las prendas que ya tienes y descubre looks para cada ocasión con tu estilista personal de inteligencia artificial."
