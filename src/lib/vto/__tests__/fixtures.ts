/**
 * Shared fixtures for lib/vto tests: a synthetic T-pose in canonical space
 * (X = subject's right, Y = up, Z = toward camera), plus a matching Three.js
 * bone hierarchy for retarget tests.
 */
import * as THREE from "three"
import { BONE_DEFS } from "../skeleton"
import { POSE_STRIDE, type Vec3 } from "../types"

/** Canonical T-pose joint positions (meters). */
export const T_POSE_JOINTS: Record<string, [number, number, number]> = {
  head_top: [0, 0.75, 0],
  ear_center: [0, 0.62, 0],
  neck_base: [0, 0.53, 0],
  chest_center: [0, 0.44, 0],
  spine_mid: [0, 0.3, 0],
  hip_center: [0, 0.16, 0],

  shoulder_l: [-0.18, 0.46, 0],
  elbow_l: [-0.42, 0.46, 0],
  wrist_l: [-0.65, 0.46, 0],
  index_l: [-0.74, 0.46, 0],

  shoulder_r: [0.18, 0.46, 0],
  elbow_r: [0.42, 0.46, 0],
  wrist_r: [0.65, 0.46, 0],
  index_r: [0.74, 0.46, 0],

  hip_l: [-0.1, 0.16, 0],
  hip_r: [0.1, 0.16, 0],

  knee_l: [-0.1, -0.31, 0],
  knee_r: [0.1, -0.31, 0],

  ankle_l: [-0.1, -0.77, 0],
  ankle_r: [0.1, -0.77, 0],

  foot_index_l: [-0.1, -0.89, 0.12],
  foot_index_r: [0.1, -0.89, 0.12],
}

/**
 * Builds a 33x4 world-landmark buffer such that the resolver reproduces
 * T_POSE_JOINTS. Only the landmarks referenced by the template are populated.
 */
export function makeWorldLandmarks(
  overrides: Partial<Record<number, [number, number, number]>> = {}
): Float32Array {
  const buffer = new Float32Array(33 * POSE_STRIDE)
  const set = (i: number, xyz: [number, number, number]) => {
    buffer[i * POSE_STRIDE] = xyz[0]
    buffer[i * POSE_STRIDE + 1] = xyz[1]
    buffer[i * POSE_STRIDE + 2] = xyz[2]
    buffer[i * POSE_STRIDE + 3] = 0.95
  }

  const J = T_POSE_JOINTS
  // Landmarks (points directly referenced by the template)
  set(7, J.ear_center)
  set(8, J.ear_center)
  set(11, J.shoulder_l)
  set(12, J.shoulder_r)
  set(13, J.elbow_l)
  set(14, J.elbow_r)
  set(15, J.wrist_l)
  set(16, J.wrist_r)
  set(19, J.index_l)
  set(20, J.index_r)
  set(23, J.hip_l)
  set(24, J.hip_r)
  set(25, J.knee_l)
  set(26, J.knee_r)
  set(27, J.ankle_l)
  set(28, J.ankle_r)
  set(31, J.foot_index_l)
  set(32, J.foot_index_r)

  for (const [index, xyz] of Object.entries(overrides)) {
    if (xyz) set(Number(index), xyz)
  }

  return buffer
}

export function jointsMapFrom(
  positions: Record<string, [number, number, number]>
): Map<string, Vec3> {
  const map = new Map<string, Vec3>()
  for (const [name, [x, y, z]] of Object.entries(positions)) {
    map.set(name, { x, y, z })
  }
  return map
}

/**
 * Builds a Three.js bone hierarchy whose bind pose matches T_POSE_JOINTS,
 * with realistic local orientations: like a Blender rig, each bone's local +Y
 * axis points from its `from` joint to its `to` joint.
 */
export function buildTposeSkeleton(): {
  bones: Map<string, THREE.Bone>
  rootObject: THREE.Object3D
} {
  const bones = new Map<string, THREE.Bone>()
  const rootObject = new THREE.Object3D()
  rootObject.name = "garment-root"

  const J = T_POSE_JOINTS
  const posOf = (name: string): THREE.Vector3 => new THREE.Vector3(...J[name])

  for (const def of BONE_DEFS) {
    const bone = new THREE.Bone()
    bone.name = def.name
    bones.set(def.name, bone)
  }

  const UP = new THREE.Vector3(0, 1, 0)
  const worldQuat = new Map<string, THREE.Quaternion>()
  const worldPos = new Map<string, THREE.Vector3>()

  for (const def of BONE_DEFS) {
    const bone = bones.get(def.name)!
    const from = posOf(def.from)
    const to = posOf(def.to)
    const dir = to.clone().sub(from).normalize()

    const qWorld = new THREE.Quaternion().setFromUnitVectors(UP, dir)
    const qParentWorld = def.parent
      ? worldQuat.get(def.parent)!.clone()
      : new THREE.Quaternion()
    const parentPos = def.parent
      ? worldPos.get(def.parent)!.clone()
      : new THREE.Vector3()

    bone.position
      .copy(from.clone().sub(parentPos).applyQuaternion(qParentWorld.clone().invert()))
    bone.quaternion.copy(qParentWorld.clone().invert().multiply(qWorld))

    worldQuat.set(def.name, qWorld)
    worldPos.set(def.name, from.clone())

    if (def.parent) {
      bones.get(def.parent)!.add(bone)
    } else {
      rootObject.add(bone)
    }
  }

  rootObject.updateMatrixWorld(true)
  return { bones, rootObject }
}
