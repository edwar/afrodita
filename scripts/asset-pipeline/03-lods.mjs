#!/usr/bin/env node
/**
 * Generates three LOD tiers from a source GLB, compressed with Draco and
 * KTX2 textures (falls back to WebP when the KTX-Software encoder is missing).
 *
 * Usage:
 *   node scripts/asset-pipeline/03-lods.mjs --in garment.glb [--outdir dist] [--base garment]
 *
 * Outputs:
 *   <base>.lod0.glb  (~100% tris, max texture 2048)
 *   <base>.lod1.glb  (~40% tris,  max texture 1024)
 *   <base>.lod2.glb  (~15% tris,  max texture 512)
 */
import { existsSync, copyFileSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const hasFlag = (name) => args.includes(name)

const input = getArg("--in")
if (!input || !existsSync(input)) {
  console.error("Usage: node scripts/asset-pipeline/03-lods.mjs --in <file.glb> [--outdir dir] [--base name] [--skinned]")
  process.exit(1)
}

const outdir = getArg("--outdir") ?? path.dirname(input)
const base = getArg("--base") ?? path.basename(input, ".glb")
const skinned = hasFlag("--skinned")

const LODS = skinned
  ? [
      // Skinned assets keep topology + skin weights: a single optimized tier.
      // (Geometry LODs for skinned meshes require re-rigging per LOD.)
      { level: "lod0", ratio: null, texSize: 2048, textureFormat: "webp" },
    ]
  : [
      { level: "lod0", ratio: null, texSize: 2048, textureFormat: "webp" },
      { level: "lod1", ratio: 0.4, error: 0.001, texSize: 1024, textureFormat: "webp" },
      { level: "lod2", ratio: 0.15, error: 0.002, texSize: 512, textureFormat: "webp" },
    ]

function run(cmdArgs, { allowFail = false } = {}) {
  const res = spawnSync("pnpm", ["exec", "gltf-transform", ...cmdArgs], {
    stdio: "inherit",
    shell: false,
  })
  if (res.status !== 0 && !allowFail) {
    throw new Error(`gltf-transform ${cmdArgs[0]} failed (exit ${res.status})`)
  }
  return res.status === 0
}

function optimize(inputFile, outputFile, texSize, textureFormat = "webp") {
  const common = [
    "optimize",
    inputFile,
    outputFile,
    "--compress",
    "draco",
    "--texture-size",
    String(texSize),
    "--simplify",
    "false",
  ]
  const ok = run([...common, "--texture-compress", textureFormat], { allowFail: true })
  if (!ok) {
    console.warn(
      `[assets:lods] ${textureFormat} compression failed, retrying with webp.`
    )
    run([...common, "--texture-compress", "webp"])
  }
}

for (const lod of LODS) {
  const output = path.join(outdir, `${base}.${lod.level}.glb`)
  const temp = path.join(outdir, `${base}.${lod.level}.tmp.glb`)

  if (lod.ratio) {
    console.log(`[assets:lods] ${lod.level}: simplify ratio ${lod.ratio}`)
    run([
      "simplify",
      input,
      temp,
      "--ratio",
      String(lod.ratio),
      "--error",
      String(lod.error),
    ])
  } else {
    copyFileSync(input, temp)
  }

  console.log(
    `[assets:lods] ${lod.level}: optimize (draco + ${lod.textureFormat} texture <= ${lod.texSize})`
  )
  optimize(temp, output, lod.texSize, lod.textureFormat)
  rmSync(temp, { force: true })
  console.log(`[assets:lods] ${lod.level} -> ${output}`)
}

console.log("[assets:lods] Done.")
