"use client"

import {
  Component,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { Bone, Loader2, RefreshCw, Shirt, SwitchCamera } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { getMaterialProfile, applyMaterialToScene } from "@/lib/three-d/garment-material"
import { CalibrationGatherer, estimateFovY } from "@/lib/vto/calibration"
import { JointResolver, SKELETON_VERSION } from "@/lib/vto/skeleton"
import { usePoseTracking } from "./pose/usePoseTracking"
import { PoseSource } from "./pose/pose-source"
import {
  CAMERA_FOV,
  GARMENT_Z,
  INFERENCE_HZ,
  anchorFor,
  computeTargets,
  type Anchor,
} from "./pose/targeting"
import { SkinnedGarmentLayer } from "./skinned-garment-layer"
import { BodyProxyLayer } from "./body-proxy-layer"
import type { TryOnGarment } from "./ar-mirror"

class CanvasErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.hasError ? null : this.props.children
  }
}

/**
 * Rigid garment layer for unrigged GLBs (Tripo/Meshy raw output): anchors the
 * mesh to a screen-space target with spring physics. Fallback when no rigged
 * asset is available.
 */
function GarmentRig({
  modelUrl,
  anchor,
  poseSource,
  material,
}: {
  modelUrl: string
  anchor: Anchor
  poseSource: PoseSource
  material?: string
}) {
  const gltf = useGLTF(modelUrl)
  const { camera } = useThree()
  const profile = getMaterialProfile(material)

  // Normaliza el GLB: de pie si está tumbado, centrado en X/Z y top en y=0
  const template = useMemo(() => {
    const root = gltf.scene.clone(true)
    let box = new THREE.Box3().setFromObject(root)
    let size = box.getSize(new THREE.Vector3())
    if (size.y < size.x * 0.6 && size.y < size.z * 0.6) {
      root.rotation.x = -Math.PI / 2
      root.updateMatrixWorld(true)
      box = new THREE.Box3().setFromObject(root)
      size = box.getSize(new THREE.Vector3())
    }
    const center = box.getCenter(new THREE.Vector3())
    root.position.x -= center.x
    root.position.y -= box.max.y
    root.position.z -= center.z
    applyMaterialToScene(root, material)

    // Add subtle transparency and depth settings for better body integration
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      for (const mat of materials) {
        const m = mat as THREE.MeshStandardMaterial
        if (!m || !("roughness" in m)) continue
        // Subtle opacity so garment blends with video feed
        m.transparent = true
        m.opacity = 0.92
        // Better depth sorting
        m.depthWrite = true
        m.depthTest = true
        // Slight emissive for ambient light response
        if (m.emissive) {
          m.emissiveIntensity = 0.08
        }
        m.needsUpdate = true
      }
    })

    return {
      root,
      width: Math.max(size.x, 1e-4),
      height: Math.max(size.y, 1e-4),
    }
  }, [gltf, material])

  // Un grupo por instancia (2 para zapatos: izquierdo y derecho)
  const instances = useMemo(() => {
    const count = anchor === "feet" ? 2 : 1
    return Array.from({ length: count }, (_, i) => {
      const group = new THREE.Group()
      group.add(template.root.clone(true))
      return {
        id: i,
        group,
        inited: false,
        velX: 0,
        velY: 0,
        velRot: 0,
        lastX: 0,
        lastY: 0,
        lastRz: 0,
      }
    })
  }, [template, anchor])

  useFrame(() => {
    poseSource.sync(performance.now())
    if (!poseSource.valid) return
    const lm = poseSource.landmarks

    const cam = camera as THREE.PerspectiveCamera
    const dist = Math.abs(GARMENT_Z)
    const viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
    const viewW = viewH * cam.aspect

    const targets = computeTargets(
      lm,
      anchor,
      viewW,
      viewH,
      template.width,
      template.height,
    )

    // Física blanda: telas fluidas (seda) se retrasan más; cuero va rígido
    // More responsive follow for better body integration
    const lag = 0.04 + (1 - profile.drape) * 0.2
    const follow = THREE.MathUtils.clamp(1 - lag, 0.15, 0.95)
    const swayAmp = profile.sway
    const t = performance.now() / 1000

    instances.forEach((inst, i) => {
      const target = targets[i] ?? targets[0]
      if (!target) return

      if (!inst.inited) {
        inst.group.position.set(target.x, target.y, GARMENT_Z)
        inst.group.rotation.z = target.rz
        inst.group.scale.setScalar(target.s)
        inst.lastX = target.x
        inst.lastY = target.y
        inst.lastRz = target.rz
        inst.inited = true
        return
      }

      // Velocidad del punto de anclaje (para inercia de tela)
      const vx = target.x - inst.lastX
      const vy = target.y - inst.lastY
      inst.lastX = target.x
      inst.lastY = target.y
      inst.lastRz = target.rz

      // Resortes más firmes: la prenda se adhiere mejor al cuerpo
      inst.velX += (target.x - inst.group.position.x) * (0.25 + profile.drape * 0.25)
      inst.velY += (target.y - inst.group.position.y) * (0.25 + profile.drape * 0.25)
      inst.velRot += (target.rz - inst.group.rotation.z) * 0.18
      inst.velX *= 0.72
      inst.velY *= 0.72
      inst.velRot *= 0.7

      inst.group.position.x += (target.x - inst.group.position.x) * follow + inst.velX * 0.4
      inst.group.position.y += (target.y - inst.group.position.y) * follow + inst.velY * 0.4

      // Micro-balanceo sutil tipo tela al moverse
      const sway =
        swayAmp *
        (Math.sin(t * 2.2 + i) * 0.002 +
          (vx + vy) * 0.06 * profile.drape +
          (target.x - inst.group.position.x) * 0.04 * profile.drape)
      inst.group.position.x += sway
      inst.group.rotation.z +=
        (target.rz - inst.group.rotation.z) * follow +
        inst.velRot * 0.3 +
        sway * 0.3

      inst.group.scale.setScalar(
        inst.group.scale.x + (target.s - inst.group.scale.x) * follow,
      )
    })
  })

  return (
    <group>
      {instances.map((inst) => (
        <primitive key={inst.id} object={inst.group} />
      ))}
    </group>
  )
}

interface TryOn3DProps {
  garments: TryOnGarment[]
}

export function TryOn3D({ garments }: TryOn3DProps) {
  const { t } = useTranslation()
  const [videoAspect, setVideoAspect] = useState("0.75")
  const [canvasKey, setCanvasKey] = useState(0)
  const [modelError, setModelError] = useState(false)
  const [calibrationReady, setCalibrationReady] = useState(false)
  // Debug view: body proxy + garment can be toggled independently
  const [showBody, setShowBody] = useState(true)
  const [showGarment, setShowGarment] = useState(true)

  const {
    videoRef,
    state,
    bodyDetected,
    samplePose,
    latestWorld,
    switchCamera,
    retry,
  } = usePoseTracking({ inferenceHz: INFERENCE_HZ })

  const resolver = useMemo(() => new JointResolver(), [])
  const gatherer = useMemo(
    () =>
      new CalibrationGatherer(
        resolver,
        // Placeholder intrinsics: the hybrid screen-space path does not use
        // `calibration.fovY` yet (a full-projection path will).
        () => estimateFovY(4, 3)
      ),
    [resolver]
  )

  const handlePoseFrame = useCallback(
    (world: Float32Array) => {
      const wasReady = gatherer.calibration !== null
      gatherer.push(world)
      if (!wasReady && gatherer.calibration !== null) {
        setCalibrationReady(true)
      }
    },
    [gatherer]
  )

  const poseSource = useMemo(
    () => new PoseSource(samplePose, latestWorld, handlePoseFrame),
    [samplePose, latestWorld, handlePoseFrame]
  )

  const models3D = useMemo(
    () => garments.filter((g) => g.modelUrl),
    [garments]
  )

  const hasSkinned = models3D.some(
    (g) => g.riggedModelUrl && g.skeletonMapVersion === SKELETON_VERSION
  )

  const hasError = state === "error" || modelError
  const active = state === "active" && !hasError

  return (
    <div
      className="relative w-full overflow-hidden bg-[#1A1A1A]"
      style={{ aspectRatio: videoAspect }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (video.videoWidth && video.videoHeight) {
            // El contenedor adopta el aspecto del video para que el
            // mapeo landmark→mundo 3D quede 1:1 sin recortes
            setVideoAspect(
              (video.videoWidth / video.videoHeight).toFixed(4),
            )
          }
        }}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ transform: "scaleX(-1)" }}
      />

      {active && models3D.length > 0 && bodyDetected && (
        <CanvasErrorBoundary
          key={canvasKey}
          onError={() => setModelError(true)}
        >
          <Canvas
            className="absolute inset-0"
            gl={{
              alpha: true,
              antialias: false,
              powerPreference: "low-power",
            }}
            camera={{ fov: CAMERA_FOV, position: [0, 0, 0], near: 0.1, far: 100 }}
            dpr={[1, 1.25]}
          >
            {/* Softer, more natural lighting for body integration */}
            <ambientLight intensity={0.9} />
            <directionalLight position={[2, 3, 4]} intensity={1.2} />
            <directionalLight position={[-3, 1, 2]} intensity={0.5} />
            {/* Subtle fill light from below for under-shadow softening */}
            <directionalLight position={[0, -2, 1]} intensity={0.2} />
            <Suspense fallback={null}>
              {showGarment &&
                models3D.map((g) => {
                  const skinned =
                    g.riggedModelUrl && g.skeletonMapVersion === SKELETON_VERSION
                  return skinned ? (
                    <SkinnedGarmentLayer
                      key={g.id}
                      modelUrl={g.riggedModelUrl as string}
                      anchor={anchorFor(g.category)}
                      poseSource={poseSource}
                      gatherer={gatherer}
                      material={g.material}
                    />
                  ) : (
                    <GarmentRig
                      key={g.id}
                      modelUrl={g.modelUrl as string}
                      anchor={anchorFor(g.category)}
                      poseSource={poseSource}
                      material={g.material}
                    />
                  )
                })}
              {showBody && (
                <BodyProxyLayer poseSource={poseSource} gatherer={gatherer} />
              )}
            </Suspense>
          </Canvas>
        </CanvasErrorBoundary>
      )}

      {/* Body not detected overlay */}
      {active && !bodyDetected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-[#1A1A1A]/60 pointer-events-none">
          <p className="text-sm text-white/80 max-w-xs text-center px-4">
            {t("tryon.hint")}
          </p>
        </div>
      )}

      {/* Calibrando silueta (skinned path only) */}
      {active && hasSkinned && !calibrationReady && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1A1A1A]/70 backdrop-blur-sm px-3 py-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-[#C9B99A]" />
          <span className="text-[10px] tracking-[0.2em] uppercase text-white">
            {t("tryon.calibrating")}
          </span>
        </div>
      )}

      {/* Estado: cargando */}
      {state === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-[#1A1A1A]/80">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9B99A]" />
          <p className="text-xs tracking-[0.2em] uppercase">
            {t("tryon.loading")}
          </p>
        </div>
      )}

      {/* Estado: error de cámara o de modelo 3D */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-white bg-[#1A1A1A]/90">
          <p className="text-sm text-white/80 max-w-xs">
            {modelError ? t("tryon.modelError") : t("tryon.error")}
          </p>
          <button
            onClick={() => {
              if (modelError) {
                setModelError(false)
                setCanvasKey((k) => k + 1)
              } else {
                retry()
              }
            }}
            className="btn-fashion-outline !border-white/40 !text-white inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t("tryon.retry")}
          </button>
        </div>
      )}

      {/* Badge EN VIVO */}
      {active && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#1A1A1A]/60 backdrop-blur-sm px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-[#C9B99A] animate-pulse" />
          <span className="text-[10px] tracking-[0.2em] uppercase text-white">
            {t("tryon.live")}
          </span>
        </div>
      )}

      {/* Toggles de debug: prenda / cuerpo */}
      {active && (
        <>
          <button
            onClick={() => setShowGarment((value) => !value)}
            aria-label={t("tryon.debugGarment")}
            title={t("tryon.debugGarment")}
            className={`absolute top-4 right-16 h-9 px-3 flex items-center gap-2 backdrop-blur-sm text-[10px] tracking-[0.15em] uppercase transition-colors ${
              showGarment
                ? "bg-[#C9B99A] text-[#1A1A1A]"
                : "bg-[#1A1A1A]/60 text-white hover:bg-[#1A1A1A]/80"
            }`}
          >
            <Shirt className="w-4 h-4" />
            {t("tryon.debugGarment")}
          </button>
          <button
            onClick={() => setShowBody((value) => !value)}
            aria-label={t("tryon.debugSkeleton")}
            title={t("tryon.debugSkeleton")}
            className={`absolute top-4 right-44 h-9 px-3 flex items-center gap-2 backdrop-blur-sm text-[10px] tracking-[0.15em] uppercase transition-colors ${
              showBody
                ? "bg-[#C9B99A] text-[#1A1A1A]"
                : "bg-[#1A1A1A]/60 text-white hover:bg-[#1A1A1A]/80"
            }`}
          >
            <Bone className="w-4 h-4" />
            {t("tryon.debugSkeleton")}
          </button>
        </>
      )}

      {/* Cambiar cámara */}
      {active && (
        <button
          onClick={switchCamera}
          aria-label="Switch camera"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-[#1A1A1A]/60 backdrop-blur-sm text-white hover:bg-[#1A1A1A]/80 transition-colors"
        >
          <SwitchCamera className="w-4 h-4" />
        </button>
      )}

      {/* Hint */}
      {active && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span className="text-[11px] text-white/70 bg-[#1A1A1A]/50 px-3 py-1">
            {t("tryon.hint")}
          </span>
        </div>
      )}
    </div>
  )
}
