// Copyright 2023 Im-Beast. MIT license.
import type { Signal } from "../signals/mod.ts";
import {
  DataPipelineAbortError,
  type DataPipelineOptions,
  type DataTransform,
  runDataPipeline,
} from "./data_pipeline.ts";

export interface DataPipelineBindingOptions<TOutput> extends Omit<DataPipelineOptions, "signal" | "revision"> {
  initialRun?: boolean;
  debounceMs?: number;
  abortOnDispose?: boolean;
  onResult?: (value: TOutput, revision: number) => void | Promise<void>;
  onError?: (error: unknown, revision: number) => void | Promise<void>;
}

export function bindDataPipeline<TInput, TOutput>(
  input: Signal<TInput>,
  output: Signal<TOutput | undefined>,
  transforms: readonly DataTransform<any, any>[],
  options: DataPipelineBindingOptions<TOutput> = {},
): () => void {
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

  return () => {
    if (disposed) return;
    disposed = true;
    clearPending();
    input.unsubscribe(schedule);
    if (options.abortOnDispose ?? true) {
      abort();
    }
  };
}
