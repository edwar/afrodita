import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"

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

export async function uploadImage(
  key: string,
  bytes: Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  const s3 = getS3Client()
  await s3.send(
    new PutObjectCommand({
      Bucket: WARDROBE_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      ContentLength: bytes.length,
    }),
  )
  return `/api/images/${key}`
}

export async function uploadModel(
  key: string,
  bytes: Buffer,
  contentType = "model/gltf-binary",
): Promise<string> {
  const s3 = getS3Client()
  await s3.send(
    new PutObjectCommand({
      Bucket: WARDROBE_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      ContentLength: bytes.length,
    }),
  )
  return `/api/models/${key}`
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

export async function getModelObject(
  key: string,
): Promise<{ body: ReadableStream | NodeJS.ReadableStream; contentType?: string }> {
  const s3 = getS3Client()
  const res = await s3.send(
    new GetObjectCommand({ Bucket: WARDROBE_BUCKET, Key: key }),
  )
  if (!res.Body) throw new Error("Objeto no encontrado en storage")
  return { body: res.Body as ReadableStream, contentType: res.ContentType }
}
