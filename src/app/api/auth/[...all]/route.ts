import { auth } from "@/lib/auth"

async function authHandler(request: Request) {
  return auth.handler(request)
}

export { authHandler as GET, authHandler as POST, authHandler as PUT, authHandler as PATCH, authHandler as DELETE }
