import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession, safeCallbackUrl } from "@/lib/auth-session"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  if (session?.user) {
    redirect("/wardrobe")
  }

  return <>{children}</>
}

export async function resolveAuthRedirect(
  callbackUrl?: string | null,
): Promise<string> {
  const session = await getServerSession()
  if (!session?.user) return "/login"
  return safeCallbackUrl(callbackUrl)
}
