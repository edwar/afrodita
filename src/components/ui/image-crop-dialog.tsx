"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { useTranslation } from "@/lib/i18n"
import { fullRect, outputSize, toSourceRect, type Rect } from "@/lib/image-crop"

/** A choice of crop shape. `ratio` undefined = free-form. */
export interface CropAspect {
  id: string
  ratio: number | undefined
  /** Translation key; free-form uses "crop.free". */
  label: string
}

export interface PickedImage {
  file: File
  /** Object URL of `file`; released by `clear`. */
  url: string
}

/**
 * Holds the image the user just chose until it is cropped. The object URL is
 * made and released in event handlers (not effects), which keeps it valid
 * under React's double-mount in development.
 */
export function useCropPick() {
  const [picked, setPicked] = useState<PickedImage | null>(null)
  const current = useRef<PickedImage | null>(null)

  const clear = useCallback(() => {
    if (current.current) URL.revokeObjectURL(current.current.url)
    current.current = null
    setPicked(null)
  }, [])

  const choose = useCallback((file: File) => {
    if (current.current) URL.revokeObjectURL(current.current.url)
    const next = { file, url: URL.createObjectURL(file) }
    current.current = next
    setPicked(next)
  }, [])

  return { picked, choose, clear }
}

/** Initial crop: 90% of the image, in the chosen shape, centered. */
function initialCrop(
  ratio: number | undefined,
  width: number,
  height: number,
): Crop {
  if (!ratio) return { unit: "%", x: 5, y: 5, width: 90, height: 90 }
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, ratio, width, height),
    width,
    height,
  )
}

/** Draws a region of `image` into a JPEG no bigger than `maxSide`. */
function exportRegion(
  image: HTMLImageElement,
  region: Rect,
  maxSide: number,
): Promise<Blob | null> {
  const size = outputSize(region, maxSide)
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext("2d")
  if (!context) return Promise.resolve(null)
  // JPEG has no transparency: a transparent PNG would turn black
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(
    image,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    size.width,
    size.height,
  )
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
}

/**
 * Crop step between choosing an image and uploading it. Gives back a JPEG of
 * the cropped region. Formats the browser cannot show (HEIC outside Safari)
 * cannot be cropped here: the user may upload the original as it is.
 */
export function ImageCropDialog({
  picked,
  title,
  hint,
  aspects,
  maxSide,
  onCancel,
  onConfirm,
}: {
  picked: PickedImage | null
  title: string
  hint?: string
  /** First one is the default. */
  aspects: CropAspect[]
  /** Longest side of the exported image, in pixels. */
  maxSide: number
  onCancel: () => void
  /** The cropped JPEG, or the untouched original when it could not be cropped. */
  onConfirm: (image: Blob | File) => void
}) {
  // Mounted only while there is an image, so every one starts fresh
  if (!picked) return null
  return (
    <CropBody
      picked={picked}
      title={title}
      hint={hint}
      aspects={aspects}
      maxSide={maxSide}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

function CropBody({
  picked,
  title,
  hint,
  aspects,
  maxSide,
  onCancel,
  onConfirm,
}: {
  picked: PickedImage
  title: string
  hint?: string
  aspects: CropAspect[]
  maxSide: number
  onCancel: () => void
  onConfirm: (image: Blob | File) => void
}) {
  const { t } = useTranslation()
  const imageRef = useRef<HTMLImageElement>(null)
  const [aspectId, setAspectId] = useState(aspects[0].id)
  const [crop, setCrop] = useState<Crop>()
  const [unreadable, setUnreadable] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  const ratio = aspects.find((aspect) => aspect.id === aspectId)?.ratio

  const chooseAspect = (id: string) => {
    setAspectId(id)
    const image = imageRef.current
    if (!image) return
    setCrop(
      initialCrop(
        aspects.find((aspect) => aspect.id === id)?.ratio,
        image.width,
        image.height,
      ),
    )
  }

  /** `useCrop` false = use the whole image as it is. */
  const finish = async (useCrop: boolean) => {
    const image = imageRef.current
    if (!image || working) return
    setWorking(true)
    const natural = { width: image.naturalWidth, height: image.naturalHeight }
    const region =
      useCrop && crop
        ? toSourceRect(
            convertToPixelCrop(crop, image.width, image.height),
            { width: image.width, height: image.height },
            natural,
          )
        : fullRect(natural)
    const blob = await exportRegion(image, region, maxSide)
    setWorking(false)
    // If the canvas could not be read, hand over the original instead
    onConfirm(blob ?? picked.file)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1A1A1A]/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-dialog-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col border border-[#E0D9CF] bg-[#F8F5F0] shadow-xl">
        <div className="p-6 pb-3">
          <h2
            id="crop-dialog-title"
            className="font-editorial text-2xl font-light"
          >
            {title}
          </h2>
          {hint && (
            <p className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
              {hint}
            </p>
          )}
        </div>

        {unreadable ? (
          <div className="px-6 pb-2">
            <p className="bg-[#EDE8E1] p-4 text-sm leading-relaxed">
              {t("crop.unreadable")}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 px-6 pb-3">
              {aspects.map((aspect) => (
                <button
                  key={aspect.id}
                  onClick={() => chooseAspect(aspect.id)}
                  aria-pressed={aspect.id === aspectId}
                  className={`border px-3 py-1.5 text-xs transition-colors ${
                    aspect.id === aspectId
                      ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                      : "border-[#E0D9CF] hover:border-[#1A1A1A]"
                  }`}
                >
                  {t(aspect.label)}
                </button>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#EDE8E1] px-6 py-4">
              <ReactCrop
                crop={crop}
                onChange={(_, percent) => setCrop(percent)}
                aspect={ratio}
                minWidth={48}
                minHeight={48}
                keepSelection
                ruleOfThirds
              >
                {/* A plain img: the crop is drawn from this very element */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imageRef}
                  src={picked.url}
                  alt=""
                  onLoad={(event) => {
                    const { width, height } = event.currentTarget
                    setCrop(initialCrop(ratio, width, height))
                  }}
                  onError={() => setUnreadable(true)}
                  style={{ maxHeight: "52vh", maxWidth: "100%" }}
                />
              </ReactCrop>
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 p-6 pt-4 sm:flex-row sm:items-center">
          <button
            onClick={onCancel}
            disabled={working}
            className="btn-fashion-outline sm:flex-1"
          >
            {t("wardrobe.deleteCancel")}
          </button>
          {unreadable ? (
            <button
              onClick={() => onConfirm(picked.file)}
              className="btn-fashion sm:flex-1"
            >
              {t("crop.uploadOriginal")}
            </button>
          ) : (
            <>
              <button
                onClick={() => finish(false)}
                disabled={working}
                className="text-xs underline underline-offset-4 hover:text-[#1A1A1A] disabled:opacity-50 sm:flex-1"
              >
                {t("crop.skip")}
              </button>
              <button
                onClick={() => finish(true)}
                disabled={working || !crop}
                className="btn-fashion disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
              >
                {t("crop.confirm")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
