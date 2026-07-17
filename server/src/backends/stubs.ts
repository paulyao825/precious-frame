/**
 * Interfaces for the remaining sponsor tools (build-order step 6).
 * All mocked now; swap real impls in one at a time — if any fights us,
 * its mock stays.
 */

/** Akash — run compute workloads (e.g. batch frame scoring). */
export interface ComputeRunner {
  run<T>(taskName: string, fn: () => Promise<T>): Promise<T>;
}

export class MockComputeRunner implements ComputeRunner {
  async run<T>(_taskName: string, fn: () => Promise<T>): Promise<T> {
    return fn(); // runs inline locally
  }
}

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
