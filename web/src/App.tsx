import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { reduceEvent, initialRunState, type RunState, type RunEvent } from "./types";
import { startRun, subscribeToRun, uploadVideo } from "./api";
import { UploadPanel, type RunOptions } from "./components/UploadPanel";
import { Loop1Panel } from "./components/Loop1Panel";
import { Loop2Card } from "./components/Loop2Card";
import { FinalGallery } from "./components/FinalGallery";
import { InfraPanel } from "./components/InfraPanel";
import { Spinner } from "./components/bits";

function runReducer(state: RunState, action: RunEvent | { type: "reset" } | { type: "uploading" }): RunState {
  if (action.type === "reset") return initialRunState;
  if (action.type === "uploading") return { ...initialRunState, phase: "uploading" };
  return reduceEvent(state, action);
}

const PHASE_LABEL: Record<string, string> = {
  uploading: "uploading video",
  extracting: "extracting frames",
  loop1: "loop 1 / selecting frames",
  loop2: "loop 2 / refining edits",
  flourish: "zero.xyz pro pass",
};

const GITHUB_URL = "https://github.com/paulyao825/Loopic-AWS-Hackathon";

export default function App() {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [uiError, setUiError] = useState<string>();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const unsubscribe = useRef<() => void>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const launch = useCallback(async (videoIdPromise: Promise<string>, opts: RunOptions) => {
    try {
      setUiError(undefined);
      unsubscribe.current?.();
      dispatch({ type: "uploading" });
      const videoId = await videoIdPromise;
      const runId = await startRun({ videoId, ...opts });
      unsubscribe.current = subscribeToRun(runId, dispatch, (message) => {
        setUiError(message);
        dispatch({ type: "reset" });
      });
    } catch (err) {
      setUiError(String(err instanceof Error ? err.message : err));
      dispatch({ type: "reset" });
    }
  }, []);

  const busy = !["idle", "done", "error"].includes(state.phase);
  const frameById = new Map(state.frames.map((f) => [f.id, f]));
  const error = uiError ?? state.error;

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <h1>Loopic</h1>
            <span className="tagline">AI visual storytelling assistant</span>
          </div>
        </div>
        <div className="topbar-right">
          <a className="btn ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <button className="theme-toggle" onClick={() => setTheme((cur) => (cur === "light" ? "dark" : "light"))}>
            <span className="theme-dot" />
            {theme === "light" ? "Dark" : "Light"}
          </button>
          {state.config && (
            <>
              <span className={`backend-chip big ${state.config.editorBackend}`}>
                editor: {state.config.editorBackend}
              </span>
              <span className="judge-chip">judge: {state.config.judge}</span>
              <span className="judge-chip">compute: {state.config.compute}</span>
            </>
          )}
          {busy && <Spinner label={PHASE_LABEL[state.phase] ?? state.phase} />}
          {(state.phase === "done" || state.phase === "error") && (
            <button className="btn ghost" onClick={() => dispatch({ type: "reset" })}>
              new run
            </button>
          )}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {state.config?.judgeNote && <div className="info-banner">Judge: {state.config.judgeNote}</div>}
      {state.judgeFallback && <div className="info-banner">{state.judgeFallback}</div>}

      {state.phase === "idle" || state.phase === "uploading" ? (
        <main className="hero">
          <div className="hero-copy fade-in">
            <span className="eyebrow">Video to photo intelligence</span>
            <h2>
              Find the best photos hidden inside your videos.
            </h2>
            <p>
              Upload a video and Loopic extracts strong frames, scores visual quality, refines edits, and returns a
              finished set you can use for posts, thumbnails, profiles, and highlights.
            </p>
            <div className="hero-actions">
              <a className="btn primary" href="#upload">
                Upload video
              </a>
              <a className="btn ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">
                View repo
              </a>
            </div>
            <div className="feature-row" aria-label="Loopic capabilities">
              <span>Frame selection</span>
              <span>Self-critique</span>
              <span>Photo edits</span>
            </div>
          </div>
          <UploadPanel
            busy={state.phase === "uploading"}
            onRunFile={(file, opts) => launch(uploadVideo(file), opts)}
          />
        </main>
      ) : (
        <main className="pipeline">
          <InfraPanel state={state} />
          {state.frames.length > 0 && (
            <Loop1Panel
              frames={state.frames}
              rounds={state.loop1Rounds}
              done={state.loop1Done}
              running={state.phase === "loop1"}
            />
          )}

          {state.loop2Order.length > 0 && (
            <section className="loop2-section">
              <header className="section-head">
                <span className="loop-tag">LOOP 2</span>
                <h2>Edit refinement</h2>
                <span className="muted">
                  one bounded correction per round, lowest-scoring axis first / bar {state.config?.bar ?? 7.5}
                </span>
              </header>
              <div className="loop2-grid">
                {state.loop2Order.map((frameId) => {
                  const loop = state.loop2[frameId];
                  return loop ? (
                    <Loop2Card
                      key={frameId}
                      frame={frameById.get(frameId)}
                      loop={loop}
                      backend={state.config?.editorBackend ?? "local"}
                      bar={state.config?.bar}
                    />
                  ) : null;
                })}
              </div>
            </section>
          )}

          {state.phase === "flourish" && (
            <section className="card fade-in">
              <Spinner label={`zero.xyz pro enhancement on ${state.flourish?.frameId}...`} />
            </section>
          )}

          {state.results && <FinalGallery results={state.results} flourishVia={state.flourish?.via} />}
        </main>
      )}

      <footer className="footer">
        <span>Built with Akash, Amazon Web Services, Cursor, TypeScript, and Zero.xyz.</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          paulyao825/Loopic-AWS-Hackathon
        </a>
      </footer>
    </div>
  );
}
