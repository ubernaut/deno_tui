// Copyright 2023 Im-Beast. MIT license.
import type { Signal } from "../signals/mod.ts";
import {
  DataPipelineAbortError,
  type DataPipelineOptions,
  type DataTransform,
  runDataPipeline,
} from "./data_pipeline.ts";

type AnyDataTransform = DataTransform<never, unknown>;

/** Options for configuring data Pipeline Binding. */
export interface DataPipelineBindingOptions<TOutput> extends Omit<DataPipelineOptions, "signal" | "revision"> {
  initialRun?: boolean;
  debounceMs?: number;
  abortOnDispose?: boolean;
  onResult?: (value: TOutput, revision: number) => void | Promise<void>;
  onError?: (error: unknown, revision: number) => void | Promise<void>;
}

/** Serializable inspection snapshot for data Pipeline Binding. */
export interface DataPipelineBindingInspection {
  revision: number;
  running: boolean;
  pending: boolean;
  disposed: boolean;
}

/** Public interface describing a data Pipeline Binding. */
export interface DataPipelineBinding<TInput> {
  (): void;
  dispose(): void;
  abort(): void;
  flush(): void;
  run(input?: TInput): void;
  inspect(): DataPipelineBindingInspection;
}

/** Binds data Pipeline behavior and returns a disposer when applicable. */
export function bindDataPipeline<TInput, TOutput>(
  input: Signal<TInput>,
  output: Signal<TOutput | undefined>,
  transforms: readonly AnyDataTransform[],
  options: DataPipelineBindingOptions<TOutput> = {},
): DataPipelineBinding<TInput> {
  const debounceMs = Math.max(0, options.debounceMs ?? 0);
  let disposed = false;
  let revision = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  const clearPending = () => {
    if (timeout === undefined) return;
    clearTimeout(timeout);
    timeout = undefined;
  };
  const abort = () => {
    controller?.abort();
    controller = undefined;
  };
  const run = (next: TInput) => {
    if (disposed) return;
    abort();
    const runRevision = ++revision;
    const runController = new AbortController();
    controller = runController;

    runDataPipeline<TInput, TOutput>(next, transforms, {
      scheduler: options.scheduler,
      priority: options.priority,
      signal: runController.signal,
      revision: runRevision,
    })
      .then((value) => {
        if (disposed || runRevision !== revision || runController.signal.aborted) return;
        output.value = value;
        return options.onResult?.(value, runRevision);
      })
      .catch((error) => {
        if (disposed || runRevision !== revision || error instanceof DataPipelineAbortError) return;
        return options.onError?.(error, runRevision);
      })
      .finally(() => {
        if (controller === runController) {
          controller = undefined;
        }
      });
  };
  const schedule = (next: TInput) => {
    clearPending();
    if (debounceMs === 0) {
      run(next);
      return;
    }
    timeout = setTimeout(() => {
      timeout = undefined;
      run(next);
    }, debounceMs);
  };

  if (options.initialRun ?? true) {
    schedule(input.peek());
  }
  input.subscribe(schedule);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearPending();
    input.unsubscribe(schedule);
    if (options.abortOnDispose ?? true) {
      abort();
    }
  };

  const binding = dispose as DataPipelineBinding<TInput>;
  binding.dispose = dispose;
  binding.abort = abort;
  binding.flush = () => {
    if (disposed || timeout === undefined) return;
    const next = input.peek();
    clearPending();
    run(next);
  };
  binding.run = (next = input.peek()) => {
    clearPending();
    run(next);
  };
  binding.inspect = () => ({
    revision,
    running: controller !== undefined,
    pending: timeout !== undefined,
    disposed,
  });

  return binding;
}
