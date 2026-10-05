import { NextResponse } from "next/server"
import { uploadImage } from "@/lib/storage"
import { requireUser, unauthorized } from "@/lib/require-user"
import { PlanLimitError, checkGarmentAllowance } from "@/lib/billing/limits"

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    if (!user) return unauthorized()

    // Fail before the upload, not after the file is already stored
    await checkGarmentAllowance(user.id)

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 },
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen no puede superar 10MB" },
        { status: 400 },
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = file.type.split("/")[1] || "jpg"
    const key = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const imageUrl = await uploadImage(key, buffer, file.type)

    return NextResponse.json({ imageUrl, key })
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
