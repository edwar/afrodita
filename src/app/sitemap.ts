import type { MetadataRoute } from "next"
import { LEGAL_UPDATED } from "@/lib/legal"
import { getSiteUrl } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
  const { origin } = getSiteUrl()

  // Superficie pública indexable: la landing y los documentos legales. El
  // resto de rutas son privadas (auth/dashboard) o APIs sin contenido HTML.
  return [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${origin}/terminos`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${origin}/seguridad`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
