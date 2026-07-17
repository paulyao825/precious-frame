import type { Critique } from "../core/loop.js";
import type { EditedImage } from "../domain/types.js";
import type { MockWorld } from "../mock/world.js";
import { clamp } from "../domain/types.js";

/**
 * Vision-model judge for Loop 2. Scores on CONCRETE axes only —
 * structured output, never vague beauty. Implementations: pixel
 * heuristics (judge.heuristic.ts), LLM providers (judge.llm.ts), mock.
 */
export interface VisionJudge {
  critique(image: EditedImage): Promise<Critique>;
}

/**
 * Wraps an LLM judge with the heuristic judge as a live fallback: the
 * first provider failure (bad key, quota, network) flips the run over to
 * heuristics permanently instead of killing the demo.
 */
export class ResilientJudge implements VisionJudge {
  private failedOver = false;

  constructor(
    private readonly primary: VisionJudge,
    private readonly fallback: VisionJudge,
    private readonly onFallback: (err: unknown) => void,
  ) {}

  async critique(image: EditedImage): Promise<Critique> {
    if (!this.failedOver) {
      try {
        return await this.primary.critique(image);
      } catch (err) {
        this.failedOver = true;
        this.onFallback(err);
      }
    }
    return this.fallback.critique(image);
  }
}

/**
 * Mock judge: compares the applied recipe against the frame's hidden
 * ideal. Reasons carry a direction hint (never a magnitude) — exactly
 * the kind of signal a real vision judge gives ("subject sits left of
 * center"), so correct() logic transfers unchanged to the real judge.
 */
export class MockVisionJudge implements VisionJudge {
  constructor(private readonly world: MockWorld) {}

  async critique(image: EditedImage): Promise<Critique> {
    const truth = this.world.truth(image.frameId);
    const { crop, exposureEv } = image.recipe;
    const ideal = truth.idealCrop;

    // --- cropFraming ---
    const cx = crop.x + crop.w / 2 - (ideal.x + ideal.w / 2);
    const cy = crop.y + crop.h / 2 - (ideal.y + ideal.h / 2);
    const dSize = crop.w * crop.h - ideal.w * ideal.h; // >0 = too wide
    const centerErr = Math.hypot(cx, cy);
    const cropScore = clamp(10 - centerErr * 14 - Math.abs(dSize) * 10, 0, 10);
    let cropReason = "subject well framed";
    let cropHint = "none";
    if (Math.abs(dSize) > Math.max(0.08, centerErr)) {
      cropHint = dSize > 0 ? "tighten" : "loosen";
      cropReason = dSize > 0 ? "crop too wide, subject reads small" : "crop too tight, subject clipped";
    } else if (centerErr > 0.05) {
      cropHint = Math.abs(cx) >= Math.abs(cy) ? (cx > 0 ? "shift-left" : "shift-right") : cy > 0 ? "shift-up" : "shift-down";
      cropReason = `subject off-center (${cropHint.replace("shift-", "needs ")})`;
    }

    // --- exposure ---
    const evErr = exposureEv - truth.idealExposureEv;
    const expScore = clamp(10 - Math.abs(evErr) * 4.5, 0, 10);
    const expHint = Math.abs(evErr) < 0.15 ? "none" : evErr < 0 ? "brighten" : "darken";
    const expReason =
      expHint === "none" ? "exposure balanced" : evErr < 0 ? "underexposed, shadows crushed" : "overexposed, highlights blown";

    // --- sharpness ---
    // Over-tight crops force upscaling and cost apparent sharpness.
    const cropArea = crop.w * crop.h;
    const upscalePenalty = cropArea < 0.3 ? (0.3 - cropArea) * 12 : 0;
    const sharpScore = clamp(truth.quality.sharpness * 10 - upscalePenalty, 0, 10);
    const sharpHint = upscalePenalty > 0.5 ? "loosen" : "none";
    const sharpReason =
      upscalePenalty > 0.5
        ? "crop so tight the upscale looks soft"
        : truth.quality.sharpness > 0.75
          ? "crisp detail"
          : "some motion softness in source frame";

    return {
      cropFraming: { score: r1(cropScore), reason: cropReason, hint: cropHint },
      exposure: { score: r1(expScore), reason: expReason, hint: expHint },
      sharpness: { score: r1(sharpScore), reason: sharpReason, hint: sharpHint },
    };
  }
}

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}
