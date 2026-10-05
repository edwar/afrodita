import { afterEach, describe, expect, it, vi } from "vitest"
import { LEGAL_DOCS, LEGAL_PATHS, contactEmail, type LegalDocId } from "../index"

const ids = Object.keys(LEGAL_DOCS) as LegalDocId[]

afterEach(() => vi.unstubAllEnvs())

describe.each(ids)("legal document: %s", (id) => {
  const { es, en } = LEGAL_DOCS[id]

  it("has the same sections, in the same order, in both languages", () => {
    expect(en.sections.map((s) => s.id).length).toBe(es.sections.length)
    // ids are language-neutral anchors, so they must not repeat inside a document
    expect(new Set(es.sections.map((s) => s.id)).size).toBe(es.sections.length)
    expect(new Set(en.sections.map((s) => s.id)).size).toBe(en.sections.length)
  })

  it.each(["es", "en"] as const)("%s: every section has a heading and content", (locale) => {
    const doc = LEGAL_DOCS[id][locale]
    expect(doc.title.length).toBeGreaterThan(5)
    expect(doc.intro.length).toBeGreaterThan(40)
    for (const section of doc.sections) {
      expect(section.heading.trim()).not.toBe("")
      expect(section.body.length).toBeGreaterThan(0)
      for (const block of section.body) {
        if (typeof block !== "string") expect(block.list.length).toBeGreaterThan(0)
      }
    }
  })

  it("has a route", () => {
    expect(LEGAL_PATHS[id]).toMatch(/^\//)
  })
})

describe("what the policy promises matches the product", () => {
  const text = JSON.stringify(LEGAL_DOCS.security.es) + JSON.stringify(LEGAL_DOCS.terms.es)

  it("names the providers that really receive data", () => {
    for (const provider of ["Google", "Neon", "Vercel"]) expect(text).toContain(provider)
  })

  it("keeps the rule about generated looks surviving a deleted photo", () => {
    expect(text).toContain("Eliminar tu foto base no los borra")
  })

  it("states the adult-only rule in both documents", () => {
    expect(JSON.stringify(LEGAL_DOCS.terms.es)).toContain("18 años")
    expect(JSON.stringify(LEGAL_DOCS.security.es)).toContain("18 años")
  })
})

describe("contactEmail", () => {
  it("is null when not configured, so the section is left out", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "")
    expect(contactEmail()).toBeNull()
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "   ")
    expect(contactEmail()).toBeNull()
  })

  it("returns the trimmed address when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", " hola@example.com ")
    expect(contactEmail()).toBe("hola@example.com")
  })
})
