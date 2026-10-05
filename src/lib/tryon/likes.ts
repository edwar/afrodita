/**
 * Looks the user marked as liked.
 *
 * A look is a set of garments (the gallery merges outfit options that use the
 * same ones), so likes are keyed by that set rather than by option: liking a
 * look keeps it liked when the stylist proposes it again. Stored as one small
 * JSON object per user next to their try-on data.
 */
import { getObject, putObject } from "@/lib/storage"

const likesKey = (userId: string) => `tryon/${userId}/likes.json`

/** Identity of a look: its garments, in any order. */
export function lookKey(garments: { id: string }[]): string {
  return garments
    .map((garment) => garment.id)
    .sort()
    .join("|")
}

export async function getLikes(userId: string): Promise<Set<string>> {
  const stored = await getObject(likesKey(userId))
  if (!stored) return new Set()
  try {
    const parsed = JSON.parse(stored.bytes.toString())
    return new Set(Array.isArray(parsed?.looks) ? (parsed.looks as string[]) : [])
  } catch {
    return new Set()
  }
}

/** Adds or removes one look; returns the new set (exported for tests). */
export function withLike(likes: Set<string>, key: string, liked: boolean): Set<string> {
  const next = new Set(likes)
  if (liked) next.add(key)
  else next.delete(key)
  return next
}

export async function setLike(userId: string, key: string, liked: boolean): Promise<void> {
  const current = await getLikes(userId)
  if (current.has(key) === liked) return
  const next = withLike(current, key, liked)
  await putObject(
    likesKey(userId),
    Buffer.from(JSON.stringify({ looks: [...next] })),
    "application/json"
  )
}
