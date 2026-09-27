"use client"

import { ReactNode } from "react"
import { QueryProvider } from "@/components/query-provider"
import { Toaster } from "sileo"

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <Toaster position="bottom-right" />
    </QueryProvider>
  )
}
