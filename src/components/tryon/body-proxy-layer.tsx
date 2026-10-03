"use client"

import { useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js"
import { BONE_DEFS, JointResolver } from "@/lib/vto/skeleton"
import {
  buildBoneIndex,
  captureRestPose,
  createRetargetScratch,
  retargetSkeleton,
} from "@/lib/vto/retarget"
import { resolveCanonicalJoints } from "@/lib/vto/coords"
import { ConfidenceGate, poseConfidence } from "@/lib/vto/confidence"
import type { CalibrationGatherer } from "@/lib/vto/calibration"
import { GARMENT_Z, computeTargets } from "./pose/targeting"
import type { PoseSource } from "./pose/pose-source"

const BODY_PROXY_URL = "/models/body-proxy-v2.glb"
// Slightly behind the garment plane to avoid z-fighting when both are visible.
const BODY_PROXY_Z = GARMENT_Z - 0.02
// Minimum on-screen shoulder width before container rotation/scale updates are
// frozen (avoids wild jumps when the person turns side-on).
const MIN_SHOULDER_SCREEN = 0.06

interface BodyProxyLayerProps {
  poseSource: PoseSource
  gatherer: CalibrationGatherer
}

/**
 * Low-poly skinned mannequin driven by the calibrated pose. Shows the body
 * contour over the video (replaces the raw skeleton debug view) and freezes
 * when tracking confidence drops (limbs out of frame, side-on turns).
 */
export function BodyProxyLayer({ poseSource, gatherer }: BodyProxyLayerProps) {
  const gltf = useGLTF(BODY_PROXY_URL)
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const gateRef = useRef(new ConfidenceGate())
  const smoothed = useRef({ init: false, x: 0, y: 0, rz: 0, scale: 1 })

  const prepared = useMemo(() => {
    const clone = skeletonClone(gltf.scene)
    const bonesByName = buildBoneIndex(clone)

    if (bonesByName.size < BONE_DEFS.length) {
      console.warn(
        `[vto] body proxy has ${bonesByName.size} bones, expected ${BONE_DEFS.length}`
      )
      return null
    }

    // The proxy is authored with its origin at the feet; re-anchor it so the
    // hip joint (bind pose) sits at the container origin, matching the
    // hips-based screen anchor.
    clone.updateMatrixWorld(true)
    const hipsBone = bonesByName.get("hips")
    if (hipsBone) {
      const hipWorld = hipsBone.getWorldPosition(new THREE.Vector3())
      clone.position.sub(hipWorld)
      clone.updateMatrixWorld(true)
    }

    // Translucent body material so the video shows through
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of materials) {
        const m = mat as THREE.MeshStandardMaterial
        if (!m || !("roughness" in m)) continue
        m.transparent = true
        m.opacity = 0.45
        m.depthWrite = false
        m.depthTest = true
        m.side = THREE.DoubleSide
        m.color.set(0x7fb2ff)
        if (m.emissive) {
          m.emissive.set(0x1a3a66)
          m.emissiveIntensity = 0.35
        }
        m.needsUpdate = true
      }
    })

    const rest = captureRestPose(bonesByName)
    const scratch = createRetargetScratch(rest)
    const resolver = new JointResolver()
    const joints = JointResolver.createOutput()
    const visibility = new Float32Array(resolver.order.length)
    const jointIndex = new Map<string, number>()
    resolver.order.forEach((name, index) => jointIndex.set(name, index))
    const isJointVisible = (name: string): boolean => {
      const index = jointIndex.get(name)
      return index === undefined ? true : visibility[index] >= 0.45
    }

    return {
      clone,
      bonesByName,
      rest,
      scratch,
      resolver,
      joints,
      visibility,
      isJointVisible,
    }
  }, [gltf])

  useFrame(() => {
    const group = groupRef.current
    if (!group || !prepared) return

    poseSource.sync(performance.now())
    if (!poseSource.valid) return

    const calibration = gatherer.calibration
    if (!calibration) {
      if (group.visible) group.visible = false
      return
    }

    // Freeze entirely when tracking confidence drops
    if (!gateRef.current.update(poseConfidence(poseSource.world))) {
      return
    }
    if (!group.visible) group.visible = true

    const cam = camera as THREE.PerspectiveCamera
    const dist = Math.abs(GARMENT_Z)
    const viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
    const viewW = viewH * cam.aspect

    // Anchor at the user's hips (canonical origin = hip center)
    const targets = computeTargets(poseSource.landmarks, "hips", viewW, viewH, 1, 1)
    const target = targets[0]
    if (!target) return

    // Live scale: screen torso extent / canonical torso extent (meters)
    const lm = poseSource.landmarks
    const hipScreenY = (lm[23].y + lm[24].y) / 2
    const earScreenY = (lm[7].y + lm[8].y) / 2
    const screenTorso = Math.abs(hipScreenY - earScreenY) * viewH
    const earJoint = prepared.joints.get("ear_center")
    const hipJoint = prepared.joints.get("hip_center")
    let liveScale = smoothed.current.scale || 1
    if (earJoint && hipJoint) {
      const worldTorso = Math.hypot(
        earJoint.x - hipJoint.x,
        earJoint.y - hipJoint.y,
        earJoint.z - hipJoint.z
      )
      if (worldTorso > 1e-4) liveScale = screenTorso / worldTorso
    }

    const shoulderScreen = Math.abs((1 - lm[11].x) - (1 - lm[12].x))
    const turnedSideOn = shoulderScreen < MIN_SHOULDER_SCREEN

    const state = smoothed.current
    if (!state.init) {
      state.init = true
      state.x = target.x
      state.y = target.y
      state.rz = target.rz
      state.scale = liveScale
    } else {
      const follow = 0.25
      state.x += (target.x - state.x) * follow
      state.y += (target.y - state.y) * follow
      if (!turnedSideOn) {
        state.rz += (target.rz - state.rz) * follow
        state.scale += (liveScale - state.scale) * follow
      }
    }

    group.position.set(state.x, state.y, BODY_PROXY_Z)
    group.rotation.z = state.rz
    group.scale.setScalar(state.scale)

    // Deform the mannequin with the calibrated joints
    resolveCanonicalJoints(
      poseSource.world,
      prepared.resolver,
      calibration,
      prepared.joints,
      prepared.visibility
    )
    retargetSkeleton(
      prepared.bonesByName,
      prepared.rest,
      prepared.joints,
      group,
      prepared.scratch,
      {
        followRoot: false,
        jointsInRootSpace: true,
        smoothing: 0.35,
        planar: true,
        isJointVisible: prepared.isJointVisible,
      }
    )
  })

  if (!prepared) return null

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={prepared.clone} />
    </group>
  )
}
