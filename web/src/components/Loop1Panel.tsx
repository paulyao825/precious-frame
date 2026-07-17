import type { FrameInfo, Loop1Round } from "../types";
import { AxisBars, ScorePill, Spinner } from "./bits";

export function Loop1Panel({
  frames,
  rounds,
  done,
  running,
}: {
  frames: FrameInfo[];
  rounds: Loop1Round[];
  done?: { selectedIds: string[]; converged: boolean; bestScore: number };
  running: boolean;
}) {
  const latest = rounds[rounds.length - 1];
  const selected = new Set(done?.selectedIds ?? latest?.selectedIds ?? []);

  return (
    <section className="card fade-in">
      <header className="card-head">
        <div>
          <span className="loop-tag">LOOP 1</span>
          <h2>Frame selection</h2>
        </div>
        <div className="head-right">
          {done ? (
            <span className={`status-chip ${done.converged ? "ok" : "cap"}`}>
              {done.converged ? "cleared bar" : "round cap"} · {done.bestScore.toFixed(1)}
            </span>
          ) : (
            running && <Spinner label="re-ranking…" />
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
              <span className="mono muted">round {r.info.round}</span>
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
