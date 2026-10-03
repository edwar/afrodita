"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  name?: string
  autoComplete?: string
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "••••••••",
  className = "",
  id,
  name,
  autoComplete = "current-password",
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input-elegant w-full pr-12 ${className}`}
        id={id}
        name={name}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}
