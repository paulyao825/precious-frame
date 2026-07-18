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

const FUTURE_DIRECTIONS = [
  {
    number: "01",
    title: "A personal aesthetic model",
    copy: "Learn from saved photos, preferred styles, previous edits, and engagement patterns to understand what makes an image feel like you.",
  },
  {
    number: "02",
    title: "Advanced style transformation",
    copy: "Turn one real moment into CCD, Y2K, film, cinematic, editorial, meme, and platform-specific versions.",
  },
  {
    number: "03",
    title: "Intelligent repurposing",
    copy: "Prepare the right crop, treatment, and visual emphasis for Instagram, TikTok, YouTube, profiles, and promotions.",
  },
  {
    number: "04",
    title: "A professional creative assistant",
    copy: "Support photo culling, batch suggestions, consistent style matching, client preferences, and faster post-production.",
  },
  {
    number: "05",
    title: "Photo intelligence everywhere",
    copy: "Bring Loopic to camera apps, social platforms, creator tools, sports, events, memories, and travel products as an SDK.",
  },
];

export default function App() {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [uiError, setUiError] = useState<string>();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem("loopic-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const unsubscribe = useRef<() => void>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("loopic-theme", theme);
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
  const isLanding = state.phase === "idle" || state.phase === "uploading";
  const frameById = new Map(state.frames.map((f) => [f.id, f]));
  const error = uiError ?? state.error;

  return (
    <div className="page" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Loopic home">
          <span className="brand-word">Loopic</span><span className="brand-stop">.</span>
        </a>
        {isLanding ? (
          <nav className="site-nav" aria-label="Primary navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#uses">Use cases</a>
            <a href="#future">What is next</a>
          </nav>
        ) : <span />}
        <div className="topbar-right">
          <a className="text-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          <button
            className="theme-toggle"
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            onClick={() => setTheme((cur) => (cur === "light" ? "dark" : "light"))}
          >
            <span className="theme-track"><span className="theme-knob" /></span>
            <span>{theme === "light" ? "Dark" : "Light"}</span>
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

      {isLanding ? (
        <LandingPage
          busy={state.phase === "uploading"}
          onRunFile={(file, opts) => launch(uploadVideo(file), opts)}
        />
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
        <div>
          <strong>Loopic.</strong>
          <span>AI visual storytelling assistant</span>
        </div>
        <span>Built with Akash, Amazon Web Services, Cursor, TypeScript, and Zero.xyz.</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">Source on GitHub ↗</a>
      </footer>
    </div>
  );
}

function LandingPage({ busy, onRunFile }: { busy: boolean; onRunFile: (file: File, opts: RunOptions) => void }) {
  return (
    <main className="landing">
      <div className="edition-line">
        <span>Prototype edition · 2026</span>
        <span>Video-to-photo intelligence</span>
        <span>Every frame deserves a second look</span>
      </div>

      <section className="hero">
        <div className="hero-copy fade-in">
          <span className="kicker">The visual moment report</span>
          <h1>Your video is full of photographs waiting to be found.</h1>
          <p className="hero-dek">
            Loopic extracts the strongest moments, critiques its own choices, improves the edits, and returns a
            finished set for the places you publish.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#upload">Start with a video</a>
            <a className="btn ghost" href="#how-it-works">Read how it works</a>
          </div>
          <div className="hero-facts" aria-label="Loopic capabilities">
            <div><strong>01</strong><span>Extract</span></div>
            <div><strong>02</strong><span>Select</span></div>
            <div><strong>03</strong><span>Refine</span></div>
          </div>
        </div>
        <UploadPanel busy={busy} onRunFile={onRunFile} />
      </section>

      <figure className="editorial-visual">
        <img
          src="/images/loopic-contact-sheet.jpg"
          alt="A contact sheet of video frames with standout moments selected for a finished photograph"
        />
        <figcaption>
          <span>Contact sheet study no. 01</span>
          <span>From continuous motion to a deliberate frame</span>
        </figcaption>
      </figure>

      <div className="news-strip" aria-label="Product summary">
        <span>Now processing</span>
        <p>One video. Thousands of frames. A small set worth keeping.</p>
      </div>

      <section className="story-section problem-section">
        <header className="section-intro">
          <span className="section-number">I.</span>
          <p className="kicker">The problem</p>
          <h2>The best frame rarely announces itself.</h2>
        </header>
        <div className="editorial-columns">
          <p className="drop-cap">
            A short clip can hold thousands of expressions, gestures, compositions, and changes in light. Finding the
            one frame that feels intentional is still a slow manual job.
          </p>
          <p>
            Loopic treats a video like a contact sheet. It evaluates sharpness, exposure, contrast, color, visual
            interest, and variety, then keeps the moments that work together as a set.
          </p>
          <blockquote>
            “Today, Loopic finds the best photos hidden inside videos.”
          </blockquote>
        </div>
      </section>

      <section className="story-section" id="how-it-works">
        <header className="section-intro split-heading">
          <div>
            <span className="section-number">II.</span>
            <p className="kicker">The method</p>
            <h2>It does not stop at the first answer.</h2>
          </div>
          <p>
            The agent makes a choice, observes the result, scores it, applies one bounded correction, and repeats
            until the work clears the quality bar or reaches the round cap.
          </p>
        </header>
        <div className="method-grid">
          <article>
            <span className="method-index">01 / Contact sheet</span>
            <h3>Extract candidate frames</h3>
            <p>Turn raw motion into a visual sequence while preserving the timing of every candidate moment.</p>
          </article>
          <article>
            <span className="method-index">02 / Loop one</span>
            <h3>Select strength and variety</h3>
            <p>Re-rank the strongest frames and remove near-duplicates so the final set tells more than one beat.</p>
          </article>
          <article>
            <span className="method-index">03 / Loop two</span>
            <h3>Critique and refine</h3>
            <p>Adjust crop, exposure, contrast, saturation, temperature, or sharpening one decision at a time.</p>
          </article>
        </div>
        <div className="loop-formula" aria-label="Loopic processing loop">
          <span>Act</span><b>→</b><span>Observe</span><b>→</b><span>Score</span><b>→</b><span>Correct</span><b>→</b><span>Repeat</span>
        </div>
      </section>

      <section className="story-section use-section" id="uses">
        <div className="use-copy">
          <span className="section-number">III.</span>
          <p className="kicker">One moment, many lives</p>
          <h2>Made for the places visual stories actually go.</h2>
          <p>
            The current prototype returns a strong finished photo set. The next step is to understand the visual goal
            of each destination and shape the output around it.
          </p>
        </div>
        <div className="use-list">
          {["Instagram posts", "TikTok thumbnails", "YouTube thumbnails", "Profile photos", "Highlight covers", "Promotional materials"].map((item, index) => (
            <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
          ))}
        </div>
      </section>

      <section className="story-section future-section" id="future">
        <header className="section-intro split-heading">
          <div>
            <span className="section-number">IV.</span>
            <p className="kicker">What is next</p>
            <h2>From visual quality to personal visual taste.</h2>
          </div>
          <p>
            General quality is only the beginning. Loopic is designed to grow into an assistant that understands why
            one image feels like yours and another does not.
          </p>
        </header>
        <div className="future-list">
          {FUTURE_DIRECTIONS.map((item) => (
            <article key={item.number}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="story-section pro-section">
        <div>
          <span className="section-number">V.</span>
          <p className="kicker">For working photographers</p>
          <h2>More time creating. Less time sorting.</h2>
        </div>
        <div className="pro-copy">
          <p>
            Loopic is not intended to replace a photographer's eye. It is an editing partner for the repetitive work:
            culling, comparing, checking consistency, and preparing a first pass.
          </p>
          <ul>
            <li>Automatic photo culling</li>
            <li>Batch editing suggestions</li>
            <li>Consistent style matching</li>
            <li>Client-specific preferences</li>
          </ul>
        </div>
      </section>

      <section className="story-section stack-section">
        <header className="section-intro">
          <span className="section-number">VI.</span>
          <p className="kicker">Under the press</p>
          <h2>A visible, inspectable AI workflow.</h2>
        </header>
        <div className="stack-grid">
          <article><strong>AWS</strong><span>Bedrock vision judging and optional S3 image hosting</span></article>
          <article><strong>Akash</strong><span>Container-ready distributed compute deployment</span></article>
          <article><strong>Zero.xyz</strong><span>Capability discovery and optional paid flourish pass</span></article>
          <article><strong>TypeScript</strong><span>One streamed product workflow from API to interface</span></article>
        </div>
        <p className="stack-note">
          Every run streams its plan, scores, corrections, fallbacks, and final output live. The system keeps working
          locally when remote credentials or paid services are unavailable.
        </p>
      </section>

      <section className="closing-section">
        <p className="kicker">The next frame is already there</p>
        <h2>Turn motion into something worth remembering.</h2>
        <div className="hero-actions">
          <a className="btn primary" href="#upload">Upload a video</a>
          <a className="btn ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">Explore the source ↗</a>
        </div>
      </section>
    </main>
  );
}
