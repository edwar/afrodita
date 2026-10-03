"use client"

import { Check, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

interface PasswordRule {
  id: string
  label: string
  test: (password: string) => boolean
}

interface PasswordValidatorProps {
  password: string
  confirmPassword?: string
  showRules?: boolean
}

export function PasswordValidator({ password, confirmPassword, showRules = true }: PasswordValidatorProps) {
  const { t } = useTranslation()

  const rules: PasswordRule[] = [
    {
      id: "length",
      label: t("auth.passwordRules.length"),
      test: (p) => p.length >= 8,
    },
    {
      id: "uppercase",
      label: t("auth.passwordRules.uppercase"),
      test: (p) => /[A-Z]/.test(p),
    },
    {
      id: "lowercase",
      label: t("auth.passwordRules.lowercase"),
      test: (p) => /[a-z]/.test(p),
    },
    {
      id: "number",
      label: t("auth.passwordRules.number"),
      test: (p) => /[0-9]/.test(p),
    },
    {
      id: "special",
      label: t("auth.passwordRules.special"),
      test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p),
    },
  ]

  // Add confirm password rule only if confirmPassword is provided
  if (confirmPassword !== undefined) {
    rules.push({
      id: "confirm",
      label: t("auth.passwordRules.confirm"),
      test: (p) => p === confirmPassword && p.length > 0,
    })
  }

  if (!showRules || !password) return null

  const allPassed = rules.every((rule) => rule.test(password))

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B]">
        {t("auth.passwordRequirements")}
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {rules.map((rule) => {
          const passed = rule.test(password)
          return (
            <div
              key={rule.id}
              className={`flex items-center gap-2 text-xs ${
                passed ? "text-[#1A1A1A]" : "text-[#B0B0B0]"
              }`}
            >
              {passed ? (
                <Check className="w-3 h-3 shrink-0" />
              ) : (
                <X className="w-3 h-3 shrink-0" />
              )}
              <span>{rule.label}</span>
            </div>
          )
        })}
      </div>
      {allPassed && (
        <p className="text-xs text-[#1A1A1A] font-medium mt-2">
          {t("auth.passwordStrong")}
        </p>
      )}
    </div>
  )
}

export function validatePassword(password: string, confirmPassword?: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters")
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number")
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.push("Passwords do not match")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
