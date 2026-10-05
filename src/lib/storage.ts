import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

export const WARDROBE_BUCKET = "wardrobe-images"

function getS3Client(): S3Client {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3
  if (!endpoint) throw new Error("AWS_ENDPOINT_URL_S3 no está configurado")
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-2",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  })
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return (
    e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404
  )
}

export async function uploadImage(
  key: string,
  bytes: Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  await putObject(key, bytes, contentType)
  return `/api/images/${key}`
}

export async function getImageObject(
  key: string,
): Promise<{ body: ReadableStream | NodeJS.ReadableStream; contentType?: string }> {
  const s3 = getS3Client()
  const res = await s3.send(
    new GetObjectCommand({ Bucket: WARDROBE_BUCKET, Key: key }),
  )
  if (!res.Body) throw new Error("Imagen no encontrada en storage")
  return { body: res.Body as ReadableStream, contentType: res.ContentType }
}

// --- Generic object helpers -------------------------------------------------
// Used for private objects (try-on photos and generated looks). Their keys
// contain "/", which /api/images/[key] rejects, so they are only reachable
// through routes that check the session.

export interface StoredObject {
  bytes: Buffer
  contentType?: string
}

export async function putObject(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: WARDROBE_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      ContentLength: bytes.length,
    }),
  )
}

export async function getObject(key: string): Promise<StoredObject | null> {
  try {
    const res = await getS3Client().send(
      new GetObjectCommand({ Bucket: WARDROBE_BUCKET, Key: key }),
    )
    if (!res.Body) return null
    return {
      bytes: Buffer.from(await res.Body.transformToByteArray()),
      contentType: res.ContentType,
    }
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** Version tag of an object (changes whenever it is overwritten), or null. */
export async function getObjectVersion(key: string): Promise<string | null> {
  try {
    const res = await getS3Client().send(
      new HeadObjectCommand({ Bucket: WARDROBE_BUCKET, Key: key }),
    )
    return res.ETag ?? res.LastModified?.toISOString() ?? "unknown"
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

export interface ListedObject {
  key: string
  lastModified?: Date
  etag?: string
}

export async function listObjects(prefix: string): Promise<ListedObject[]> {
  const s3 = getS3Client()
  const found: ListedObject[] = []
  let token: string | undefined
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: WARDROBE_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    )
    for (const item of res.Contents ?? []) {
      if (item.Key) {
        found.push({ key: item.Key, lastModified: item.LastModified, etag: item.ETag })
      }
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return found
}

export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: WARDROBE_BUCKET, Key: key }),
  )
}

/** Deletes every object under a prefix. Returns how many were removed. */
export async function deleteObjects(prefix: string): Promise<number> {
  const objects = await listObjects(prefix)
  await Promise.all(objects.map(({ key }) => deleteObject(key)))
  return objects.length
}
