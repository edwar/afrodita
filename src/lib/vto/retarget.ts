/**
 * Bone retargeting: drives a humanoid skeleton (19 bones) from calibrated
 * MediaPipe joint positions.
 *
 * All math happens in the skeleton ROOT space (the garment container), so the
 * garment can be moved/scaled in the scene without invalidating bind data.
 *
 * Per bone:
 *   qLocal = qParentRoot⁻¹ · qDelta · qRootRest
 *   qDelta = setFromUnitVectors(restDirRoot, targetDir)
 *
 * Where restDirRoot is the bind direction of the bone (child position minus
 * own position) and targetDir comes from the observed joints. This produces
 * the minimal (twist-free) rotation that aligns the bone with the body.
 */
import * as THREE from "three"
import { BONE_DEFS, CHAIN_CHILD, type BoneDef } from "./skeleton"
import type { Vec3 } from "./types"

export interface BoneRestInfo {
  def: BoneDef
  qRootRest: THREE.Quaternion
  restDirRoot: THREE.Vector3
  restLength: number
}

export interface SkeletonRestPose {
  /** Parents always before children. */
  order: BoneDef[]
  info: Map<string, BoneRestInfo>
}

function topologicalOrder(defs: BoneDef[]): BoneDef[] {
  const byName = new Map(defs.map((d) => [d.name, d]))
  const done = new Set<string>()
  const result: BoneDef[] = []

  const visit = (def: BoneDef, guard: Set<string>) => {
    if (done.has(def.name)) return
    if (guard.has(def.name)) throw new Error(`cyclic bone hierarchy at ${def.name}`)
    guard.add(def.name)
    if (def.parent) {
      const parent = byName.get(def.parent)
      if (parent) visit(parent, guard)
    }
    guard.delete(def.name)
    done.add(def.name)
    result.push(def)
  }

  for (const def of defs) visit(def, new Set())
  return result
}

/**
 * Builds a name -> Bone index that survives three.js name sanitization.
 * GLTFLoader strips reserved characters from node names (e.g. `shoulder.L`
 * becomes `shoulderL`) but keeps the original in `userData.name`.
 */
export function buildBoneIndex(root: THREE.Object3D): Map<string, THREE.Bone> {
  const index = new Map<string, THREE.Bone>()
  root.traverse((obj) => {
    const bone = obj as THREE.Bone
    if (!bone.isBone) return
    const originalName =
      typeof bone.userData?.name === "string" ? bone.userData.name : null
    if (originalName && !index.has(originalName)) {
      index.set(originalName, bone)
    }
    if (!index.has(bone.name)) {
      index.set(bone.name, bone)
    }
  })
  return index
}

/**
 * Captures the bind pose from a loaded skeleton. The bones must be in their
 * rest pose (as exported) and `bonesByName` must contain every template bone.
 */
export function captureRestPose(
  bonesByName: Map<string, THREE.Bone>
): SkeletonRestPose {
  const order = topologicalOrder(BONE_DEFS)
  const info = new Map<string, BoneRestInfo>()

  const qRootRest = new Map<string, THREE.Quaternion>()
  const posRoot = new Map<string, THREE.Vector3>()

  const missing: string[] = []

  for (const def of order) {
    const bone = bonesByName.get(def.name)
    if (!bone) {
      missing.push(def.name)
      continue
    }
    const parentQ = def.parent ? qRootRest.get(def.parent) ?? new THREE.Quaternion() : new THREE.Quaternion()
    const parentPos = def.parent
      ? posRoot.get(def.parent) ?? new THREE.Vector3()
      : new THREE.Vector3()

    const q = parentQ.clone().multiply(bone.quaternion)
    const pos = parentPos.clone().add(bone.position.clone().applyQuaternion(parentQ))

    qRootRest.set(def.name, q)
    posRoot.set(def.name, pos)
  }

  if (missing.length > 0) {
    const found = Array.from(bonesByName.keys()).slice(0, 24).join(", ")
    throw new Error(
      `Skeleton is missing template bones: ${missing.join(", ")}. ` +
        `Found: [${found}]. Expected skeleton version compatibility with ${BONE_DEFS.length} bones.`
    )
  }

  for (const def of order) {
    const childName = CHAIN_CHILD.get(def.name)
    const q = qRootRest.get(def.name)!
    let dir: THREE.Vector3
    let length = 0

    if (childName) {
      const childPos = posRoot.get(childName)!
      const ownPos = posRoot.get(def.name)!
      dir = childPos.clone().sub(ownPos)
      length = dir.length()
      if (length < 1e-6) {
        dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
        length = 0
      } else {
        dir.normalize()
      }
    } else {
      // Leaf bone: Blender exports bone direction along local +Y.
      dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
    }

    info.set(def.name, {
      def,
      qRootRest: q,
      restDirRoot: dir,
      restLength: length,
    })
  }

  return { order, info }
}

export interface RetargetScratch {
  rootSpaceQuats: Map<string, THREE.Quaternion>
  jointPositions: Map<string, THREE.Vector3>
  dir: THREE.Vector3
  qDelta: THREE.Quaternion
  qParent: THREE.Quaternion
  qTargetLocal: THREE.Quaternion
  v: THREE.Vector3
}

export function createRetargetScratch(rest: SkeletonRestPose): RetargetScratch {
  const rootSpaceQuats = new Map<string, THREE.Quaternion>()
  const jointPositions = new Map<string, THREE.Vector3>()

  for (const def of rest.order) {
    rootSpaceQuats.set(def.name, new THREE.Quaternion())
    if (!jointPositions.has(def.from)) jointPositions.set(def.from, new THREE.Vector3())
    if (!jointPositions.has(def.to)) jointPositions.set(def.to, new THREE.Vector3())
    // Some joints are referenced by another bone as well (e.g. shared roots)
    for (const info of [rest.info.get(def.name)]) {
      if (info) {
        if (!jointPositions.has(info.def.from)) {
          jointPositions.set(info.def.from, new THREE.Vector3())
        }
        if (!jointPositions.has(info.def.to)) {
          jointPositions.set(info.def.to, new THREE.Vector3())
        }
      }
    }
  }

  return {
    rootSpaceQuats,
    jointPositions,
    dir: new THREE.Vector3(),
    qDelta: new THREE.Quaternion(),
    qParent: new THREE.Quaternion(),
    qTargetLocal: new THREE.Quaternion(),
    v: new THREE.Vector3(),
  }
}

export interface RetargetOptions {
  /**
   * Move the root bone to the observed hip position so the garment follows
   * the user horizontally/vertically. Default true.
   */
  followRoot?: boolean
  /**
   * When true, canonical joint positions are treated as already expressed in
   * the skeleton root space (skip `rootObject.worldToLocal`). Used when the
   * garment container is placed by a separate screen-space rig.
   */
  jointsInRootSpace?: boolean
  /**
   * Per-frame slerp factor toward the target local quaternion (1 = snap).
   * Values < 1 damp noisy pose data at the cost of slightly slower response.
   */
  smoothing?: number
  /**
   * Ignore the depth (Z) component of target directions. MediaPipe world Z is
   * noisy; planar directions keep on-screen alignment stable.
   */
  planar?: boolean
  /**
   * Gate bones by landmark visibility: when false for a bone's from/to
   * joints, the bone keeps its previous rotation (prevents wild flips when a
   * limb leaves the frame).
   */
  isJointVisible?: (jointName: string) => boolean
}

export function retargetSkeleton(
  bones: Map<string, THREE.Bone>,
  rest: SkeletonRestPose,
  canonicalJoints: Map<string, Vec3>,
  rootObject: THREE.Object3D,
  scratch: RetargetScratch,
  options: RetargetOptions = {}
): void {
  const followRoot = options.followRoot ?? true
  const jointsInRootSpace = options.jointsInRootSpace ?? false
  const smoothing = THREE.MathUtils.clamp(options.smoothing ?? 1, 0.05, 1)
  const planar = options.planar ?? false
  const isJointVisible = options.isJointVisible

  if (!jointsInRootSpace) {
    rootObject.updateWorldMatrix(true, false)
  }

  // 1) Canonical world joints -> skeleton root local space (once per joint)
  for (const [jointName, joint] of canonicalJoints) {
    const target = scratch.jointPositions.get(jointName)
    if (!target) continue
    if (jointsInRootSpace) {
      target.set(joint.x, joint.y, joint.z)
    } else {
      scratch.v.set(joint.x, joint.y, joint.z)
      rootObject.worldToLocal(scratch.v)
      target.copy(scratch.v)
    }
  }

  // 2) Hierarchical rotation, parents before children
  for (const def of rest.order) {
    const bone = bones.get(def.name)
    const boneInfo = rest.info.get(def.name)
    if (!bone || !boneInfo) continue

    const from = scratch.jointPositions.get(def.from)
    const to = scratch.jointPositions.get(def.to)
    if (!from || !to) continue

    if (isJointVisible && (!isJointVisible(def.from) || !isJointVisible(def.to))) {
      // Limb out of frame: keep the previous rotation for this bone
      continue
    }

    scratch.dir.subVectors(to, from)
    if (planar) {
      scratch.dir.z = 0
    }
    if (scratch.dir.lengthSq() < 1e-10) continue
    scratch.dir.normalize()

    scratch.qDelta.setFromUnitVectors(boneInfo.restDirRoot, scratch.dir)

    if (def.parent) {
      const parentRoot = scratch.rootSpaceQuats.get(def.parent)
      if (!parentRoot) continue
      scratch.qParent.copy(parentRoot)

      const targetLocal = scratch.qTargetLocal
        .copy(scratch.qParent)
        .invert()
        .multiply(scratch.qDelta)
        .multiply(boneInfo.qRootRest)

      if (smoothing >= 1) {
        bone.quaternion.copy(targetLocal)
      } else {
        bone.quaternion.slerp(targetLocal, smoothing)
      }

      const rootQuat = scratch.rootSpaceQuats.get(def.name)!
      rootQuat.copy(scratch.qParent).multiply(bone.quaternion)
    } else {
      if (followRoot) bone.position.copy(from)

      const targetLocal = scratch.qTargetLocal
        .copy(scratch.qDelta)
        .multiply(boneInfo.qRootRest)

      if (smoothing >= 1) {
        bone.quaternion.copy(targetLocal)
      } else {
        bone.quaternion.slerp(targetLocal, smoothing)
      }
      scratch.rootSpaceQuats.get(def.name)!.copy(bone.quaternion)
    }
  }
}
