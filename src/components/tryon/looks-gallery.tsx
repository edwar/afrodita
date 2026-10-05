"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Check,
  Columns3,
  Heart,
  ImagePlus,
  Loader2,
  RefreshCw,
  Search,
  ThumbsDown,
  Trash2,
  X,
} from "lucide-react"
import { sileo } from "sileo"
import { useTranslation } from "@/lib/i18n"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImageCropDialog, useCropPick } from "@/components/ui/image-crop-dialog"
import { CROP_MAX_SIDE, PHOTO_ASPECTS } from "./crop-presets"
import { DislikeDialog } from "./dislike-dialog"
import { PhotoConsentDialog } from "./photo-consent-dialog"
import { GarmentFilter } from "./garment-filter"
import { LookCompare, MAX_COMPARED } from "./look-compare"
import { GarmentCollage, type Garment, type Look } from "./look-parts"
import { OutfitTryOn } from "./outfit-try-on"
import { TryOnConfirm, type TryOnAction } from "./try-on-confirm"
import type { Reason, Vote } from "@/lib/tryon/feedback-core"
import { readJson, useTryOnPhoto } from "./use-try-on-photo"

interface LooksResponse {
  photo: boolean
  looks: Look[]
}

type ImageFilter = "all" | "generated" | "pending"

/** Identity of a look: its garments, in any order. */
const lookKeyOf = (look: Look) =>
  look.garments
    .map((garment) => garment.id)
    .sort()
    .join("|")

/**
 * The stylist often proposes the same garments again under another title.
 * Those are one look (and share one generated image): keep the newest.
 */
function uniqueLooks(looks: Look[]): Look[] {
  const seen = new Set<string>()
  return looks.filter((look) => {
    const key = lookKeyOf(look)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Every outfit proposed so far, with filters, and the user's try-on photo. */
export function LooksGallery() {
  const { t, locale } = useTranslation()
  const [search, setSearch] = useState("")
  const [selectedGarments, setSelectedGarments] = useState<string[]>([])
  const [images, setImages] = useState<ImageFilter>("all")
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Look | null>(null)
  const [onlyLiked, setOnlyLiked] = useState(false)
  const [hideDisliked, setHideDisliked] = useState(false)
  const [disliking, setDisliking] = useState<Look | null>(null)
  // Comparison: `picking` turns cards into checkboxes, `picked` are the
  // chosen looks, `comparing` shows them side by side.
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const togglePicked = (optionId: string) =>
    setPicked((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : current.length < MAX_COMPARED
          ? [...current, optionId]
          : current,
    )
  const stopPicking = () => {
    setPicking(false)
    setPicked([])
    setComparing(false)
  }
  const queryClient = useQueryClient()

  const vote = useMutation({
    mutationFn: async ({
      look,
      vote,
      reasons = [],
    }: {
      look: Look
      vote: Vote | null
      reasons?: Reason[]
    }) =>
      readJson(
        await fetch(`/api/looks/${look.optionId}/feedback`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote, reasons }),
        }),
      ),
    // Shown at once; rolled back if the server refuses
    onMutate: async ({ look, vote, reasons = [] }) => {
      await queryClient.cancelQueries({ queryKey: ["looks"] })
      const previous = queryClient.getQueryData<LooksResponse>(["looks"])
      const key = lookKeyOf(look)
      queryClient.setQueryData<LooksResponse>(
        ["looks"],
        (current) =>
          current && {
            ...current,
            looks: current.looks.map((item) =>
              lookKeyOf(item) === key
                ? { ...item, vote, reasons: vote === "dislike" ? reasons : [] }
                : item,
            ),
          },
      )
      return { previous }
    },
    onError: (failure, _variables, context) => {
      queryClient.setQueryData(["looks"], context?.previous)
      sileo.error({ title: failure.message })
    },
  })
  const toggleLike = (look: Look) =>
    vote.mutate({ look, vote: look.vote === "like" ? null : "like" })
  // Rejecting asks why first; taking the rejection back needs no question
  const toggleDislike = (look: Look) =>
    look.vote === "dislike"
      ? vote.mutate({ look, vote: null })
      : setDisliking(look)

  const remove = useMutation({
    mutationFn: async (optionId: string) =>
      readJson(await fetch(`/api/looks/${optionId}`, { method: "DELETE" })),
    onSuccess: () => {
      sileo.success({ title: t("looks.deleted") })
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["looks"] }),
        queryClient.invalidateQueries({ queryKey: ["tryon-look"] }),
      ])
    },
    onError: (failure) => sileo.error({ title: failure.message }),
  })

  const { data, isPending, error } = useQuery({
    queryKey: ["looks"],
    queryFn: () => fetch("/api/looks").then((r) => readJson<LooksResponse>(r)),
  })

  const looks = useMemo(() => uniqueLooks(data?.looks ?? []), [data])

  // Garments that appear in at least one look, for the filter
  const garments = useMemo(() => {
    const byId = new Map<string, Garment>()
    for (const look of looks)
      for (const item of look.garments) byId.set(item.id, item)
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [looks])

  const query = search.trim().toLowerCase()
  const visible = looks.filter((look) => {
    if (onlyLiked && look.vote !== "like") return false
    if (hideDisliked && look.vote === "dislike") return false
    if (images === "generated" && !look.imageUrl) return false
    if (images === "pending" && look.imageUrl) return false
    // Several garments widen the search: any look wearing one of them shows
    if (
      selectedGarments.length > 0 &&
      !look.garments.some((item) => selectedGarments.includes(item.id))
    )
      return false
    if (!query) return true
    return [
      look.title,
      look.description ?? "",
      look.request,
      ...look.garments.map((g) => g.name),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query)
  })
  const open = looks.find((look) => look.optionId === openId) ?? null

  if (isPending) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border border-[#C9B99A] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-12 md:px-12">
      <div className="mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <div>
          <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-[#6B6B6B]">
            Lookbook
          </p>
          <h1 className="font-editorial text-5xl font-light md:text-6xl">
            {t("looks.title")}
          </h1>
          <p className="mt-3 text-sm text-[#6B6B6B]">
            {t("looks.subtitle", { count: looks.length })}
          </p>
        </div>
        <PhotoCard hasPhoto={data?.photo === true} />
      </div>

      {error && <p className="mb-8 text-sm text-red-700">{error.message}</p>}

      {looks.length === 0 ? (
        <div className="py-24 text-center">
          <p className="mb-6 text-[#6B6B6B]">{t("looks.empty")}</p>
          <Link
            href="/chat"
            className="btn-fashion inline-flex items-center gap-3"
          >
            {t("looks.emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-12 space-y-4 border-b border-[#E0D9CF] pb-8">
            {/* Row 1: find looks */}
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
                <input
                  type="text"
                  placeholder={t("looks.search")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input-elegant w-full !pl-12"
                />
              </div>
              <GarmentFilter
                garments={garments}
                selected={selectedGarments}
                onChange={setSelectedGarments}
                className="w-full lg:w-[240px]"
              />
              <Select
                value={images}
                onValueChange={(value) => setImages(value as ImageFilter)}
              >
                <SelectTrigger className="w-full lg:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("looks.filterAll")}</SelectItem>
                  <SelectItem value="generated">
                    {t("looks.filterGenerated")}
                  </SelectItem>
                  <SelectItem value="pending">
                    {t("looks.filterPending")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: narrow down and act */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setOnlyLiked((value) => !value)}
                aria-pressed={onlyLiked}
                className={`inline-flex items-center justify-center gap-2 border px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors ${
                  onlyLiked
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                    : "border-[#E0D9CF] text-[#1A1A1A] hover:border-[#1A1A1A]"
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${onlyLiked ? "fill-current" : ""}`}
                />
                {t("looks.onlyLiked")}
              </button>
              <button
                onClick={() => setHideDisliked((value) => !value)}
                aria-pressed={hideDisliked}
                className={`inline-flex items-center justify-center gap-2 border px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors ${
                  hideDisliked
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                    : "border-[#E0D9CF] text-[#1A1A1A] hover:border-[#1A1A1A]"
                }`}
              >
                <ThumbsDown className="h-4 w-4" />
                {t("looks.hideDisliked")}
              </button>
              <button
                onClick={() => (picking ? stopPicking() : setPicking(true))}
                aria-pressed={picking}
                className={`inline-flex items-center justify-center gap-2 border px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors ${
                  picking
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                    : "border-[#E0D9CF] text-[#1A1A1A] hover:border-[#1A1A1A]"
                }`}
              >
                <Columns3 className="h-4 w-4" />
                {t("looks.compare")}
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="py-24 text-center text-[#6B6B6B]">
              {t("looks.noResults")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 xl:grid-cols-4">
              {visible.map((look) => {
                const isPicked = picked.includes(look.optionId)
                const full = picked.length >= MAX_COMPARED && !isPicked
                return (
                  <div
                    key={look.optionId}
                    className={`group relative ${picking && full ? "opacity-40" : ""} ${look.vote === "dislike" && !picking ? "opacity-50 transition-opacity hover:opacity-100" : ""}`}
                  >
                    {picking ? (
                      <span
                        className={`pointer-events-none absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center border ${
                          isPicked
                            ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                            : "border-[#1A1A1A]/40 bg-white/90"
                        }`}
                      >
                        {isPicked && <Check className="h-4 w-4" />}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleLike(look)}
                          aria-label={t(
                            look.vote === "like"
                              ? "looks.unlike"
                              : "looks.like",
                          )}
                          aria-pressed={look.vote === "like"}
                          title={t(
                            look.vote === "like"
                              ? "looks.unlike"
                              : "looks.like",
                          )}
                          className={`absolute left-3 top-3 z-10 bg-white/90 p-2 text-[#1A1A1A] transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
                            look.vote === "like" ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          <Heart
                            className={`h-4 w-4 ${look.vote === "like" ? "fill-current" : ""}`}
                          />
                        </button>
                        <button
                          onClick={() => toggleDislike(look)}
                          aria-label={t(
                            look.vote === "dislike"
                              ? "looks.undislike"
                              : "looks.dislike",
                          )}
                          aria-pressed={look.vote === "dislike"}
                          title={t(
                            look.vote === "dislike"
                              ? "looks.undislike"
                              : "looks.dislike",
                          )}
                          className={`absolute left-14 top-3 z-10 bg-white/90 p-2 text-[#1A1A1A] transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${
                            look.vote === "dislike"
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        >
                          <ThumbsDown
                            className={`h-4 w-4 ${look.vote === "dislike" ? "fill-current" : ""}`}
                          />
                        </button>
                        <button
                          onClick={() => setDeleting(look)}
                          aria-label={t("looks.delete")}
                          title={t("looks.delete")}
                          className="absolute right-3 top-3 z-10 bg-white/90 p-2 text-[#1A1A1A] opacity-0 transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() =>
                        picking
                          ? togglePicked(look.optionId)
                          : setOpenId(look.optionId)
                      }
                      disabled={picking && full}
                      aria-pressed={picking ? isPicked : undefined}
                      className="block w-full text-left"
                    >
                      <div
                        className={`relative mb-4 aspect-[3/4] overflow-hidden bg-[#EDE8E1] ${
                          picking && isPicked
                            ? "outline outline-2 outline-[#1A1A1A]"
                            : ""
                        }`}
                      >
                        {look.imageUrl ? (
                          <Image
                            src={look.imageUrl}
                            alt={look.title}
                            fill
                            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                            className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <GarmentCollage garments={look.garments} />
                        )}
                        {(!look.imageUrl || look.outdated) && (
                          <span className="absolute bottom-3 left-3 bg-[#1A1A1A]/70 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                            {t(
                              look.imageUrl
                                ? "looks.outdated"
                                : "looks.notGenerated",
                            )}
                          </span>
                        )}
                      </div>
                      <h3 className="mb-1 font-editorial text-lg font-light">
                        {look.title}
                      </h3>
                      <p className="line-clamp-1 text-xs text-[#6B6B6B]">
                        {look.garments.map((item) => item.name).join(" · ")}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#6B6B6B]/70">
                        {new Date(look.createdAt).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {picking && !comparing && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E0D9CF] bg-[#F8F5F0]/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 md:px-12">
            <p className="text-xs text-[#6B6B6B]">
              {t("looks.comparePick", {
                count: picked.length,
                max: MAX_COMPARED,
              })}
            </p>
            <div className="flex items-center gap-3">
              <button onClick={stopPicking} className="btn-fashion-outline">
                {t("looks.compareCancel")}
              </button>
              <button
                onClick={() => setComparing(true)}
                disabled={picked.length < 2}
                className="btn-fashion disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("looks.compare")}
              </button>
            </div>
          </div>
        </div>
      )}

      {comparing && (
        <LookCompare
          // In the order they were picked
          looks={picked
            .map((id) => looks.find((look) => look.optionId === id))
            .filter((look): look is Look => look !== undefined)}
          onClose={() => setComparing(false)}
          onOpen={(look) => setOpenId(look.optionId)}
          onToggleLike={toggleLike}
        />
      )}

      {open && (
        <LookDialog
          look={open}
          onClose={() => setOpenId(null)}
          onDelete={() => setDeleting(open)}
          onToggleLike={() => toggleLike(open)}
          onToggleDislike={() => toggleDislike(open)}
        />
      )}

      <DislikeDialog
        lookTitle={disliking?.title ?? null}
        onCancel={() => setDisliking(null)}
        onConfirm={(reasons) => {
          if (disliking)
            vote.mutate({ look: disliking, vote: "dislike", reasons })
          setDisliking(null)
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("looks.deleteTitle")}
        description={t("looks.deleteDescription", {
          name: deleting?.title ?? "",
        })}
        confirmLabel={t("looks.delete")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.optionId)
          setDeleting(null)
          setOpenId(null)
        }}
      />
    </div>
  )
}

function LookDialog({
  look,
  onClose,
  onDelete,
  onToggleLike,
  onToggleDislike,
}: {
  look: Look
  onClose: () => void
  onDelete: () => void
  onToggleLike: () => void
  onToggleDislike: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1A1A1A]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={look.title}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto bg-white p-6 md:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h2 className="font-editorial text-2xl font-light">{look.title}</h2>
            {look.description && (
              <p className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
                {look.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("looks.close")}
            className="p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Leaves room for the title, garments and actions: no scrolling */}
        <OutfitTryOn optionId={look.optionId} maxHeight="calc(92vh - 24rem)" />

        <div className="mt-6 flex flex-wrap gap-2">
          {look.garments.map((item) => (
            <span key={item.id} className="bg-[#EDE8E1] px-3 py-1.5 text-xs">
              {item.name}
            </span>
          ))}
        </div>
        {look.request && (
          <p className="mt-4 text-xs text-[#6B6B6B]">
            {t("looks.requested")}: “{look.request}”
          </p>
        )}
        <div className="mt-6 flex items-center gap-6 text-xs text-[#6B6B6B]">
          <button
            onClick={onToggleLike}
            aria-pressed={look.vote === "like"}
            className={`inline-flex items-center gap-1.5 underline-offset-4 hover:underline ${
              look.vote === "like" ? "text-[#1A1A1A]" : "hover:text-[#1A1A1A]"
            }`}
          >
            <Heart
              className={`h-3 w-3 ${look.vote === "like" ? "fill-current" : ""}`}
            />
            {t(look.vote === "like" ? "looks.unlike" : "looks.like")}
          </button>
          <button
            onClick={onToggleDislike}
            aria-pressed={look.vote === "dislike"}
            className={`inline-flex items-center gap-1.5 underline-offset-4 hover:underline ${
              look.vote === "dislike"
                ? "text-[#1A1A1A]"
                : "hover:text-[#1A1A1A]"
            }`}
          >
            <ThumbsDown
              className={`h-3 w-3 ${look.vote === "dislike" ? "fill-current" : ""}`}
            />
            {t(look.vote === "dislike" ? "looks.undislike" : "looks.dislike")}
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-[#1A1A1A] hover:underline"
          >
            <Trash2 className="h-3 w-3" />
            {t("looks.delete")}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The user's try-on photo, with the actions to replace or delete it. */
function PhotoCard({ hasPhoto }: { hasPhoto: boolean }) {
  const { t } = useTranslation()
  const fileInput = useRef<HTMLInputElement>(null)
  const [version, setVersion] = useState(0)
  const { upload, remove, busy } = useTryOnPhoto(() =>
    setVersion((value) => value + 1),
  )
  const failure = upload.error ?? remove.error
  const [confirming, setConfirming] = useState<TryOnAction | null>(null)
  const [consenting, setConsenting] = useState(false)
  const pick = useCropPick()

  return (
    <div className="flex items-center gap-4 self-start border border-[#E0D9CF] bg-white p-3 md:self-auto">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) pick.choose(file)
        }}
      />
      <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-[#EDE8E1]">
        {hasPhoto ? (
          <Image
            key={version}
            src={`/api/tryon/photo?v=${version}`}
            alt={t("tryon.photoAlt")}
            fill
            sizes="64px"
            className="object-cover object-top"
          />
        ) : (
          <ImagePlus className="absolute inset-0 m-auto h-5 w-5 text-[#C9B99A]" />
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-4 w-4 animate-spin text-[#1A1A1A]" />
          </div>
        )}
      </div>
      <div className="max-w-[230px] space-y-2 text-xs">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B6B6B]">
          {t("looks.photoTitle")}
        </p>
        <p className="leading-relaxed text-[#6B6B6B]">
          {failure
            ? failure.message
            : t(hasPhoto ? "looks.photoHint" : "looks.photoMissing")}
        </p>
        <div className="flex items-center gap-4">
          <button
            // Replacing a photo asks first; a first upload replaces nothing
            onClick={() =>
              hasPhoto ? setConfirming("change") : setConsenting(true)
            }
            disabled={busy}
            className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            {t(hasPhoto ? "tryon.changePhoto" : "tryon.uploadCta")}
          </button>
          {hasPhoto && (
            <button
              onClick={() => setConfirming("delete")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              {t("tryon.deletePhoto")}
            </button>
          )}
        </div>
      </div>
      <TryOnConfirm
        action={confirming}
        onCancel={() => setConfirming(null)}
        onConfirm={(action) => {
          setConfirming(null)
          if (action === "delete") remove.mutate()
          else setConsenting(true)
        }}
      />
      <PhotoConsentDialog
        open={consenting}
        onCancel={() => setConsenting(false)}
        onAccept={() => {
          setConsenting(false)
          fileInput.current?.click()
        }}
      />
      <ImageCropDialog
        picked={pick.picked}
        title={t("crop.photoTitle")}
        hint={t("crop.photoHint")}
        aspects={PHOTO_ASPECTS}
        maxSide={CROP_MAX_SIDE}
        onCancel={pick.clear}
        onConfirm={(image) => {
          pick.clear()
          upload.mutate(image)
        }}
      />
    </div>
  )
}
