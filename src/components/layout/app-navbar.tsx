"use client"

import Link from "next/link"
import { UserRound } from "lucide-react"
import { usePathname } from "next/navigation"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useAuth } from "@/components/auth-provider"
import { useTranslation } from "@/lib/i18n"

const LINK_BASE =
  "text-[11px] tracking-[0.15em] uppercase transition-colors"
const LINK_INACTIVE = "text-[#6B6B6B] hover:text-[#1A1A1A]"
const LINK_ACTIVE =
  "text-[#1A1A1A] font-medium border-b border-[#1A1A1A] pb-1"

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Navbar centralizado del dashboard (closet, estilista, preview).
 * Diseño editorial Afrodita: logo, links con estado activo, usuario, logout e idioma.
 */
export function AppNavbar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { user, logout, loading } = useAuth()

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#F8F5F0]/90 backdrop-blur-md border-b border-[#E0D9CF]">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-editorial text-xl font-light hover:opacity-70 transition-opacity"
        >
          Afrodita
        </Link>

        <div className="flex items-center gap-6 md:gap-8">
          <Link
            href="/wardrobe"
            className={`${LINK_BASE} ${isActive(pathname, "/wardrobe") ? LINK_ACTIVE : LINK_INACTIVE}`}
          >
            {t("nav.closet")}
          </Link>
          <Link
            href="/chat"
            className={`${LINK_BASE} ${isActive(pathname, "/chat") ? LINK_ACTIVE : LINK_INACTIVE}`}
          >
            {t("nav.stylist")}
          </Link>
          <Link
            href="/looks"
            className={`${LINK_BASE} ${isActive(pathname, "/looks") ? LINK_ACTIVE : LINK_INACTIVE}`}
          >
            {t("nav.looks")}
          </Link>

          {user && (
            <Link
              href="/account"
              title={t("nav.account")}
              aria-label={t("nav.account")}
              className={`flex items-center text-[11px] tracking-[0.15em] uppercase transition-colors ${
                isActive(pathname, "/account")
                  ? "text-[#1A1A1A]"
                  : "text-[#6B6B6B] hover:text-[#1A1A1A]"
              }`}
            >
              {/* Small screens have no room for the name: an icon reaches the same page */}
              <UserRound className="h-4 w-4 lg:hidden" />
              <span className="hidden max-w-[180px] truncate lg:block">
                {user.name || user.email}
              </span>
            </Link>
          )}

          {!loading && user && (
            <button
              type="button"
              onClick={() => logout()}
              className={`${LINK_BASE} ${LINK_INACTIVE}`}
            >
              {t("nav.logout")}
            </button>
          )}

          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  )
}
