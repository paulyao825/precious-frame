import { useRef, useState } from "react";
import type { PhotoPreference } from "../types";
import type { AppCopy } from "../i18n";

export interface RunOptions {
  n: number;
  preference: PhotoPreference;
}

const PREFERENCE_VALUES: PhotoPreference[] = ["balanced", "people-emotion", "competition", "action-energy", "scenic-composed"];

export function UploadPanel({
  busy,
  onRunFile,
  copy,
}: {
  busy: boolean;
  onRunFile: (file: File, opts: RunOptions) => void;
  copy: AppCopy;
}) {
  const [n, setN] = useState(3);
  const [preference, setPreference] = useState<PhotoPreference>("balanced");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const opts: RunOptions = { n, preference };

  return (
    <section className="card upload-panel fade-in" id="upload">
      <header className="upload-head">
        <span className="eyebrow">{copy.upload.eyebrow}</span>
        <h2 id="run-section-title">{copy.upload.title}</h2>
        <p className="muted">{copy.upload.description}</p>
      </header>

      <div
        className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) setFile(f);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <p>
            <strong>{file.name}</strong> <span className="muted">({(file.size / 1e6).toFixed(1)} MB)</span>
          </p>
        ) : (
          <p>
            {copy.upload.drop} <span className="link">{copy.upload.browse}</span>
          </p>
        )}
      </div>

      <div className="controls">
        <fieldset className="preference-control">
          <legend className="control-label">{copy.upload.preferenceLegend}</legend>
          <div className="preference-grid">
            {PREFERENCE_VALUES.map((value) => {
              const option = copy.preferences[value];
              return <label className={`preference-option ${preference === value ? "selected" : ""}`} key={value}>
                <input
                  type="radio"
                  name="photo-preference"
                  value={value}
                  checked={preference === value}
                  onChange={() => setPreference(value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            })}
          </div>
        </fieldset>

        <label className="control">
          <span className="control-label">
            {copy.upload.bestShots} <strong className="mono">N = {n}</strong>
          </span>
          <input type="range" min={1} max={6} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>

        <p className="muted">{copy.upload.judged}</p>
      </div>

      <div className="actions">
        <button className="btn primary" disabled={!file || busy} onClick={() => file && onRunFile(file, opts)}>
          {busy ? copy.upload.working : copy.upload.run}
        </button>
      </div>
    </section>
  );
}
