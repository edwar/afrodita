#!/usr/bin/env node
/**
 * Validates GLB assets against the VTO performance budgets.
 * Dependency-free: parses the GLB container and JSON chunk directly, including
 * KTX2/WebP/PNG/JPEG header inspection for texture dimensions.
 *
 * Usage:
 *   node scripts/asset-pipeline/04-validate.mjs <file.glb> [more.glb ...]
 *     [--level lod0|lod1|lod2]   (default: auto-detect from filename, else lod0)
 *     [--require-skin]           (fails when the asset has no skeleton)
 *
 * Exits with code 1 when any file violates its budget.
 */
import { readFileSync, statSync } from "node:fs"
import path from "node:path"

const BUDGETS = {
  lod0: { maxTris: 12000, maxTex: 2048, maxMaterials: 2, maxBytes: 2.5 * 1024 * 1024 },
  lod1: { maxTris: 5000, maxTex: 1024, maxMaterials: 2, maxBytes: 1.5 * 1024 * 1024 },
  lod2: { maxTris: 2000, maxTex: 512, maxMaterials: 2, maxBytes: 1.0 * 1024 * 1024 },
}

const args = process.argv.slice(2)
const getArg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const explicitLevel = getArg("--level")
const requireSkin = args.includes("--require-skin")

// Files = positional args minus options and their values
const OPTION_NAMES = new Set(["--level"])
const files = []
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg.startsWith("--")) {
    if (OPTION_NAMES.has(arg)) i++ // skip option value
    continue
  }
  files.push(arg)
}

if (files.length === 0) {
  console.error("Usage: node scripts/asset-pipeline/04-validate.mjs <file.glb> [--level lod0] [--require-skin]")
  process.exit(1)
}

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error("not a GLB file")
  const jsonLen = buf.readUInt32LE(12)
  if (buf.readUInt32LE(16) !== CHUNK_JSON) throw new Error("first chunk is not JSON")
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"))

  let bin = null
  const binHeader = 20 + jsonLen
  if (binHeader + 8 <= buf.length && buf.readUInt32LE(binHeader + 4) === CHUNK_BIN) {
    const binLen = buf.readUInt32LE(binHeader)
    bin = buf.subarray(binHeader + 8, binHeader + 8 + binLen)
  }
  return { json, bin }
}

function countTriangles(json) {
  let tris = 0
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const mode = prim.mode ?? 4
      if (mode !== 4) continue
      const accessorIndex = prim.indices ?? prim.attributes?.POSITION
      const accessor = accessorIndex != null ? json.accessors?.[accessorIndex] : null
      if (accessor) tris += Math.floor(accessor.count / 3)
    }
  }
  return tris
}

function readU32LE(b, o) { return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24) >>> 0 }
function readU32BE(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0 }
function readU16BE(b, o) { return (b[o] << 8) | b[o + 1] }

function imageDimensions(bytes) {
  if (!bytes || bytes.length < 30) return null
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return [readU32BE(bytes, 16), readU32BE(bytes, 20)]
  }
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2
    while (o + 9 < bytes.length) {
      if (bytes[o] !== 0xff) { o++; continue }
      const marker = bytes[o + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return [readU16BE(bytes, o + 7), readU16BE(bytes, o + 5)]
      }
      const len = readU16BE(bytes, o + 2)
      o += 2 + len
    }
    return null
  }
  // KTX2
  if (bytes[0] === 0xab && bytes[1] === 0x4b && bytes[4] === 0x20 && bytes[5] === 0x32) {
    return [readU32LE(bytes, 20), readU32LE(bytes, 24)]
  }
  // WebP: VP8X (extended), VP8 (lossy) or VP8L (lossless)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    const tag = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
    if (tag === "VP8X") {
      const w = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)
      const h = bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)
      return [w + 1, h + 1]
    }
    if (tag === "VP8 ") {
      const w = (bytes[26] | (bytes[27] << 8)) & 0x3fff
      const h = (bytes[28] | (bytes[29] << 8)) & 0x3fff
      return [w, h]
    }
    if (tag === "VP8L") {
      const b1 = bytes[21]
      const b2 = bytes[22]
      const b3 = bytes[23]
      const b4 = bytes[24]
      const w = 1 + (((b2 & 0x3f) << 8) | b1)
      const h = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
      return [w, h]
    }
    return null
  }
  return null
}

function maxTextureDimension(json, bin) {
  let max = 0
  let unknown = 0
  for (const image of json.images ?? []) {
    if (image.bufferView == null || !bin) { unknown++; continue }
    const view = json.bufferViews[image.bufferView]
    if (!view) { unknown++; continue }
    const start = view.byteOffset ?? 0
    const bytes = bin.subarray(start, start + view.byteLength)
    const dims = imageDimensions(bytes)
    if (dims) max = Math.max(max, dims[0], dims[1])
    else unknown++
  }
  return { max, unknown }
}

function formatBytes(n) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`
}

let failed = false

for (const file of files) {
  const level =
    explicitLevel ??
    (file.includes(".lod2.") ? "lod2" : file.includes(".lod1.") ? "lod1" : "lod0")
  const budget = BUDGETS[level]

  const buf = readFileSync(file)
  const { json, bin } = parseGlb(buf)
  const bytes = statSync(file).size
  const tris = countTriangles(json)
  const materials = json.materials?.length ?? 0
  const { max: maxTex, unknown: unknownTex } = maxTextureDimension(json, bin)
  const joints = (json.skins ?? []).reduce((acc, s) => acc + (s.joints?.length ?? 0), 0)

  const checks = [
    { label: "triangles", value: tris, max: budget.maxTris, ok: tris <= budget.maxTris },
    { label: "texture max", value: maxTex || "n/a", max: budget.maxTex, ok: maxTex <= budget.maxTex },
    { label: "materials", value: materials, max: budget.maxMaterials, ok: materials <= budget.maxMaterials },
    { label: "size", value: formatBytes(bytes), max: formatBytes(budget.maxBytes), ok: bytes <= budget.maxBytes },
  ]
  if (requireSkin) {
    checks.push({ label: "skin joints", value: joints, max: ">= 1", ok: joints > 0 })
  }

  const ok = checks.every((c) => c.ok)
  if (!ok) failed = true

  console.log(`\n${ok ? "PASS" : "FAIL"}  ${path.basename(file)}  [${level}]`)
  for (const c of checks) {
    console.log(
      `  ${c.ok ? "ok  " : "FAIL"} ${c.label.padEnd(12)} ${String(c.value).padEnd(10)} (max ${c.max})`
    )
  }
  if (unknownTex > 0) {
    console.log(`  warn unknown texture dimensions for ${unknownTex} image(s)`)
  }
  if (json.extensionsUsed?.length) {
    console.log(`  ext  ${json.extensionsUsed.join(", ")}`)
  }
}

process.exit(failed ? 1 : 0)
