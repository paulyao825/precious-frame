import type { Frame } from "../domain/types.js";
import type { MockWorld } from "../mock/world.js";

/** Frame extraction from an uploaded video. Real impl: ffmpeg (step 2). */
export interface FrameExtractor {
  extract(videoUri: string): Promise<Frame[]>;
}

export class MockFrameExtractor implements FrameExtractor {
  constructor(private readonly world: MockWorld) {}

  async extract(_videoUri: string): Promise<Frame[]> {
    return this.world.frames;
  }
}
