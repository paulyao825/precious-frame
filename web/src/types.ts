/** Mirrors server/src/api/events.ts wire format. */

export interface AxisCritique {
  score: number;
  reason: string;
  hint?: string;
}

export type Critique = Record<string, AxisCritique>;

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

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Recipe {
  crop: CropRect;
  exposureEv: number;
  contrast: number;
  saturation: number;
  temperature: number;
  sharpen: number;
}

export interface ZeroCapabilityInfo {
  name: string;
  slug: string;
  pricing: string;
  status: string;
}

export interface ZeroDiscoveryInfo {
  purpose: "flourish" | "editor";
  query: string;
  capability?: ZeroCapabilityInfo;
  invocable: boolean;
  note: string;
}

export interface ResultInfo {
  frameId: string;
  score: number;
  url: string;
  flourishUrl?: string;
  backend: string;
  winner: boolean;
}

export type RunEvent =
  | {
      type: "run:init";
      runId: string;
      n: number;
      editorBackend: "local" | "zero";
      flourish: boolean;
      judge: string;
      judgeNote?: string;
      bar: number;
      compute: "akash" | "local";
      computeNote: string;
      awsNote?: string;
    }
  | { type: "compute:task"; name: string; ms: number }
  | { type: "extract:start" }
  | { type: "extract:done"; frames: FrameInfo[] }
  | ({ type: "zero:discovery" } & ZeroDiscoveryInfo)
  | { type: "judge:fallback"; message: string }
  | { type: "loop1:round"; info: RoundInfo; selectedIds: string[] }
  | { type: "loop1:done"; selectedIds: string[]; converged: boolean; bestScore: number }
  | { type: "loop2:start"; frameId: string }
  | { type: "loop2:round"; frameId: string; info: RoundInfo; imageUrl: string; recipe: Recipe }
  | { type: "loop2:done"; frameId: string; converged: boolean; bestScore: number; bestUrl: string; rounds: number }
  | { type: "flourish:start"; frameId: string }
  | { type: "flourish:done"; frameId: string; url: string; via: string; note?: string }
  | { type: "run:done"; results: ResultInfo[] }
  | { type: "run:error"; message: string };

export interface Loop1Round {
  info: RoundInfo;
  selectedIds: string[];
}

export interface Loop2Round {
  info: RoundInfo;
  imageUrl: string;
  recipe: Recipe;
}

export interface Loop2State {
  frameId: string;
  rounds: Loop2Round[];
  done?: { converged: boolean; bestScore: number; bestUrl: string; rounds: number };
}

export type Phase = "idle" | "uploading" | "extracting" | "loop1" | "loop2" | "flourish" | "done" | "error";

export interface RunState {
  phase: Phase;
  runId?: string;
  error?: string;
  config?: {
    n: number;
    editorBackend: "local" | "zero";
    flourish: boolean;
    judge: string;
    judgeNote?: string;
    bar: number;
    compute: "akash" | "local";
    computeNote: string;
    awsNote?: string;
  };
  judgeFallback?: string;
  zeroDiscoveries: ZeroDiscoveryInfo[];
  computeTasks: Array<{ name: string; ms: number }>;
  frames: FrameInfo[];
  loop1Rounds: Loop1Round[];
  loop1Done?: { selectedIds: string[]; converged: boolean; bestScore: number };
  loop2: Record<string, Loop2State>;
  loop2Order: string[];
  flourish?: { frameId: string; url?: string; via?: string; note?: string };
  results?: ResultInfo[];
}

export const initialRunState: RunState = {
  phase: "idle",
  zeroDiscoveries: [],
  computeTasks: [],
  frames: [],
  loop1Rounds: [],
  loop2: {},
  loop2Order: [],
};

export function reduceEvent(state: RunState, e: RunEvent): RunState {
  switch (e.type) {
    case "run:init":
      return {
        ...initialRunState,
        phase: "extracting",
        runId: e.runId,
        config: {
          n: e.n,
          editorBackend: e.editorBackend,
          flourish: e.flourish,
          judge: e.judge,
          judgeNote: e.judgeNote,
          bar: e.bar,
          compute: e.compute,
          computeNote: e.computeNote,
          awsNote: e.awsNote,
        },
      };
    case "compute:task":
      return { ...state, computeTasks: [...state.computeTasks, { name: e.name, ms: e.ms }] };
    case "extract:start":
      return { ...state, phase: "extracting" };
    case "zero:discovery":
      return {
        ...state,
        zeroDiscoveries: [
          ...state.zeroDiscoveries,
          { purpose: e.purpose, query: e.query, capability: e.capability, invocable: e.invocable, note: e.note },
        ],
      };
    case "judge:fallback":
      return { ...state, judgeFallback: e.message };
    case "extract:done":
      return { ...state, frames: e.frames, phase: "loop1" };
    case "loop1:round":
      return { ...state, loop1Rounds: [...state.loop1Rounds, { info: e.info, selectedIds: e.selectedIds }] };
    case "loop1:done":
      return {
        ...state,
        phase: "loop2",
        loop1Done: { selectedIds: e.selectedIds, converged: e.converged, bestScore: e.bestScore },
      };
    case "loop2:start":
      return {
        ...state,
        loop2Order: [...state.loop2Order, e.frameId],
        loop2: { ...state.loop2, [e.frameId]: { frameId: e.frameId, rounds: [] } },
      };
    case "loop2:round": {
      const cur = state.loop2[e.frameId] ?? { frameId: e.frameId, rounds: [] };
      return {
        ...state,
        loop2: {
          ...state.loop2,
          [e.frameId]: { ...cur, rounds: [...cur.rounds, { info: e.info, imageUrl: e.imageUrl, recipe: e.recipe }] },
        },
      };
    }
    case "loop2:done": {
      const cur = state.loop2[e.frameId];
      if (!cur) return state;
      return {
        ...state,
        loop2: {
          ...state.loop2,
          [e.frameId]: { ...cur, done: { converged: e.converged, bestScore: e.bestScore, bestUrl: e.bestUrl, rounds: e.rounds } },
        },
      };
    }
    case "flourish:start":
      return { ...state, phase: "flourish", flourish: { frameId: e.frameId } };
    case "flourish:done":
      return { ...state, flourish: { frameId: e.frameId, url: e.url, via: e.via, note: e.note } };
    case "run:done":
      return { ...state, phase: "done", results: e.results };
    case "run:error":
      return { ...state, phase: "error", error: e.message };
  }
}
