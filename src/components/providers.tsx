"use client"

import { ReactNode } from "react"
import { QueryProvider } from "@/components/query-provider"
import { AuthProvider } from "@/components/auth-provider"
import { I18nProvider } from "@/lib/i18n"
import { Toaster } from "sileo"

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <QueryProvider>
          {children}
          <Toaster position="top-right" />
        </QueryProvider>
      </AuthProvider>
    </I18nProvider>
  )
}
