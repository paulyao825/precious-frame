# Precious Frame

AI visual storytelling assistant. Users upload a video in the browser; the app extracts real
frames (client-side Canvas), then two loops select the strongest frames and refine them. See
`README.md` for the full product overview, architecture, and standard commands.

npm workspaces monorepo:
- `server` — Express API (`@precious-frame/server`), runs on port `4000`.
- `web` — React + Vite UI (`@precious-frame/web`), dev server on port `5173`, proxies `/api` and `/media` to the API.

Standard commands live in the root `package.json` and `README.md` (`npm run dev`, `npm run build`,
`npm start`, `npm test`, `npm run typecheck`). There is no lint script configured.

## Cursor Cloud specific instructions

- The environment (Node 22, deps installed) is already set up by the startup update script. Just run the services.
- Start both services with `npm run dev` (API on `:4000` + Vite on `:5173`). Do the app in a browser via `http://localhost:5173`. `npm start` (prod-style) requires `npm run build` first and then serves the built UI from the API on `:4000`.
- No API keys are required to run or test. `MOONSHOT_API_KEY`/`GEMINI_API_KEY` are unset by default, and the pipeline transparently falls back to local heuristic image scoring. Tests mock `fetch`, so they never need live keys.
- There is no database, Docker, or other external service — storage is the local filesystem under `server/data/` (gitignored). Nothing else needs to be started.
- The core pipeline can be exercised without a browser by POSTing JPEGs to the SSE endpoint `POST /api/run` (multipart `frames` field, up to 24). This streams `loop1`/`loop2` events and ends with a `run:done` event — useful for quick backend verification.
- For a full browser E2E test you need a video file; generate one with ffmpeg (`ffmpeg -f lavfi -i testsrc=duration=4:size=640x480:rate=8 -pix_fmt yuv420p sample.mp4`) since the repo ships no sample media.
