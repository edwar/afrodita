"use client"

import { useState, useRef, useCallback } from "react"
import { X, Upload, Loader2 } from "lucide-react"
import { sileo } from "sileo"
import { WARDROBE_CATEGORIES, WARDROBE_COLORS, WARDROBE_SEASONS } from "@/lib/constants"
import { useTranslation } from "@/lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageCropDialog, useCropPick } from "@/components/ui/image-crop-dialog"
import { CROP_MAX_SIDE, GARMENT_ASPECTS } from "@/components/tryon/crop-presets"

interface WardrobeItem {
  id: string
  name: string
  category: string
  color: string
  material?: string
  brand?: string
  season?: string
  imageUrl: string
}

interface WardrobeFormProps {
  item?: WardrobeItem | null
  onClose: () => void
  onSubmit: (data: Omit<WardrobeItem, "id">) => void
}

export function WardrobeForm({ item, onClose, onSubmit }: WardrobeFormProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: item?.name || "",
    category: item?.category || "camisa",
    color: item?.color || "negro",
    material: item?.material || "",
    brand: item?.brand || "",
    season: item?.season || "todo",
    imageUrl: item?.imageUrl || "",
  })

  const pick = useCropPick()
  const { choose } = pick

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body })
      const data = await res.json().catch(() => ({}))
      // The server says why (no plan, monthly cap, too big...): show it
      if (!res.ok) throw new Error(data?.error || t("wardrobe.form.uploadError"))
      setFormData((prev) => ({ ...prev, imageUrl: data.imageUrl }))
    } catch (error) {
      console.error("Error uploading:", error)
      sileo.error({
        title:
          error instanceof Error ? error.message : t("wardrobe.form.uploadError"),
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith("image/")) {
        choose(file)
      }
    }
  }, [choose])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith("image/")) {
        choose(file)
      }
    }
    // Lets the same file be chosen again after cancelling
    e.target.value = ""
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <>
    <div className="fixed inset-0 bg-[#1A1A1A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#F8F5F0] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E0D9CF]">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-1">
              {item ? t("wardrobe.form.edit") : t("wardrobe.form.new")}
            </p>
            <h2 className="font-editorial text-2xl font-light">
              {item ? t("wardrobe.form.edit") : t("wardrobe.form.new")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#EDE8E1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Row 1: Name + Category */}
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                {t("wardrobe.form.name")} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t("wardrobe.form.namePlaceholder")}
                className="input-elegant w-full"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                {t("wardrobe.form.category")} *
              </label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("wardrobe.form.category")} />
                </SelectTrigger>
                <SelectContent>
                  {WARDROBE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {t(`categories.${cat.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: Color + Material */}
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                {t("wardrobe.form.color")} *
              </label>
              <Select
                value={formData.color}
                onValueChange={(value) =>
                  setFormData({ ...formData, color: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("wardrobe.form.color")} />
                </SelectTrigger>
                <SelectContent>
                  {WARDROBE_COLORS.map((col) => (
                    <SelectItem key={col.value} value={col.value}>
                      {t(`colors.${col.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                {t("wardrobe.form.material")}
              </label>
              <input
                type="text"
                value={formData.material}
                onChange={(e) =>
                  setFormData({ ...formData, material: e.target.value })
                }
                placeholder={t("wardrobe.form.materialPlaceholder")}
                className="input-elegant w-full"
              />
            </div>

            {/* Row 3: Brand + Season */}
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                {t("wardrobe.form.brand")}
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) =>
                  setFormData({ ...formData, brand: e.target.value })
                }
                placeholder={t("wardrobe.form.brandPlaceholder")}
                className="input-elegant w-full"
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                {t("wardrobe.form.season")}
              </label>
              <Select
                value={formData.season}
                onValueChange={(value) =>
                  setFormData({ ...formData, season: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("wardrobe.form.season")} />
                </SelectTrigger>
                <SelectContent>
                  {WARDROBE_SEASONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {t(`seasons.${s.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Upload - Full width */}
            <div className="md:col-span-2">
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">
                {t("wardrobe.form.imageUrl")} *
              </label>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {formData.imageUrl ? (
                <div className="relative">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-64 object-cover bg-[#EDE8E1]"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imageUrl: "" })}
                    className="absolute top-2 right-2 p-2 bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`w-full h-48 border-2 border-dashed flex flex-col items-center justify-center transition-colors ${
                    isUploading
                      ? "border-[#C9B99A] bg-[#C9B99A]/5 cursor-wait"
                      : isDragging
                        ? "border-[#1A1A1A] bg-[#EDE8E1] cursor-pointer"
                        : "border-[#E0D9CF] hover:border-[#6B6B6B] hover:bg-[#EDE8E1]/50 cursor-pointer"
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-8 h-8 text-[#C9B99A] mb-3 animate-spin" />
                      <p className="text-sm text-[#6B6B6B] mb-1">
                        {t("wardrobe.form.uploading") || "Subiendo imagen..."}
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-[#6B6B6B] mb-3" />
                      <p className="text-sm text-[#6B6B6B] mb-1">
                        {t("wardrobe.form.dragDrop")}
                      </p>
                      <p className="text-xs text-[#6B6B6B]/60">
                        {t("wardrobe.form.orClick")}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 mt-6 border-t border-[#E0D9CF]">
            <button
              type="button"
              onClick={onClose}
              className="btn-fashion-outline flex-1"
            >
              {t("wardrobe.form.cancel")}
            </button>
            <button
              type="submit"
              className="btn-fashion flex-1"
            >
              {item ? t("wardrobe.form.save") : t("wardrobe.form.add")}
            </button>
          </div>
        </form>
      </div>
    </div>
    <ImageCropDialog
      picked={pick.picked}
      title={t("crop.garmentTitle")}
      hint={t("crop.garmentHint")}
      aspects={GARMENT_ASPECTS}
      maxSide={CROP_MAX_SIDE}
      onCancel={pick.clear}
      onConfirm={(image) => {
        pick.clear()
        uploadFile(
          image instanceof File
            ? image
            : new File([image], "prenda.jpg", { type: "image/jpeg" }),
        )
      }}
    />
    </>
  )
}
