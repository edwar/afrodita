import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isGoogleConfigured } from "@/lib/auth-providers"
import { requireUser, unauthorized } from "@/lib/require-user"

/** How the signed-in user can sign in: with a password, with Google, or both. */
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (!user) return unauthorized()

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { providerId: true, password: true },
  })

  return NextResponse.json({
    name: user.name,
    email: user.email,
    hasPassword: accounts.some(
      (a) => a.providerId === "credential" && !!a.password,
    ),
    hasGoogle: accounts.some((a) => a.providerId === "google"),
    googleAvailable: isGoogleConfigured(),
  })
}
