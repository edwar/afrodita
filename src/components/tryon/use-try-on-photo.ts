"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

/** Longest side of the photo sent to the server (keeps uploads small). */
const UPLOAD_MAX_SIDE = 1600

export async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error ?? "Error")
  return data as T
}

/** Downsizes in the browser: phone photos are far larger than needed. */
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    )
    return blob ?? file
  } catch {
    // Formats the browser cannot decode go up as they are; the server decides
    return file
  }
}

/**
 * Upload / delete of the user's try-on photo. Either one changes which looks
 * exist, so every screen showing looks is refreshed.
 */
export function useTryOnPhoto(onChange?: () => void) {
  const queryClient = useQueryClient()
  const refresh = () => {
    onChange?.()
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tryon-look"] }),
      queryClient.invalidateQueries({ queryKey: ["looks"] }),
    ])
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", await shrinkPhoto(file), "photo.jpg")
      return readJson(await fetch("/api/tryon/photo", { method: "PUT", body: form }))
    },
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: async () =>
      readJson(await fetch("/api/tryon/photo", { method: "DELETE" })),
    onSuccess: refresh,
  })

  return { upload, remove, busy: upload.isPending || remove.isPending }
}
