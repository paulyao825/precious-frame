/**
 * Interfaces for the remaining sponsor tools (build-order step 6).
 * Akash lives in compute.ts, AWS in aws.ts; Nexla stays mocked.
 */

/** Nexla — data layer for frames / params / scores. */
export interface DataStore {
  put(collection: string, id: string, record: unknown): Promise<void>;
  list(collection: string): Promise<unknown[]>;
}

export class MockDataStore implements DataStore {
  private readonly data = new Map<string, Map<string, unknown>>();

  async put(collection: string, id: string, record: unknown): Promise<void> {
    if (!this.data.has(collection)) this.data.set(collection, new Map());
    this.data.get(collection)!.set(id, record);
  }

  async list(collection: string): Promise<unknown[]> {
    return [...(this.data.get(collection)?.values() ?? [])];
  }
}
