// Copyright 2023 Im-Beast. MIT license.
export interface AsyncStore<T = unknown> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryStore<T = unknown> implements AsyncStore<T> {
  private readonly values = new Map<string, T>();

  async get(key: string): Promise<T | undefined> {
    return this.values.get(key);
  }

  async set(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export interface IndexedDbStoreOptions {
  databaseName: string;
  storeName?: string;
  version?: number;
}

interface MinimalIdbDatabase {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string): unknown;
  transaction(storeName: string, mode: "readonly" | "readwrite"): {
    objectStore(name: string): {
      get(key: string): MinimalIdbRequest<unknown>;
      put(value: unknown, key: string): MinimalIdbRequest<unknown>;
      delete(key: string): MinimalIdbRequest<unknown>;
    };
  };
}

interface MinimalIdbRequest<T> {
  error: Error | null;
  result: T;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface MinimalIdbOpenRequest extends MinimalIdbRequest<MinimalIdbDatabase> {
  onupgradeneeded: (() => void) | null;
}

interface MinimalIndexedDb {
  open(databaseName: string, version: number): MinimalIdbOpenRequest;
}

export class IndexedDbStore<T = unknown> implements AsyncStore<T> {
  private readonly storeName: string;
  private readonly databasePromise: Promise<MinimalIdbDatabase>;

  constructor(options: IndexedDbStoreOptions) {
    this.storeName = options.storeName ?? "values";
    this.databasePromise = openDatabase(options.databaseName, this.storeName, options.version ?? 1);
  }

  async get(key: string): Promise<T | undefined> {
    const database = await this.databasePromise;
    return await requestValue<T | undefined>(
      database.transaction(this.storeName, "readonly").objectStore(this.storeName).get(key) as MinimalIdbRequest<
        T | undefined
      >,
    );
  }

  async set(key: string, value: T): Promise<void> {
    const database = await this.databasePromise;
    await requestValue(database.transaction(this.storeName, "readwrite").objectStore(this.storeName).put(value, key));
  }

  async delete(key: string): Promise<void> {
    const database = await this.databasePromise;
    await requestValue(database.transaction(this.storeName, "readwrite").objectStore(this.storeName).delete(key));
  }
}

function openDatabase(databaseName: string, storeName: string, version: number): Promise<MinimalIdbDatabase> {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("IndexedDB is not available in this runtime."));
  }

  return new Promise((resolve, reject) => {
    const indexedDb = (globalThis as typeof globalThis & { indexedDB: MinimalIndexedDb }).indexedDB;
    const request = indexedDb.open(databaseName, version);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB database."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
  });
}

function requestValue<T>(request: MinimalIdbRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
    request.onsuccess = () => resolve(request.result);
  });
}
