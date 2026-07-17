import type { Critique } from "../core/loop.js";
import type { EditorBackend } from "../config.js";
import type { Recipe } from "../domain/types.js";

/** Wire format streamed to the UI over SSE. Mirrored in web/src/types.ts. */

export interface FrameInfo {
  id: string;
  t: number;
  url: string;
}

export interface RoundInfo {
  round: number;
  score: number;
  critique: Critique;
  correction?: string;
  cached: boolean;
  durationMs: number;
}

export interface ZeroCapabilityInfo {
  name: string;
  slug: string;
  pricing: string;
  status: string;
}

export type RunEvent =
  | {
      type: "run:init";
      runId: string;
      n: number;
      editorBackend: EditorBackend;
      flourish: boolean;
      judge: string;
      judgeNote?: string;
      bar: number;
      /** Akash detection: "akash" when running on a provider, else "local". */
      compute: "akash" | "local";
      computeNote: string;
      /** Present when AWS (Bedrock judge and/or S3 hosting) is active. */
      awsNote?: string;
    }
  | { type: "compute:task"; name: string; ms: number }
  | { type: "extract:start" }
  | { type: "extract:done"; frames: FrameInfo[] }
  | {
      type: "zero:discovery";
      purpose: "flourish" | "editor";
      query: string;
      capability?: ZeroCapabilityInfo;
      invocable: boolean;
      note: string;
    }
  | { type: "judge:fallback"; message: string }
  | { type: "loop1:round"; info: RoundInfo; selectedIds: string[] }
  | { type: "loop1:done"; selectedIds: string[]; converged: boolean; bestScore: number }
  | { type: "loop2:start"; frameId: string }
  | { type: "loop2:round"; frameId: string; info: RoundInfo; imageUrl: string; recipe: Recipe }
  | { type: "loop2:done"; frameId: string; converged: boolean; bestScore: number; bestUrl: string; rounds: number }
  | { type: "flourish:start"; frameId: string }
  | { type: "flourish:done"; frameId: string; url: string; via: string; note?: string }
  | {
      type: "run:done";
      results: Array<{ frameId: string; score: number; url: string; flourishUrl?: string; backend: string; winner: boolean }>;
    }
  | { type: "run:error"; message: string };
