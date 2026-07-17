import sharp from "sharp";

/** Pixel-level stats used by the real frame scorer and heuristic judge. */
export interface ImageStats {
  /** Mean luma 0..1. */
  meanLuma: number;
  /** Std deviation of luma 0..1 — global contrast proxy. */
  lumaStd: number;
  /** Fraction of pixels crushed to black / blown to white. */
  clippedShadows: number;
  clippedHighlights: number;
  /** Mean chroma 0..1 — colorfulness / saturation proxy. */
  meanChroma: number;
  /** Red-minus-blue channel imbalance, -1..1 (+ = warm cast). */
  warmth: number;
  /** Variance of a 3x3 laplacian — classic sharpness proxy. */
  laplacianVariance: number;
  /** Edge-energy centroid, normalized 0..1 (saliency proxy). */
  centroidX: number;
  centroidY: number;
  /** Fraction of edge energy inside the central 50% window. */
  centerConcentration: number;
  /** Total edge energy per pixel — "how much is going on". */
  edgeEnergy: number;
}

const ANALYSIS_WIDTH = 160;

export async function analyzeImage(input: string | Buffer): Promise<ImageStats> {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .resize({ width: ANALYSIS_WIDTH })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const n = w * h;

  // Color pass: luma buffer + exposure/chroma/warmth stats.
  const luma = new Float32Array(n);
  let sum = 0;
  let sumSq = 0;
  let shadows = 0;
  let highlights = 0;
  let chromaSum = 0;
  let rSum = 0;
  let bSum = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 3]!;
    const g = data[i * 3 + 1]!;
    const b = data[i * 3 + 2]!;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = y;
    sum += y;
    sumSq += y * y;
    if (y <= 8) shadows++;
    if (y >= 247) highlights++;
    chromaSum += Math.max(r, g, b) - Math.min(r, g, b);
    rSum += r;
    bSum += b;
  }
  const meanLuma = sum / n / 255;
  const lumaStd = Math.sqrt(Math.max(0, sumSq / n - (sum / n) ** 2)) / 255;

  // Laplacian + edge-energy map in one pass over the luma buffer.
  let lapSum = 0;
  let lapSqSum = 0;
  let energyTotal = 0;
  let energyX = 0;
  let energyY = 0;
  let energyCenter = 0;
  const x0 = w * 0.25;
  const x1 = w * 0.75;
  const y0 = h * 0.25;
  const y1 = h * 0.75;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * luma[i]! - luma[i - 1]! - luma[i + 1]! - luma[i - w]! - luma[i + w]!;
      lapSum += lap;
      lapSqSum += lap * lap;
      const e = Math.abs(lap);
      energyTotal += e;
      energyX += e * x;
      energyY += e * y;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) energyCenter += e;
    }
  }
  const m = (w - 2) * (h - 2);
  const lapMean = lapSum / m;
  const laplacianVariance = lapSqSum / m - lapMean * lapMean;

  const safeEnergy = Math.max(energyTotal, 1e-6);
  return {
    meanLuma,
    lumaStd,
    clippedShadows: shadows / n,
    clippedHighlights: highlights / n,
    meanChroma: chromaSum / n / 255,
    warmth: (rSum - bSum) / n / 255,
    laplacianVariance,
    centroidX: energyX / safeEnergy / w,
    centroidY: energyY / safeEnergy / h,
    centerConcentration: energyCenter / safeEnergy,
    edgeEnergy: energyTotal / m / 255,
  };
}

/** Tiny grayscale signature for perceptual frame similarity. */
export async function imageSignature(input: string | Buffer, size = 12): Promise<Float32Array> {
  const { data } = await sharp(input)
    .grayscale()
    .resize(size, size, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sig = new Float32Array(size * size);
  for (let i = 0; i < sig.length; i++) sig[i] = data[i]! / 255;
  return sig;
}

/** Similarity 0..1 from mean absolute difference of signatures. */
export function signatureSimilarity(a: Float32Array, b: Float32Array): number {
  let mad = 0;
  for (let i = 0; i < a.length; i++) mad += Math.abs(a[i]! - b[i]!);
  mad /= a.length;
  // MAD 0 -> identical (1.0); MAD >= 0.25 -> unrelated (~0).
  return Math.max(0, 1 - mad / 0.25);
}

/** Map laplacian variance to a 0..10 sharpness score (log scale). */
export function sharpnessScore(laplacianVariance: number): number {
  const lv = Math.log10(laplacianVariance + 1);
  return Math.max(0, Math.min(10, ((lv - 0.6) / (3.1 - 0.6)) * 10));
}
