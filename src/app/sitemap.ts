import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
  const { origin } = getSiteUrl()

  // La landing es la única superficie pública indexable. El resto de rutas
  // son privadas (auth/dashboard) o APIs sin contenido HTML.
  return [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
