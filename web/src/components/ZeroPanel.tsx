import type { ZeroDiscoveryInfo } from "../types";

export function ZeroPanel({ discoveries }: { discoveries: ZeroDiscoveryInfo[] }) {
  if (discoveries.length === 0) return null;
  return (
    <section className="card zero-panel fade-in">
      <header className="card-head">
        <div>
          <span className="loop-tag zero">ZERO.XYZ</span>
          <h2>Live capability discovery</h2>
        </div>
      </header>
      {discoveries.map((d) => (
        <div className="zero-row" key={d.purpose}>
          <div className="zero-query mono muted">
            {d.purpose === "flourish" ? "pro-enhancement pass" : "editor backend"} · search: “{d.query}”
          </div>
          {d.capability ? (
            <div className="zero-cap">
              <span className="zero-name">{d.capability.name}</span>
              <span className="mono zero-price">{d.capability.pricing}</span>
              <span className={`status-chip ${d.capability.status === "healthy" ? "ok" : "cap"}`}>
                {d.capability.status}
              </span>
              <span className={`pill ${d.invocable ? "pass" : "close"}`}>
                {d.invocable ? "invocable" : "discovery only"}
              </span>
            </div>
          ) : (
            <div className="zero-cap muted">no capability matched</div>
          )}
          <div className="zero-note muted">{d.note}</div>
        </div>
      ))}
    </section>
  );
}
