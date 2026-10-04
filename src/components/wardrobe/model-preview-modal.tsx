"use client"

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { X, Loader2, Box } from "lucide-react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, Center } from "@react-three/drei"
import { useTranslation } from "@/lib/i18n"
import { applyMaterialToScene } from "@/lib/three-d/garment-material"

function Model({
  url,
  material,
  onReady,
}: {
  url: string
  material?: string
  onReady: () => void
}) {
  const { scene } = useGLTF(url)

  useEffect(() => {
    applyMaterialToScene(scene, material)
    onReady()
  }, [scene, material, onReady])

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  )
}

/** Spinner mientras el GLB se descarga/decodifica */
function ModelLoading() {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none z-10">
      <Loader2 className="w-8 h-8 animate-spin text-[#C9B99A]" />
      <p className="text-[11px] tracking-[0.2em] uppercase text-white/70">
        {t("wardrobe.model3dLoading")}
      </p>
    </div>
  )
}

/** Captura errores de carga del GLB (useGLTF) sin romper el árbol de React. */
class ModelErrorBoundary extends Component<
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

interface ModelPreviewModalProps {
  open: boolean
  onClose: () => void
  modelUrl: string
  /** GLB optimizado (rig pipeline) — se prefiere sobre el modelo crudo */
  riggedModelUrl?: string | null
  name: string
  material?: string
}

/**
 * El padre debe montarlo solo cuando está abierto
 * (así el estado de carga se reinicia en cada vista previa).
 */
export function ModelPreviewModal({
  open,
  onClose,
  modelUrl,
  riggedModelUrl,
  name,
  material,
}: ModelPreviewModalProps) {
  const { t } = useTranslation()
  const [modelReady, setModelReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const handleReady = useCallback(() => setModelReady(true), [])

  const glbUrl = useMemo(() => {
    const preferred = riggedModelUrl || modelUrl
    if (!preferred) return null
    if (preferred.startsWith("http") || preferred.startsWith("/")) return preferred
    return `/api/models/${preferred}`
  }, [riggedModelUrl, modelUrl])

  if (!open || !glbUrl) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#1A1A1A]/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("wardrobe.preview3dTitle")}
    >
      <div
        className="bg-[#F8F5F0] w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#E0D9CF]">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-1">
              {t("wardrobe.preview3dTitle")}
            </p>
            <h2 className="font-editorial text-2xl font-light">{name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#EDE8E1] transition-colors"
            aria-label={t("wardrobe.preview3dClose")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Degradado circular: contraste para prendas negras */}
        <div
          className="relative aspect-square md:aspect-[4/3] w-full overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 45%, #3A3A3A 0%, #1C1C1C 42%, #0A0A0A 78%, #000 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 42%, rgba(201,185,154,0.12) 0%, rgba(201,185,154,0.04) 28%, transparent 55%)",
            }}
          />

          <ModelErrorBoundary onError={() => setLoadFailed(true)}>
            <Canvas
              key={glbUrl}
              camera={{ position: [0, 0.4, 2.2], fov: 40 }}
              dpr={[1, 1.5]}
              gl={{ antialias: true, alpha: true }}
            >
              <ambientLight intensity={0.9} />
              <directionalLight position={[3, 4, 5]} intensity={1.15} />
              <directionalLight position={[-3, 1, 2]} intensity={0.5} />
              <directionalLight position={[0, -2, -3]} intensity={0.3} />
              <Suspense fallback={null}>
                <Model
                  url={glbUrl}
                  material={material}
                  onReady={handleReady}
                />
              </Suspense>
              <OrbitControls
                enablePan={false}
                enableZoom
                minDistance={1}
                maxDistance={4}
                autoRotate
                autoRotateSpeed={1.2}
              />
            </Canvas>
          </ModelErrorBoundary>

          {!modelReady && !loadFailed && <ModelLoading />}

          {loadFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80 p-8 text-center">
              <Box className="w-8 h-8 text-[#C9B99A]" />
              <p className="text-sm">{t("wardrobe.model3dLoadError")}</p>
            </div>
          )}

          {modelReady && (
            <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] tracking-[0.2em] uppercase text-white/45 pointer-events-none">
              {t("wardrobe.preview3dHint")}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
