/** Solo permite rutas internas como callbackUrl (/wardrobe, no //evil.com). */
export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/wardrobe",
): string {
  if (!raw) return fallback
  if (typeof raw !== "string") return fallback
  if (!raw.startsWith("/")) return fallback
  if (raw.startsWith("//")) return fallback
  if (raw.startsWith("/\\")) return fallback
  if (raw.includes("\\") || raw.includes("\\")) return fallback
  return raw
}
