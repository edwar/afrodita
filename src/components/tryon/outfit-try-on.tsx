"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import Image from "next/image"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { PhotoConsentDialog } from "./photo-consent-dialog"
import { TryOnConfirm, type TryOnAction } from "./try-on-confirm"
import { readJson, useTryOnPhoto } from "./use-try-on-photo"

interface LookStatus {
  /** The user has uploaded their base photo. */
  photo: boolean
  /** Generated image of the user in this outfit, once it exists. */
  imageUrl: string | null
  /** The image was made from a photo the user has since changed or deleted. */
  outdated: boolean
}

/**
 * Photorealistic try-on of one outfit option: the user uploads a photo of
 * themselves once, and an image model dresses that photo with the outfit's
 * garments. Generation is explicit (it is a paid call) and cached server-side.
 */
export function OutfitTryOn({
  optionId,
  lookUrlRef,
  maxHeight = "75vh",
}: {
  optionId: string
  /** Kept pointing at the generated image of the current option, if any. */
  lookUrlRef?: RefObject<string | null>
  /** Tallest the image area may get (any CSS length); it never scrolls. */
  maxHeight?: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  // Busts the browser cache of the photo URL after it is replaced
  const [photoVersion, setPhotoVersion] = useState(0)
  const [confirming, setConfirming] = useState<TryOnAction | null>(null)
  const [consenting, setConsenting] = useState(false)
  // Width / height of the picture on screen. The frame takes exactly this
  // shape, so the picture fills it with no bars at the sides.
  const [ratio, setRatio] = useState(2 / 3)
  const frame = {
    aspectRatio: ratio,
    // Capping the width is what caps the height without distorting the frame
    // (never below 16rem tall, so it stays usable on very short screens)
    maxWidth: `calc(max(${maxHeight}, 16rem) * ${ratio})`,
  }

  const status = useQuery({
    queryKey: ["tryon-look", optionId],
    queryFn: () =>
      fetch(`/api/tryon/looks/${optionId}`).then((r) =>
        readJson<LookStatus>(r),
      ),
    staleTime: Infinity,
  })

  const generate = useMutation({
    mutationFn: (regenerate: boolean) =>
      fetch(`/api/tryon/looks/${optionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      }).then((r) => readJson<LookStatus>(r)),
    onSuccess: (data) => {
      queryClient.setQueryData(["tryon-look", optionId], data)
      return queryClient.invalidateQueries({ queryKey: ["looks"] })
    },
  })

  const { upload, remove, busy } = useTryOnPhoto(() =>
    setPhotoVersion((value) => value + 1),
  )

  const imageUrl = status.data?.imageUrl ?? null
  useEffect(() => {
    if (!lookUrlRef) return
    lookUrlRef.current = imageUrl
    return () => {
      lookUrlRef.current = null
    }
  }, [lookUrlRef, imageUrl])

  const hasPhoto = status.data?.photo === true
  const outdated = status.data?.outdated === true

  const run = (action: TryOnAction) => {
    setConfirming(null)
    if (action === "delete") remove.mutate()
    else if (action === "change") setConsenting(true)
    else generate.mutate(true)
  }
  const failure = generate.error ?? upload.error ?? remove.error ?? status.error

  const picker = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (file) {
          generate.reset()
          upload.mutate(file)
        }
      }}
    />
  )

  if (status.isPending) {
    return (
      <div
        className="mx-auto flex items-center justify-center bg-[#EDE8E1]"
        style={frame}
      >
        <Loader2 className="h-6 w-6 animate-spin text-[#C9B99A]" />
      </div>
    )
  }

  // Nothing to show yet: ask for the photo. A look generated earlier stays
  // visible even without one (see below).
  if (!hasPhoto && !imageUrl) {
    return (
      <div
        className="flex min-h-[22rem] flex-col items-center justify-center gap-5 bg-[#EDE8E1] p-8 text-center"
        style={{ maxHeight }}
      >
        {picker}
        <ImagePlus className="h-8 w-8 text-[#C9B99A]" />
        <div className="max-w-sm space-y-2">
          <h3 className="font-editorial text-2xl font-light">
            {t("tryon.uploadTitle")}
          </h3>
          <p className="text-sm leading-relaxed text-[#6B6B6B]">
            {t("tryon.uploadHint")}
          </p>
        </div>
        <button
          onClick={() => setConsenting(true)}
          disabled={busy}
          className="btn-fashion inline-flex items-center gap-2 disabled:opacity-60"
        >
          {upload.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("tryon.uploadCta")}
        </button>
        <p className="max-w-sm text-[11px] leading-relaxed text-[#6B6B6B]">
          {t("tryon.privacy")}
        </p>
        {failure && <p className="text-xs text-red-700">{failure.message}</p>}
        <PhotoConsentDialog
          open={consenting}
          onCancel={() => setConsenting(false)}
          onAccept={() => {
            setConsenting(false)
            fileInput.current?.click()
          }}
        />
      </div>
    )
  }

  return (
    <div>
      {picker}
      <div
        className="relative mx-auto overflow-hidden bg-[#1A1A1A]"
        style={frame}
      >
        <Image
          key={imageUrl ?? `photo-${photoVersion}`}
          src={imageUrl ?? `/api/tryon/photo?v=${photoVersion}`}
          alt={t(imageUrl ? "tryon.lookAlt" : "tryon.photoAlt")}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (naturalWidth && naturalHeight)
              setRatio(naturalWidth / naturalHeight)
          }}
          className={`object-cover transition-opacity duration-500 ${
            imageUrl ? "" : "opacity-60"
          }`}
        />

        {(!imageUrl || generate.isPending) && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-white ${
              imageUrl ? "bg-[#1A1A1A]/60" : ""
            }`}
          >
            {generate.isPending ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin text-[#C9B99A]" />
                <p className="text-xs uppercase tracking-[0.2em]">
                  {t("tryon.generating")}
                </p>
                <p className="max-w-xs text-xs text-white/70">
                  {t("tryon.generatingHint")}
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={() => generate.mutate(false)}
                  disabled={busy}
                  className="btn-fashion inline-flex items-center gap-2 !bg-white !text-[#1A1A1A] disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {t("tryon.generate")}
                </button>
                {failure && (
                  <p className="max-w-xs bg-[#1A1A1A]/70 px-3 py-2 text-xs text-white">
                    {failure.message}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[#6B6B6B]">
        <span>
          {failure && imageUrl
            ? failure.message
            : outdated
              ? t(hasPhoto ? "tryon.outdatedNotice" : "tryon.noPhotoNotice")
              : t(imageUrl ? "tryon.aiNotice" : "tryon.photoNotice")}
        </span>
        <span className="flex shrink-0 items-center gap-4">
          {imageUrl && hasPhoto && (
            <button
              onClick={() => setConfirming(outdated ? "refresh" : "regenerate")}
              disabled={busy || generate.isPending}
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              {t(outdated ? "tryon.refresh" : "tryon.regenerate")}
            </button>
          )}
          {hasPhoto ? (
            <>
              <button
                onClick={() => setConfirming("change")}
                disabled={busy || generate.isPending}
                className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" />
                {t("tryon.changePhoto")}
              </button>
              <button
                onClick={() => setConfirming("delete")}
                disabled={busy || generate.isPending}
                className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                {t("tryon.deletePhoto")}
              </button>
            </>
          ) : (
            // Uploading with no photo replaces nothing: no confirmation needed
            <button
              onClick={() => setConsenting(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline disabled:opacity-50"
            >
              <ImagePlus className="h-3 w-3" />
              {t("tryon.uploadCta")}
            </button>
          )}
        </span>
      </div>

      <PhotoConsentDialog
        open={consenting}
        onCancel={() => setConsenting(false)}
        onAccept={() => {
          setConsenting(false)
          fileInput.current?.click()
        }}
      />
      <TryOnConfirm
        action={confirming}
        onCancel={() => setConfirming(null)}
        onConfirm={run}
      />
    </div>
  )
}
