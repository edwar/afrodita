import * as THREE from "three"
import type { GarmentMeta } from "./types"

export interface MaterialProfile {
  /** Descripción en inglés para prompts de textura Tripo */
  texturePrompt: string
  /** Roughness PBR en cliente (0 = espejo, 1 = mate) */
  roughness: number
  /** Metalness PBR en cliente */
  metalness: number
  /** 0 = muy rígido (cuero/acero), 1 = muy fluido (seda) */
  drape: number
  /** Micro-sway en VTO */
  sway: number
}

const COTTON: MaterialProfile = {
  texturePrompt:
    "soft matte cotton jersey fabric, natural tiny weave grain, subtle fiber detail, non-reflective cloth",
  roughness: 0.92,
  metalness: 0.0,
  drape: 0.75,
  sway: 0.55,
}

const POLY: MaterialProfile = {
  texturePrompt:
    "matte polyester fabric, fine synthetic weave, slightly smoother than cotton, low sheen",
  roughness: 0.85,
  metalness: 0.02,
  drape: 0.7,
  sway: 0.5,
}

const LINEN: MaterialProfile = {
  texturePrompt:
    "natural linen fabric, visible slub texture, matte, breathable cloth folds",
  roughness: 0.9,
  metalness: 0.0,
  drape: 0.72,
  sway: 0.5,
}

const DENIM: MaterialProfile = {
  texturePrompt:
    "denim twill fabric, visible diagonal weave, matte cotton, sturdy cloth",
  roughness: 0.88,
  metalness: 0.0,
  drape: 0.45,
  sway: 0.25,
}

const WOOL: MaterialProfile = {
  texturePrompt:
    "soft wool knit fabric, fuzzy fiber surface, matte, warm textile",
  roughness: 0.94,
  metalness: 0.0,
  drape: 0.55,
  sway: 0.3,
}

const LEATHER: MaterialProfile = {
  texturePrompt:
    "smooth leather material, subtle grain, soft specular highlights, not plastic",
  roughness: 0.48,
  metalness: 0.08,
  drape: 0.2,
  sway: 0.08,
}

const SILK: MaterialProfile = {
  texturePrompt:
    "silk satin fabric, elegant soft sheen, fluid drape, luxurious textile not plastic",
  roughness: 0.35,
  metalness: 0.05,
  drape: 0.95,
  sway: 0.85,
}

const SATIN: MaterialProfile = {
  texturePrompt: "satin fabric, gentle reflective sheen, smooth cloth surface",
  roughness: 0.4,
  metalness: 0.04,
  drape: 0.85,
  sway: 0.7,
}

const METAL: MaterialProfile = {
  texturePrompt:
    "brushed metal hardware, anisotropic highlights, cold metallic surface",
  roughness: 0.35,
  metalness: 0.85,
  drape: 0.05,
  sway: 0.0,
}

const RUBBER: MaterialProfile = {
  texturePrompt: "matte rubber or silicone surface, soft touch, non-glossy",
  roughness: 0.7,
  metalness: 0.0,
  drape: 0.15,
  sway: 0.05,
}

const DEFAULT: MaterialProfile = {
  texturePrompt:
    "realistic fabric material matching the garment photo, natural cloth surface",
  roughness: 0.8,
  metalness: 0.02,
  drape: 0.6,
  sway: 0.4,
}

function normalize(value?: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
}

export function getMaterialProfile(material?: string): MaterialProfile {
  const m = normalize(material)
  if (!m) return DEFAULT
  if (/algodon|cotton|jersey/.test(m)) return COTTON
  if (/poliester|polyester|sintetic|acrilic|nylon|ripstop|softshell/.test(m))
    return POLY
  if (/lino|linen/.test(m)) return LINEN
  if (/denim|vaquero|jean/.test(m)) return DENIM
  if (/lana|wool|fleece|polar|knit/.test(m)) return WOOL
  if (/cuero|leather|piel/.test(m)) return LEATHER
  if (/seda|silk/.test(m)) return SILK
  if (/satin|saten/.test(m)) return SATIN
  if (/metal|acero|steel|laton|aluminio|oro|plata/.test(m)) return METAL
  if (/caucho|rubber|silicone|neopreno/.test(m)) return RUBBER
  return DEFAULT
}

export function buildTexturePrompt(meta?: GarmentMeta): string {
  const profile = getMaterialProfile(meta?.material)
  const color = meta?.color ? `${meta.color} color` : ""
  const category = meta?.category ? `${meta.category} garment` : "garment"
  const brand = meta?.brand ? `brand: ${meta.brand}` : ""
  const parts = [
    `Photorealistic ${category} texture.`,
    color ? `Primary color: ${color}.` : "",
    profile.texturePrompt,
    "Natural micro-folds and fabric tension, no plastic look, no rubber sheen.",
    brand,
  ].filter(Boolean)
  return parts.join(" ")
}

export function applyMaterialToScene(
  root: THREE.Object3D,
  material?: string,
): void {
  const profile = getMaterialProfile(material)
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    for (const mat of materials) {
      const m = mat as THREE.MeshStandardMaterial
      if (!m || !("roughness" in m)) continue
      if (m.roughness < 0.55) {
        m.roughness = Math.min(
          1,
          m.roughness + (profile.roughness - 0.4) * 0.35,
        )
      }
      if (m.metalness > 0.4 && profile.metalness < 0.3) {
        m.metalness = profile.metalness
      }
      m.envMapIntensity = profile.metalness > 0.5 ? 1.2 : 0.7
      m.needsUpdate = true
    }
  })
}
