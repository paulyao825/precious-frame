import assert from "node:assert/strict";
import test from "node:test";
import { frameQualityScore } from "../domain/types.js";
import { parseFrameScores } from "./frameScorer.llm.js";

test("parseFrameScores preserves expected frame order and clamps scores", () => {
  const scores = parseFrameScores(
    '```json\n{"frames":[{"id":"frame_002","aesthetic":12},{"id":"frame_001","aesthetic":7.5}]}\n```',
    ["frame_001", "frame_002"],
  );

  assert.deepEqual(scores.map(({ id, aesthetic }) => ({ id, aesthetic })), [
    { id: "frame_001", aesthetic: 7.5 },
    { id: "frame_002", aesthetic: 10 },
  ]);
});

test("vision aesthetic score is the largest frame-selection signal", () => {
  const lowAesthetic = frameQualityScore({ sharpness: 1, exposure: 1, interest: 1, aesthetic: 0 });
  const highAesthetic = frameQualityScore({ sharpness: 0, exposure: 0, interest: 0, aesthetic: 1 });

  assert.equal(lowAesthetic, 4.5);
  assert.equal(highAesthetic, 5.5);
});
