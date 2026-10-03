import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API y rutas privadas (auth/dashboard) no aportan valor de indexación
      disallow: ["/api/", "/wardrobe", "/chat", "/preview", "/login", "/register"],
    },
    sitemap: `${getSiteUrl().origin}/sitemap.xml`,
  }
}
