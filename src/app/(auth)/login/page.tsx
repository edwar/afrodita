"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "@/lib/auth-client"
import { safeCallbackUrl } from "@/lib/safe-callback-url"
import { useTranslation } from "@/lib/i18n"
import { sileo } from "sileo"
import { PasswordInput } from "@/components/ui/password-input"
import { LanguageSwitcher } from "@/components/language-switcher"

function LoginForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"), "/wardrobe")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await signIn.email({
        email: email.trim(),
        password,
      })

      if (error) {
        const code = (error as { code?: string }).code
        if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "EMAIL_NOT_FOUND") {
          sileo.error({ title: t("auth.invalidCredentials") })
        } else if (code === "EMAIL_NOT_VERIFIED") {
          sileo.error({ title: t("auth.emailNotVerified") })
        } else {
          sileo.error({
            title: error.message || t("auth.invalidCredentials"),
          })
        }
        return
      }

      sileo.success({ title: t("auth.welcomeBack") })
      router.replace(callbackUrl)
      router.refresh()
    } catch {
      sileo.error({ title: t("auth.error") })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
          {t("auth.email")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input-elegant w-full"
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
          {t("auth.password")}
        </label>
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-fashion w-full flex items-center justify-center gap-3"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          t("auth.login")
        )}
      </button>
    </form>
  )
}

export default function LoginPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-12 flex items-start justify-between">
            <Link href="/" className="font-editorial text-3xl font-light">
              Afrodita
            </Link>
            <LanguageSwitcher />
          </div>

          <div className="mb-8">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-3">
              {t("auth.login")}
            </p>
            <h1 className="font-editorial text-4xl font-light">
              {t("auth.welcomeBack")}
            </h1>
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border border-[#C9B99A] border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          <p className="text-sm text-[#6B6B6B] mt-8 text-center">
            {t("auth.dontHaveAccount")}{" "}
            <Link
              href="/register"
              className="text-[#1A1A1A] font-medium hover:underline"
            >
              {t("auth.register")}
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 relative">
        <img
          src="/images/login-bg.jpg"
          alt="Fashion editorial"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#1A1A1A]/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <p className="font-editorial text-6xl font-light">
              {t("landing.hero.yourStyle")}
            </p>
            <p className="text-sm mt-4 tracking-[0.2em] uppercase">
              {t("landing.hero.fromYourWardrobe").split(" ").slice(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
