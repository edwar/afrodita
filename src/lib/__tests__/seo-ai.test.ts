import { afterEach, describe, expect, it, vi } from "vitest"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { GET as llmsTxt } from "@/app/llms.txt/route"
import { FAQ } from "../faq"
import { faqJsonLd, serializeJsonLd, siteJsonLd } from "../json-ld"

afterEach(() => vi.unstubAllEnvs())

describe("FAQ", () => {
  it("has the same questions, in the same order, in both languages", () => {
    expect(FAQ.en).toHaveLength(FAQ.es.length)
    expect(FAQ.es.map((i) => !!i.policyLink)).toEqual(FAQ.en.map((i) => !!i.policyLink))
  })

  it.each(["es", "en"] as const)("%s: every question has a real answer", (locale) => {
    for (const item of FAQ[locale]) {
      expect(item.question.trim().endsWith("?")).toBe(true)
      expect(item.answer.length).toBeGreaterThan(20)
    }
    expect(new Set(FAQ[locale].map((i) => i.question)).size).toBe(FAQ[locale].length)
  })

  it("makes no claim about prices or free plans", () => {
    const text = JSON.stringify(FAQ).toLowerCase()
    for (const word of ["gratis", "gratuit", "free", "precio", "price", "$"]) {
      expect(text).not.toContain(word)
    }
  })
})

describe("structured data", () => {
  it("cannot close its own script tag", () => {
    const out = serializeJsonLd({ text: "</script><script>alert(1)</script>" })
    expect(out).not.toContain("</script")
    expect(JSON.parse(out).text).toBe("</script><script>alert(1)</script>")
  })

  it("describes the site as an organization, a website and a web application", () => {
    const graph = siteJsonLd("https://afrodita.test")["@graph"]
    expect(graph.map((node) => node["@type"])).toEqual(["Organization", "WebSite", "WebApplication"])
    for (const node of graph) expect(node.url).toBe("https://afrodita.test")
    // the website and the app point back at the same publisher
    expect(graph[1].publisher).toEqual({ "@id": graph[0]["@id"] })
    expect(graph[2].publisher).toEqual({ "@id": graph[0]["@id"] })
  })

  it("publishes the contact email only when it is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "")
    expect(siteJsonLd("https://a.test")["@graph"][0]).not.toHaveProperty("email")
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "hola@example.com")
    expect(siteJsonLd("https://a.test")["@graph"][0]).toHaveProperty("email", "hola@example.com")
  })

  it("turns the visible FAQ into a FAQPage with the same text", () => {
    const data = faqJsonLd(FAQ.es, "es")
    expect(data["@type"]).toBe("FAQPage")
    expect(data.mainEntity).toHaveLength(FAQ.es.length)
    expect(data.mainEntity[0].name).toBe(FAQ.es[0].question)
    expect(data.mainEntity[0].acceptedAnswer.text).toBe(FAQ.es[0].answer)
  })
})

describe("llms.txt", () => {
  it("is plain text that follows the convention and links the public pages", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://afrodita.test")
    const response = llmsTxt()
    expect(response.headers.get("Content-Type")).toMatch(/^text\/plain/)
    const body = await response.text()
    expect(body.startsWith("# Afrodita\n")).toBe(true)
    expect(body).toContain("\n> ")
    for (const path of ["/", "/terminos", "/seguridad"]) {
      expect(body).toContain(`](https://afrodita.test${path})`)
    }
    for (const item of FAQ.es) expect(body).toContain(item.answer)
  })

  it("does not advertise private areas as pages", async () => {
    const body = await llmsTxt().text()
    for (const path of ["/wardrobe", "/chat", "/looks", "/preview"]) {
      expect(body).not.toMatch(new RegExp(`\\]\\([^)]*${path}\\)`))
    }
  })
})

describe("robots and sitemap", () => {
  it("keeps private areas out of search, and never blocks the public ones", () => {
    const rules = robots().rules as { allow: string; disallow: string[] }
    for (const path of ["/api/", "/wardrobe", "/chat", "/preview", "/looks", "/login", "/register"]) {
      expect(rules.disallow).toContain(path)
    }
    for (const path of ["/", "/terminos", "/seguridad"]) {
      expect(rules.disallow.some((blocked) => path.startsWith(blocked) && blocked !== "/")).toBe(false)
    }
  })

  it("lists the landing and both legal pages", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname)
    expect(urls).toEqual(["/", "/terminos", "/seguridad"])
  })
})
