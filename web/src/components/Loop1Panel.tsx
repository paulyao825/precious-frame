import type { FrameInfo, Loop1Round } from "../types";
import { AxisBars, ScorePill, Spinner } from "./bits";
import type { AppCopy } from "../i18n";

export function Loop1Panel({
  frames,
  rounds,
  done,
  running,
  copy,
}: {
  frames: FrameInfo[];
  rounds: Loop1Round[];
  done?: { selectedIds: string[]; converged: boolean; bestScore: number };
  running: boolean;
  copy: AppCopy;
}) {
  const latest = rounds[rounds.length - 1];
  const selected = new Set(done?.selectedIds ?? latest?.selectedIds ?? []);

  return (
    <section className="card fade-in">
      <header className="card-head">
        <div>
          <span className="loop-tag">LOOP 1</span>
          <h2>{copy.loop1.title}</h2>
        </div>
        <div className="head-right">
          {done ? (
            <span className={`status-chip ${done.converged ? "ok" : "cap"}`}>
              {done.converged ? copy.loop1.clearedBar : copy.loop1.roundCap} · {done.bestScore.toFixed(1)}
            </span>
          ) : (
            running && <Spinner label={copy.loop1.reranking} />
          )}
        </div>
      </header>

      <div className="filmstrip">
        {frames.map((f) => (
          <figure key={f.id} className={`film-cell ${selected.has(f.id) ? "picked" : ""}`}>
            <img src={f.url} alt={f.id} />
            <figcaption className="mono">{f.t.toFixed(1)}s</figcaption>
          </figure>
        ))}
      </div>

      <div className="rounds-row">
        {rounds.map((r) => (
          <div className="round-card" key={r.info.round}>
            <div className="round-head">
              <span className="mono muted">{copy.loop1.round} {r.info.round}</span>
              <ScorePill score={r.info.score} bar={8.2} />
            </div>
            <AxisBars critique={r.info.critique} />
            {r.info.correction && <div className="correction">{r.info.correction}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
