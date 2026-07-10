// Copyright 2023 Im-Beast. MIT license.
import type { AsyncScheduler } from "./scheduler.ts";
import type { AsyncStore } from "./storage.ts";

/** Context passed to each data pipeline transform. */
export interface DataPipelineContext {
  signal?: AbortSignal;
  revision: number;
}

/** Runtime options for executing a transform pipeline. */
export interface DataPipelineOptions {
  scheduler?: AsyncScheduler;
  signal?: AbortSignal;
  priority?: number;
  revision?: number;
}

/** Transform stage that maps one pipeline value to the next value. */
export type DataTransform<TInput, TOutput> = (
  input: TInput,
  context: DataPipelineContext,
) => TOutput | Promise<TOutput>;

type AnyDataTransform = DataTransform<never, unknown>;

/** Minimal async worker-like runner used by worker-backed transforms. */
export interface WorkerTaskRunner<TPayload, TResult> {
  run(payload: TPayload): Promise<TResult>;
}

/** Maps a pipeline input and context into a worker payload. */
export type WorkerPayloadMapper<TInput, TPayload> = (
  input: TInput,
  context: DataPipelineContext,
) => TPayload;

/** Result for latest-only pipelines that can detect stale async completions. */
export interface LatestPipelineResult<T> {
  status: "ok" | "stale";
  value?: T;
  revision: number;
}

/** Cache key mapper for persisted data pipeline results. */
export type DataPipelineCacheKey<TInput> = string | ((input: TInput) => string);

/** Options for a latest-only data pipeline with optional async result persistence. */
export interface CachedDataPipelineOptions<TInput, TOutput, Stored = TOutput>
  extends Omit<DataPipelineOptions, "revision"> {
  store?: AsyncStore<Stored>;
  key?: DataPipelineCacheKey<TInput>;
  serialize?: (value: TOutput, input: TInput) => Stored;
  deserialize?: (value: Stored, input: TInput) => TOutput;
  onCacheError?: (error: unknown) => void;
}

/** Serializable state for a cached pipeline instance. */
export interface CachedDataPipelineInspection<TOutput = unknown> {
  revision: number;
  cached: boolean;
  key?: string;
  value?: TOutput;
}

/** Error thrown when a pipeline observes an aborted signal. */
export class DataPipelineAbortError extends Error {
  constructor() {
    super("Data pipeline was aborted");
    this.name = "DataPipelineAbortError";
  }
}

/** Runs a sequence of transforms with optional scheduler priority and cancellation. */
export async function runDataPipeline<TInput, TOutput = unknown>(
  input: TInput,
  transforms: readonly AnyDataTransform[],
  options: DataPipelineOptions = {},
): Promise<TOutput> {
  const context = {
    signal: options.signal,
    revision: options.revision ?? 0,
  };
  let current: unknown = input;
  for (const transform of transforms) {
    throwIfAborted(context.signal);
    try {
      current = options.scheduler
        ? await options.scheduler.run(() => runAnyDataTransform(transform, current, context), {
          priority: options.priority,
          signal: options.signal,
        })
        : await runAnyDataTransform(transform, current, context);
    } catch (error) {
      if (context.signal?.aborted && isAbortError(error)) {
        throw new DataPipelineAbortError();
      }
      throw error;
    }
    throwIfAborted(context.signal);
  }
  return current as TOutput;
}

/** Pipeline wrapper that marks older completions stale when newer runs start. */
export class LatestDataPipeline<TInput, TOutput> {
  #revision = 0;

  /** Creates a latest-only pipeline with shared default options. */
  constructor(
    private readonly transforms: readonly AnyDataTransform[],
    private readonly options: Omit<DataPipelineOptions, "revision"> = {},
  ) {}

  /** Current monotonic revision for started runs. */
  get revision(): number {
    return this.#revision;
  }

  /** Runs the pipeline and returns stale when a newer run superseded it. */
  async run(
    input: TInput,
    options: Omit<DataPipelineOptions, "revision"> = {},
  ): Promise<LatestPipelineResult<TOutput>> {
    const revision = ++this.#revision;
    const value = await runDataPipeline<TInput, TOutput>(input, this.transforms, {
      ...this.options,
      ...options,
      revision,
    });
    if (revision !== this.#revision) {
      return { status: "stale", revision };
    }
    return { status: "ok", value: value as TOutput, revision };
  }
}

/** Latest-only transform pipeline that can restore and persist successful results. */
export class CachedDataPipeline<TInput, TOutput, Stored = TOutput> {
  readonly latest: LatestDataPipeline<TInput, TOutput>;
  readonly #store?: AsyncStore<Stored>;
  readonly #key: DataPipelineCacheKey<TInput>;
  readonly #serialize: (value: TOutput, input: TInput) => Stored;
  readonly #deserialize: (value: Stored, input: TInput) => TOutput;
  readonly #onCacheError?: (error: unknown) => void;
  #last: { key: string; value: TOutput; cached: boolean } | undefined;

  /** Creates a cached pipeline around a transform sequence. */
  constructor(
    transforms: readonly AnyDataTransform[],
    options: CachedDataPipelineOptions<TInput, TOutput, Stored> = {},
  ) {
    const { store, key, serialize, deserialize, onCacheError, ...pipelineOptions } = options;
    this.latest = new LatestDataPipeline(transforms, pipelineOptions);
    this.#store = store;
    this.#key = key ?? "data-pipeline";
    this.#serialize = serialize ?? ((value) => value as unknown as Stored);
    this.#deserialize = deserialize ?? ((value) => value as unknown as TOutput);
    this.#onCacheError = onCacheError;
  }

  /** Current monotonic revision for started runs. */
  get revision(): number {
    return this.latest.revision;
  }

  /** Restores the cached value for an input when storage is configured. */
  async restore(input: TInput): Promise<TOutput | undefined> {
    const key = this.cacheKey(input);
    if (!this.#store) return undefined;
    try {
      const stored = await this.#store.get(key);
      if (stored === undefined) return undefined;
      const value = this.#deserialize(stored, input);
      this.#last = { key, value, cached: true };
      return value;
    } catch (error) {
      this.#onCacheError?.(error);
      return undefined;
    }
  }

  /** Runs the pipeline and persists only the latest successful completion. */
  async run(
    input: TInput,
    options: Omit<DataPipelineOptions, "revision"> = {},
  ): Promise<LatestPipelineResult<TOutput>> {
    const result = await this.latest.run(input, options);
    if (result.status !== "ok") return result;

    const value = result.value as TOutput;
    const key = this.cacheKey(input);
    this.#last = { key, value, cached: false };
    if (this.#store) {
      try {
        await this.#store.set(key, this.#serialize(value, input));
      } catch (error) {
        this.#onCacheError?.(error);
      }
    }
    return result;
  }

  /** Resolves the configured cache key for an input. */
  cacheKey(input: TInput): string {
    return typeof this.#key === "function" ? this.#key(input) : this.#key;
  }

  /** Returns the last restored or computed value known to the pipeline. */
  inspect(): CachedDataPipelineInspection<TOutput> {
    return {
      revision: this.revision,
      cached: this.#last?.cached ?? false,
      key: this.#last?.key,
      value: this.#last?.value,
    };
  }
}

/** Creates a cached latest-only data pipeline. */
export function createCachedDataPipeline<TInput, TOutput, Stored = TOutput>(
  transforms: readonly AnyDataTransform[],
  options: CachedDataPipelineOptions<TInput, TOutput, Stored> = {},
): CachedDataPipeline<TInput, TOutput, Stored> {
  return new CachedDataPipeline(transforms, options);
}

function runAnyDataTransform(
  transform: AnyDataTransform,
  input: unknown,
  context: DataPipelineContext,
): unknown | Promise<unknown> {
  return (transform as DataTransform<unknown, unknown>)(input, context);
}

/** Creates a transform that maps every row in an array. */
export function mapRows<TInput, TOutput>(
  mapper: (row: TInput, index: number) => TOutput,
): DataTransform<readonly TInput[], TOutput[]> {
  return (rows) => {
    const output = new Array<TOutput>(rows.length);
    for (let index = 0; index < rows.length; index += 1) output[index] = mapper(rows[index]!, index);
    return output;
  };
}

/** Creates a transform that filters rows with a predicate. */
export function filterRows<T>(
  predicate: (row: T, index: number) => boolean,
): DataTransform<readonly T[], T[]> {
  return (rows) => {
    const output: T[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      if (predicate(row, index)) output.push(row);
    }
    return output;
  };
}

/** Creates a transform that returns a sorted copy of row data. */
export function sortRows<T>(
  compare: (left: T, right: T) => number,
): DataTransform<readonly T[], T[]> {
  return (rows) => rows.slice().sort(compare);
}

/** Creates a transform that slices row data without mutating the input. */
export function sliceRows<T>(start: number, end?: number): DataTransform<readonly T[], T[]> {
  return (rows) => {
    const from = normalizeSliceIndex(start, rows.length);
    const to = end === undefined ? rows.length : normalizeSliceIndex(end, rows.length);
    const count = Math.max(0, to - from);
    const output = new Array<T>(count);
    for (let index = 0; index < count; index += 1) output[index] = rows[from + index]!;
    return output;
  };
}

/** Creates a transform that offloads one stage through a worker-like runner. */
export function workerTransform<TInput, TPayload = TInput, TOutput = unknown>(
  runner: WorkerTaskRunner<TPayload, TOutput>,
  payload: WorkerPayloadMapper<TInput, TPayload> = (input) => input as unknown as TPayload,
): DataTransform<TInput, TOutput> {
  return async (input, context) => {
    throwIfAborted(context.signal);
    const result = await runner.run(payload(input, context));
    throwIfAborted(context.signal);
    return result;
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DataPipelineAbortError();
  }
}

function normalizeSliceIndex(index: number, length: number): number {
  const integer = Number.isNaN(index) ? 0 : Math.trunc(index);
  if (integer < 0) return Math.max(length + integer, 0);
  return Math.min(integer, length);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
