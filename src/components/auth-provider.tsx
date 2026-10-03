"use client"

import { createContext, useContext, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useSession as useAuthSession, signOut } from "@/lib/auth-client"

interface User {
  id: string
  name: string
  email: string
  image?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useAuthSession()
  const router = useRouter()
  const user: User | null =
    !isPending && session?.user ? (session.user as User) : null

  const logout = async () => {
    await signOut()
    router.replace("/")
    router.refresh()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: isPending,
        isAuthenticated: !!session?.user,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
