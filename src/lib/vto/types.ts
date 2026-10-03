/**
 * Shared types for the Virtual Try-On runtime.
 *
 * Pose data travels between the worker and the main thread as flat
 * Float32Arrays to avoid per-frame object allocation and structured-clone cost.
 */

export const LANDMARK_COUNT = 33
/** Floats per landmark stored in pose buffers: x, y, z, visibility */
export const POSE_STRIDE = 4

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface PoseFrame {
  tsMs: number
  /** Normalized image-space landmarks (x, y in [0,1], z relative depth). */
  landmarks: Float32Array
  /** Metric world landmarks in meters (MediaPipe origin: hip center). */
  world: Float32Array
}

/** A calibrated orthonormal basis + scale mapping world landmarks to Three.js space. */
export interface Calibration {
  valid: boolean
  /** Row-major 3x3 rotation. Canonical = scale * M * (world - origin). */
  m: [number, number, number, number, number, number, number, number, number]
  scale: number
  originX: number
  originY: number
  originZ: number
  /** Vertical field of view of the render camera, radians. */
  fovY: number
}

export type QualityTier = "high" | "medium" | "low"

export type PoseWorkerInbound =
  | { type: "init"; wasmPath: string; modelPath: string; delegate: "GPU" | "CPU" }
  | { type: "detect"; bitmap: ImageBitmap; frameId: number; tsMs: number }

export type PoseWorkerOutbound =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "error"; stage: "init" | "detect"; message: string }
  | {
      type: "pose"
      frameId: number
      tsMs: number
      landmarks: Float32Array | null
      world: Float32Array | null
    }
