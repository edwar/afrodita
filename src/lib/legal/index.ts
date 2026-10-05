import { SECURITY } from "./security"
import { TERMS } from "./terms"

export { LEGAL_UPDATED, contactEmail } from "./types"
export type { Block, LegalDoc, LegalDocs, LegalSection } from "./types"

export const LEGAL_DOCS = { terms: TERMS, security: SECURITY } as const
export type LegalDocId = keyof typeof LEGAL_DOCS

/** Where each document lives. */
export const LEGAL_PATHS: Record<LegalDocId, string> = {
  terms: "/terminos",
  security: "/seguridad",
}
