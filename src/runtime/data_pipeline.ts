// Copyright 2023 Im-Beast. MIT license.
import type { AsyncScheduler } from "./scheduler.ts";

export interface DataPipelineContext {
  signal?: AbortSignal;
  revision: number;
}

export interface DataPipelineOptions {
  scheduler?: AsyncScheduler;
  signal?: AbortSignal;
  priority?: number;
  revision?: number;
}

export type DataTransform<TInput, TOutput> = (
  input: TInput,
  context: DataPipelineContext,
) => TOutput | Promise<TOutput>;

type AnyDataTransform = DataTransform<any, any>;

export interface WorkerTaskRunner<TPayload, TResult> {
  run(payload: TPayload): Promise<TResult>;
}

export type WorkerPayloadMapper<TInput, TPayload> = (
  input: TInput,
  context: DataPipelineContext,
) => TPayload;

export interface LatestPipelineResult<T> {
  status: "ok" | "stale";
  value?: T;
  revision: number;
}

export class DataPipelineAbortError extends Error {
  constructor() {
    super("Data pipeline was aborted");
    this.name = "DataPipelineAbortError";
  }
}

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
        ? await options.scheduler.run(() => transform(current, context), {
          priority: options.priority,
          signal: options.signal,
        })
        : await transform(current, context);
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

export class LatestDataPipeline<TInput, TOutput> {
  #revision = 0;

  constructor(
    private readonly transforms: readonly AnyDataTransform[],
    private readonly options: Omit<DataPipelineOptions, "revision"> = {},
  ) {}

  get revision(): number {
    return this.#revision;
  }

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

export function mapRows<TInput, TOutput>(
  mapper: (row: TInput, index: number) => TOutput,
): DataTransform<readonly TInput[], TOutput[]> {
  return (rows) => rows.map(mapper);
}

export function filterRows<T>(
  predicate: (row: T, index: number) => boolean,
): DataTransform<readonly T[], T[]> {
  return (rows) => rows.filter(predicate);
}

export function sortRows<T>(
  compare: (left: T, right: T) => number,
): DataTransform<readonly T[], T[]> {
  return (rows) => [...rows].sort(compare);
}

export function sliceRows<T>(start: number, end?: number): DataTransform<readonly T[], T[]> {
  return (rows) => rows.slice(start, end);
}

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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
