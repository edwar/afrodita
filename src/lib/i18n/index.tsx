"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react"
import es from "./locales/es.json"
import en from "./locales/en.json"

export type Locale = "es" | "en"

const translations: Record<Locale, typeof es> = { es, en }

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".")
  let current: unknown = obj

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === "string" ? current : undefined
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("es")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("afrodita-locale") as Locale
    if (saved === "es" || saved === "en") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- needed to read localStorage after hydration to avoid SSR mismatch
      setLocale(saved)
    }
    setHydrated(true)
  }, [])

  const handleSetLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale)
    localStorage.setItem("afrodita-locale", newLocale)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value = getNestedValue(translations[locale], key)
      if (value === undefined) {
        console.warn(`Missing translation: ${key}`)
        return key
      }

      if (!params) return value

      return Object.entries(params).reduce(
        (result, [paramKey, paramValue]) =>
          result.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue)),
        value
      )
    },
    [locale]
  )

  useEffect(() => {
    if (hydrated) {
      document.title = t("meta.title")
    }
  }, [t, hydrated])

  return (
    <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider")
  }
  return context
}
