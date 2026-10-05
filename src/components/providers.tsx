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
          {/* Bajo el menú fijo (h-16), para no tapar sus enlaces */}
          <Toaster
            position="top-right"
            theme="light"
            offset={{ top: 64 }}
            options={{ fill: "#1A1A1A", roundness: 6 }}
          />
        </QueryProvider>
      </AuthProvider>
    </I18nProvider>
  )
}
