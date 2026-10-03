"use client"

import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { useTranslation } from "@/lib/i18n"

interface SessionNavLinksProps {
  /** Clases extra para el link activo (dashboard/closet) */
  activeClassName?: string
  className?: string
}

/**
 * En la landing/nav pública:
 * - Sesión activa → link a Dashboard (no muestra "Iniciar sesión")
 * - Sin sesión → Iniciar sesión + Registrarse
 */
export function SessionNavLinks({
  activeClassName = "border-b border-[#1A1A1A] pb-1",
  className = "text-xs tracking-[0.2em] uppercase hover:opacity-60 transition-opacity",
}: SessionNavLinksProps) {
  const { isAuthenticated, loading } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return <div className="h-4 w-24" aria-hidden />
  }

  if (isAuthenticated) {
    return (
      <div className={`flex items-center gap-6 ${className}`}>
        <Link href="/wardrobe" className={activeClassName}>
          {t("nav.dashboard")}
        </Link>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-6 ${className}`}>
      <Link href="/register" className="hidden sm:inline-block hover:opacity-60">
        {t("nav.register")}
      </Link>
      <Link href="/login" className={activeClassName}>
        {t("nav.login")}
      </Link>
    </div>
  )
}
