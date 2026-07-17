import { useState } from "react";
import type { ResultInfo } from "../types";
import { ScorePill } from "./bits";

function WinnerCard({ r, flourishVia }: { r: ResultInfo; flourishVia?: string }) {
  const [showFlourish, setShowFlourish] = useState(true);
  const url = showFlourish && r.flourishUrl ? r.flourishUrl : r.url;
  const remote = flourishVia?.startsWith("zero:");
  return (
    <figure className="result-card winner">
      <div className="winner-banner">WINNER</div>
      <img src={url} alt={r.frameId} />
      <figcaption>
        <span className="mono">{r.frameId}</span>
        <ScorePill score={r.score} />
        <span className={`backend-chip ${r.backend}`}>{r.backend}</span>
        {r.flourishUrl && (
          <button className="btn tiny" onClick={() => setShowFlourish((v) => !v)}>
            {showFlourish ? (remote ? "zero.xyz remote" : "pro pass") : "loop output"}
          </button>
        )}
      </figcaption>
    </figure>
  );
}

export function FinalGallery({ results, flourishVia }: { results: ResultInfo[]; flourishVia?: string }) {
  return (
    <section className="card fade-in">
      <header className="card-head">
        <div>
          <span className="loop-tag done">OUTPUT</span>
          <h2>Finished set</h2>
        </div>
      </header>
      <div className="gallery">
        {results.map((r) =>
          r.winner ? (
            <WinnerCard key={r.frameId} r={r} flourishVia={flourishVia} />
          ) : (
            <figure className="result-card" key={r.frameId}>
              <img src={r.url} alt={r.frameId} />
              <figcaption>
                <span className="mono">{r.frameId}</span>
                <ScorePill score={r.score} />
                <span className={`backend-chip ${r.backend}`}>{r.backend}</span>
              </figcaption>
            </figure>
          ),
        )}
      </div>
    </section>
  );
}
