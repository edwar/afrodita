/**
 * What the user thinks of each look: the pure part (types, parsing, ranking).
 * No storage here, so client components can import the reasons list.
 *
 * A look is a set of garments (the gallery merges outfit options that use the
 * same ones), so votes are keyed by that set rather than by option: a vote
 * holds when the stylist proposes the same garments again.
 */

/** Why a look was rejected. Short on purpose: one tap each. */
export const REASONS = [
  "colors",
  "too_formal",
  "too_casual",
  "combination",
  "overused",
] as const
export type Reason = (typeof REASONS)[number]

export type Vote = "like" | "dislike"

export interface VoteRecord {
  vote: Vote
  /** Only for dislikes; optional. */
  reasons: Reason[]
  /** What the user asked the stylist for when the look was proposed. */
  request: string
  /** Garment ids of the look. */
  garments: string[]
  /** ISO date of the vote. */
  at: string
}

/** Votes by look key. */
export type Feedback = Record<string, VoteRecord>

/** Identity of a look: its garments, in any order. */
export function lookKey(garments: { id: string }[]): string {
  return garments
    .map((garment) => garment.id)
    .sort()
    .join("|")
}

/** Keeps only known reasons, once each (input comes from the client). */
export function sanitizeReasons(input: unknown): Reason[] {
  if (!Array.isArray(input)) return []
  return REASONS.filter((reason) => input.includes(reason))
}

const LEGACY_DATE = "1970-01-01T00:00:00.000Z"

/**
 * Reads the stored votes. `feedbackJson` is the current file; `legacyLikesJson`
 * the older likes-only file, used only until the first vote is written.
 */
export function parseFeedback(
  feedbackJson: string | null,
  legacyLikesJson: string | null
): Feedback {
  try {
    if (feedbackJson !== null) {
      const votes = JSON.parse(feedbackJson)?.votes
      return votes && typeof votes === "object" ? (votes as Feedback) : {}
    }
    if (legacyLikesJson !== null) {
      const looks: unknown = JSON.parse(legacyLikesJson)?.looks
      if (!Array.isArray(looks)) return {}
      return Object.fromEntries(
        (looks as string[]).map((key) => [
          key,
          {
            vote: "like",
            reasons: [],
            request: "",
            garments: key.split("|"),
            at: LEGACY_DATE,
          } satisfies VoteRecord,
        ])
      )
    }
  } catch {
    // A damaged file must not take the stylist down: start fresh
  }
  return {}
}

/** Sets or clears (`null`) one look's vote, leaving the original untouched. */
export function withVote(
  feedback: Feedback,
  key: string,
  record: VoteRecord | null
): Feedback {
  const next = { ...feedback }
  if (record) next[key] = record
  else delete next[key]
  return next
}

/** Most recent votes of one kind, newest first. */
export function recentVotes(
  feedback: Feedback,
  vote: Vote,
  limit: number
): { key: string; record: VoteRecord }[] {
  return Object.entries(feedback)
    .filter(([, record]) => record.vote === vote)
    .map(([key, record]) => ({ key, record }))
    .sort((a, b) => b.record.at.localeCompare(a.record.at))
    .slice(0, limit)
}

/** Keys of every look the user rejected. */
export function dislikedKeys(feedback: Feedback): Set<string> {
  return new Set(
    Object.entries(feedback)
      .filter(([, record]) => record.vote === "dislike")
      .map(([key]) => key)
  )
}
