"use client"

import Link from "next/link"
import Image from 'next/image'
import { ArrowRight, Check, Menu } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"
import { SessionNavLinks } from "@/components/auth/session-nav-links"
import { useAuth } from "@/components/auth-provider"
import { FaqSection } from "@/components/faq-section"

export default function LandingPage() {
  const { t } = useTranslation()
  const { isAuthenticated, loading } = useAuth()

  const heroCtaHref = isAuthenticated ? "/wardrobe" : "/register"
  const heroCtaLabel = isAuthenticated
    ? t("landing.hero.ctaAuthenticated")
    : t("landing.hero.cta")

  const bottomCtaHref = isAuthenticated ? "/wardrobe" : "/register"
  const bottomCtaLabel = isAuthenticated
    ? t("landing.cta.buttonAuthenticated")
    : t("landing.cta.button")

  return (
    <div className="min-h-screen bg-[#F8F5F0] text-[#1A1A1A]">
      {/* Navigation - Editorial Style */}
      <nav className="fixed top-0 w-full z-50 bg-[#F8F5F0]/90 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button className="flex items-center gap-3 text-xs tracking-[0.2em] uppercase">
              <Menu className="w-4 h-4" />
              {t("nav.menu")}
            </button>
          </div>

          <Link href="/" className="absolute left-1/2 -translate-x-1/2">
            <span className="font-editorial text-2xl font-light tracking-wide">Afrodita</span>
          </Link>

          <div className="flex items-center gap-6">
            <LanguageSwitcher />
            <div className="hidden md:block">
              <SessionNavLinks />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero - Editorial Magazine Layout */}
      <section className="pt-16 min-h-screen">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[calc(100vh-4rem)]">

            {/* Left Column - Large Typography */}
            <div className="lg:col-span-5 flex flex-col justify-center py-12 lg:py-0">
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-6">
                {t("landing.hero.eyebrow")}
              </p>

              <h1 className="heading-editorial text-[80px] md:text-[120px] lg:text-[160px] leading-[0.85] mb-8">
                <span className="block">{t("landing.hero.title1")}</span>{" "}
                <span className="block italic">{t("landing.hero.title2")}</span>
              </h1>

              <div className="max-w-sm">
                <p className="text-sm text-[#6B6B6B] leading-relaxed mb-8">
                  {t("landing.hero.description")}
                </p>

                <Link
                  href={heroCtaHref}
                  className="inline-flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase font-medium hover:gap-5 transition-all"
                >
                  {!loading && heroCtaLabel}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Column - Visual */}
            <div className="lg:col-span-7 relative">
              <div className="aspect-[3/4] relative overflow-hidden">
                <Image
                  width={500}
                  height={500}
                  src="/images/fashion-hero.jpg"
                  alt={t("landing.alt.hero")}
                  priority
                  className="w-full h-full object-cover"
                />

                {/* Floating label */}
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="bg-white/90 backdrop-blur-sm p-6">
                    <p className="text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                      {t("landing.hero.aiPowered")}
                    </p>
                    <p className="font-editorial text-2xl font-light">
                      {t("landing.hero.outfitsFromCloset")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating price tag style */}
              <div className="absolute top-12 -left-4 lg:left-8 bg-[#1A1A1A] text-white px-6 py-4">
                <p className="text-[10px] tracking-[0.2em] uppercase mb-1">{t("landing.hero.fromYourWardrobe").split(" ").slice(0, 1)}</p>
                <p className="font-editorial text-3xl font-light">{t("landing.hero.fromYourWardrobe").split(" ").slice(1, 2)}</p>
                <p className="font-editorial text-3xl font-light italic">{t("landing.hero.fromYourWardrobe").split(" ").slice(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Minimal Editorial */}
      <section className="py-24 md:py-32 border-t border-[#E0D9CF]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {/* Feature 1 */}
            <div className="group">
              <div className="aspect-[4/5] mb-6 overflow-hidden relative">
                <Image
                  width={500}
                  height={500}
                  src="/images/fashion-closet.jpg"
                  alt={t("landing.alt.closet")}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-3">
                {t("landing.features.step1.number")}
              </p>
              <h3 className="font-editorial text-2xl font-light mb-3">
                {t("landing.features.step1.title")}
              </h3>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                {t("landing.features.step1.description")}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group">
              <div className="aspect-[4/5] mb-6 overflow-hidden relative">
                <Image
                  width={500}
                  height={500}
                  src="/images/fashion-style.jpg"
                  alt={t("landing.alt.style")}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-3">
                {t("landing.features.step2.number")}
              </p>
              <h3 className="font-editorial text-2xl font-light mb-3">
                {t("landing.features.step2.title")}
              </h3>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                {t("landing.features.step2.description")}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group">
              <div className="aspect-[4/5] mb-6 overflow-hidden relative">
                <Image
                  width={500}
                  height={500}
                  src="/images/fashion-avatar.jpg"
                  alt={t("landing.alt.avatar")}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-3">
                {t("landing.features.step3.number")}
              </p>
              <h3 className="font-editorial text-2xl font-light mb-3">
                {t("landing.features.step3.title")}
              </h3>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                {t("landing.features.step3.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Afrodita - Editorial Grid */}
      <section className="py-24 md:py-32 bg-[#1A1A1A] text-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#C9B99A] mb-6">
                {t("landing.why.eyebrow")}
              </p>
              <h2 className="font-editorial text-5xl md:text-6xl font-light leading-[0.95] mb-8">
                {t("landing.why.title1")}
                <span className="block italic">{t("landing.why.title2")}</span>
              </h2>
              <p className="text-white/60 max-w-md leading-relaxed">
                {t("landing.why.description")}
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex gap-6 items-start border-b border-white/10 pb-8">
                <Check className="w-5 h-5 text-[#C9B99A] mt-1 shrink-0" />
                <div>
                  <h4 className="font-medium mb-2">{t("landing.why.features.uses_what")}</h4>
                  <p className="text-sm text-white/50">{t("landing.why.features.uses_what_desc")}</p>
                </div>
              </div>
              <div className="flex gap-6 items-start border-b border-white/10 pb-8">
                <Check className="w-5 h-5 text-[#C9B99A] mt-1 shrink-0" />
                <div>
                  <h4 className="font-medium mb-2">{t("landing.why.features.tryon_live")}</h4>
                  <p className="text-sm text-white/50">{t("landing.why.features.tryon_live_desc")}</p>
                </div>
              </div>
              <div className="flex gap-6 items-start border-b border-white/10 pb-8">
                <Check className="w-5 h-5 text-[#C9B99A] mt-1 shrink-0" />
                <div>
                  <h4 className="font-medium mb-2">{t("landing.why.features.ai_fashion")}</h4>
                  <p className="text-sm text-white/50">{t("landing.why.features.ai_fashion_desc")}</p>
                </div>
              </div>
              <div className="flex gap-6 items-start">
                <Check className="w-5 h-5 text-[#C9B99A] mt-1 shrink-0" />
                <div>
                  <h4 className="font-medium mb-2">{t("landing.why.features.options")}</h4>
                  <p className="text-sm text-white/50">{t("landing.why.features.options_desc")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FaqSection />

      {/* CTA - Editorial Style */}
      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 text-center">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-6">
            {t("landing.cta.eyebrow")}
          </p>
          <h2 className="font-editorial text-5xl md:text-7xl font-light leading-[0.9] mb-8">
            {t("landing.cta.title1")}
            <span className="block italic">{t("landing.cta.title2")}</span>
          </h2>
          <p className="text-[#6B6B6B] mb-12 max-w-lg mx-auto">
            {t("landing.cta.description")}
          </p>
          <Link
            href={bottomCtaHref}
            className="btn-fashion inline-flex items-center gap-3"
          >
            {!loading && bottomCtaLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer - Minimal Editorial */}
      <footer className="py-8 border-t border-[#E0D9CF]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-editorial text-lg font-light">Afrodita</span>
          <div className="flex flex-col items-center gap-2 md:items-end">
            <nav className="flex items-center gap-5 text-xs text-[#6B6B6B]">
              <Link href="/terminos" className="hover:text-[#1A1A1A] hover:underline">
                {t("landing.footer.terms")}
              </Link>
              <Link href="/seguridad" className="hover:text-[#1A1A1A] hover:underline">
                {t("landing.footer.security")}
              </Link>
            </nav>
            <p className="text-xs text-[#6B6B6B]">
              &copy; {new Date().getFullYear()} Afrodita. {t("landing.footer.copyright")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
