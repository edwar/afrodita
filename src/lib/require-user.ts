import { NextResponse } from "next/server"
import { auth } from "./auth"

export type SessionUser = {
  id: string
  name: string
  email: string
  image?: string | null
}

function toHeaders(input: Request | Headers): Headers {
  return input instanceof Request ? input.headers : input
}

async function resolveSessionUser(
  input: Request | Headers,
): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: toHeaders(input) })
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

/** Para route handlers: exige sesión activa. Acepta Request o Headers. */
export async function requireUser(input: Request | Headers) {
  return resolveSessionUser(input)
}

export async function requireUserId(input: Request | Headers) {
  const user = await resolveSessionUser(input)
  return user?.id ?? null
}

export function unauthorized(
  message = "Debes iniciar sesión para continuar",
) {
  return NextResponse.json({ error: message }, { status: 401 })
}
