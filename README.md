# Precious Frame - AI visual storytelling assistant

Precious Frame finds the best photos hidden inside videos. Upload a video, and the
agent extracts candidate frames, selects the strongest and most varied moments,
then improves each one through a critique-and-refine loop.

**Don't miss any frames.** Precious Frame does not create fake AI pictures. It uses AI to
attract real-world clip photos: the actual moments already inside your videos.

The current prototype focuses on discovering and improving strong photo moments:

- frame extraction from raw video
- multimodal frame selection for composition, real moments, and storytelling
- local visual scoring for sharpness, exposure, contrast, color, and interest
- looped edit refinement with named corrections
- visible round history, score changes, and final output gallery
- AWS Bedrock judge support and optional S3 image hosting
- Zero.xyz discovery and optional paid flourish pass
- Akash-ready container deployment

Every run is streamed live to the UI. You can see the agent plan, act, observe,
score, correct, and stop when the output clears the quality bar.

## Run it

```bash
npm install

# API on :4000, UI on :5173 with hot reload
npm run dev

# or build the UI once and serve everything from the API
npm run build && npm start
```

Open the app and upload a video file to start a run.

Extra:

- `npm run demo` - all-mock console demo
- `npm test` - unit tests for model-output parsing and score weighting

## Required setup

Only one external service is required for AI frame selection:

1. Create an AkashML account and generate a new key in **Settings -> API Keys**.
2. Copy `.env.example` to `.env`.
3. Set `AKASHML_API_KEY` in `.env`. Never commit or paste the value into chat.
4. Keep `judge.provider` as `"akashml"` in `precious-frame.config.json`.

AkashML API keys use the `akml-...` format. An Akash Console deployment key is
not an inference key and cannot call a vision model. The configured default is
`Qwen/Qwen3.5-35B-A3B`, a multimodal model. You can override it with
`JUDGE_MODEL` after confirming another model reports image input support in
`GET https://api.akashml.com/v1/models`.

Without an AkashML key, the full app still runs using local pixel scoring and
shows the fallback in the infrastructure panel.

## Configuration - `precious-frame.config.json`

The config file is reloaded on every run, so edits apply without restarting the
server.

```jsonc
{
  "judge": {
    "provider": "akashml",     // akashml | heuristic | openai | gemini | anthropic | openrouter | bedrock
    "model": "Qwen/Qwen3.5-35B-A3B",
    "apiKeyEnv": "",           // empty = provider default env var
    "baseUrl": ""              // override for proxies / compatible endpoints
  },
  "aws": {
    "region": "us-east-1",
    "s3Bucket": ""
  },
  "loop": { "bar": 7.5, "maxRounds": 8 },
  "zero": {
    "enabled": true,
    "maxPayUsdc": 0,
    "flourishQuery": "image upscale enhance super-resolution photo",
    "editQuery": "photo image editing crop resize exposure"
  }
}
```

Put API keys in `.env`. Missing keys or provider errors degrade to local pixel
scoring, and the UI shows the fallback reason.

## Technical stack audit

| Component | Needed now | Setup | Simpler default |
| --- | --- | --- | --- |
| Node.js 22 + TypeScript | Yes | Install Node.js, then `npm install` | Existing stack |
| ffmpeg-static | Yes | Installed by npm | No system FFmpeg install |
| Sharp | Yes | Installed by npm | Local crop, color, and sharpen |
| AkashML vision API | Yes for AI selection | New `AKASHML_API_KEY` in `.env` or host secrets | Falls back to local scorer |
| Container host | Yes for production API | Deploy the included Dockerfile | Railway/Render is easier; Akash fits the hackathon |
| Vercel | Frontend only | Set `VITE_API_BASE` to the container API URL | Keep the existing Vercel site |
| AWS Bedrock / S3 | No | AWS credentials and optional bucket | Use AkashML + local run storage |
| Zero.xyz | No | Login, funded wallet, explicit budget | Use local Sharp; zero spend by default |

The API accepts videos up to 300MB and keeps an SSE connection open while
FFmpeg and the model run. Vercel Functions cap request bodies at 4.5MB, so the
production API must run as the included long-lived container. Vercel remains a
good static frontend host once `VITE_API_BASE` points to that container.

## Built With

- Akash
- AkashML
- Amazon Web Services
- Cursor
- TypeScript
- Zero.xyz

## AWS

Precious Frame includes two AWS integration points:

- **Bedrock vision judge** - set `judge.provider` to `"bedrock"` and the edit
  critique runs through AWS Bedrock using the SDK default credential chain.
- **S3 image hosting** - set `aws.s3Bucket` to host intermediate images through
  presigned URLs for remote editor calls.

If AWS credentials are missing, the run continues with the heuristic judge and
shows the fallback note in the UI.

## Zero.xyz

Precious Frame uses `@zeroxyz/cli` for live capability discovery. Discovery is free and
visible in the infrastructure panel.

Paid invocation is gated:

1. Run `npx zero auth login`.
2. Fund the wallet with USDC on Base.
3. Set `zero.maxPayUsdc` in `precious-frame.config.json`.

Without a wallet or budget, Precious Frame still works. The final flourish falls back to
a local enhancement pass and reports that clearly.

## Akash

The repo includes:

- `Dockerfile` - single container serving API + built web UI
- `deploy/akash.sdl.yaml` - Akash deployment template

Precious Frame detects Akash provider environment variables at runtime and reports the
compute host in the UI infrastructure panel.

## How It Works

Precious Frame uses one reusable loop abstraction:

```txt
act -> observe -> score -> correct -> repeat
```

Two product loops plug into it:

| Loop | Goal | Output |
| --- | --- | --- |
| Loop 1 | Multimodal aesthetic score + pixel quality + diversity | Candidate photos |
| Loop 2 | Improve each chosen frame through bounded edits | Refined photos |

Loop 1 sends six extracted frames per model request, combines the model's
aesthetic score (55%) with local sharpness, exposure, and visual activity, then
removes near-duplicates. The edit loop changes one parameter at a time: crop, exposure, contrast,
saturation, temperature, or sharpening. A judge scores concrete visual axes and
returns directional hints such as `brighten`, `tighten`, or `warmer`.

## What's Next for Precious Frame

While the current prototype focuses on discovering and improving the best
moments hidden inside videos, Precious Frame can become a complete AI visual storytelling
assistant.

Future directions:

1. **Personalized AI aesthetic model** - learn from saved photos, preferred
   styles, previous editing choices, and engagement patterns to understand what
   makes a photo feel like each user.
2. **Advanced style transformation** - create CCD camera aesthetics, Y2K styles,
   film photography, cinematic color grading, magazine/editorial looks, meme
   templates, and platform-specific formats.
3. **Intelligent content repurposing** - transform videos into Instagram posts,
   TikTok thumbnails, YouTube thumbnails, profile photos, highlight covers, and
   promotional materials.
4. **AI creative assistant for professionals** - support photo culling, batch
   editing suggestions, consistent style matching, client-specific preferences,
   and faster post-production workflows.
5. **Photo intelligence SDK** - let camera apps, social platforms, creator tools,
   sports/event platforms, memory apps, and travel apps integrate Precious Frame as an AI
   layer for understanding which moments matter.

Today, Precious Frame finds the best photos hidden inside videos. Tomorrow, Precious Frame
becomes the AI that understands every visual moment worth remembering.

## Repo Layout

```txt
server/src/core/loop.ts          reusable act/observe/score/correct loop
server/src/loops/                frame selection and edit refinement specs
server/src/backends/             editor, judge, scorer, AWS, Zero.xyz, compute
server/src/media/                ffmpeg and sharp image analysis
server/src/api/                  run orchestration and event types
server/src/server.ts             Express API, uploads, SSE, static web serving
web/                             React + Vite frontend
```
