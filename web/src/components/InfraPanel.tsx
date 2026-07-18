import type { RunState } from "../types";
import type { AppCopy } from "../i18n";

export function InfraPanel({ state, copy }: { state: RunState; copy: AppCopy }) {
  const cfg = state.config;
  if (!cfg) return null;

  const usesVisionApi = cfg.selector === "AI";
  return (
    <section className="card infra-panel fade-in">
      <header className="card-head">
        <div>
          <span className="loop-tag">STACK</span>
          <h2>{copy.infra.stack}</h2>
        </div>
      </header>

      <div className="infra-row">
        <div className="infra-label">
          {copy.infra.frameIntelligence}
          <span className={`pill ${usesVisionApi ? "pass" : "close"}`}>
            {usesVisionApi ? copy.labels.visionAi : copy.labels.localFallback}
          </span>
        </div>
        <div className="infra-note muted">{cfg.selector}</div>
      </div>

      <div className="infra-row">
        <div className="infra-label">{copy.infra.preference}<span className="pill pass">{copy.infra.selected}</span></div>
        <div className="infra-note muted">{cfg.preferenceLabel}</div>
      </div>

      <div className="infra-row">
        <div className="infra-label">{copy.infra.processing}<span className="pill pass">{copy.infra.local}</span></div>
        <div className="infra-note muted">{copy.infra.browserNote}</div>
      </div>

      <div className="infra-row">
        <div className="infra-label">{copy.infra.api}<span className="pill pass">{copy.infra.standard}</span></div>
        <div className="infra-note muted">{copy.infra.apiNote}</div>
      </div>
    </section>
  );
}
