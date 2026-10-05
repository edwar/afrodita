import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "@/lib/prisma"
import { googleCredentials } from "@/lib/auth-providers"

const secret = process.env.BETTER_AUTH_SECRET
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("BETTER_AUTH_SECRET no está definido")
}

const google = googleCredentials()

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: secret || "afrodita-secret-change-in-production",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  // Only when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set. Google always
  // asks which account to use, so a shared computer does not sign in silently.
  socialProviders: google ? { google: { ...google, prompt: "select_account" } } : {},
  account: {
    accountLinking: {
      enabled: true,
      // Left at its default on purpose: signing in with Google only joins an
      // existing email/password account when that account's email is VERIFIED.
      // Ours are not (no verification emails), so otherwise anyone could
      // register someone else's address with a password and take over the
      // account when its owner later signs in with Google. Joining the two
      // is done explicitly, signed in, from the account page.
      requireLocalEmailVerified: true,
    },
  },
  // Failed sign-ins land on our login page (?error=...), not on a generic one
  onAPIError: { errorURL: "/login" },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [
    "http://localhost:3000",
    "https://afrodita.vercel.app",
  ].concat(
    process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
  ),
  advanced: {
    database: {
      generateId: false,
    },
  },
})

export type Session = typeof auth.$Infer.Session
