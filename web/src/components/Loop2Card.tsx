import { useEffect, useState } from "react";
import type { FrameInfo, Loop2Round, Loop2State } from "../types";
import { AxisBars, ScorePill, Sparkline, Spinner } from "./bits";

export function Loop2Card({
  frame,
  loop,
  backend,
  bar = 7.5,
}: {
  frame: FrameInfo | undefined;
  loop: Loop2State;
  backend: string;
  bar?: number;
}) {
  const rounds = loop.rounds;
  const [viewIdx, setViewIdx] = useState(rounds.length - 1);
  const [pinned, setPinned] = useState(false); // user grabbed the scrubber

  // Follow the newest round live unless the user is scrubbing history.
  useEffect(() => {
    if (!pinned) setViewIdx(rounds.length - 1);
  }, [rounds.length, pinned]);

  const view = rounds[Math.max(0, Math.min(viewIdx, rounds.length - 1))];
  const first = rounds[0];
  if (!view || !first) {
    return (
      <div className="card loop2-card">
        <Spinner label={`preparing ${loop.frameId}…`} />
      </div>
    );
  }

  return (
    <div className="card loop2-card fade-in">
      <header className="card-head">
        <div>
          <span className="mono muted">{loop.frameId}</span>
          <span className={`backend-chip ${backend}`}>{backend}</span>
        </div>
        <div className="head-right">
          <Sparkline scores={rounds.map((r) => r.info.score)} bar={bar} />
          {loop.done ? (
            <span className={`status-chip ${loop.done.converged ? "ok" : "cap"}`}>
              {loop.done.converged ? "cleared bar" : "round cap"} · {first.info.score.toFixed(1)} →{" "}
              {loop.done.bestScore.toFixed(1)}
            </span>
          ) : (
            <Spinner label={`round ${rounds.length}…`} />
          )}
        </div>
      </header>

      <div className="compare">
        <figure>
          <img src={first.imageUrl} alt="round 1" />
          <figcaption>
            round 1 <ScorePill score={first.info.score} bar={bar} />
          </figcaption>
        </figure>
        <div className="compare-arrow">→</div>
        <figure>
          <img src={view.imageUrl} alt={`round ${view.info.round}`} />
          <figcaption>
            round {view.info.round} <ScorePill score={view.info.score} bar={bar} />
            {view.info.cached && <span className="cached-chip">cached</span>}
          </figcaption>
        </figure>
      </div>

      {rounds.length > 1 && (
        <div className="scrubber">
          <span className="mono muted">scrub rounds</span>
          <input
            type="range"
            min={0}
            max={rounds.length - 1}
            value={Math.min(viewIdx, rounds.length - 1)}
            onChange={(e) => {
              setPinned(Number(e.target.value) < rounds.length - 1);
              setViewIdx(Number(e.target.value));
            }}
          />
          <span className="mono">
            {view.info.round}/{rounds.length}
          </span>
        </div>
      )}

      <AxisBars critique={view.info.critique} />
      {view.info.correction && <div className="correction">{view.info.correction}</div>}
      <RecipeLine recipe={view.recipe} srcT={frame?.t} />
    </div>
  );
}

function RecipeLine({ recipe, srcT }: { recipe: Loop2Round["recipe"]; srcT?: number }) {
  const parts = [
    `crop ${recipe.crop.w.toFixed(2)}×${recipe.crop.h.toFixed(2)} @ (${recipe.crop.x.toFixed(2)},${recipe.crop.y.toFixed(2)})`,
    `EV ${recipe.exposureEv >= 0 ? "+" : ""}${recipe.exposureEv.toFixed(2)}`,
  ];
  if (recipe.contrast !== 1) parts.push(`contrast ${recipe.contrast.toFixed(2)}`);
  if (recipe.saturation !== 1) parts.push(`sat ${recipe.saturation.toFixed(2)}`);
  if (recipe.temperature !== 0) parts.push(`temp ${recipe.temperature > 0 ? "+" : ""}${recipe.temperature.toFixed(2)}`);
  if (recipe.sharpen > 0) parts.push(`sharpen ${recipe.sharpen.toFixed(2)}`);
  if (srcT !== undefined) parts.push(`src ${srcT.toFixed(1)}s`);
  return <div className="recipe mono muted">{parts.join(" · ")}</div>;
}
