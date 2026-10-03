import { headers } from "next/headers"
import { auth } from "./auth"
import { NextResponse } from "next/server"

export type SessionUser = {
  id: string
  name: string
  email: string
  image?: string | null
}

/** Sesión real vía better-auth (server components / route handlers). */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function getServerUserId(): Promise<string | null> {
  const session = await getServerSession()
  return session?.user?.id ?? null
}

/** Solo para route handlers: pasa los headers del Request. */
export async function getSessionUserFromRequest(
  request: Request,
): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) return null
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    }
  } catch {
    return null
  }
}

export function unauthorized(
  message = "Debes iniciar sesión para continuar",
) {
  return NextResponse.json({ error: message }, { status: 401 })
}

export { safeCallbackUrl } from "./safe-callback-url"
