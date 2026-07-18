import { useRef, useState } from "react";

export interface RunOptions {
  n: number;
}

export function UploadPanel({
  busy,
  onRunFile,
}: {
  busy: boolean;
  onRunFile: (file: File, opts: RunOptions) => void;
}) {
  const [n, setN] = useState(3);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const opts: RunOptions = { n };

  return (
    <section className="card upload-panel fade-in" id="upload">
      <header className="upload-head">
        <span className="eyebrow">Start a run</span>
        <h2>Upload your video</h2>
        <p className="muted">Precious Frame works best with short reels, clips, and highlight videos.</p>
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
            Drop a video here or <span className="link">browse</span>
          </p>
        )}
      </div>

      <div className="controls">
        <label className="control">
          <span className="control-label">
            best shots <strong className="mono">N = {n}</strong>
          </span>
          <input type="range" min={1} max={6} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>

        <p className="muted">Frames are selected by GLM Vision and refined locally with Sharp.</p>
      </div>

      <div className="actions">
        <button className="btn primary" disabled={!file || busy} onClick={() => file && onRunFile(file, opts)}>
          {busy ? "working…" : "Run the loops"}
        </button>
      </div>
    </section>
  );
}
