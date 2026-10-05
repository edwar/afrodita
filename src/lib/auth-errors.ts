/**
 * Error codes better-auth puts in `?error=` when a sign-in or link with a
 * provider fails, mapped to the translation key of the message to show.
 */
const KEYS: Record<string, string> = {
  // The email already belongs to an account that has not proven it owns it
  account_not_linked: "auth.errors.accountNotLinked",
  email_does_not_match: "auth.errors.emailDoesNotMatch",
  account_already_linked_to_different_user: "auth.errors.alreadyLinked",
  access_denied: "auth.errors.cancelled",
}

/** Translation key for an error code; null when there is no error. */
export function authErrorKey(code: string | null | undefined): string | null {
  if (!code) return null
  return KEYS[code] ?? "auth.errors.generic"
}
