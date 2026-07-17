import { readFile } from "node:fs/promises";
import type { VisionJudge } from "./judge.js";
import type { Critique } from "../core/loop.js";
import type { EditedImage } from "../domain/types.js";
import { JUDGE_SYSTEM_PROMPT, parseCritique } from "./judge.llm.js";
import { BedrockJudgeClient } from "./aws.js";

/**
 * Vision judge on AWS Bedrock. Same prompt and critique contract as the
 * other LLM judges — only the transport differs (SigV4 + Converse API,
 * so it works with Nova, Claude-on-Bedrock, etc. without code changes).
 */
export class BedrockVisionJudge implements VisionJudge {
  private readonly client: BedrockJudgeClient;

  constructor(
    private readonly resolvePath: (uri: string) => string,
    region: string,
    modelId: string,
  ) {
    this.client = new BedrockJudgeClient(region, modelId);
  }

  async critique(image: EditedImage): Promise<Critique> {
    const jpeg = await readFile(this.resolvePath(image.uri));
    const userText = `Applied recipe: ${JSON.stringify(image.recipe)}. Judge the image.`;
    const text = await this.client.judgeImage(jpeg, JUDGE_SYSTEM_PROMPT, userText);
    return parseCritique(text);
  }
}
