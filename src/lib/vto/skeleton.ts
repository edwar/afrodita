/**
 * Runtime skeleton contract. Single source of truth shared with the Blender
 * rigging script (scripts/asset-pipeline/02-rig.py reads the same JSON).
 *
 * Joints are derived from MediaPipe pose landmarks (33 points) and resolved
 * into named joint positions. The resolver is preallocated and mutation-based
 * so it performs zero allocations per frame.
 */
import template from "./skeleton-template.json"
import { POSE_STRIDE, type Vec3 } from "./types"

export interface BoneDef {
  name: string
  parent: string | null
  from: string
  to: string
}

export const SKELETON_VERSION: string = template.version

export const BONE_DEFS: BoneDef[] = template.bones.map((b) => ({
  name: b.name,
  parent: b.parent,
  from: b.from,
  to: b.to,
}))

type Ref = number | string

type JointOp =
  | { kind: "landmark"; i: number }
  | { kind: "mid"; a: string; b: string }
  | { kind: "lerp"; a: string; b: string; t: number }
  | { kind: "extrapolate"; a: string; b: string; t: number }

const RAW_JOINTS = template.joints as Record<
  string,
  | { op: "point"; i: number }
  | { op: "mid"; a: Ref; b: Ref }
  | { op: "lerp"; a: string; b: string; t: number }
  | { op: "extrapolate"; a: string; b: string; t: number }
>

/** Bone whose `from` joint equals this bone's `to` joint (the natural child chain). */
export const CHAIN_CHILD: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>()
  for (const bone of BONE_DEFS) {
    const child = BONE_DEFS.find((c) => c.parent === bone.name && c.from === bone.to)
    if (child) map.set(bone.name, child.name)
  }
  return map
})()

/**
 * Topologically ordered, zero-allocation joint resolver.
 *
 * Usage:
 *   const resolver = new JointResolver()
 *   const joints = JointResolver.createOutput()
 *   resolver.resolve(worldLandmarks, joints) // mutates `joints` in place
 */
export class JointResolver {
  readonly order: string[] = []
  private readonly ops: JointOp[] = []
  private readonly indexByName = new Map<string, number>()

  constructor() {
    const deps = new Map<string, Set<string>>()
    const ops = new Map<string, JointOp>()

    const registerLandmark = (i: number): string => {
      const key = `@lm${i}`
      if (!ops.has(key)) {
        ops.set(key, { kind: "landmark", i })
        deps.set(key, new Set())
      }
      return key
    }
    const asName = (ref: Ref): string =>
      typeof ref === "number" ? registerLandmark(ref) : ref

    for (const [name, def] of Object.entries(RAW_JOINTS)) {
      switch (def.op) {
        case "point": {
          const lmName = registerLandmark(def.i)
          ops.set(name, { kind: "lerp", a: lmName, b: lmName, t: 1 })
          deps.set(name, new Set([lmName]))
          break
        }
        case "mid": {
          const a = asName(def.a)
          const b = asName(def.b)
          ops.set(name, { kind: "mid", a, b })
          deps.set(name, new Set([a, b]))
          break
        }
        case "lerp":
        case "extrapolate": {
          const a = asName(def.a)
          const b = asName(def.b)
          ops.set(name, { kind: def.op, a, b, t: def.t })
          deps.set(name, new Set([a, b]))
          break
        }
      }
    }

    // Kahn topological sort (deterministic order for stable output)
    const indegree = new Map<string, number>()
    const dependents = new Map<string, string[]>()
    for (const [name, set] of deps) {
      indegree.set(name, set.size)
      for (const dep of set) {
        const list = dependents.get(dep) ?? []
        list.push(name)
        dependents.set(dep, list)
      }
    }

    const queue: string[] = []
    for (const [name, degree] of indegree) {
      if (degree === 0) queue.push(name)
    }

    while (queue.length > 0) {
      const name = queue.shift()!
      this.order.push(name)
      this.ops.push(ops.get(name)!)
      for (const dependent of dependents.get(name) ?? []) {
        const next = (indegree.get(dependent) ?? 1) - 1
        indegree.set(dependent, next)
        if (next === 0) queue.push(dependent)
      }
    }

    if (this.order.length !== ops.size) {
      throw new Error("skeleton-template.json contains cyclic joint definitions")
    }

    this.order.forEach((name, index) => this.indexByName.set(name, index))
  }

  /** Preallocates the output map (one Vec3 per joint, including synthetic landmarks). */
  static createOutput(): Map<string, Vec3> {
    const out = new Map<string, Vec3>()
    for (const key of Object.keys(RAW_JOINTS)) {
      out.set(key, { x: 0, y: 0, z: 0 })
    }
    for (let i = 0; i < 33; i++) out.set(`@lm${i}`, { x: 0, y: 0, z: 0 })
    return out
  }

  /**
   * Resolves all joints in place. `src` is a pose buffer (stride 4).
   * When `visibility` is provided (length = order.length) it is filled with
   * per-joint visibility (landmark visibility; min of sources for derived joints).
   */
  resolve(
    src: Float32Array,
    out: Map<string, Vec3>,
    visibility?: Float32Array
  ): Map<string, Vec3> {
    const vis = (name: string): number => {
      if (!visibility) return 1
      const index = this.indexByName.get(name)
      return index === undefined ? 1 : visibility[index]
    }

    for (let k = 0; k < this.ops.length; k++) {
      const op = this.ops[k]
      const target = out.get(this.order[k])!
      switch (op.kind) {
        case "landmark": {
          const o = op.i * POSE_STRIDE
          target.x = src[o]
          target.y = src[o + 1]
          target.z = src[o + 2]
          if (visibility) visibility[k] = src[o + 3]
          break
        }
        case "mid": {
          const a = out.get(op.a)!
          const b = out.get(op.b)!
          target.x = (a.x + b.x) * 0.5
          target.y = (a.y + b.y) * 0.5
          target.z = (a.z + b.z) * 0.5
          if (visibility) visibility[k] = Math.min(vis(op.a), vis(op.b))
          break
        }
        case "lerp": {
          const a = out.get(op.a)!
          const b = out.get(op.b)!
          target.x = a.x + (b.x - a.x) * op.t
          target.y = a.y + (b.y - a.y) * op.t
          target.z = a.z + (b.z - a.z) * op.t
          if (visibility) visibility[k] = Math.min(vis(op.a), vis(op.b))
          break
        }
        case "extrapolate": {
          const a = out.get(op.a)!
          const b = out.get(op.b)!
          target.x = a.x + (b.x - a.x) * op.t
          target.y = a.y + (b.y - a.y) * op.t
          target.z = a.z + (b.z - a.z) * op.t
          if (visibility) visibility[k] = Math.min(vis(op.a), vis(op.b))
          break
        }
      }
    }
    return out
  }
}
