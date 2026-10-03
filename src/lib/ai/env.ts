export function hasValidApiKey(value: string | undefined): boolean {
  if (!value) return false
  const key = value.trim()
  if (!key) return false
  if (key.toLowerCase().startsWith("your-")) return false
  if (key === "changeme" || key === "xxx" || key === "test") return false
  return true
}
