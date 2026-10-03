/**
 * T-pose calibration: resolves axis conventions and metric scale of the
 * MediaPipe world-landmark space into the canonical VTO space.
 *
 * The user holds a T-pose for ~1.5 s; samples are averaged and used to build
 * an orthonormal basis (X = shoulder line, Y = hip->head, Z = X x Y).
 */
import { JointResolver } from "./skeleton"
import { averagePoseSamples } from "./coords"
import type { Calibration, Vec3 } from "./types"

export const DEFAULT_HFOV_DEG = 65
export const RECOMMENDED_SAMPLES = 30

/** Vertical FOV for the render camera derived from the captured video aspect. */
export function estimateFovY(
  videoWidth: number,
  videoHeight: number,
  hfovDeg: number = DEFAULT_HFOV_DEG
): number {
  if (videoWidth <= 0 || videoHeight <= 0) return (50 * Math.PI) / 180
  const aspect = videoWidth / videoHeight
  const hfov = (hfovDeg * Math.PI) / 180
  return 2 * Math.atan(Math.tan(hfov / 2) / aspect)
}

export function identityCalibration(fovY: number): Calibration {
  return {
    valid: false,
    m: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    scale: 1,
    originX: 0,
    originY: 0,
    originZ: 0,
    fovY,
  }
}

/** Plausibility checks for a world-landmark pose (metric units, meters). */
export function poseLooksSane(world: Float32Array): boolean {
  const visibility = (i: number) => world[i * 4 + 3]
  const keyLandmarks = [0, 7, 8, 11, 12, 23, 24]
  const visAvg =
    keyLandmarks.reduce((acc, i) => acc + visibility(i), 0) / keyLandmarks.length
  if (visAvg < 0.5) return false

  const dist = (a: number, b: number) => {
    const dx = world[a * 4] - world[b * 4]
    const dy = world[a * 4 + 1] - world[b * 4 + 1]
    const dz = world[a * 4 + 2] - world[b * 4 + 2]
    return Math.hypot(dx, dy, dz)
  }

  const shoulderWidth = dist(11, 12)
  const torso = dist(11, 23)
  if (shoulderWidth < 0.18 || shoulderWidth > 0.75) return false
  if (torso < 0.25 || torso > 1.2) return false
  return true
}

interface Basis {
  x: [number, number, number]
  y: [number, number, number]
  z: [number, number, number]
}

function buildBasis(
  shoulderL: Vec3,
  shoulderR: Vec3,
  hip: Vec3,
  ear: Vec3,
  mirrorX: boolean
): Basis | null {
  let x: [number, number, number] = [
    shoulderR.x - shoulderL.x,
    shoulderR.y - shoulderL.y,
    shoulderR.z - shoulderL.z,
  ]
  let y: [number, number, number] = [ear.x - hip.x, ear.y - hip.y, ear.z - hip.z]

  const lenX = Math.hypot(...x)
  const lenY = Math.hypot(...y)
  if (lenX < 1e-6 || lenY < 1e-6) return null
  x = [x[0] / lenX, x[1] / lenX, x[2] / lenX]
  y = [y[0] / lenY, y[1] / lenY, y[2] / lenY]

  // Z = X x Y
  let z: [number, number, number] = [
    x[1] * y[2] - x[2] * y[1],
    x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0],
  ]
  const lenZ = Math.hypot(...z)
  if (lenZ < 1e-6) return null
  z = [z[0] / lenZ, z[1] / lenZ, z[2] / lenZ]

  // Re-orthogonalize X = Y x Z
  x = [
    y[1] * z[2] - y[2] * z[1],
    y[2] * z[0] - y[0] * z[2],
    y[0] * z[1] - y[1] * z[0],
  ]

  if (mirrorX) x = [-x[0], -x[1], -x[2]]

  return { x, y, z }
}

/**
 * Builds a calibration from averaged T-pose world landmarks.
 * Returns an invalid (identity) calibration when the pose is not usable.
 */
export function buildCalibrationFromWorld(
  avgWorld: Float32Array,
  resolver: JointResolver,
  fovY: number,
  mirrorX = false
): Calibration {
  if (!poseLooksSane(avgWorld)) {
    return identityCalibration(fovY)
  }

  const joints = JointResolver.createOutput()
  resolver.resolve(avgWorld, joints)

  const hip = joints.get("hip_center")!
  const ear = joints.get("ear_center")!
  const shoulderL = joints.get("shoulder_l")!
  const shoulderR = joints.get("shoulder_r")!

  const basis = buildBasis(shoulderL, shoulderR, hip, ear, mirrorX)
  if (!basis) return identityCalibration(fovY)

  // M rows = basis vectors: canonical = M * (world - origin)
  return {
    valid: true,
    m: [
      basis.x[0], basis.x[1], basis.x[2],
      basis.y[0], basis.y[1], basis.y[2],
      basis.z[0], basis.z[1], basis.z[2],
    ],
    scale: 1,
    originX: 0,
    originY: 0,
    originZ: 0,
    fovY,
  }
}

/**
 * Builds a calibration from raw T-pose samples.
 * Returns null when there are not enough valid samples.
 */
export function calibrateFromSamples(
  samples: Float32Array[],
  resolver: JointResolver,
  fovY: number,
  mirrorX = false
): Calibration | null {
  const valid = samples.filter(poseLooksSane)
  if (valid.length < RECOMMENDED_SAMPLES * 0.5) return null
  const avg = averagePoseSamples(valid, new Float32Array(valid[0].length))
  const cal = buildCalibrationFromWorld(avg, resolver, fovY, mirrorX)
  return cal.valid ? cal : null
}

export interface CalibrationGathererOptions {
  maxSamples?: number
  mirrorX?: boolean
  /** Max collection attempts before giving up. */
  maxAttempts?: number
}

/**
 * Silently collects sane poses and produces a calibration once enough samples
 * are available. Works with any standing pose (the basis only needs the
 * shoulder line and the hip->head axis, not a strict T-pose).
 */
export class CalibrationGatherer {
  private samples: Float32Array[] = []
  private result: Calibration | null = null
  private attempts = 0
  private readonly maxSamples: number
  private readonly maxAttempts: number
  private readonly mirrorX: boolean

  constructor(
    private readonly resolver: JointResolver,
    private readonly fovYProvider: () => number,
    options: CalibrationGathererOptions = {}
  ) {
    this.maxSamples = options.maxSamples ?? 24
    this.maxAttempts = options.maxAttempts ?? 5
    this.mirrorX = options.mirrorX ?? false
  }

  get calibration(): Calibration | null {
    return this.result
  }

  get isCollecting(): boolean {
    return this.result === null && this.samples.length > 0
  }

  get progress(): number {
    return Math.min(1, this.samples.length / this.maxSamples)
  }

  /** Feed a world-landmark buffer (copied internally). */
  push(world: Float32Array): void {
    if (this.result || this.attempts >= this.maxAttempts) return
    if (this.samples.length >= this.maxSamples) return
    if (!poseLooksSane(world)) return

    this.samples.push(new Float32Array(world))

    if (this.samples.length >= this.maxSamples) {
      const calibration = calibrateFromSamples(
        this.samples,
        this.resolver,
        this.fovYProvider(),
        this.mirrorX
      )
      if (calibration) {
        this.result = calibration
        this.samples = []
      } else {
        this.attempts += 1
        this.samples = []
      }
    }
  }

  reset(): void {
    this.samples = []
    this.result = null
    this.attempts = 0
  }
}
