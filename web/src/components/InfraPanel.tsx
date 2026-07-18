import type { RunState, ZeroDiscoveryInfo } from "../types";

/** Live infrastructure: Zero.xyz discovery, Akash compute, AWS services. */
export function InfraPanel({ state }: { state: RunState }) {
  const cfg = state.config;
  const discoveries = state.zeroDiscoveries;
  if (!cfg && discoveries.length === 0) return null;

  const totalMs = state.computeTasks.reduce((a, t) => a + t.ms, 0);

  return (
    <section className="card infra-panel fade-in">
      <header className="card-head">
        <div>
          <span className="loop-tag">STACK</span>
          <h2>Infrastructure</h2>
        </div>
      </header>

      {cfg && (
        <div className="infra-row">
          <div className="infra-label">
            Frame selection
            <span className={`pill ${cfg.selector.startsWith("heuristic") ? "close" : "pass"}`}>
              {cfg.selector.startsWith("heuristic") ? "local" : "vision AI"}
            </span>
          </div>
          <div className="infra-note muted">{cfg.selector}</div>
        </div>
      )}

      {cfg && (
        <div className="infra-row">
          <div className="infra-label">
            Compute
            <span className={`pill ${cfg.compute === "akash" ? "pass" : "close"}`}>
              {cfg.compute === "akash" ? "akash" : "local"}
            </span>
          </div>
          <div className="infra-note muted">
            {cfg.computeNote}
            {state.computeTasks.length > 0 && (
              <>
                {" — "}
                {state.computeTasks.length} tasks, {(totalMs / 1000).toFixed(1)}s total
              </>
            )}
          </div>
        </div>
      )}

      {cfg?.awsNote && (
        <div className="infra-row">
          <div className="infra-label">
            AWS<span className="pill pass">active</span>
          </div>
          <div className="infra-note muted">{cfg.awsNote}</div>
        </div>
      )}

      {discoveries.map((d) => (
        <ZeroRow d={d} key={d.purpose} />
      ))}
    </section>
  );
}

function ZeroRow({ d }: { d: ZeroDiscoveryInfo }) {
  return (
    <div className="infra-row">
      <div className="infra-label">
        Zero.xyz
        <span className={`pill ${d.invocable ? "pass" : "close"}`}>{d.invocable ? "invocable" : "discovery only"}</span>
      </div>
      {d.capability && (
        <div className="zero-cap">
          <span className="zero-name">{d.capability.name}</span>
          <span className="mono zero-price">{d.capability.pricing}</span>
          <span className={`status-chip ${d.capability.status === "healthy" ? "ok" : "cap"}`}>
            {d.capability.status}
          </span>
        </div>
      )}
      <div className="infra-note muted">
        {d.purpose === "flourish" ? "pro-enhancement pass" : "editor backend"} · search “{d.query}” — {d.note}
      </div>
    </div>
  );
}
