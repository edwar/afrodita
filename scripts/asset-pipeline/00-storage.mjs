#!/usr/bin/env node
/**
 * Storage helper for the asset pipeline (S3-compatible bucket, same as the app).
 *
 * Usage:
 *   node --env-file=.env.local scripts/asset-pipeline/00-storage.mjs fetch <key> <localPath>
 *   node --env-file=.env.local scripts/asset-pipeline/00-storage.mjs upload <localPath> <key> [contentType]
 *
 * Examples:
 *   ... 00-storage.mjs fetch cmus0ezql000518rhpu2e8k9d.glb work/raw.glb
 *   ... 00-storage.mjs upload work/rigged.glb cmus0ezql000518rhpu2e8k9d.rigged.glb
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import { createWriteStream, readFileSync, statSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { pipeline } from "node:stream/promises"
import path from "node:path"

const [command, ...args] = process.argv.slice(2)

if (!command || args.length < 2) {
  console.error(
    "Usage:\n  fetch <key> <localPath>\n  upload <localPath> <key> [contentType]"
  )
  process.exit(1)
}

const endpoint = process.env.AWS_ENDPOINT_URL_S3
if (!endpoint) {
  console.error(
    "Faltan credenciales AWS. Ejecuta con: node --env-file=.env.local <script>"
  )
  process.exit(1)
}

const bucket = "wardrobe-images"
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
})

function contentTypeFor(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith(".glb")) return "model/gltf-binary"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  return "application/octet-stream"
}

if (command === "fetch") {
  const [key, localPath] = args
  await mkdir(path.dirname(path.resolve(localPath)), { recursive: true })
  const res = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  )
  if (!res.Body) throw new Error(`No se encontró el objeto: ${key}`)
  await pipeline(res.Body, createWriteStream(localPath))
  console.log(
    `[storage] fetched s3://${bucket}/${key} -> ${localPath} (${statSync(localPath).size} bytes)`
  )
} else if (command === "upload") {
  const [localPath, key, contentTypeArg] = args
  const body = readFileSync(localPath)
  const contentType = contentTypeArg ?? contentTypeFor(localPath)
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
    })
  )
  console.log(
    `[storage] uploaded ${localPath} (${body.length} bytes) -> s3://${bucket}/${key} [${contentType}]`
  )
} else {
  console.error(`Comando desconocido: ${command}`)
  process.exit(1)
}
