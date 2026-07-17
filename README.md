# Topshot — a self-correcting photo agent

Upload a video; an agent picks the best N frames and edits each one in a
critique-and-refine loop until the edit clears a quality bar. The agent
**plans, acts, observes, and self-corrects** — every round is streamed
live to the UI: score climbing, corrections named, missteps reverted.

## Run it

```bash
npm install

# demo / development (API on :4000, UI on :5173 with hot reload)
npm run dev

# or single-process: build the UI once, serve everything on :4000
npm run build && npm start
```

Open the app, click **Use sample reel** (generates a test video with
deliberately bad exposure — no footage needed) or drop in any video.

Extras:

- `npm run demo` — the original all-mock console demo (score climbing on fake data).

## Configuration — `topshot.config.json`

Reloaded on **every run** — edit it while the server is up and the next
run picks it up.

```jsonc
{
  "judge": {
    "provider": "heuristic",   // heuristic | openai | gemini | anthropic | openrouter
    "model": "",               // empty = provider default (gpt-4o-mini, gemini-2.5-flash, ...)
    "apiKeyEnv": "",           // empty = provider default (OPENAI_API_KEY, GEMINI_API_KEY, ...)
    "baseUrl": ""              // override for proxies / compatible endpoints
  },
  "loop": { "bar": 7.5, "maxRounds": 8 },
  "zero": {
    "enabled": true,
    "maxPayUsdc": 0,           // > 0 allows paid Zero.xyz invocations up to this per call
    "flourishQuery": "image upscale enhance super-resolution photo",
    "editQuery": "photo image editing crop resize exposure"
  }
}
```

Put API keys in `.env` (see `.env.example`). Judge selection is fail-safe:
a missing key or a provider error mid-run degrades to the pixel-heuristic
judge and tells you why (banner in the UI, `judge:fallback` event).
OpenAI, Gemini, and OpenRouter share one OpenAI-compatible client;
Anthropic uses its native API — all four emit the same axes and hint
vocabulary, so the loop is identical under every judge.

## Zero.xyz — real integration

The `@zeroxyz/cli` is bundled. Every run performs a **live capability
search** against the Zero catalog (free, no account) and the UI shows
what it found — e.g. "AI Image Upscaler / Super-Resolution (ESRGAN via
fal.ai), $0.1/call, healthy". Paid invocation is gated honestly:

1. `npx zero auth login` (creates a wallet) and fund it with USDC on Base,
2. set `zero.maxPayUsdc` in `topshot.config.json` (e.g. `0.15`),

and the final flourish pass sends the winning frame to the discovered
capability for real remote enhancement (x402 payment handled by the CLI).
Without a wallet the run still works: discovery stays real, the flourish
renders locally, and the event stream reports `via: "local-render"` with
the reason. Remote failures fall back the same way mid-run.

## Architecture

One reusable `Loop` abstraction (`server/src/core/loop.ts`) is the spine:

```
act() -> observe() -> score() -> correct() -> ... until score >= bar or round cap
```

`runLoop()` owns the score cache (keyed per candidate — reward returns in
seconds) and logs every round (input, output, per-axis critique,
correction) which the server streams to the UI over SSE.

Two instances plug into it:

| | Loop 1 — frame selection | Loop 2 — edit refinement |
|---|---|---|
| act | pick top-N frames (quality − diversity penalty) | `Editor.edit(frame, recipe)` |
| observe | pixel stats + near-dupe pairs | vision-judge critique of edited pixels |
| score | `quality`, `variety` axes | `cropFraming`, `exposure`, `contrast`, `color`, `whiteBalance`, `sharpness` |
| correct | ban near-dupes / rebalance weights | adjust ONLY the lowest axis's recipe param |

The edit space is bounded and named — every parameter has a hard range
and exactly one judge axis that can move it:

| Recipe param | Range | Judge axis | Hints |
|---|---|---|---|
| `crop` (x,y,w,h) | ≥ 0.2 side | cropFraming | shift-\*, tighten (zoom in), loosen |
| `exposureEv` | −2 … +2 | exposure | brighten, darken |
| `contrast` | 0.6 … 1.6 | contrast | more/less-contrast |
| `saturation` | 0.4 … 1.8 | color | more/less-saturation |
| `temperature` | −1 … +1 | whiteBalance | warmer, cooler |
| `sharpen` | 0 … 1 | sharpness | sharpen, soften (+ loosen for over-tight crops) |

Overall score = 0.6·mean + 0.4·worst axis, so one bad axis can't hide
behind five good ones. Correction mechanics (all visible in the UI):

- judge hints are directions only (`brighten`, `shift-left`, `tighten`, ...);
  the loop picks magnitudes
- repeated hint → keep step; flipped hint → halve step (binary-search settling)
- a correction that drops the overall score > 0.5 is **reverted** and the
  step halved (backfire guard)
- shift clamped at the frame edge → tighten first to make room
- no actionable hint left → stop early, flaws are in the source

### Editor backends (`local` | `zero`, toggle in the UI)

One `Editor` interface (`server/src/backends/editor.ts`); Loop 2 never
knows which is active.

- `local` (default): sharp-based recipe rendering in-process. Fast — the
  in-loop demo path.
- `zero`: Zero.xyz-driven with the same recipe interface — live catalog
  discovery, remote invocation when wallet + budget allow, local render
  with honest external-call latency otherwise.
- Recommended demo config: `local` in the loop, plus the **Zero.xyz pro
  flourish** — a one-shot enhancement pass on the winning frame only,
  outside the loop (toggleable on the winner card).

### External-system slots (mock-first)

| Slot | Interface | Status |
|---|---|---|
| Frame extraction | `FrameExtractor` | **real** — bundled ffmpeg-static |
| Fast frame scorer | `FrameScorer` | **real** — laplacian sharpness / exposure / edge-energy interest |
| Vision judge | `VisionJudge` | **real** — pixel heuristics or OpenAI / Gemini / Claude / OpenRouter via config |
| Editor `local` | `Editor` | **real** — sharp |
| Editor `zero` | `Editor` | **real discovery** via @zeroxyz/cli; paid invocation gated on wallet + budget |
| Compute | `ComputeRunner` | Akash slot — mock (runs inline) |
| Data layer | `DataStore` | Nexla slot — mock (in-memory) |

## UI (demo flow)

1. Drop a video (or sample reel), set N, pick the editor backend.
2. **Loop 1** — filmstrip of extracted frames re-ranks live; round cards
   show quality/variety climbing and which near-dupe got banned.
3. **Loop 2** — one card per pick: round 1 vs latest side-by-side, a
   scrubber to replay any round's image, per-axis meters + one-line
   reasons, and the exact correction taken each round.
4. **Finished set** — winner starred with the Zero.xyz pro-pass toggle;
   every card shows which backend produced it.

## Repo layout

```
server/src/core/loop.ts          the Loop abstraction (act/observe/score/correct)
server/src/loops/                the two LoopSpecs
server/src/backends/             Editor / VisionJudge / FrameScorer / stubs (+ mocks)
server/src/media/                ffmpeg + sharp pixel analysis
server/src/api/                  run orchestrator + SSE event types
server/src/server.ts             Express app (upload, run, events, media)
server/src/demo.ts               all-mock console demo
web/                             React + Vite frontend
```
