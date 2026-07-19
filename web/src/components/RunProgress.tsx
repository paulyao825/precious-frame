import type { RunState } from "../types";
import type { AppCopy } from "../i18n";

/**
 * Phase-weighted progress estimate (0–100). The pipeline emits a variable
 * number of loop rounds, so within each loop band we ease toward the band
 * ceiling as rounds stream in — the bar keeps advancing and never stalls or
 * overshoots into the next phase.
 */
function computeProgress(state: RunState): number {
  switch (state.phase) {
    case "uploading":
      return 6;
    case "extracting":
      return 20;
    case "loop1": {
      const rounds = state.loop1Rounds.length;
      return 32 + 26 * (1 - 1 / (1 + rounds * 0.6));
    }
    case "loop2": {
      const total = Math.max(state.loop1Done?.selectedIds.length ?? state.loop2Order.length, 1);
      const completed = state.loop2Order.filter((id) => state.loop2[id]?.done).length;
      const active = state.loop2Order.find((id) => !state.loop2[id]?.done);
      const activeRounds = active ? state.loop2[active]?.rounds.length ?? 0 : 0;
      const partial = active ? 1 - 1 / (1 + activeRounds * 0.6) : 0;
      const frac = Math.min(1, (completed + partial) / total);
      return 62 + 34 * frac;
    }
    case "done":
      return 100;
    default:
      return 0;
  }
}

function activeStep(phase: RunState["phase"]): number {
  if (phase === "uploading" || phase === "extracting") return 0;
  if (phase === "loop1") return 1;
  if (phase === "loop2") return 2;
  return 3;
}

export function RunProgress({ state, copy }: { state: RunState; copy: AppCopy }) {
  const pct = Math.round(computeProgress(state));
  const step = activeStep(state.phase);
  const phaseLabel = copy.phase[state.phase as keyof typeof copy.phase] ?? "";

  return (
    <div
      className="run-progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={copy.progress.heading}
    >
      <div className="run-progress-top">
        <div className="run-progress-heading">
          <span className="run-progress-title">{copy.progress.heading}</span>
          {phaseLabel && <span className="run-progress-phase">{phaseLabel}</span>}
        </div>
        <span className="run-progress-pct">{pct}%</span>
      </div>

      <div className="run-progress-track">
        <div className="run-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="run-progress-steps">
        {copy.progress.steps.map((label, index) => (
          <span
            key={label}
            className={`run-progress-step${index < step ? " done" : ""}${index === step ? " active" : ""}`}
          >
            <b>{String(index + 1).padStart(2, "0")}</b>
            {label}
          </span>
        ))}
        <span className="run-progress-hint">{copy.progress.hint}</span>
      </div>
    </div>
  );
}
