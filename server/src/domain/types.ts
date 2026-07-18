/** A frame extracted from the uploaded video. */
export interface Frame {
  id: string;
  /** Timestamp in the source video, seconds. */
  t: number;
  /** Path/URL to the frame image (mock frames use a fake path). */
  uri: string;
}

/** Normalized crop rect, all values 0..1 relative to the source frame. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The ENTIRE edit space — bounded and named. Every parameter has a hard
 * range and one judge axis that can move it. Nothing else is editable.
 */
export interface Recipe {
  /** Crop window (also zoom: smaller window = punch in). */
  crop: CropRect;
  /** Exposure adjustment in EV, clamped to [-2, +2]. */
  exposureEv: number;
  /** Contrast multiplier around midtones, [0.6, 1.6], 1 = neutral. */
  contrast: number;
  /** Saturation multiplier, [0.4, 1.8], 1 = neutral. */
  saturation: number;
  /** White balance, [-1 cool, +1 warm], 0 = neutral. */
  temperature: number;
  /** Output sharpening amount, [0, 1], 0 = none. */
  sharpen: number;
}

export interface EditedImage {
  frameId: string;
  uri: string;
  recipe: Recipe;
  /** Which editor backend produced it — shown in the UI. */
  backend: string;
}

/** Fast per-frame quality signal (Loop 1's observe path). */
export interface FrameQuality {
  sharpness: number; // 0..1
  exposure: number;  // 0..1 (1 = well exposed, no clipping)
  interest: number;  // 0..1 (edge energy / something happening)
  /** Vision-model score for composition, human moment, and storytelling. */
  aesthetic?: number; // 0..1
}

export function frameQualityScore(q: FrameQuality): number {
  if (q.aesthetic !== undefined) {
    return 10 * (0.2 * q.sharpness + 0.15 * q.exposure + 0.1 * q.interest + 0.55 * q.aesthetic);
  }
  return 10 * (0.45 * q.sharpness + 0.35 * q.exposure + 0.2 * q.interest);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function defaultRecipe(): Recipe {
  return {
    crop: { x: 0, y: 0, w: 1, h: 1 },
    exposureEv: 0,
    contrast: 1,
    saturation: 1,
    temperature: 0,
    sharpen: 0,
  };
}

export const RECIPE_BOUNDS = {
  exposureEv: [-2, 2],
  contrast: [0.6, 1.6],
  saturation: [0.4, 1.8],
  temperature: [-1, 1],
  sharpen: [0, 1],
  minCropSize: 0.2,
} as const;
