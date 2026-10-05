/**
 * Try-on storage and orchestration.
 *
 * Everything lives under `tryon/<userId>/` in object storage, with no
 * database rows:
 *   base.jpg                          the user's photo
 *   look-<garments>-<photo>.jpg       one generated image per look
 *   usage-<date>.json                 generations made that day
 *
 * A look is identified by its garments alone, so it outlives the photo it
 * was made from: changing or deleting the photo keeps every generated image.
 * The `<photo>` part only records which photo produced it, to tell the user
 * when a look is outdated and can be refreshed.
 */
import { createHash } from "node:crypto"
import sharp from "sharp"
import {
  deleteObject,
  getImageObject,
  getObject,
  getObjectVersion,
  listObjects,
  putObject,
} from "@/lib/storage"
import {
  PROMPT_VERSION,
  TryOnError,
  closestAspectRatio,
  generateTryOnImage,
  tryOnModel,
  type TryOnGarmentInput,
} from "./gemini"

const PHOTO_MAX_SIDE = 1536
const GARMENT_MAX_SIDE = 1024
const MAX_GARMENTS = 6

export interface LookGarment {
  id: string
  name: string
  category: string
  imageUrl: string
}

const userPrefix = (userId: string) => `tryon/${userId}/`
const photoKey = (userId: string) => `${userPrefix(userId)}base.jpg`
const lookPrefix = (userId: string) => `${userPrefix(userId)}look-`
const usageKey = (userId: string) =>
  `${userPrefix(userId)}usage-${new Date().toISOString().slice(0, 10)}.json`

function dailyLimit(): number {
  const value = Number(process.env.TRYON_DAILY_LIMIT)
  return Number.isFinite(value) && value > 0 ? value : 20
}

const shortHash = (value: string, length: number) =>
  createHash("sha256").update(value).digest("hex").slice(0, length)

/** Stable id of a look: its garments (and their pictures), in any order. */
export function lookHash(garments: Pick<LookGarment, "id" | "imageUrl">[]): string {
  return shortHash(
    garments
      .map((garment) => `${garment.id}:${garment.imageUrl}`)
      .sort()
      .join("|"),
    16
  )
}

/** Short tag of a photo version, stored in the name of the looks made from it. */
export const photoTag = (photoVersion: string) => shortHash(photoVersion, 8)

/**
 * Name used before looks were kept across photo changes: one hash mixing the
 * photo, the garments, the prompt version and the model. Only needed to adopt
 * images generated back then (see `adoptLegacyLook`).
 */
function legacyLookHash(photoVersion: string, garments: Pick<LookGarment, "id" | "imageUrl">[]) {
  const items = garments
    .map((garment) => `${garment.id}:${garment.imageUrl}`)
    .sort()
    .join("|")
  return shortHash([photoVersion, items, PROMPT_VERSION, tryOnModel()].join("\n"), 20)
}

// --- Base photo -------------------------------------------------------------

/**
 * Stores the user's photo, upright (phone photos carry their rotation in
 * EXIF) and downsized. Looks made from the previous photo are kept.
 */
export async function savePhoto(userId: string, upload: Buffer): Promise<void> {
  let normalized: Buffer
  try {
    normalized = await sharp(upload)
      .rotate()
      .resize(PHOTO_MAX_SIDE, PHOTO_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch {
    throw new TryOnError("No se pudo leer la imagen. Usa un JPG o PNG.", 400)
  }
  await putObject(photoKey(userId), normalized, "image/jpeg")
}

export function getPhoto(userId: string) {
  return getObject(photoKey(userId))
}

/**
 * Removes the user's photo. Generated looks are kept: each one is deleted on
 * its own from the gallery.
 */
export async function deletePhoto(userId: string): Promise<void> {
  await deleteObject(photoKey(userId))
}

// --- Daily limit ------------------------------------------------------------
// Every generation is a paid call. Counted in a per-day object rather than by
// listing looks, so regenerating a look (same key, overwritten) still counts.

async function generationsToday(userId: string): Promise<number> {
  const usage = await getObject(usageKey(userId))
  if (!usage) return 0
  try {
    return Number(JSON.parse(usage.bytes.toString()).count) || 0
  } catch {
    return 0
  }
}

async function recordGeneration(userId: string, previous: number): Promise<void> {
  await putObject(
    usageKey(userId),
    Buffer.from(JSON.stringify({ count: previous + 1 })),
    "application/json"
  )
}

// --- Looks ------------------------------------------------------------------

interface StoredLook {
  key: string
  /** Changes every time the image is regenerated. */
  version: string
  lastModified: number
  /** Photo it was made from; null for images in the old naming. */
  photoTag: string | null
}

export interface LookIndex {
  photoVersion: string | null
  /** look hash (or legacy hash) -> stored images, newest first */
  stored: Map<string, StoredLook[]>
}

/**
 * Everything needed to resolve any look of a user: two storage calls in
 * total, however many looks are asked about.
 */
export async function getLookIndex(userId: string): Promise<LookIndex> {
  const prefix = lookPrefix(userId)
  const [photoVersion, objects] = await Promise.all([
    getObjectVersion(photoKey(userId)),
    listObjects(prefix),
  ])
  const stored = new Map<string, StoredLook[]>()
  for (const object of objects) {
    const [hash, tag] = object.key.slice(prefix.length).replace(/\.jpg$/, "").split("-")
    const entry: StoredLook = {
      key: object.key,
      version: object.etag ?? object.lastModified?.toISOString() ?? "unknown",
      lastModified: object.lastModified?.getTime() ?? 0,
      photoTag: tag ?? null,
    }
    stored.set(hash, [...(stored.get(hash) ?? []), entry])
  }
  for (const list of stored.values()) list.sort((a, b) => b.lastModified - a.lastModified)
  return { photoVersion, stored }
}

export interface LookState {
  /** The user currently has a base photo (needed to generate). */
  photo: boolean
  hash: string
  image: {
    key: string
    version: string
    /** Made from the user's current photo. False once the photo changes. */
    current: boolean
  } | null
}

/**
 * Moves an image stored under the old naming to the new one, so it survives
 * the next photo change like any other look. Returns the new entry.
 */
async function adoptLegacyLook(
  userId: string,
  legacy: StoredLook,
  hash: string,
  photoVersion: string
): Promise<StoredLook> {
  const tag = photoTag(photoVersion)
  const key = `${lookPrefix(userId)}${hash}-${tag}.jpg`
  const object = await getObject(legacy.key)
  if (!object) return legacy
  await putObject(key, object.bytes, "image/jpeg")
  await deleteObject(legacy.key)
  return { ...legacy, key, photoTag: tag }
}

/** State of the look made of `garments`, from an index. */
export async function resolveLook(
  userId: string,
  garments: Pick<LookGarment, "id" | "imageUrl">[],
  index: LookIndex
): Promise<LookState> {
  const hash = lookHash(garments)
  const photo = index.photoVersion !== null
  const currentTag = index.photoVersion ? photoTag(index.photoVersion) : null

  let candidates = index.stored.get(hash) ?? []
  if (candidates.length === 0 && index.photoVersion) {
    const legacy = index.stored.get(legacyLookHash(index.photoVersion, garments))?.[0]
    if (legacy) {
      candidates = [await adoptLegacyLook(userId, legacy, hash, index.photoVersion)]
    }
  }

  // The one made from the current photo if there is one, else the newest
  const best =
    candidates.find((look) => look.photoTag === currentTag) ?? candidates[0] ?? null
  return {
    photo,
    hash,
    image: best && {
      key: best.key,
      version: best.version,
      current: currentTag !== null && best.photoTag === currentTag,
    },
  }
}

export async function getLookState(
  userId: string,
  garments: Pick<LookGarment, "id" | "imageUrl">[]
): Promise<LookState> {
  return resolveLook(userId, garments, await getLookIndex(userId))
}

/**
 * URL of a look's image. `v` changes with the look and with each
 * regeneration, so the image can be cached forever under it.
 */
export function lookImageUrl(optionId: string, state: LookState): string | null {
  if (!state.image) return null
  const tag = state.image.version.replace(/[^A-Za-z0-9]/g, "").slice(0, 16)
  return `/api/tryon/looks/${optionId}/image?v=${state.hash}-${tag}`
}

/** What the client needs to know about a look. */
export function describeLook(optionId: string, state: LookState) {
  return {
    photo: state.photo,
    imageUrl: lookImageUrl(optionId, state),
    /** There is an image, but it was not made from the current photo. */
    outdated: state.image !== null && !state.image.current,
  }
}

/** Removes every stored image of a look (current and outdated). */
export async function deleteLookImage(
  userId: string,
  garments: Pick<LookGarment, "id" | "imageUrl">[]
): Promise<void> {
  const index = await getLookIndex(userId)
  const hashes = [lookHash(garments)]
  if (index.photoVersion) hashes.push(legacyLookHash(index.photoVersion, garments))
  const keys = hashes.flatMap((hash) => index.stored.get(hash) ?? []).map((look) => look.key)
  await Promise.all(keys.map((key) => deleteObject(key)))
}

export async function getLookImage(userId: string, state: LookState) {
  return state.image ? getObject(state.image.key) : null
}

async function loadGarmentImage(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith("/api/images/")) {
    const { body } = await getImageObject(imageUrl.replace("/api/images/", ""))
    const chunks: Buffer[] = []
    for await (const chunk of body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }
  if (imageUrl.startsWith("http")) {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`garment image ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  throw new Error(`unsupported garment image url: ${imageUrl}`)
}

/**
 * Generates the image of the user wearing `garments`, or returns the stored
 * one when it is already up to date with the current photo. `regenerate`
 * asks the model for another attempt. Either way the new image replaces any
 * older one of the same look.
 */
export async function generateLook(
  userId: string,
  garments: LookGarment[],
  regenerate = false
): Promise<LookState> {
  if (garments.length === 0) {
    throw new TryOnError("Este look no tiene prendas.", 400)
  }
  const index = await getLookIndex(userId)
  const state = await resolveLook(userId, garments, index)
  if (!index.photoVersion) {
    throw new TryOnError("Primero sube una foto tuya de cuerpo entero.", 409)
  }
  if (state.image?.current && !regenerate) return state

  const used = await generationsToday(userId)
  if (used >= dailyLimit()) {
    throw new TryOnError(
      "Alcanzaste el límite diario de looks generados. Vuelve a intentarlo mañana.",
      429
    )
  }

  const photo = await getPhoto(userId)
  if (!photo) throw new TryOnError("Primero sube una foto tuya de cuerpo entero.", 409)

  const inputs: TryOnGarmentInput[] = await Promise.all(
    garments.slice(0, MAX_GARMENTS).map(async (garment) => ({
      name: garment.name,
      category: garment.category,
      mimeType: "image/jpeg",
      bytes: await sharp(await loadGarmentImage(garment.imageUrl))
        .rotate()
        .flatten({ background: "#ffffff" })
        .resize(GARMENT_MAX_SIDE, GARMENT_MAX_SIDE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 88 })
        .toBuffer(),
    }))
  )

  const { width, height } = await sharp(photo.bytes).metadata()
  const generated = await generateTryOnImage(
    { bytes: photo.bytes, mimeType: "image/jpeg" },
    inputs,
    width && height ? closestAspectRatio(width, height) : undefined
  )
  const jpeg = await sharp(generated.bytes).jpeg({ quality: 92 }).toBuffer()
  const key = `${lookPrefix(userId)}${state.hash}-${photoTag(index.photoVersion)}.jpg`
  await putObject(key, jpeg, "image/jpeg")
  await recordGeneration(userId, used)

  // One image per look: drop the ones this replaces
  const replaced = (index.stored.get(state.hash) ?? []).filter((look) => look.key !== key)
  await Promise.all(replaced.map((look) => deleteObject(look.key)))
  if (state.image && state.image.key !== key && !replaced.some((l) => l.key === state.image?.key)) {
    await deleteObject(state.image.key)
  }
  return getLookState(userId, garments)
}
