"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTranslation } from "@/lib/i18n"
import {
  LEGAL_DOCS,
  LEGAL_PATHS,
  LEGAL_UPDATED,
  contactEmail,
  type Block,
  type LegalDocId,
} from "@/lib/legal"

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) =>
        typeof block === "string" ? (
          <p key={index} className="leading-relaxed text-[#1A1A1A]/85">
            {block}
          </p>
        ) : (
          <ul
            key={index}
            className="list-disc space-y-2 pl-5 leading-relaxed text-[#1A1A1A]/85 marker:text-[#C9B99A]"
          >
            {block.list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </>
  )
}

/** A legal document (terms or security policy) in the visitor's language. */
export function LegalPage({ doc }: { doc: LegalDocId }) {
  const { t, locale } = useTranslation()
  const content = LEGAL_DOCS[doc][locale]
  const other: LegalDocId = doc === "terms" ? "security" : "terms"
  const otherTitle = LEGAL_DOCS[other][locale].title
  const email = contactEmail()

  // The page title follows the language (the server sends the Spanish one)
  useEffect(() => {
    document.title = `${content.title} | Afrodita`
  }, [content.title])

  return (
    <div className="min-h-screen bg-[#F8F5F0] text-[#1A1A1A]">
      <header className="sticky top-0 z-40 border-b border-[#E0D9CF] bg-[#F8F5F0]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] hover:opacity-70"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-editorial text-xl font-light normal-case tracking-wide">
              Afrodita
            </span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-[#6B6B6B]">
          {t("legal.eyebrow")}
        </p>
        <h1 className="font-editorial text-4xl font-light leading-tight md:text-6xl">
          {content.title}
        </h1>
        <p className="mt-4 text-xs text-[#6B6B6B]">
          {t("legal.updated", {
            date: LEGAL_UPDATED.toLocaleDateString(locale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          })}
        </p>
        <p className="mt-8 border-l-2 border-[#C9B99A] pl-5 leading-relaxed text-[#1A1A1A]/85">
          {content.intro}
        </p>

        <nav
          aria-label={t("legal.toc")}
          className="mt-12 border-y border-[#E0D9CF] py-6"
        >
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#6B6B6B]">
            {t("legal.toc")}
          </p>
          <ol className="columns-1 gap-8 text-sm sm:columns-2">
            {content.sections.map((section, index) => (
              <li key={section.id} className="mb-1.5 break-inside-avoid">
                <a href={`#${section.id}`} className="hover:underline">
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-4 space-y-12">
          {content.sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 space-y-4 pt-8"
            >
              <h2 className="font-editorial text-2xl font-light md:text-3xl">
                {index + 1}. {section.heading}
              </h2>
              <Blocks blocks={section.body} />
            </section>
          ))}

          {email && (
            <section id="contact" className="scroll-mt-24 space-y-4 pt-8">
              <h2 className="font-editorial text-2xl font-light md:text-3xl">
                {content.sections.length + 1}. {t("legal.contact")}
              </h2>
              <p className="leading-relaxed text-[#1A1A1A]/85">
                {t("legal.contactBody")}{" "}
                <a
                  href={`mailto:${email}`}
                  className="underline underline-offset-4"
                >
                  {email}
                </a>
              </p>
            </section>
          )}
        </div>

        <footer className="mt-20 flex flex-col gap-3 border-t border-[#E0D9CF] pt-8 text-sm">
          <Link
            href={LEGAL_PATHS[other]}
            className="underline underline-offset-4"
          >
            {otherTitle}
          </Link>
          <Link href="/" className="text-[#6B6B6B] hover:text-[#1A1A1A]">
            {t("legal.backHome")}
          </Link>
        </footer>
      </main>
    </div>
  )
}
