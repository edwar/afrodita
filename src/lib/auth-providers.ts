import { hasValidApiKey } from "@/lib/ai/env"

export interface GoogleCredentials {
  clientId: string
  clientSecret: string
}

/**
 * Google sign-in credentials, or null when they are not configured (missing,
 * or still the example text). Without them the app works with email and
 * password only and the Google buttons are not shown.
 */
export function googleCredentials(
  env: Record<string, string | undefined> = process.env,
): GoogleCredentials | null {
  const clientId = env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_CLIENT_SECRET
  if (!hasValidApiKey(clientId) || !hasValidApiKey(clientSecret)) return null
  return { clientId: clientId!.trim(), clientSecret: clientSecret!.trim() }
}

export const isGoogleConfigured = () => googleCredentials() !== null
