// Copyright 2023 Im-Beast. MIT license.
import { Signal, type SignalOptions } from "../signals/mod.ts";

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

export interface RuntimeStoreOptions extends IndexedDbStoreOptions {
  preferIndexedDb?: boolean;
  scope?: typeof globalThis;
}

export interface PersistentSignalOptions<T, Stored = T> {
  key: string;
  initialValue: T;
  store: AsyncStore<Stored>;
  signalOptions?: SignalOptions<T>;
  serialize?: (value: T) => Stored;
  deserialize?: (value: Stored) => T;
  onError?: (error: unknown) => void;
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
  // deno-lint-ignore no-explicit-any
  onsuccess: ((event: any) => any) | null;
  // deno-lint-ignore no-explicit-any
  onerror: ((event: any) => any) | null;
}

interface MinimalIdbOpenRequest extends MinimalIdbRequest<MinimalIdbDatabase> {
  // deno-lint-ignore no-explicit-any
  onupgradeneeded: ((event: any) => any) | null;
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

export function createRuntimeStore<T = unknown>(options: RuntimeStoreOptions): AsyncStore<T> {
  if (options.preferIndexedDb !== false && "indexedDB" in (options.scope ?? globalThis)) {
    return new IndexedDbStore<T>(options);
  }
  return new MemoryStore<T>();
}

export class PersistentSignal<T, Stored = T> {
  readonly value: Signal<T>;
  readonly ready: Promise<T>;
  readonly key: string;
  readonly store: AsyncStore<Stored>;
  readonly initialValue: T;
  #loaded = false;
  #dirtyBeforeLoad = false;
  #suspendWrites = false;
  #pendingWrite: Promise<void> = Promise.resolve();

  readonly #serialize: (value: T) => Stored;
  readonly #deserialize: (value: Stored) => T;
  readonly #onError?: (error: unknown) => void;

  constructor(options: PersistentSignalOptions<T, Stored>) {
    this.key = options.key;
    this.store = options.store;
    this.initialValue = options.initialValue;
    this.value = new Signal(options.initialValue, options.signalOptions);
    this.#serialize = options.serialize ?? ((value) => value as unknown as Stored);
    this.#deserialize = options.deserialize ?? ((value) => value as unknown as T);
    this.#onError = options.onError;

    this.value.subscribe((value) => {
      if (this.#suspendWrites) return;
      if (!this.#loaded) {
        this.#dirtyBeforeLoad = true;
        return;
      }
      this.#write(value);
    });

    this.ready = this.#load();
  }

  set(value: T): void {
    this.value.value = value;
  }

  update(updater: (value: T) => T): void {
    this.value.value = updater(this.value.peek());
  }

  async flush(): Promise<void> {
    await this.ready;
    await this.#pendingWrite;
  }

  async reset(value = this.initialValue): Promise<void> {
    await this.ready;
    this.#suspendWrites = true;
    this.value.value = value;
    this.#suspendWrites = false;
    this.#pendingWrite = this.#pendingWrite
      .catch(() => undefined)
      .then(() => this.store.delete(this.key))
      .catch((error) => {
        this.#onError?.(error);
      });
    await this.#pendingWrite;
  }

  async #load(): Promise<T> {
    try {
      const stored = await this.store.get(this.key);
      this.#loaded = true;
      if (stored !== undefined && !this.#dirtyBeforeLoad) {
        this.value.value = this.#deserialize(stored);
      } else if (this.#dirtyBeforeLoad) {
        this.#write(this.value.peek());
      }
      return this.value.peek();
    } catch (error) {
      this.#loaded = true;
      this.#onError?.(error);
      return this.value.peek();
    }
  }

  #write(value: T): void {
    this.#pendingWrite = this.#pendingWrite
      .catch(() => undefined)
      .then(() => this.store.set(this.key, this.#serialize(value)))
      .catch((error) => {
        this.#onError?.(error);
      });
  }
}

export function createPersistentSignal<T, Stored = T>(
  options: PersistentSignalOptions<T, Stored>,
): PersistentSignal<T, Stored> {
  return new PersistentSignal(options);
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
