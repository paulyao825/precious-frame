import type { GeminiConfig } from "../appConfig.js";

type FetchLike = typeof fetch;
type Sleep = (ms: number) => Promise<void>;

export interface GeminiPart {
  type?: string;
  text?: string;
  data?: string;
  mime_type?: string;
}

export interface GeminiInteraction {
  steps?: Array<{ content?: GeminiPart[] }>;
}

interface GeminiRequestOptions {
  cfg: GeminiConfig;
  body: Record<string, unknown>;
  label: string;
  fetchImpl?: FetchLike;
  sleep?: Sleep;
}

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function requestGeminiInteraction({
  cfg,
  body,
  label,
  fetchImpl = fetch,
  sleep = defaultSleep,
}: GeminiRequestOptions): Promise<GeminiInteraction> {
  if (!cfg.apiKey) throw new Error("AI final review is not configured");

  for (let attempt = 0; attempt <= 2; attempt++) {
    const res = await fetchImpl(`${cfg.baseUrl}/interactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": cfg.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) return await res.json() as GeminiInteraction;

    const message = (await res.text()).slice(0, 300);
    if ((res.status !== 429 && res.status < 500) || attempt === 2) {
      throw new Error(`AI ${label} failed: ${res.status} ${message}`);
    }
    await sleep(250 * 2 ** attempt);
  }

  throw new Error(`AI ${label} failed without a response`);
}

export function interactionText(response: GeminiInteraction): string {
  return response.steps
    ?.flatMap((step) => step.content ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text!)
    .join("\n") ?? "";
}

export function interactionImage(response: GeminiInteraction): { data: string; mimeType: string } | undefined {
  const parts = response.steps?.flatMap((step) => step.content ?? []) ?? [];
  const image = [...parts].reverse().find((part) => part.type === "image" && typeof part.data === "string");
  return image ? { data: image.data!, mimeType: image.mime_type ?? "image/jpeg" } : undefined;
}
