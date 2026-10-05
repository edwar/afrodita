import type { Locale } from "@/lib/i18n"

/** A paragraph, or a bulleted list. */
export type Block = string | { list: string[] }

export interface LegalSection {
  id: string
  heading: string
  body: Block[]
}

export interface LegalDoc {
  title: string
  /** One-paragraph summary shown under the title. */
  intro: string
  sections: LegalSection[]
}

export type LegalDocs = Record<Locale, LegalDoc>

/** Date of the last change to either document (local noon avoids timezone drift). */
export const LEGAL_UPDATED = new Date("2026-10-05T12:00:00")

/**
 * Contact address shown in both documents. Set NEXT_PUBLIC_CONTACT_EMAIL; when
 * it is empty the contact section is left out rather than shown blank.
 */
export function contactEmail(): string | null {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null
}
