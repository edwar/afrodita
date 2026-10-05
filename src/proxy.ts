import { NextRequest, NextResponse } from "next/server"

const PROTECTED_PAGE_PREFIXES = ["/wardrobe", "/chat", "/preview", "/looks", "/account"]
// El webhook lo llama Mercado Pago, sin sesión: se valida por firma y consultando su API
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/billing/webhook"]

// better-auth renombra la cookie con prefijo seguro cuando el baseURL es https
// (__Secure-better-auth.session_token). El proxy debe reconocer ambos, o entra
// en loop: no ve cookie → /login, y el layout de auth ve sesión válida → /wardrobe.
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "__Host-better-auth.session_token",
]

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => !!request.cookies.get(name)?.value)
}

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
  const hasSession = hasSessionCookie(request)

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname) || hasSession) {
      return NextResponse.next()
    }
    return NextResponse.json(
      { error: "Debes iniciar sesión para continuar" },
      { status: 401 },
    )
  }

  if (isProtectedPage(pathname) && !hasSession) {
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
