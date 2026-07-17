import type { Critique } from "../types";

export function ScorePill({ score, bar = 8 }: { score: number; bar?: number }) {
  const cls = score >= bar ? "pill pass" : score >= bar - 1.5 ? "pill close" : "pill fail";
  return <span className={cls}>{score.toFixed(1)}</span>;
}

export function AxisBars({ critique, compact }: { critique: Critique; compact?: boolean }) {
  return (
    <div className={compact ? "axes compact" : "axes"}>
      {Object.entries(critique).map(([axis, a]) => (
        <div className="axis" key={axis}>
          <div className="axis-head">
            <span className="axis-name">{axis}</span>
            <span className="axis-score">{a.score.toFixed(1)}</span>
          </div>
          <div className="meter">
            <div className="meter-fill" style={{ width: `${a.score * 10}%` }} />
          </div>
          {!compact && (
            <div className="axis-reason">
              {a.reason}
              {a.hint && a.hint !== "none" && <span className="hint-chip">{a.hint}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ scores, bar = 8 }: { scores: number[]; bar?: number }) {
  const W = 120;
  const H = 36;
  const n = Math.max(scores.length, 2);
  const x = (i: number) => (i / (n - 1)) * (W - 8) + 4;
  const y = (s: number) => H - 4 - (s / 10) * (H - 8);
  const pts = scores.map((s, i) => `${x(i)},${y(s)}`).join(" ");
  const last = scores[scores.length - 1] ?? 0;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <line x1={0} x2={W} y1={y(bar)} y2={y(bar)} className="spark-bar" />
      <polyline points={pts} className="spark-line" />
      <circle cx={x(scores.length - 1)} cy={y(last)} r={3} className="spark-dot" />
    </svg>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="spinner-row">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
