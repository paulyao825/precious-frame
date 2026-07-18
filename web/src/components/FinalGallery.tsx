import { useEffect, useRef, useState } from "react";
import { refineResult } from "../api";
import type { PhotoPreference, ResultInfo } from "../types";
import { ScorePill } from "./bits";
import type { AppCopy } from "../i18n";

interface ImageAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

const DEFAULT_ADJUSTMENTS: ImageAdjustments = { brightness: 100, contrast: 100, saturation: 100 };

function cssFilter(adjustments: ImageAdjustments) {
  return `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
}

export function FinalGallery({
  results,
  preference,
  copy,
  onRefined,
}: {
  results: ResultInfo[];
  preference: PhotoPreference;
  copy: AppCopy;
  onRefined: (result: Pick<ResultInfo, "frameId" | "url" | "score">) => void;
}) {
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
          <ResultCard key={result.frameId} result={result} preference={preference} copy={copy} onRefined={onRefined} />
        ))}
      </div>
    </section>
  );
}

function ResultCard({
  result,
  preference,
  copy,
  onRefined,
}: {
  result: ResultInfo;
  preference: PhotoPreference;
  copy: AppCopy;
  onRefined: (result: Pick<ResultInfo, "frameId" | "url" | "score">) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [refining, setRefining] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string>();
  const [feedbackStatus, setFeedbackStatus] = useState<string>();
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);
  const imageRef = useRef<HTMLImageElement>(null);
  const filter = cssFilter(adjustments);

  const reset = () => setAdjustments(DEFAULT_ADJUSTMENTS);
  const update = (key: keyof ImageAdjustments, value: number) => {
    setAdjustments((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
  }, [result.url]);

  const submitFeedback = async () => {
    const instruction = feedback.trim();
    if (!instruction || refining) return;

    setRefining(true);
    setFeedbackError(undefined);
    setFeedbackStatus(undefined);
    try {
      const refined = await refineResult(result, preference, instruction);
      onRefined({ frameId: result.frameId, url: refined.url, score: refined.score });
      setFeedbackStatus(refined.usedLocalFallback ? copy.output.feedbackFallback : copy.output.feedbackApplied);
      setFeedback("");
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : String(error));
    } finally {
      setRefining(false);
    }
  };

  const save = () => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.filter = filter;
    context.drawImage(image, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `precious-frame-${result.frameId}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/jpeg", 0.92);
  };

  return (
    <figure className={`result-card ${result.winner ? "winner" : ""}`}>
      {result.winner && <div className="winner-banner">{copy.output.winner}</div>}
      <img ref={imageRef} src={result.url} alt={result.frameId} style={{ filter }} />
      <figcaption>
        <span className="mono">{result.frameId}</span>
        <ScorePill score={result.score} />
        <div className="result-actions">
          <button
            className="btn tiny"
            type="button"
            aria-expanded={editing}
            aria-label={editing ? copy.output.closeEdit : copy.output.edit}
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? copy.output.closeEdit : copy.output.edit}
          </button>
          <button
            className="btn tiny"
            type="button"
            aria-expanded={feedbackOpen}
            onClick={() => setFeedbackOpen((current) => !current)}
          >
            {copy.output.feedback}
          </button>
          <button
            className="save-result"
            type="button"
            aria-label={`${copy.output.save}: ${result.frameId}`}
            title={copy.output.save}
            onClick={save}
          >
            ↓
          </button>
        </div>
      </figcaption>
      {editing && (
        <div className="result-edit">
          <AdjustmentControl label={copy.output.brightness} value={adjustments.brightness} onChange={(value) => update("brightness", value)} />
          <AdjustmentControl label={copy.output.contrast} value={adjustments.contrast} onChange={(value) => update("contrast", value)} />
          <AdjustmentControl label={copy.output.saturation} value={adjustments.saturation} onChange={(value) => update("saturation", value)} />
          <button className="btn tiny" type="button" onClick={reset}>{copy.output.reset}</button>
        </div>
      )}
      {feedbackOpen && (
        <div className="result-feedback">
          <span className="feedback-title">{copy.output.feedback}</span>
          <p>{copy.output.feedbackHint}</p>
          <textarea
            value={feedback}
            maxLength={600}
            placeholder={copy.output.feedbackPlaceholder}
            onChange={(event) => setFeedback(event.target.value)}
          />
          <div className="feedback-actions">
            <button className="btn primary tiny" type="button" disabled={!feedback.trim() || refining} onClick={() => void submitFeedback()}>
              {refining ? copy.output.refining : copy.output.refine}
            </button>
            <span className="mono muted">{feedback.length}/600</span>
          </div>
          {feedbackStatus && <p className="feedback-status">{feedbackStatus}</p>}
          {feedbackError && <p className="feedback-error">{feedbackError}</p>}
        </div>
      )}
    </figure>
  );
}

function AdjustmentControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="result-adjustment">
      <span>{label}<strong>{value}%</strong></span>
      <input type="range" min={70} max={130} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
