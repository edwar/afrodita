"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"

/**
 * Guard de cliente: mientras carga la sesión o si no hay usuario,
 * mantiene en /login. La protección real es server-side en (dashboard)/layout.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/wardrobe"

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }
  }, [loading, user, router, callbackUrl])

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border border-[#C9B99A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
