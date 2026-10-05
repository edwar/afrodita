import { describe, expect, it } from "vitest"
import { authErrorKey } from "../auth-errors"
import { googleCredentials } from "../auth-providers"

describe("googleCredentials", () => {
  it("needs both values", () => {
    expect(googleCredentials({ GOOGLE_CLIENT_ID: "id" })).toBeNull()
    expect(googleCredentials({ GOOGLE_CLIENT_SECRET: "secret" })).toBeNull()
    expect(googleCredentials({})).toBeNull()
  })

  it("ignores the example text from .env.example", () => {
    expect(
      googleCredentials({
        GOOGLE_CLIENT_ID: "your-google-client-id",
        GOOGLE_CLIENT_SECRET: "your-google-client-secret",
      })
    ).toBeNull()
  })

  it("returns trimmed credentials when both are real", () => {
    expect(
      googleCredentials({ GOOGLE_CLIENT_ID: " 123.apps ", GOOGLE_CLIENT_SECRET: " GOCSPX-abc " })
    ).toEqual({ clientId: "123.apps", clientSecret: "GOCSPX-abc" })
  })
})

describe("authErrorKey", () => {
  it("is null when there is no error", () => {
    expect(authErrorKey(null)).toBeNull()
    expect(authErrorKey("")).toBeNull()
    expect(authErrorKey(undefined)).toBeNull()
  })

  it.each([
    ["account_not_linked", "auth.errors.accountNotLinked"],
    ["email_does_not_match", "auth.errors.emailDoesNotMatch"],
    ["account_already_linked_to_different_user", "auth.errors.alreadyLinked"],
    ["access_denied", "auth.errors.cancelled"],
  ])("explains %s", (code, key) => {
    expect(authErrorKey(code)).toBe(key)
  })

  it("falls back to a generic message for anything else", () => {
    expect(authErrorKey("invalid_code")).toBe("auth.errors.generic")
    expect(authErrorKey("<script>")).toBe("auth.errors.generic")
  })
})
