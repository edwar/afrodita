import { NextRequest, NextResponse } from "next/server"

const PROTECTED_PAGE_PREFIXES = ["/wardrobe", "/chat", "/preview"]
const PUBLIC_API_PREFIXES = ["/api/auth"]

const SESSION_COOKIE = "better-auth.session_token"

function isProtectedPage(pathname: string) {
  return PROTECTED_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
}

/**
 * Proxy de Next.js 16 (reemplaza middleware).
 * - Optimistic: checa cookie de sesión (sin tocar la DB)
 * - APIs privadas → 401 JSON
 * - Páginas privadas sin cookie → redirect /login?callbackUrl=
 * La validación real de la sesión se hace en (dashboard)/layout.tsx
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSessionCookie = !!request.cookies.get(SESSION_COOKIE)?.value

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname) || hasSessionCookie) {
      return NextResponse.next()
    }
    return NextResponse.json(
      { error: "Debes iniciar sesión para continuar" },
      { status: 401 },
    )
  }

  if (isProtectedPage(pathname) && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
