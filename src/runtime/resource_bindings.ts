// Copyright 2023 Im-Beast. MIT license.
import type { Signal } from "../signals/mod.ts";
import type { AsyncResource, AsyncResourceState } from "./resource.ts";

export interface ResourceParamsBindingOptions<TParams, TData> {
  initialLoad?: boolean;
  debounceMs?: number;
  abortOnDispose?: boolean;
  onLoad?: (state: AsyncResourceState<TData, TParams>) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
}

export interface ResourceParamsBindingInspection<TParams, TData> {
  disposed: boolean;
  pending: boolean;
  debounceMs: number;
  abortOnDispose: boolean;
  params: TParams;
  resource: ReturnType<AsyncResource<TParams, TData>["inspect"]>;
}

export type ResourceParamsBindingHandle<TParams, TData> = (() => void) & {
  dispose(): void;
  flush(): void;
  abort(): void;
  inspect(): ResourceParamsBindingInspection<TParams, TData>;
};

export function bindResourceParams<TParams, TData>(
  resource: AsyncResource<TParams, TData>,
  params: Signal<TParams>,
  options: ResourceParamsBindingOptions<TParams, TData> = {},
): ResourceParamsBindingHandle<TParams, TData> {
  const debounceMs = Math.max(0, options.debounceMs ?? 0);
  let disposed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const clearPending = () => {
    if (timeout === undefined) return;
    clearTimeout(timeout);
    timeout = undefined;
  };
  const load = (next: TParams) => {
    if (disposed) return;
    resource.load(next)
      .then((state) => options.onLoad?.(state))
      .catch((error) => options.onError?.(error));
  };
  const schedule = (next: TParams) => {
    clearPending();
    if (debounceMs === 0) {
      load(next);
      return;
    }

    timeout = setTimeout(() => {
      timeout = undefined;
      load(next);
    }, debounceMs);
  };

  if (options.initialLoad ?? true) {
    schedule(params.peek());
  }
  params.subscribe(schedule);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearPending();
    params.unsubscribe(schedule);
    if (options.abortOnDispose) {
      resource.abort();
    }
  };
  const abort = () => {
    clearPending();
    resource.abort();
  };
  const flush = () => {
    if (disposed) return;
    clearPending();
    load(params.peek());
  };
  const inspect = (): ResourceParamsBindingInspection<TParams, TData> => ({
    disposed,
    pending: timeout !== undefined,
    debounceMs,
    abortOnDispose: options.abortOnDispose ?? false,
    params: params.peek(),
    resource: resource.inspect(),
  });

  return Object.assign(dispose, {
    dispose,
    flush,
    abort,
    inspect,
  });
}
