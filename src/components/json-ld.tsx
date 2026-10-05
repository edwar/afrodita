import { serializeJsonLd } from "@/lib/json-ld"

/** Structured data for search and AI engines. Rendered into the HTML itself. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
