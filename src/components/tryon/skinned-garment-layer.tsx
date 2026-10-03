"use client"

import { useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js"
import { applyMaterialToScene } from "@/lib/three-d/garment-material"
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
import { GARMENT_Z, computeTargets, type Anchor } from "./pose/targeting"
import type { PoseSource } from "./pose/pose-source"

// Self-hosted Draco decoder (public/draco, copied by scripts/asset-pipeline).
useGLTF.setDecoderPath("/draco/")

interface SkinnedGarmentLayerProps {
  modelUrl: string
  anchor: Anchor
  poseSource: PoseSource
  gatherer: CalibrationGatherer
  material?: string
}

/**
 * Skinned garment layer: renders a rigged GLB (19-bone template) and drives
 * its skeleton from calibrated pose joints every frame.
 *
 * Placement strategy: the container follows the body using the validated
 * screen-space anchor; the skeleton deforms inside the container using
 * calibrated world joints (jointsInRootSpace, followRoot=false).
 */
export function SkinnedGarmentLayer({
  modelUrl,
  anchor,
  poseSource,
  gatherer,
  material,
}: SkinnedGarmentLayerProps) {
  const gltf = useGLTF(modelUrl, true)
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const gateRef = useRef(new ConfidenceGate())

  const prepared = useMemo(() => {
    const clone = skeletonClone(gltf.scene)
    // three.js sanitizes glTF node names (dots removed), so index by both the
    // original name (userData.name) and the sanitized one.
    const bonesByName = buildBoneIndex(clone)

    if (bonesByName.size < BONE_DEFS.length) {
      console.warn(
        `[vto] rigged model "${modelUrl}" has ${bonesByName.size} bones, expected ${BONE_DEFS.length}`
      )
      return null
    }

    applyMaterialToScene(clone, material)
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of materials) {
        const m = mat as THREE.MeshStandardMaterial
        if (!m || !("roughness" in m)) continue
        // Skinned meshes stay opaque to avoid sorting artifacts
        m.transparent = false
        m.opacity = 1
        m.depthWrite = true
        m.depthTest = true
        if (m.emissive) m.emissiveIntensity = 0.06
        m.needsUpdate = true
      }
    })

    // Normalize like the rigid path: bbox centered in X/Z with its TOP at the
    // container origin, so the screen-space anchor (shoulder line) places the
    // garment hanging from the shoulders instead of centered on it.
    const box = new THREE.Box3().setFromObject(clone)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    clone.position.x -= center.x
    clone.position.y -= box.max.y
    clone.position.z -= center.z

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
      size,
    }
  }, [gltf, material, modelUrl])

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

    // Freeze the garment when tracking confidence drops (limbs out of frame,
    // side-on turns): better to hold the last good pose than to thrash.
    if (!gateRef.current.update(poseConfidence(poseSource.world))) {
      return
    }
    if (!group.visible) group.visible = true

    // 1) Container placement via screen-space anchor
    const cam = camera as THREE.PerspectiveCamera
    const dist = Math.abs(GARMENT_Z)
    const viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
    const viewW = viewH * cam.aspect

    const targets = computeTargets(
      poseSource.landmarks,
      anchor,
      viewW,
      viewH,
      prepared.size.x,
      prepared.size.y
    )
    const target = targets[0]
    if (target) {
      const follow = 0.25
      group.position.x += (target.x - group.position.x) * follow
      group.position.y += (target.y - group.position.y) * follow
      group.position.z = GARMENT_Z

      // Freeze rotation/scale when the person turns side-on: the shoulder line
      // is foreshortened and screen-space tilt/scale becomes meaningless.
      const lm = poseSource.landmarks
      const shoulderScreen = Math.abs((1 - lm[11].x) - (1 - lm[12].x))
      if (shoulderScreen >= 0.06) {
        group.rotation.z += (target.rz - group.rotation.z) * follow
        const nextScale = group.scale.x + (target.s - group.scale.x) * follow
        group.scale.setScalar(nextScale)
      }
    }

    // 2) Skeleton deformation from calibrated joints (meters, root space)
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
        // Damp MediaPipe depth noise; converges in a few frames
        smoothing: 0.4,
        // MediaPipe Z is unreliable: keep directions on the screen plane
        planar: true,
        // Freeze bones whose landmarks leave the frame
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
