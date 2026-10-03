import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/auth-session"
import { AppNavbar } from "@/components/layout/app-navbar"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  if (!session?.user) {
    redirect("/login?callbackUrl=/wardrobe")
  }

  return (
    <div className="min-h-screen bg-[#F8F5F0] text-[#1A1A1A]">
      <AppNavbar />
      {children}
    </div>
  )
}
