import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "@/lib/prisma"

const secret = process.env.BETTER_AUTH_SECRET
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("BETTER_AUTH_SECRET no está definido")
}

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
