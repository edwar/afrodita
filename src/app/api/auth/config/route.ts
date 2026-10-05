import { NextResponse } from "next/server"
import { isGoogleConfigured } from "@/lib/auth-providers"

/** Which sign-in methods this deployment offers, so the UI shows only those. */
export function GET() {
  return NextResponse.json(
    { google: isGoogleConfigured() },
    { headers: { "Cache-Control": "public, max-age=60" } },
  )
}
