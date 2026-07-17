import type { Frame, FrameQuality } from "../domain/types.js";
import type { MockWorld } from "../mock/world.js";

/**
 * Fast per-frame scorer for Loop 1 (sharpness / face / eyes-open).
 * Must be cheap — it runs on every extracted frame.
 * Real impl (step 2): laplacian variance + face detector.
 */
export interface FrameScorer {
  score(frame: Frame): Promise<FrameQuality>;
  /** Similarity 0..1 between two frames (1 = near-identical). */
  similarity(a: Frame, b: Frame): Promise<number>;
}

export class MockFrameScorer implements FrameScorer {
  constructor(private readonly world: MockWorld) {}

  async score(frame: Frame): Promise<FrameQuality> {
    return this.world.truth(frame.id).quality;
  }

  async similarity(a: Frame, b: Frame): Promise<number> {
    const ta = this.world.truth(a.id);
    const tb = this.world.truth(b.id);
    if (ta.sceneId !== tb.sceneId) return 0.05;
    // Same scene: closer in time = more similar.
    const dt = Math.abs(a.t - b.t);
    return Math.max(0.05, 1 - dt / 4);
  }
}
