import { NextResponse } from "next/server"
import { APIError } from "better-auth/api"
import { auth } from "@/lib/auth"
import { requireUser, unauthorized } from "@/lib/require-user"

const MAX_LENGTH = 128

/**
 * Lets an account that has no password (it signed up with Google) add one, so
 * it can then sign in either way. Only for the signed-in user; an account that
 * already has a password is refused (changing it is a different flow).
 */
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const body = await request.json().catch(() => null)
  const password = body?.password
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > MAX_LENGTH
  ) {
    return NextResponse.json(
      { error: "La contraseña debe tener entre 8 y 128 caracteres." },
      { status: 400 },
    )
  }

  try {
    await auth.api.setPassword({
      body: { newPassword: password },
      headers: request.headers,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof APIError) {
      const already = String(error.body?.code ?? "").includes(
        "PASSWORD_ALREADY_SET",
      )
      return NextResponse.json(
        {
          error: already
            ? "Tu cuenta ya tiene una contraseña."
            : (error.body?.message ?? "No se pudo guardar la contraseña."),
        },
        { status: already ? 409 : 400 },
      )
    }
    console.error("[api/account/password] failed:", error)
    return NextResponse.json(
      { error: "No se pudo guardar la contraseña." },
      { status: 500 },
    )
  }
}
