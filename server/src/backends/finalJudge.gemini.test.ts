import assert from "node:assert/strict";
import test from "node:test";
import { buildFinalJudgePrompt, parseFinalVerdicts } from "./finalJudge.gemini.js";

test("final Gemini judge distinguishes accidental shake from intentional motion", () => {
  const prompt = buildFinalJudgePrompt();
  assert.match(prompt, /accidental camera shake/i);
  assert.match(prompt, /deliberate motion blur/i);
  assert.match(prompt, /do not imagine repairs/i);
});

test("parseFinalVerdicts validates the complete candidate set", () => {
  const verdicts = parseFinalVerdicts(
    '{"frames":[{"frameId":"frame_001","score":8.3,"shakeBlur":2,"reason":"subject remains clear"}]}',
    ["frame_001"],
  );
  assert.deepEqual(verdicts, [{ frameId: "frame_001", score: 8.3, shakeBlur: 2, reason: "subject remains clear" }]);
  assert.throws(
    () => parseFinalVerdicts('{"frames":[]}', ["frame_001"]),
    /incomplete frame set/,
  );
});
