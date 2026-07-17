import type { EditorBackend } from "../config.js";
import type { EditedImage, Frame, Recipe } from "../domain/types.js";

/**
 * THE Editor interface. Loop 2's act() calls edit() and does not care
 * which backend is active. Both backends must satisfy it exactly.
 */
export interface Editor {
  readonly backend: EditorBackend;
  edit(frame: Frame, recipe: Recipe): Promise<EditedImage>;
}

/**
 * `local` backend — the agent's own bounded edit code.
 * Mock for now; real impl (step 3) applies crop + exposure via sharp.
 */
export class MockLocalEditor implements Editor {
  readonly backend = "local" as const;

  async edit(frame: Frame, recipe: Recipe): Promise<EditedImage> {
    // Real impl will render pixels; the mock just records the recipe,
    // which is all the mock judge needs to critique the result.
    return {
      frameId: frame.id,
      uri: `mock://edited/local/${frame.id}/${recipeSlug(recipe)}.jpg`,
      recipe,
      backend: this.backend,
    };
  }
}

/**
 * `zero` backend — Zero.xyz-sourced external editing tool driven with the
 * SAME recipe params. Mock simulates external-call latency so toggling
 * shows the trade-off honestly.
 */
export class MockZeroEditor implements Editor {
  readonly backend = "zero" as const;

  constructor(private readonly simulatedLatencyMs = 350) {}

  async edit(frame: Frame, recipe: Recipe): Promise<EditedImage> {
    await sleep(this.simulatedLatencyMs);
    return {
      frameId: frame.id,
      uri: `mock://edited/zero/${frame.id}/${recipeSlug(recipe)}.jpg`,
      recipe,
      backend: this.backend,
    };
  }

  /**
   * Final "pro enhancement" flourish — run OUTSIDE the loop, on the
   * winning frame only. Not part of the Editor interface on purpose:
   * it is a one-shot cleanup pass, not a loop-drivable edit.
   */
  async finalFlourish(image: EditedImage): Promise<EditedImage> {
    await sleep(this.simulatedLatencyMs * 2);
    return {
      ...image,
      uri: image.uri.replace(".jpg", ".pro-enhanced.jpg"),
      backend: "zero",
    };
  }
}

export function createEditor(backend: EditorBackend): Editor {
  // Mock-first: real SDKs get wired here later behind the same interface.
  return backend === "zero" ? new MockZeroEditor() : new MockLocalEditor();
}

export function recipeSlug(r: Recipe): string {
  const c = r.crop;
  return [
    `c${c.x.toFixed(2)}-${c.y.toFixed(2)}-${c.w.toFixed(2)}-${c.h.toFixed(2)}`,
    `ev${r.exposureEv.toFixed(2)}`,
    `ct${r.contrast.toFixed(2)}`,
    `sa${r.saturation.toFixed(2)}`,
    `te${r.temperature.toFixed(2)}`,
    `sh${r.sharpen.toFixed(2)}`,
  ].join("_");
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
