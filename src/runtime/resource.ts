// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { AsyncScheduler } from "./scheduler.ts";
import type { AsyncStore } from "./storage.ts";

export type AsyncResourceStatus = "idle" | "loading" | "success" | "error";

export interface AsyncResourceState<TData = unknown, TParams = unknown> {
  status: AsyncResourceStatus;
  data?: TData;
  error?: unknown;
  params?: TParams;
  revision: number;
}

export interface AsyncResourceContext<TParams = unknown> {
  signal: AbortSignal;
  params: TParams;
  revision: number;
}

export type AsyncResourceLoader<TParams, TData> = (
  context: AsyncResourceContext<TParams>,
) => TData | Promise<TData>;

export interface AsyncResourceOptions<TParams, TData> {
  loader: AsyncResourceLoader<TParams, TData>;
  scheduler?: AsyncScheduler;
  priority?: number | ((params: TParams) => number);
  initialData?: TData;
  initialParams?: TParams;
  keepPreviousData?: boolean;
}

export interface AsyncResourceInspection<TData = unknown, TParams = unknown>
  extends AsyncResourceState<TData, TParams> {
  loading: boolean;
  hasData: boolean;
  hasError: boolean;
  aborted: boolean;
}

export type AsyncResourceCacheKey<TParams> = string | ((params: TParams) => string);

export interface CachedAsyncResourceOptions<TParams, TData, Stored = TData>
  extends AsyncResourceOptions<TParams, TData> {
  store?: AsyncStore<Stored>;
  key?: AsyncResourceCacheKey<TParams>;
  serialize?: (value: TData, params: TParams) => Stored;
  deserialize?: (value: Stored, params: TParams) => TData;
  onCacheError?: (error: unknown) => void;
}

export interface CachedAsyncResourceInspection<TData = unknown, TParams = unknown>
  extends AsyncResourceInspection<TData, TParams> {
  cached: boolean;
  key?: string;
}

export class AsyncResource<TParams = void, TData = unknown> {
  readonly state: Signal<AsyncResourceState<TData, TParams>>;
  readonly #loader: AsyncResourceLoader<TParams, TData>;
  readonly #scheduler?: AsyncScheduler;
  readonly #priority?: number | ((params: TParams) => number);
  readonly #keepPreviousData: boolean;
  #controller: AbortController | undefined;
  #revision = 0;

  constructor(options: AsyncResourceOptions<TParams, TData>) {
    this.#loader = options.loader;
    this.#scheduler = options.scheduler;
    this.#priority = options.priority;
    this.#keepPreviousData = options.keepPreviousData ?? true;
    const initialState: AsyncResourceState<TData, TParams> = {
      status: options.initialData === undefined ? "idle" : "success",
      data: options.initialData,
      params: options.initialParams,
      revision: 0,
    };
    this.state = new Signal<AsyncResourceState<TData, TParams>>(initialState, { deepObserve: true });
  }

  get revision(): number {
    return this.#revision;
  }

  get loading(): boolean {
    return this.state.peek().status === "loading";
  }

  async load(params: TParams): Promise<AsyncResourceState<TData, TParams>> {
    this.abort();
    const revision = ++this.#revision;
    const controller = new AbortController();
    this.#controller = controller;
    const previous = this.state.peek();
    this.state.value = {
      status: "loading",
      data: this.#keepPreviousData ? previous.data : undefined,
      params,
      revision,
    };

    try {
      const context = { signal: controller.signal, params, revision };
      const data = this.#scheduler
        ? await this.#scheduler.run(() => this.#loader(context), {
          priority: this.priority(params),
          signal: controller.signal,
        })
        : await this.#loader(context);
      if (revision !== this.#revision || controller.signal.aborted) {
        return this.state.peek();
      }
      const state = { status: "success" as const, data, params, revision };
      this.state.value = state;
      return state;
    } catch (error) {
      if (revision !== this.#revision || controller.signal.aborted) {
        return this.state.peek();
      }
      const state = {
        status: "error" as const,
        data: this.#keepPreviousData ? previous.data : undefined,
        error,
        params,
        revision,
      };
      this.state.value = state;
      return state;
    } finally {
      if (this.#controller === controller) {
        this.#controller = undefined;
      }
    }
  }

  reload(): Promise<AsyncResourceState<TData, TParams>> {
    const params = this.state.peek().params;
    if (params === undefined) {
      throw new AsyncResourceParamsError();
    }
    return this.load(params);
  }

  abort(): void {
    this.#controller?.abort();
    this.#controller = undefined;
  }

  inspect(): AsyncResourceInspection<TData, TParams> {
    const state = this.state.peek();
    return {
      ...state,
      loading: state.status === "loading",
      hasData: state.data !== undefined,
      hasError: state.error !== undefined,
      aborted: this.#controller?.signal.aborted ?? false,
    };
  }

  reset(data?: TData, params?: TParams): void {
    this.abort();
    this.#revision += 1;
    const state: AsyncResourceState<TData, TParams> = {
      status: data === undefined ? "idle" : "success",
      data,
      revision: this.#revision,
    };
    if (params !== undefined) {
      state.params = params;
    }
    this.state.value = state;
  }

  private priority(params: TParams): number | undefined {
    return typeof this.#priority === "function" ? this.#priority(params) : this.#priority;
  }

  dispose(): void {
    this.abort();
    this.state.dispose();
  }
}

export class AsyncResourceParamsError extends Error {
  constructor() {
    super("AsyncResource cannot reload before params have been provided.");
    this.name = "AsyncResourceParamsError";
  }
}

export function createAsyncResource<TParams, TData>(
  options: AsyncResourceOptions<TParams, TData>,
): AsyncResource<TParams, TData> {
  return new AsyncResource(options);
}

export class CachedAsyncResource<TParams = void, TData = unknown, Stored = TData> {
  readonly resource: AsyncResource<TParams, TData>;
  readonly state: Signal<AsyncResourceState<TData, TParams>>;
  readonly #store?: AsyncStore<Stored>;
  readonly #key: AsyncResourceCacheKey<TParams>;
  readonly #serialize: (value: TData, params: TParams) => Stored;
  readonly #deserialize: (value: Stored, params: TParams) => TData;
  readonly #onCacheError?: (error: unknown) => void;
  #last: { key: string; cached: boolean } | undefined;

  constructor(options: CachedAsyncResourceOptions<TParams, TData, Stored>) {
    const { store, key, serialize, deserialize, onCacheError, ...resourceOptions } = options;
    this.resource = new AsyncResource(resourceOptions);
    this.state = this.resource.state;
    this.#store = store;
    this.#key = key ?? "async-resource";
    this.#serialize = serialize ?? ((value) => value as unknown as Stored);
    this.#deserialize = deserialize ?? ((value) => value as unknown as TData);
    this.#onCacheError = onCacheError;
  }

  get revision(): number {
    return this.resource.revision;
  }

  get loading(): boolean {
    return this.resource.loading;
  }

  async restore(params: TParams): Promise<AsyncResourceState<TData, TParams> | undefined> {
    const key = this.cacheKey(params);
    if (!this.#store) return undefined;
    try {
      const stored = await this.#store.get(key);
      if (stored === undefined) return undefined;
      const data = this.#deserialize(stored, params);
      this.resource.reset(data, params);
      this.#last = { key, cached: true };
      return this.state.peek();
    } catch (error) {
      this.#onCacheError?.(error);
      return undefined;
    }
  }

  async load(params: TParams): Promise<AsyncResourceState<TData, TParams>> {
    const revision = this.resource.revision + 1;
    const state = await this.resource.load(params);
    if (state.status === "success" && state.revision === revision && state.data !== undefined) {
      const key = this.cacheKey(params);
      this.#last = { key, cached: false };
      if (this.#store) {
        try {
          await this.#store.set(key, this.#serialize(state.data, params));
        } catch (error) {
          this.#onCacheError?.(error);
        }
      }
    }
    return state;
  }

  reload(): Promise<AsyncResourceState<TData, TParams>> {
    const params = this.state.peek().params;
    if (params === undefined) {
      throw new AsyncResourceParamsError();
    }
    return this.load(params);
  }

  abort(): void {
    this.resource.abort();
  }

  reset(data?: TData, params?: TParams): void {
    this.resource.reset(data, params);
    this.#last = undefined;
  }

  async clear(params?: TParams): Promise<void> {
    const key = params === undefined ? this.#last?.key : this.cacheKey(params);
    this.#last = undefined;
    if (!this.#store || key === undefined) return;
    try {
      await this.#store.delete(key);
    } catch (error) {
      this.#onCacheError?.(error);
    }
  }

  cacheKey(params: TParams): string {
    return typeof this.#key === "function" ? this.#key(params) : this.#key;
  }

  inspect(): CachedAsyncResourceInspection<TData, TParams> {
    return {
      ...this.resource.inspect(),
      cached: this.#last?.cached ?? false,
      key: this.#last?.key,
    };
  }

  dispose(): void {
    this.resource.dispose();
  }
}

export function createCachedAsyncResource<TParams, TData, Stored = TData>(
  options: CachedAsyncResourceOptions<TParams, TData, Stored>,
): CachedAsyncResource<TParams, TData, Stored> {
  return new CachedAsyncResource(options);
}
