import { readFile } from "node:fs/promises";
import type { GeminiConfig } from "../appConfig.js";
import { interactionText, requestGeminiInteraction } from "./gemini.js";

export interface FinalJudgeCandidate {
  frameId: string;
  uri: string;
}

export interface FinalJudgeVerdict {
  frameId: string;
  score: number;
  shakeBlur: number;
  reason: string;
}

export function buildFinalJudgePrompt(): string {
  return `You are the final professional photography judge for a set of edited video frames.
Rank every supplied image for publishability using impact, story, composition, and technical integrity.
Pay special attention to accidental camera shake, focus failure, and motion blur that makes a subject unreadable.
Do not penalize deliberate motion blur when the key subject, action, and storytelling remain clear.

Calibration: 9 = exceptional keeper, 7 = strong publishable photo, 5 = usable but compromised,
3 = obvious technical miss, 1 = unusable. shakeBlur is 0-10 where 0 means no visible shake/blur risk,
7 means the blur makes the result unsuitable, and 10 means the subject is unreadable.
Judge only the real image supplied. Do not imagine repairs or generated replacements.
Respond only with JSON: {"frames":[{"frameId":"frame_001","score":8.2,"shakeBlur":1,"reason":"short visible reason"}]}.`;
}

export class GeminiFinalJudge {
  constructor(private readonly resolvePath: (uri: string) => string, private readonly cfg: GeminiConfig) {}

  async judge(candidates: FinalJudgeCandidate[]): Promise<FinalJudgeVerdict[]> {
    const input: Array<Record<string, unknown>> = [{ type: "text", text: "Evaluate every final candidate in this set." }];
    for (const candidate of candidates) {
      const image = await readFile(this.resolvePath(candidate.uri));
      input.push({ type: "text", text: candidate.frameId });
      input.push({ type: "image", mime_type: "image/jpeg", data: image.toString("base64") });
    }

    const response = await requestGeminiInteraction({
      cfg: this.cfg,
      label: "final review",
      body: {
        model: this.cfg.model,
        system_instruction: buildFinalJudgePrompt(),
        input,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "object",
            properties: {
              frames: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    frameId: { type: "string" },
                    score: { type: "number" },
                    shakeBlur: { type: "number" },
                    reason: { type: "string" },
                  },
                  required: ["frameId", "score", "shakeBlur", "reason"],
                },
              },
            },
            required: ["frames"],
          },
        },
      },
    });

    return parseFinalVerdicts(interactionText(response), candidates.map((candidate) => candidate.frameId));
  }
}

export function parseFinalVerdicts(text: string, expectedIds: string[]): FinalJudgeVerdict[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI final review returned no JSON");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { frames?: FinalJudgeVerdict[] };
  if (!Array.isArray(parsed.frames) || parsed.frames.length !== expectedIds.length) {
    throw new Error("AI final review returned an incomplete frame set");
  }
  const byId = new Map(parsed.frames.map((verdict) => [verdict.frameId, verdict]));
  if (byId.size !== expectedIds.length || expectedIds.some((id) => !byId.has(id))) {
    throw new Error("AI final review returned unexpected frame ids");
  }
  return expectedIds.map((frameId) => {
    const verdict = byId.get(frameId)!;
    if (!Number.isFinite(verdict.score) || !Number.isFinite(verdict.shakeBlur)) {
      throw new Error(`AI final review returned malformed ${frameId}`);
    }
    return {
      frameId,
      score: clamp10(verdict.score),
      shakeBlur: clamp10(verdict.shakeBlur),
      reason: String(verdict.reason ?? ""),
    };
  });
}

function clamp10(value: number): number {
  return Math.max(0, Math.min(10, value));
}
