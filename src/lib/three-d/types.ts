export interface Generate3DResult {
  modelUrl: string
  taskId: string
  provider: string
  /** Task id del modelo base (antes de retextura), si aplica */
  baseTaskId?: string
}

export interface GarmentMeta {
  name?: string
  category?: string
  color?: string
  material?: string
  brand?: string
  season?: string
}

export interface ImageInput {
  url?: string
  buffer?: Buffer
  filename?: string
  contentType?: string
  meta?: GarmentMeta
}

export interface ImageTo3DProvider {
  name: string
  isAvailable(): boolean
  generate(input: ImageInput | string): Promise<Generate3DResult>
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
