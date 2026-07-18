import { readFile } from "node:fs/promises";
import type { JudgeConfig } from "../appConfig.js";
import type { Frame, FrameQuality } from "../domain/types.js";
import type { FrameScorer } from "./frameScorer.js";

const BATCH_SIZE = 6;

const SYSTEM_PROMPT = `You select real photographs hidden inside a video contact sheet.
Judge the photographic value of every supplied frame. Favor intentional composition, a clear subject,
authentic human emotion or action, visual storytelling, and a moment that would be worth saving.
Do not reward synthetic-looking imagery or mere technical sharpness. Each id must appear exactly once.
Respond ONLY with JSON: {"frames":[{"id":"frame_001","aesthetic":8.4,"reason":"short reason"}]}`;

interface ModelFrameScore {
  id: string;
  aesthetic: number;
  reason?: string;
}

/** Adds multimodal aesthetic judgment to the fast local pixel scorer. */
export class LlmFrameScorer implements FrameScorer {
  private readonly scores = new Map<string, number>();
  private failed = false;

  constructor(
    private readonly local: FrameScorer,
    private readonly cfg: JudgeConfig,
    private readonly onFallback: (err: unknown) => void,
  ) {}

  async prepare(frames: Frame[]): Promise<void> {
    if (this.failed) return;
    try {
      for (let i = 0; i < frames.length; i += BATCH_SIZE) {
        const batch = frames.slice(i, i + BATCH_SIZE);
        const modelScores = await this.scoreBatch(batch);
        for (const item of modelScores) this.scores.set(item.id, clamp01(item.aesthetic / 10));
      }
    } catch (err) {
      this.failed = true;
      this.scores.clear();
      this.onFallback(err);
    }
  }

  async score(frame: Frame): Promise<FrameQuality> {
    const local = await this.local.score(frame);
    const aesthetic = this.scores.get(frame.id);
    return aesthetic === undefined ? local : { ...local, aesthetic };
  }

  similarity(a: Frame, b: Frame): Promise<number> {
    return this.local.similarity(a, b);
  }

  private async scoreBatch(frames: Frame[]): Promise<ModelFrameScore[]> {
    const content: Array<Record<string, unknown>> = [
      { type: "text", text: `Score these ${frames.length} frames in the same order. Compare them against each other.` },
    ];
    for (const frame of frames) {
      const jpeg = await readFile(frame.uri);
      content.push({ type: "text", text: `${frame.id} at ${frame.t.toFixed(2)} seconds` });
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } });
    }

    const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        max_tokens: 900,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`${this.cfg.provider} frame scorer failed: ${res.status} ${(await res.text()).slice(0, 240)}`);
    }
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return parseFrameScores(body.choices?.[0]?.message?.content ?? "", frames.map((f) => f.id));
  }
}

export function parseFrameScores(text: string, expectedIds: string[]): ModelFrameScore[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`frame scorer returned no JSON: ${text.slice(0, 160)}`);
  const parsed = JSON.parse(text.slice(start, end + 1)) as { frames?: ModelFrameScore[] };
  if (!Array.isArray(parsed.frames)) throw new Error("frame scorer returned no frames array");

  const byId = new Map(parsed.frames.map((item) => [item.id, item]));
  return expectedIds.map((id) => {
    const item = byId.get(id);
    if (!item || !Number.isFinite(item.aesthetic)) throw new Error(`frame scorer omitted or malformed ${id}`);
    return { id, aesthetic: Math.max(0, Math.min(10, item.aesthetic)), reason: String(item.reason ?? "") };
  });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
