/**
 * AWS integration — two real touchpoints:
 *  1. Bedrock (Converse API) as a vision-judge provider ("bedrock" in config).
 *  2. S3 + presigned GETs to host intermediate images for remote editors
 *     (replaces the free ephemeral hosts when a bucket is configured).
 *
 * Credentials come from the SDK default chain (env vars, ~/.aws, SSO, roles).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface AwsConfig {
  region: string;
  s3Bucket: string;
}

/** True when the SDK default credential chain has something to work with. */
export function hasAwsCredentials(): boolean {
  if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_ROLE_ARN) return true;
  return existsSync(path.join(os.homedir(), ".aws", "credentials")) || existsSync(path.join(os.homedir(), ".aws", "config"));
}

/** Vision judge on AWS Bedrock via the model-agnostic Converse API (Nova, Claude, ...). */
export class BedrockJudgeClient {
  private readonly client: BedrockRuntimeClient;

  constructor(
    region: string,
    private readonly modelId: string,
  ) {
    this.client = new BedrockRuntimeClient({ region });
  }

  async judgeImage(jpeg: Buffer, system: string, userText: string): Promise<string> {
    const res = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: system }],
        messages: [
          {
            role: "user",
            content: [
              { image: { format: "jpeg", source: { bytes: new Uint8Array(jpeg) } } },
              { text: userText },
            ],
          },
        ],
        inferenceConfig: { maxTokens: 700, temperature: 0 },
      }),
    );
    const text = res.output?.message?.content?.find((c) => c.text)?.text;
    if (!text) throw new Error("bedrock returned no text content");
    return text;
  }
}

/** Publishes an image to S3 and returns a short-lived presigned GET URL. */
export class S3Publisher {
  private readonly client: S3Client;

  constructor(private readonly cfg: AwsConfig) {
    this.client = new S3Client({ region: cfg.region });
  }

  async publish(jpeg: Buffer, key: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.s3Bucket,
        Key: key,
        Body: jpeg,
        ContentType: "image/jpeg",
      }),
    );
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.cfg.s3Bucket, Key: key }), {
      expiresIn: 3600,
    });
  }
}
