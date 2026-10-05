"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2 } from "lucide-react"
import { sileo } from "sileo"
import { useTranslation } from "@/lib/i18n"
import { linkSocial } from "@/lib/auth-client"
import { authErrorKey } from "@/lib/auth-errors"
import { PasswordInput } from "@/components/ui/password-input"
import {
  PasswordValidator,
  validatePassword,
} from "@/components/ui/password-validator"

interface Methods {
  name: string
  email: string
  hasPassword: boolean
  hasGoogle: boolean
  googleAvailable: boolean
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error ?? "Error")
  return data as T
}

/** One way of signing in: its name, whether it is on, and what to do about it. */
function Method({
  title,
  active,
  description,
  children,
}: {
  title: string
  active: boolean
  description: string
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="border-b border-[#E0D9CF] py-8">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h3 className="font-editorial text-2xl font-light">{title}</h3>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-[0.15em] ${
            active
              ? "bg-[#1A1A1A] text-white"
              : "border border-[#E0D9CF] text-[#6B6B6B]"
          }`}
        >
          {active && <Check className="h-3 w-3" />}
          {t(active ? "account.on" : "account.off")}
        </span>
      </div>
      <p className="mb-5 max-w-xl text-sm leading-relaxed text-[#6B6B6B]">
        {description}
      </p>
      {children}
    </div>
  )
}

function SetPassword({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")

  const save = useMutation({
    mutationFn: async () =>
      readJson(
        await fetch("/api/account/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }),
      ),
    onSuccess: () => {
      sileo.success({ title: t("account.passwordSaved") })
      onDone()
    },
    onError: (error) => sileo.error({ title: error.message }),
  })

  return (
    <form
      className="max-w-md space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        const validation = validatePassword(password, confirm)
        if (!validation.isValid) {
          sileo.error({ title: validation.errors[0] })
          return
        }
        save.mutate()
      }}
    >
      <div>
        <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[#6B6B6B]">
          {t("auth.password")}
        </label>
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <PasswordValidator password={password} confirmPassword={confirm} />
      </div>
      <div>
        <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[#6B6B6B]">
          {t("auth.confirmPassword")}
        </label>
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>
      <button
        type="submit"
        disabled={save.isPending}
        className="btn-fashion inline-flex items-center gap-3 disabled:opacity-60"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("account.addPassword")}
      </button>
    </form>
  )
}

function AccountContent() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [connecting, setConnecting] = useState(false)

  const { data, isPending, error } = useQuery({
    queryKey: ["account-methods"],
    queryFn: () =>
      fetch("/api/account/methods").then((r) => readJson<Methods>(r)),
  })

  // Back from Google: ?linked=google on success, ?error=<code> on failure
  const failure = authErrorKey(searchParams.get("error"))
  const justLinked = searchParams.get("linked") === "google"

  if (isPending) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border border-[#C9B99A] border-t-transparent" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <p className="py-12 text-sm text-red-700">{error?.message ?? "Error"}</p>
    )
  }

  const both = data.hasPassword && data.hasGoogle

  return (
    <>
      {failure && (
        <p
          role="alert"
          className="mb-6 border-l-2 border-[#1A1A1A] bg-[#EDE8E1] p-4 text-sm leading-relaxed"
        >
          {t(failure)}
        </p>
      )}
      {justLinked && data.hasGoogle && (
        <p
          role="status"
          className="mb-6 border-l-2 border-[#C9B99A] bg-[#EDE8E1] p-4 text-sm leading-relaxed"
        >
          {t("account.googleLinked")}
        </p>
      )}

      <p className="text-sm text-[#6B6B6B]">
        {t("account.signedInAs")}{" "}
        <span className="text-[#1A1A1A]">{data.email}</span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
        {t(both ? "account.bothOn" : "account.onlyOne")}
      </p>

      <div className="mt-8 border-t border-[#E0D9CF]">
        <Method
          title={t("account.methodPassword")}
          active={data.hasPassword}
          description={t(
            data.hasPassword ? "account.passwordOn" : "account.passwordOff",
          )}
        >
          {!data.hasPassword && (
            <SetPassword
              onDone={() =>
                queryClient.invalidateQueries({ queryKey: ["account-methods"] })
              }
            />
          )}
        </Method>

        <Method
          title="Google"
          active={data.hasGoogle}
          description={t(
            data.hasGoogle
              ? "account.googleOn"
              : data.googleAvailable
                ? "account.googleOff"
                : "account.googleUnavailable",
          )}
        >
          {!data.hasGoogle && data.googleAvailable && (
            <button
              type="button"
              disabled={connecting}
              onClick={async () => {
                setConnecting(true)
                // Same email as this account is required; goes back to this page
                const { error: linkError } = await linkSocial({
                  provider: "google",
                  callbackURL: "/account?linked=google",
                  errorCallbackURL: "/account",
                })
                if (linkError) {
                  setConnecting(false)
                  sileo.error({
                    title: linkError.message ?? t("auth.errors.generic"),
                  })
                }
              }}
              className="btn-fashion inline-flex items-center gap-3 disabled:opacity-60"
            >
              {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("account.connectGoogle")}
            </button>
          )}
        </Method>
      </div>
    </>
  )
}

export default function AccountPage() {
  const { t } = useTranslation()
  return (
    <main className="pt-16">
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-12">
        <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-[#6B6B6B]">
          {t("account.eyebrow")}
        </p>
        <h1 className="mb-8 font-editorial text-5xl font-light md:text-6xl">
          {t("account.title")}
        </h1>
        <Suspense fallback={null}>
          <AccountContent />
        </Suspense>
      </div>
    </main>
  )
}
