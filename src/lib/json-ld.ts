import { contactEmail } from "@/lib/legal"
import type { FaqItem } from "@/lib/faq"
import { DEFAULT_SITE_DESCRIPTION } from "@/lib/seo"

/**
 * Serializes structured data for a <script type="application/ld+json">.
 * "<" is escaped so no value can close the script tag early.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

/** What the site is: organization, website and web application. */
export function siteJsonLd(origin: string) {
  const organization = `${origin}/#organization`
  const email = contactEmail()
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: "Afrodita",
        url: origin,
        logo: `${origin}/icon.svg`,
        ...(email && { email }),
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: "Afrodita",
        description: DEFAULT_SITE_DESCRIPTION,
        inLanguage: ["es", "en"],
        publisher: { "@id": organization },
      },
      {
        "@type": "WebApplication",
        "@id": `${origin}/#app`,
        name: "Afrodita",
        url: origin,
        description: DEFAULT_SITE_DESCRIPTION,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        inLanguage: ["es", "en"],
        featureList: [
          "Closet digital con fotos de tus prendas",
          "Estilista con inteligencia artificial que combina solo la ropa que ya tienes",
          "Imagen de cómo te queda un look, generada con IA a partir de una foto tuya",
          "Galería de looks con me gusta, comparador y filtros",
        ],
        publisher: { "@id": organization },
      },
    ],
  }
}

/** The questions of the page, as FAQPage structured data. */
export function faqJsonLd(items: FaqItem[], language: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: language,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }
}
