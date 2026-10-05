"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { signIn } from "@/lib/auth-client"
import { useTranslation } from "@/lib/i18n"

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  )
}

/** Whether this deployment has Google sign-in set up. */
export function useGoogleAvailable(): boolean {
  const { data } = useQuery({
    queryKey: ["auth-config"],
    queryFn: () =>
      fetch("/api/auth/config").then(
        (r) => r.json() as Promise<{ google: boolean }>,
      ),
    staleTime: Infinity,
  })
  return data?.google === true
}

/**
 * "Continue with Google", with its divider. Renders nothing when Google is not
 * configured, so the form is simply email and password. The same button signs
 * in and signs up: a new Google account creates the Afrodita one.
 */
export function GoogleSignIn({ callbackUrl }: { callbackUrl: string }) {
  const { t } = useTranslation()
  const available = useGoogleAvailable()
  const [busy, setBusy] = useState(false)

  if (!available) return null

  return (
    <div className="mt-8">
      <div className="mb-6 flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-[#6B6B6B]">
        <span className="h-px flex-1 bg-[#E0D9CF]" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-[#E0D9CF]" />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          // Leaves the page for Google; on failure it comes back to /login?error=...
          const { error } = await signIn.social({
            provider: "google",
            callbackURL: callbackUrl,
            errorCallbackURL: "/login",
          })
          if (error) setBusy(false)
        }}
        className="flex w-full items-center justify-center gap-3 border border-[#E0D9CF] bg-white px-6 py-4 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors hover:border-[#1A1A1A] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleLogo />}
        {t("auth.continueWithGoogle")}
      </button>
      <p className="mt-3 text-center text-xs text-[#6B6B6B]">
        {t("auth.googleHint")}
      </p>
    </div>
  )
}
