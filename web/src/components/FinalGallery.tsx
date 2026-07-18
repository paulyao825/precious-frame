import type { ResultInfo } from "../types";
import { ScorePill } from "./bits";
import type { AppCopy } from "../i18n";

export function FinalGallery({ results, copy }: { results: ResultInfo[]; copy: AppCopy }) {
  return (
    <section className="card fade-in">
      <header className="card-head">
        <div>
          <span className="loop-tag done">{copy.output.tag}</span>
          <h2>{copy.output.title}</h2>
        </div>
      </header>
      <div className="gallery">
        {results.map((result) => (
          <figure className={`result-card ${result.winner ? "winner" : ""}`} key={result.frameId}>
            {result.winner && <div className="winner-banner">{copy.output.winner}</div>}
            <img src={result.url} alt={result.frameId} />
            <figcaption>
              <span className="mono">{result.frameId}</span>
              <ScorePill score={result.score} />
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
