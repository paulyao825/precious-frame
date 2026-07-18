import { useRef, useState } from "react";

export interface RunOptions {
  n: number;
  editorBackend: "local" | "zero";
  flourish: boolean;
}

export function UploadPanel({
  busy,
  onRunFile,
}: {
  busy: boolean;
  onRunFile: (file: File, opts: RunOptions) => void;
}) {
  const [n, setN] = useState(3);
  const [backend, setBackend] = useState<"local" | "zero">("local");
  const [flourish, setFlourish] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const opts: RunOptions = { n, editorBackend: backend, flourish };

  return (
    <section className="card upload-panel fade-in" id="upload">
      <header className="upload-head">
        <span className="eyebrow">Start a run</span>
        <h2>Upload your video</h2>
        <p className="muted">Loopic works best with short reels, clips, and highlight videos.</p>
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

        <div className="control">
          <span className="control-label">editor backend</span>
          <div className="segmented">
            <button className={backend === "local" ? "on" : ""} onClick={() => setBackend("local")}>
              local
            </button>
            <button className={backend === "zero" ? "on" : ""} onClick={() => setBackend("zero")}>
              zero.xyz
            </button>
          </div>
        </div>

        <label className="control checkbox">
          <input type="checkbox" checked={flourish} onChange={(e) => setFlourish(e.target.checked)} />
          <span className="control-label">Zero.xyz pro flourish on winner</span>
        </label>
      </div>

      <div className="actions">
        <button className="btn primary" disabled={!file || busy} onClick={() => file && onRunFile(file, opts)}>
          {busy ? "working…" : "Run the loops"}
        </button>
      </div>
    </section>
  );
}
