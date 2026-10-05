import type { CropAspect } from "@/components/ui/image-crop-dialog"

/** The user's own photo: portrait, since it is for trying clothes on a body. */
export const PHOTO_ASPECTS: CropAspect[] = [
  { id: "2:3", ratio: 2 / 3, label: "crop.portrait23" },
  { id: "3:4", ratio: 3 / 4, label: "crop.portrait34" },
  { id: "free", ratio: undefined, label: "crop.free" },
]

/** Closet cards are 3:4, so that is the default; shoes and accessories may want 1:1. */
export const GARMENT_ASPECTS: CropAspect[] = [
  { id: "3:4", ratio: 3 / 4, label: "crop.portrait34" },
  { id: "1:1", ratio: 1, label: "crop.square" },
  { id: "free", ratio: undefined, label: "crop.free" },
]

/** Longest side of the cropped image sent to the server. */
export const CROP_MAX_SIDE = 1600
