import assert from "node:assert/strict";
import test from "node:test";
import type { GeminiConfig } from "../appConfig.js";
import { interactionImage, interactionText, requestGeminiInteraction } from "./gemini.js";

const cfg: GeminiConfig = {
  enabled: true,
  model: "gemini-3.5-flash",
  imageModel: "gemini-3.1-flash-image",
  apiKey: "test-key",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
};

test("requestGeminiInteraction uses the Interactions API and retries a rate limit", async () => {
  let calls = 0;
  let requestBody: Record<string, unknown> | undefined;
  const response = await requestGeminiInteraction({
    cfg,
    label: "final review",
    body: { model: cfg.model, input: "review this image" },
    fetchImpl: async (_input, init) => {
      calls++;
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (calls === 1) return new Response("busy", { status: 429 });
      return new Response(JSON.stringify({ steps: [{ content: [{ type: "text", text: "{}" }] }] }), { status: 200 });
    },
    sleep: async () => {},
  });

  assert.equal(calls, 2);
  assert.equal(requestBody?.model, cfg.model);
  assert.equal(interactionText(response), "{}");
});

test("Gemini interaction helpers extract text and the final image", () => {
  const response = {
    steps: [
      { content: [{ type: "text", text: "first" }] },
      { content: [{ type: "image", data: "old", mime_type: "image/png" }, { type: "image", data: "final", mime_type: "image/jpeg" }] },
    ],
  };
  assert.equal(interactionText(response), "first");
  assert.deepEqual(interactionImage(response), { data: "final", mimeType: "image/jpeg" });
});
