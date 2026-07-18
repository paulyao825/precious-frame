import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AppConfig } from "../appConfig.js";
import { loadAppConfig } from "../appConfig.js";
import type { Editor } from "../backends/editor.js";
import { SharpLocalEditor } from "../backends/editor.sharp.js";
import type { FrameScorer } from "../backends/frameScorer.js";
import { LlmFrameScorer } from "../backends/frameScorer.llm.js";
import { RealFrameScorer } from "../backends/frameScorer.real.js";
import type { VisionJudge } from "../backends/judge.js";
import { ResilientJudge } from "../backends/judge.js";
import { HeuristicVisionJudge } from "../backends/judge.heuristic.js";
import { LlmVisionJudge } from "../backends/judge.llm.js";
import type { LoopRound } from "../core/loop.js";
import { runLoop } from "../core/loop.js";
import type { EditedImage, Frame } from "../domain/types.js";
import { initialRefineState, makeEditRefinementLoop } from "../loops/editRefinement.js";
import { initialSelectionState, makeFrameSelectionLoop } from "../loops/frameSelection.js";
import { extractFrames } from "../media/ffmpeg.js";
import type { FrameInfo, RoundInfo, RunEvent } from "./events.js";

export interface RunRequest {
  videoPath: string;
  n: number;
}

interface RunRecord {
  events: RunEvent[];
  listeners: Set<(event: RunEvent) => void>;
  done: boolean;
}

export class RunManager {
  private readonly runs = new Map<string, RunRecord>();

  constructor(
    private readonly dataDir: string,
    private readonly urlFor: (absPath: string) => string,
    private readonly resolvePath: (url: string) => string,
  ) {}

  get(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`unknown run ${runId}`);
    for (const event of run.events) listener(event);
    run.listeners.add(listener);
    return () => run.listeners.delete(listener);
  }

  start(req: RunRequest): string {
    const runId = randomUUID().slice(0, 8);
    const record: RunRecord = { events: [], listeners: new Set(), done: false };
    this.runs.set(runId, record);

    const emit = (event: RunEvent) => {
      record.events.push(event);
      for (const listener of record.listeners) listener(event);
    };

    this.execute(runId, req, emit)
      .catch((err) => emit({ type: "run:error", message: String(err?.message ?? err) }))
      .finally(() => {
        record.done = true;
      });

    return runId;
  }

  private async execute(runId: string, req: RunRequest, emit: (event: RunEvent) => void): Promise<void> {
    const runDir = path.join(this.dataDir, "runs", runId);
    const cfg = loadAppConfig();
    const editor: Editor = new SharpLocalEditor(path.join(runDir, "edits"), this.urlFor);
    const judge = this.buildJudge(cfg, emit);
    const visionLabel = cfg.judge.provider === "glm" ? `GLM:${cfg.judge.model}` : "local pixel scoring";

    emit({
      type: "run:init",
      runId,
      n: req.n,
      selector: visionLabel,
      judge: visionLabel,
      judgeNote: cfg.judge.note,
      bar: cfg.loop.bar,
    });

    emit({ type: "extract:start" });
    const extracted = await extractFrames(req.videoPath, path.join(runDir, "frames"));
    const frames: Frame[] = extracted.map((frame, index) => ({
      id: `frame_${String(index + 1).padStart(3, "0")}`,
      t: frame.t,
      uri: frame.path,
    }));
    const frameInfos: FrameInfo[] = frames.map((frame) => ({ id: frame.id, t: frame.t, url: this.urlFor(frame.uri) }));
    emit({ type: "extract:done", frames: frameInfos });

    const localScorer = new RealFrameScorer();
    const scorer = this.buildFrameScorer(cfg, localScorer, emit);
    await scorer.prepare?.(frames);
    const selection = await runLoop(
      makeFrameSelectionLoop(frames, scorer, { bar: 8.2 }),
      initialSelectionState(req.n),
      {
        onRound: (round) =>
          emit({ type: "loop1:round", info: toRoundInfo(round), selectedIds: round.candidate.map((frame) => frame.id) }),
      },
    );
    emit({
      type: "loop1:done",
      selectedIds: selection.best.map((frame) => frame.id),
      converged: selection.converged,
      bestScore: selection.bestScore,
    });

    const results: Array<{ frame: Frame; image: EditedImage; score: number }> = [];
    for (const frame of selection.best) {
      emit({ type: "loop2:start", frameId: frame.id });
      const result = await runLoop(
        makeEditRefinementLoop(frame, editor, judge, { bar: cfg.loop.bar, maxRounds: cfg.loop.maxRounds }),
        initialRefineState(),
        {
          onRound: (round) =>
            emit({
              type: "loop2:round",
              frameId: frame.id,
              info: toRoundInfo(round),
              imageUrl: round.candidate.uri,
              recipe: round.candidate.recipe,
            }),
        },
      );
      emit({
        type: "loop2:done",
        frameId: frame.id,
        converged: result.converged,
        bestScore: result.bestScore,
        bestUrl: result.best.uri,
        rounds: result.rounds.length,
      });
      results.push({ frame, image: result.best, score: result.bestScore });
    }

    if (results.length === 0) throw new Error("no frames were selected for editing");
    const winner = results.reduce((best, result) => (result.score > best.score ? result : best));
    emit({
      type: "run:done",
      results: results.map((result) => ({
        frameId: result.frame.id,
        score: result.score,
        url: result.image.uri,
        winner: result.frame.id === winner.frame.id,
      })),
    });
  }

  private buildJudge(cfg: AppConfig, emit: (event: RunEvent) => void): VisionJudge {
    const local = new HeuristicVisionJudge(this.resolvePath);
    if (cfg.judge.provider === "heuristic") return local;
    return new ResilientJudge(new LlmVisionJudge(this.resolvePath, cfg.judge), local, (err) =>
      emit({
        type: "judge:fallback",
        message: `GLM edit judging failed (${String(err).slice(0, 180)}) - continuing with local pixel scoring`,
      }),
    );
  }

  private buildFrameScorer(
    cfg: AppConfig,
    local: FrameScorer,
    emit: (event: RunEvent) => void,
  ): FrameScorer {
    if (cfg.judge.provider === "heuristic") return local;
    return new LlmFrameScorer(local, cfg.judge, (err) =>
      emit({
        type: "judge:fallback",
        message: `GLM frame selection failed (${String(err).slice(0, 180)}) - continuing with local pixel scoring`,
      }),
    );
  }
}

function toRoundInfo(round: LoopRound<unknown>): RoundInfo {
  return {
    round: round.round,
    score: round.score,
    critique: round.critique,
    correction: round.correction,
    cached: round.scoreCached,
    durationMs: round.durationMs,
  };
}
