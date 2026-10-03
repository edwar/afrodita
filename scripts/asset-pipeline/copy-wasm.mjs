#!/usr/bin/env node
/**
 * Copies the MediaPipe vision WASM runtime from node_modules into public/wasm
 * so the pose worker loads it from our own origin (no CDN, faster cold start,
 * zero third-party egress at runtime).
 *
 * Idempotent: skips when the marker file matches the installed package version.
 */
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const src = path.join(root, "node_modules/@mediapipe/tasks-vision/wasm")
const dest = path.join(root, "public/wasm")
const marker = path.join(dest, ".marker")

if (!existsSync(src)) {
  console.error(
    `[assets:wasm] Source not found: ${src}\nRun "pnpm install" first.`
  )
  process.exit(1)
}

const packageJson = JSON.parse(
  await readFile(
    path.join(root, "node_modules/@mediapipe/tasks-vision/package.json"),
    "utf8"
  )
)
const expected = `@mediapipe/tasks-vision@${packageJson.version}`

if (existsSync(marker)) {
  const current = (await readFile(marker, "utf8")).trim()
  if (current === expected && existsSync(path.join(dest, "vision_wasm_internal.wasm"))) {
    console.log(`[assets:wasm] Up to date (${expected}), skipping copy.`)
    process.exit(0)
  }
}

await mkdir(dest, { recursive: true })
await cp(src, dest, { recursive: true })
await writeFile(marker, `${expected}\n`)

const files = (await readdir(dest)).filter((f) => f !== ".marker")
let total = 0
for (const file of files) {
  total += (await stat(path.join(dest, file))).size
}

console.log(
  `[assets:wasm] Copied ${files.length} files (${(total / 1024 / 1024).toFixed(1)} MB) -> public/wasm (${expected})`
)
