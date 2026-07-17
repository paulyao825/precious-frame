import { makeRng } from "../core/rng.js";
import type { CropRect, Frame, FrameQuality } from "../domain/types.js";

/**
 * Hidden ground truth for mock frames. Only mock implementations
 * (scorer, judge, similarity) may read this — the loops never do.
 */
export interface HiddenFrameTruth {
  sceneId: number;
  quality: FrameQuality;
  /** The crop a great editor would land on. */
  idealCrop: CropRect;
  /** The exposure correction the shot actually needs, in EV. */
  idealExposureEv: number;
}

export class MockWorld {
  constructor(
    public readonly frames: Frame[],
    private readonly truthByFrame: Map<string, HiddenFrameTruth>,
    public readonly rng: () => number,
  ) {}

  truth(frameId: string): HiddenFrameTruth {
    const t = this.truthByFrame.get(frameId);
    if (!t) throw new Error(`no mock truth for frame ${frameId}`);
    return t;
  }

  /**
   * A plausible short video: 4 scenes, ~24 frames. Scene 2 contains a
   * "burst" of near-identical high-quality frames — the trap Loop 1's
   * variety axis must correct out of.
   */
  static generate(seed: number): MockWorld {
    const rng = makeRng(seed);
    const frames: Frame[] = [];
    const truth = new Map<string, HiddenFrameTruth>();

    const add = (t: number, sceneId: number, q: FrameQuality) => {
      const id = `frame_${String(frames.length + 1).padStart(3, "0")}`;
      frames.push({ id, t, uri: `mock://video/frames/${id}.jpg` });
      truth.set(id, {
        sceneId,
        quality: q,
        idealCrop: randomIdealCrop(rng),
        idealExposureEv: round2((rng() - 0.5) * 2.4), // needs -1.2..+1.2 EV
      });
    };

    const scenes: Array<{ start: number; strong: number; weak: number }> = [
      { start: 0, strong: 2, weak: 3 },
      { start: 8, strong: 0, weak: 3 }, // burst added separately below
      { start: 18, strong: 2, weak: 4 },
      { start: 30, strong: 1, weak: 3 },
    ];

    scenes.forEach(({ start, strong, weak }, sceneId) => {
      if (sceneId === 1) {
        // The burst: three near-identical frames, all excellent quality.
        for (let i = 0; i < 3; i++) {
          add(start + 2 + i * 0.2, sceneId, {
            sharpness: 0.94 + rng() * 0.04,
            exposure: 0.92 + rng() * 0.05,
            interest: 0.95,
          });
        }
      }
      for (let i = 0; i < strong; i++) {
        add(start + rng() * 6, sceneId, {
          sharpness: 0.82 + rng() * 0.12,
          exposure: 0.8 + rng() * 0.15,
          interest: 0.85 + rng() * 0.15,
        });
      }
      for (let i = 0; i < weak; i++) {
        add(start + rng() * 6, sceneId, {
          sharpness: 0.25 + rng() * 0.4,
          exposure: 0.2 + rng() * 0.5,
          interest: rng() < 0.3 ? 0.1 : 0.7,
        });
      }
    });

    frames.sort((a, b) => a.t - b.t);
    return new MockWorld(frames, truth, rng);
  }
}

function randomIdealCrop(rng: () => number): CropRect {
  // Subject sits somewhere off-center; ideal crop is a tighter window on it.
  const w = 0.55 + rng() * 0.15;
  const h = 0.55 + rng() * 0.15;
  const x = rng() * (1 - w);
  const y = rng() * (1 - h);
  return { x: round2(x), y: round2(y), w: round2(w), h: round2(h) };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
