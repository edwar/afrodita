import { describe, expect, it } from "vitest"
import * as THREE from "three"
import {
  buildBoneIndex,
  captureRestPose,
  createRetargetScratch,
  retargetSkeleton,
} from "../retarget"
import { buildTposeSkeleton, jointsMapFrom, T_POSE_JOINTS } from "./fixtures"

function worldDirOf(
  bones: Map<string, THREE.Bone>,
  boneName: string,
  childName: string
): THREE.Vector3 {
  const bone = bones.get(boneName)!
  const child = bones.get(childName)!
  const a = bone.getWorldPosition(new THREE.Vector3())
  const b = child.getWorldPosition(new THREE.Vector3())
  return b.sub(a).normalize()
}

describe("buildBoneIndex", () => {
  it("indexes bones by original and sanitized names", () => {
    const root = new THREE.Object3D()
    const bone = new THREE.Bone()
    bone.name = "shoulderL" // three.js sanitized form (dots removed)
    bone.userData.name = "shoulder.L"
    root.add(bone)

    const index = buildBoneIndex(root)
    expect(index.get("shoulder.L")).toBe(bone)
    expect(index.get("shoulderL")).toBe(bone)
  })

  it("captures the rest pose when GLTFLoader sanitized bone names", () => {
    const { bones, rootObject } = buildTposeSkeleton()

    // Simulate three.js GLTFLoader: dots stripped from node names, original
    // kept in userData.name.
    for (const [name, bone] of bones) {
      bone.userData.name = name
      bone.name = name.replace(/[.[\]:/]/g, "")
    }

    const index = buildBoneIndex(rootObject)
    const rest = captureRestPose(index)

    expect(rest.order.length).toBe(19)
    const upperArm = rest.info.get("upper_arm.L")!
    expect(upperArm.restDirRoot.x).toBeCloseTo(-1, 3)
  })
})

describe("captureRestPose", () => {
  it("derives rest directions and lengths from the bind pose", () => {
    const { bones } = buildTposeSkeleton()
    const rest = captureRestPose(bones)

    const upperArm = rest.info.get("upper_arm.L")!
    expect(upperArm.restDirRoot.x).toBeCloseTo(-1, 5)
    expect(Math.abs(upperArm.restDirRoot.y)).toBeLessThan(1e-5)
    expect(upperArm.restLength).toBeCloseTo(0.24, 5)

    const thigh = rest.info.get("thigh.L")!
    expect(thigh.restDirRoot.y).toBeCloseTo(-1, 5)
  })

  it("throws when template bones are missing", () => {
    const { bones } = buildTposeSkeleton()
    bones.delete("head")
    expect(() => captureRestPose(bones)).toThrow(/missing template bones/i)
  })
})

describe("retargetSkeleton", () => {
  it("keeps the bind local pose when targets equal the rest pose", () => {
    const { bones, rootObject } = buildTposeSkeleton()
    const rest = captureRestPose(bones)
    const scratch = createRetargetScratch(rest)

    const bindLocal = new Map<string, THREE.Quaternion>()
    for (const def of rest.order) {
      bindLocal.set(def.name, bones.get(def.name)!.quaternion.clone())
    }

    retargetSkeleton(
      bones,
      rest,
      jointsMapFrom(T_POSE_JOINTS),
      rootObject,
      scratch,
      { followRoot: false }
    )

    for (const def of rest.order) {
      const bone = bones.get(def.name)!
      expect(bone.quaternion.angleTo(bindLocal.get(def.name)!)).toBeLessThan(1e-5)
    }
  })

  it("aligns chain bones with a rotated target (left arm lowered 45°)", () => {
    const { bones, rootObject } = buildTposeSkeleton()
    const rest = captureRestPose(bones)
    const scratch = createRetargetScratch(rest)

    const shoulder = new THREE.Vector3(...T_POSE_JOINTS.shoulder_l)
    const elbow = new THREE.Vector3(...T_POSE_JOINTS.elbow_l)
    const wrist = new THREE.Vector3(...T_POSE_JOINTS.wrist_l)
    const index = new THREE.Vector3(...T_POSE_JOINTS.index_l)

    const l1 = elbow.distanceTo(shoulder)
    const l2 = wrist.distanceTo(elbow)
    const l3 = index.distanceTo(wrist)

    const dir = new THREE.Vector3(-Math.SQRT1_2, -Math.SQRT1_2, 0)
    const elbowT = shoulder.clone().addScaledVector(dir, l1)
    const wristT = elbowT.clone().addScaledVector(dir, l2)
    const indexT = wristT.clone().addScaledVector(dir, l3)

    const joints = jointsMapFrom(T_POSE_JOINTS)
    const put = (name: string, v: THREE.Vector3) => {
      const joint = joints.get(name)!
      joint.x = v.x
      joint.y = v.y
      joint.z = v.z
    }
    put("elbow_l", elbowT)
    put("wrist_l", wristT)
    put("index_l", indexT)

    retargetSkeleton(bones, rest, joints, rootObject, scratch, {
      followRoot: false,
    })
    rootObject.updateMatrixWorld(true)

    const upperDir = worldDirOf(bones, "upper_arm.L", "forearm.L")
    expect(upperDir.dot(dir)).toBeGreaterThan(0.9999)

    const forearmDir = worldDirOf(bones, "forearm.L", "hand.L")
    expect(forearmDir.dot(dir)).toBeGreaterThan(0.9999)
  })

  it("moves the root bone to the observed hips when followRoot is enabled", () => {
    const { bones, rootObject } = buildTposeSkeleton()
    const rest = captureRestPose(bones)
    const scratch = createRetargetScratch(rest)

    const joints = jointsMapFrom(T_POSE_JOINTS)
    // Shift hips to the right and slightly forward
    joints.get("hip_l")!.x = -0.05
    joints.get("hip_r")!.x = 0.15
    joints.get("hip_r")!.z = 0.02
    joints.get("hip_center")!.x = 0.05
    joints.get("hip_center")!.z = 0.01

    retargetSkeleton(bones, rest, joints, rootObject, scratch, {
      followRoot: true,
    })

    const hips = bones.get("hips")!
    expect(hips.position.x).toBeCloseTo(0.05, 5)
    expect(hips.position.z).toBeCloseTo(0.01, 5)
  })

  it("supports jointsInRootSpace with a translated/scaled container", () => {
    const { bones, rootObject } = buildTposeSkeleton()
    const rest = captureRestPose(bones)
    const scratch = createRetargetScratch(rest)

    // Container placed like the screen-space rig (no rotation)
    rootObject.position.set(1.2, -0.4, -1.8)
    rootObject.scale.setScalar(2.5)
    rootObject.updateMatrixWorld(true)

    const shoulder = new THREE.Vector3(...T_POSE_JOINTS.shoulder_l)
    const elbow = new THREE.Vector3(...T_POSE_JOINTS.elbow_l)
    const wrist = new THREE.Vector3(...T_POSE_JOINTS.wrist_l)
    const index = new THREE.Vector3(...T_POSE_JOINTS.index_l)

    const l1 = elbow.distanceTo(shoulder)
    const l2 = wrist.distanceTo(elbow)
    const l3 = index.distanceTo(wrist)

    const dir = new THREE.Vector3(-Math.SQRT1_2, -Math.SQRT1_2, 0)
    const elbowT = shoulder.clone().addScaledVector(dir, l1)
    const wristT = elbowT.clone().addScaledVector(dir, l2)
    const indexT = wristT.clone().addScaledVector(dir, l3)

    const joints = jointsMapFrom(T_POSE_JOINTS)
    const put = (name: string, v: THREE.Vector3) => {
      const joint = joints.get(name)!
      joint.x = v.x
      joint.y = v.y
      joint.z = v.z
    }
    put("elbow_l", elbowT)
    put("wrist_l", wristT)
    put("index_l", indexT)

    retargetSkeleton(bones, rest, joints, rootObject, scratch, {
      followRoot: false,
      jointsInRootSpace: true,
    })
    rootObject.updateMatrixWorld(true)

    // With jointsInRootSpace the container transform must not affect bone math
    const upperDir = worldDirOf(bones, "upper_arm.L", "forearm.L")
    expect(upperDir.dot(dir)).toBeGreaterThan(0.9999)
  })

  it("damps and then converges with smoothing < 1", () => {
    const { bones, rootObject } = buildTposeSkeleton()
    const rest = captureRestPose(bones)
    const scratch = createRetargetScratch(rest)

    const shoulder = new THREE.Vector3(...T_POSE_JOINTS.shoulder_l)
    const elbow = new THREE.Vector3(...T_POSE_JOINTS.elbow_l)
    const wrist = new THREE.Vector3(...T_POSE_JOINTS.wrist_l)
    const index = new THREE.Vector3(...T_POSE_JOINTS.index_l)
    const dir = new THREE.Vector3(-Math.SQRT1_2, -Math.SQRT1_2, 0)

    const elbowT = shoulder.clone().addScaledVector(dir, elbow.distanceTo(shoulder))
    const wristT = elbowT.clone().addScaledVector(dir, wrist.distanceTo(elbow))
    const indexT = wristT.clone().addScaledVector(dir, index.distanceTo(wrist))

    const joints = jointsMapFrom(T_POSE_JOINTS)
    const put = (name: string, v: THREE.Vector3) => {
      const joint = joints.get(name)!
      joint.x = v.x
      joint.y = v.y
      joint.z = v.z
    }
    put("elbow_l", elbowT)
    put("wrist_l", wristT)
    put("index_l", indexT)

    retargetSkeleton(bones, rest, joints, rootObject, scratch, {
      smoothing: 0.4,
    })
    rootObject.updateMatrixWorld(true)
    const afterOne = worldDirOf(bones, "upper_arm.L", "forearm.L")
    expect(afterOne.dot(dir)).toBeLessThan(0.9999)

    for (let i = 0; i < 14; i++) {
      retargetSkeleton(bones, rest, joints, rootObject, scratch, {
        smoothing: 0.4,
      })
    }
    rootObject.updateMatrixWorld(true)
    const converged = worldDirOf(bones, "upper_arm.L", "forearm.L")
    expect(converged.dot(dir)).toBeGreaterThan(0.999)
  })

  it("ignores depth (planar) and gates bones by visibility", () => {
    const { bones, rootObject } = buildTposeSkeleton()
    const rest = captureRestPose(bones)
    const scratch = createRetargetScratch(rest)

    const shoulder = new THREE.Vector3(...T_POSE_JOINTS.shoulder_l)
    const elbow = new THREE.Vector3(...T_POSE_JOINTS.elbow_l)
    const wrist = new THREE.Vector3(...T_POSE_JOINTS.wrist_l)
    const index = new THREE.Vector3(...T_POSE_JOINTS.index_l)

    // Target direction with a strong (noisy) depth component
    const dir = new THREE.Vector3(-Math.SQRT1_2, -Math.SQRT1_2, 0.4).normalize()
    const elbowT = shoulder.clone().addScaledVector(dir, elbow.distanceTo(shoulder))
    const wristT = elbowT.clone().addScaledVector(dir, wrist.distanceTo(elbow))
    const indexT = wristT.clone().addScaledVector(dir, index.distanceTo(wrist))

    const joints = jointsMapFrom(T_POSE_JOINTS)
    const put = (name: string, v: THREE.Vector3) => {
      const joint = joints.get(name)!
      joint.x = v.x
      joint.y = v.y
      joint.z = v.z
    }
    put("elbow_l", elbowT)
    put("wrist_l", wristT)
    put("index_l", indexT)

    retargetSkeleton(bones, rest, joints, rootObject, scratch, {
      planar: true,
      isJointVisible: (name) => name !== "elbow_l",
    })
    rootObject.updateMatrixWorld(true)

    // upper_arm.L depends on elbow_l -> gated (keeps bind pose)
    const bindUpper = new THREE.Quaternion()
      .copy(rest.info.get("upper_arm.L")!.qRootRest)
    const upperWorld = bones
      .get("upper_arm.L")!
      .getWorldQuaternion(new THREE.Quaternion())
    // Its parent chain is at rest, so world == root-rest quaternion
    expect(upperWorld.angleTo(bindUpper)).toBeLessThan(1e-4)

    // forearm.L only needs elbow/wrist (elbow hidden, wrist visible) -> gated too
    const forearmWorld = bones
      .get("forearm.L")!
      .getWorldQuaternion(new THREE.Quaternion())
    const bindForearm = rest.info.get("forearm.L")!.qRootRest
    expect(forearmWorld.angleTo(bindForearm)).toBeLessThan(1e-4)
  })
})
