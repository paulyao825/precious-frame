import type { FrameScorer } from "./frameScorer.js";
import type { Frame, FrameQuality } from "../domain/types.js";
import { analyzeImage, imageSignature, signatureSimilarity, sharpnessScore } from "../media/analysis.js";

/**
 * Real fast frame scorer: pure pixel statistics via sharp — no model
 * call, so Loop 1's reward returns in milliseconds per frame.
 */
export class RealFrameScorer implements FrameScorer {
  private readonly qualityCache = new Map<string, FrameQuality>();
  private readonly sigCache = new Map<string, Float32Array>();

  async score(frame: Frame): Promise<FrameQuality> {
    const hit = this.qualityCache.get(frame.id);
    if (hit) return hit;
    const s = await analyzeImage(frame.uri);
    const sharpness = sharpnessScore(s.laplacianVariance) / 10;
    const q: FrameQuality = {
      sharpness,
      exposure: Math.max(
        0,
        1 - Math.abs(s.meanLuma - 0.5) * 2.2 - s.clippedShadows * 2 - s.clippedHighlights * 2,
      ),
      interest: Math.min(1, s.edgeEnergy * 12),
      blurRisk: Math.max(0, (0.42 - sharpness) / 0.42),
    };
    this.qualityCache.set(frame.id, q);
    return q;
  }

  async similarity(a: Frame, b: Frame): Promise<number> {
    const [sa, sb] = await Promise.all([this.signature(a), this.signature(b)]);
    return signatureSimilarity(sa, sb);
  }

  private async signature(f: Frame): Promise<Float32Array> {
    let sig = this.sigCache.get(f.id);
    if (!sig) {
      sig = await imageSignature(f.uri);
      this.sigCache.set(f.id, sig);
    }
    return sig;
  }
}
