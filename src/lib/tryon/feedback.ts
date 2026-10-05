/**
 * Storage of the user's votes on looks: one small JSON object per user next
 * to their try-on data (`tryon/<user>/feedback.json`).
 */
import { getObject, putObject } from "@/lib/storage"
import {
  parseFeedback,
  withVote,
  type Feedback,
  type VoteRecord,
} from "./feedback-core"

const feedbackKey = (userId: string) => `tryon/${userId}/feedback.json`
const legacyLikesKey = (userId: string) => `tryon/${userId}/likes.json`

export async function getFeedback(userId: string): Promise<Feedback> {
  const current = await getObject(feedbackKey(userId))
  // The likes-only file only matters until the first vote is saved
  const legacy = current ? null : await getObject(legacyLikesKey(userId))
  return parseFeedback(
    current ? current.bytes.toString() : null,
    legacy ? legacy.bytes.toString() : null
  )
}

async function save(userId: string, feedback: Feedback): Promise<void> {
  await putObject(
    feedbackKey(userId),
    Buffer.from(JSON.stringify({ votes: feedback })),
    "application/json"
  )
}

/** Sets or clears (`null`) the vote on one look. */
export async function setVote(
  userId: string,
  key: string,
  record: VoteRecord | null
): Promise<void> {
  await save(userId, withVote(await getFeedback(userId), key, record))
}

/**
 * Forgets a "like" (used when the look is deleted). A "dislike" stays: it is
 * what keeps the stylist from proposing that combination again.
 */
export async function removeLike(userId: string, key: string): Promise<void> {
  const feedback = await getFeedback(userId)
  if (feedback[key]?.vote === "like") await save(userId, withVote(feedback, key, null))
}
