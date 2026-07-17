import type { LoopSpec } from "../core/loop.js";
import { lowestAxis, meanScore } from "../core/loop.js";
import type { FrameScorer } from "../backends/frameScorer.js";
import type { Frame } from "../domain/types.js";
import { frameQualityScore } from "../domain/types.js";

/**
 * Loop 1 — Frame selection.
 * act:     greedily pick top-N frames by quality, penalizing similarity
 * observe: set stats — per-frame quality + most-similar pair
 * score:   quality axis + variety axis
 * correct: lowest axis → ban a near-duplicate / rebalance weights
 */

export interface SelectionState {
  n: number;
  /** How hard act() penalizes picking frames similar to already-picked ones. */
  diversityWeight: number;
  /** Frames correct() has ruled out (e.g. the weaker half of a near-dupe pair). */
  banned: Set<string>;
}

export interface SelectionObservation {
  meanQuality: number; // 0..10
  maxPairSimilarity: number; // 0..1
  /** The most similar pair, worst offender for the variety axis. */
  worstPair?: { a: Frame; b: Frame };
}

export function initialSelectionState(n: number): SelectionState {
  return { n, diversityWeight: 0, banned: new Set() };
}

export function makeFrameSelectionLoop(
  allFrames: Frame[],
  scorer: FrameScorer,
  opts: { bar?: number; maxRounds?: number } = {},
): LoopSpec<SelectionState, Frame[], SelectionObservation> {
  // Fast scorer results are cached up front — reward must return in seconds.
  const qualityCache = new Map<string, number>();
  const quality = async (f: Frame): Promise<number> => {
    let q = qualityCache.get(f.id);
    if (q === undefined) {
      q = frameQualityScore(await scorer.score(f));
      qualityCache.set(f.id, q);
    }
    return q;
  };

  return {
    name: "frame-selection",
    bar: opts.bar ?? 8.5,
    maxRounds: opts.maxRounds ?? 6,
    candidateKey: (frames) =>
      frames
        .map((f) => f.id)
        .sort()
        .join("+"),

    async act(state) {
      const pool = allFrames.filter((f) => !state.banned.has(f.id));
      const picked: Frame[] = [];
      while (picked.length < state.n && pool.length > 0) {
        let bestFrame: Frame | undefined;
        let bestValue = -Infinity;
        for (const f of pool) {
          if (picked.includes(f)) continue;
          let maxSim = 0;
          for (const p of picked) {
            maxSim = Math.max(maxSim, await scorer.similarity(f, p));
          }
          const value = (await quality(f)) - state.diversityWeight * maxSim * 10;
          if (value > bestValue) {
            bestValue = value;
            bestFrame = f;
          }
        }
        if (!bestFrame) break;
        picked.push(bestFrame);
      }
      return picked.sort((a, b) => a.t - b.t);
    },

    async observe(candidate) {
      let sum = 0;
      for (const f of candidate) sum += await quality(f);

      let maxPairSimilarity = 0;
      let worstPair: SelectionObservation["worstPair"];
      for (let i = 0; i < candidate.length; i++) {
        for (let j = i + 1; j < candidate.length; j++) {
          const a = candidate[i]!;
          const b = candidate[j]!;
          const sim = await scorer.similarity(a, b);
          if (sim > maxPairSimilarity) {
            maxPairSimilarity = sim;
            worstPair = { a, b };
          }
        }
      }
      return { meanQuality: sum / candidate.length, maxPairSimilarity, worstPair };
    },

    async score(_candidate, obs) {
      const varietyScore = 10 * (1 - obs.maxPairSimilarity);
      const critique = {
        quality: {
          score: r1(obs.meanQuality),
          reason: obs.meanQuality > 8 ? "picks are sharp and well exposed" : "set includes soft or weak frames",
        },
        variety: {
          score: r1(varietyScore),
          reason:
            obs.maxPairSimilarity > 0.6 && obs.worstPair
              ? `${obs.worstPair.a.id} and ${obs.worstPair.b.id} are near-identical (burst frames)`
              : "picks span distinct moments",
        },
      };
      return { score: r1(meanScore(critique)), critique };
    },

    async correct(state, candidate, critique) {
      const [axis] = lowestAxis(critique);
      if (axis === "variety") {
        // Ban the weaker frame of the most similar pair and raise the
        // diversity penalty so act() stops raiding the same burst.
        const obs = await this.observe(candidate);
        const next: SelectionState = {
          ...state,
          diversityWeight: state.diversityWeight + 1.5,
          banned: new Set(state.banned),
        };
        let note = `variety lowest → diversityWeight ${state.diversityWeight} → ${next.diversityWeight}`;
        if (obs.worstPair) {
          const qa = await quality(obs.worstPair.a);
          const qb = await quality(obs.worstPair.b);
          const weaker = qa <= qb ? obs.worstPair.a : obs.worstPair.b;
          next.banned.add(weaker.id);
          note += `, banned near-dupe ${weaker.id}`;
        }
        return { state: next, note };
      }
      // quality lowest → ease the diversity penalty so act() can trade
      // a bit of spread for stronger frames.
      const next = { ...state, diversityWeight: Math.max(0, state.diversityWeight - 0.5) };
      return {
        state: next,
        note: `quality lowest → diversityWeight ${state.diversityWeight} → ${next.diversityWeight}`,
      };
    },
  };
}

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}
