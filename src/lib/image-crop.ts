/**
 * Arithmetic of cropping an image shown smaller than it really is.
 * Pure, so it can be tested without a browser.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/**
 * Turns a crop drawn over the DISPLAYED image into the matching rectangle of
 * the real image, in whole pixels and never outside it.
 */
export function toSourceRect(crop: Rect, displayed: Size, natural: Size): Rect {
  const scaleX = natural.width / displayed.width
  const scaleY = natural.height / displayed.height
  const x = Math.min(Math.max(Math.round(crop.x * scaleX), 0), natural.width - 1)
  const y = Math.min(Math.max(Math.round(crop.y * scaleY), 0), natural.height - 1)
  const width = Math.min(Math.max(Math.round(crop.width * scaleX), 1), natural.width - x)
  const height = Math.min(Math.max(Math.round(crop.height * scaleY), 1), natural.height - y)
  return { x, y, width, height }
}

/** The whole image, for "use without cropping". */
export function fullRect(natural: Size): Rect {
  return { x: 0, y: 0, width: natural.width, height: natural.height }
}

/**
 * Size of the exported image: the crop scaled down so its longest side fits
 * `maxSide`. Never scaled up, which would only blur it.
 */
export function outputSize(rect: Size, maxSide: number): Size {
  const scale = Math.min(1, maxSide / Math.max(rect.width, rect.height))
  return {
    width: Math.max(1, Math.round(rect.width * scale)),
    height: Math.max(1, Math.round(rect.height * scale)),
  }
}
