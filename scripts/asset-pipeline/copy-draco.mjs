#!/usr/bin/env node
/**
 * Copies the Draco decoder (needed for gltf-transform draco-compressed GLBs)
 * from three's examples into public/draco so the runtime uses our own origin
 * (no CDN). Idempotent via version marker.
 */
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const src = path.join(root, "node_modules/three/examples/jsm/libs/draco")
const dest = path.join(root, "public/draco")
const marker = path.join(dest, ".marker")

if (!existsSync(src)) {
  console.error(
    `[assets:draco] Source not found: ${src}\nRun "pnpm install" first.`
  )
  process.exit(1)
}

const threePackage = JSON.parse(
  await readFile(path.join(root, "node_modules/three/package.json"), "utf8")
)
const expected = `three@${threePackage.version}`

if (existsSync(marker)) {
  const current = (await readFile(marker, "utf8")).trim()
  if (current === expected && existsSync(path.join(dest, "draco_decoder.js"))) {
    console.log(`[assets:draco] Up to date (${expected}), skipping copy.`)
    process.exit(0)
  }
}

await mkdir(dest, { recursive: true })
await cp(src, dest, { recursive: true })
await writeFile(marker, `${expected}\n`)

const files = (await readdir(dest)).filter((f) => f !== ".marker")
console.log(`[assets:draco] Copied ${files.length} files -> public/draco (${expected})`)
