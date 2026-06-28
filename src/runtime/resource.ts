// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { AsyncScheduler } from "./scheduler.ts";

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

  reset(data?: TData): void {
    this.abort();
    this.#revision += 1;
    this.state.value = {
      status: data === undefined ? "idle" : "success",
      data,
      revision: this.#revision,
    };
  }

  private priority(params: TParams): number | undefined {
    return typeof this.#priority === "function" ? this.#priority(params) : this.#priority;
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
