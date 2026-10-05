"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signUp } from "@/lib/auth-client"
import { useTranslation } from "@/lib/i18n"
import { sileo } from "sileo"
import { PasswordInput } from "@/components/ui/password-input"
import {
  PasswordValidator,
  validatePassword,
} from "@/components/ui/password-validator"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validation = validatePassword(password, confirmPassword)
    if (!validation.isValid) {
      sileo.error({ title: validation.errors[0] })
      return
    }

    setLoading(true)

    try {
      const { error } = await signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      })

      if (error) {
        const code = (error as { code?: string }).code
        if (
          code === "USER_ALREADY_EXISTS" ||
          code === "EMAIL_ALREADY_EXISTS" ||
          code === "DUPLICATE_EMAIL"
        ) {
          sileo.error({ title: t("auth.emailExists") })
        } else {
          sileo.error({
            title: error.message || t("auth.registrationFailed"),
          })
        }
      } else {
        sileo.success({ title: t("auth.accountCreated") })
        router.replace("/wardrobe")
        router.refresh()
      }
    } catch {
      sileo.error({ title: t("auth.error") })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F5F0] flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Header */}
          {/* Header */}
          <div className="mb-12 flex items-start justify-between">
            <Link href="/" className="font-editorial text-3xl font-light">
              Afrodita
            </Link>
            <LanguageSwitcher />
          </div>

          <div className="mb-8">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-3">
              {t("auth.register")}
            </p>
            <h1 className="font-editorial text-4xl font-light">
              {t("auth.createAccount")}
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                {t("auth.name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.yourName")}
                className="input-elegant w-full"
                required
              />
            </div>

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
                autoComplete="new-password"
              />
              <PasswordValidator
                password={password}
                confirmPassword={confirmPassword}
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                {t("auth.confirmPassword")}
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="••••••••"
                autoComplete="new-password"
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
                t("auth.register")
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-[#6B6B6B]">
            {t("auth.legal.prefix")}{" "}
            <Link
              href="/terminos"
              target="_blank"
              className="underline underline-offset-4 hover:text-[#1A1A1A]"
            >
              {t("auth.legal.terms")}
            </Link>{" "}
            {t("auth.legal.and")}{" "}
            <Link
              href="/seguridad"
              target="_blank"
              className="underline underline-offset-4 hover:text-[#1A1A1A]"
            >
              {t("auth.legal.security")}
            </Link>
            .
          </p>

          {/* Footer */}
          <p className="text-sm text-[#6B6B6B] mt-8 text-center">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link
              href="/login"
              className="text-[#1A1A1A] font-medium hover:underline"
            >
              {t("auth.login")}
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 relative">
        <img
          src="/images/register-bg.jpg"
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
