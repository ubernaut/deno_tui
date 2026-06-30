// Copyright 2023 Im-Beast. MIT license.
import type { DataTableController, DataTableState } from "../components/data_table.ts";
import type { DataQueryController, DataQueryParams, DataQueryResult } from "../runtime/data_query.ts";
import type { AsyncResourceState } from "../runtime/resource.ts";
import type { Signal } from "../signals/mod.ts";

/** Options for configuring data Query Params Binding. */
export interface DataQueryParamsBindingOptions<TRow, TParams extends DataQueryParams = DataQueryParams> {
  initialLoad?: boolean;
  initialRestore?: boolean;
  debounceMs?: number;
  abortOnDispose?: boolean;
  onLoad?: (result: DataQueryResult<TRow>, params: TParams) => void | Promise<void>;
  onRestore?: (result: DataQueryResult<TRow>, params: TParams) => void | Promise<void>;
  onError?: (error: unknown, params: TParams) => void | Promise<void>;
}

/** Serializable inspection snapshot for data Query Params Binding. */
export interface DataQueryParamsBindingInspection<TParams extends DataQueryParams = DataQueryParams> {
  disposed: boolean;
  pending: boolean;
  debounceMs: number;
  abortOnDispose: boolean;
  params: TParams;
  query: ReturnType<DataQueryController["inspect"]>;
}

/** Public type alias for a data Query Params Binding Handle. */
export type DataQueryParamsBindingHandle<TParams extends DataQueryParams = DataQueryParams> = (() => void) & {
  dispose(): void;
  flush(): void;
  abort(): void;
  load(params?: TParams): void;
  inspect(): DataQueryParamsBindingInspection<TParams>;
};

/** Options for configuring data Query Result Binding. */
export interface DataQueryResultBindingOptions<TRow> {
  initialSync?: boolean;
  includeLoadingData?: boolean;
  cloneRows?: boolean;
  onSync?: (result: DataQueryResult<TRow>, state: AsyncResourceState<DataQueryResult<TRow>>) => void;
}

/** Serializable inspection snapshot for data Query Result Binding. */
export interface DataQueryResultBindingInspection {
  disposed: boolean;
  rowCount: number;
  totalRows: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Public type alias for a data Query Result Binding Handle. */
export type DataQueryResultBindingHandle = (() => void) & {
  dispose(): void;
  sync(): void;
  inspect(): DataQueryResultBindingInspection;
};

/** Options for configuring data Query Table Binding. */
export interface DataQueryTableBindingOptions<TRow extends Record<string, unknown>>
  extends DataQueryResultBindingOptions<TRow> {
  resetLocalQuery?: boolean;
  resetLocalSort?: boolean;
  resetLocalPage?: boolean;
  syncPageSize?: boolean;
  preserveSelectedKey?: boolean;
}

/** Serializable inspection snapshot for data Query Table Binding. */
export interface DataQueryTableBindingInspection extends DataQueryResultBindingInspection {
  table: ReturnType<DataTableController["inspect"]>;
}

/** Public type alias for a data Query Table Binding Handle. */
export type DataQueryTableBindingHandle = (() => void) & {
  dispose(): void;
  sync(): void;
  inspect(): DataQueryTableBindingInspection;
};

/** Binds data Query Params behavior and returns a disposer when applicable. */
export function bindDataQueryParams<
  TRow,
  TParams extends DataQueryParams = DataQueryParams,
>(
  query: DataQueryController<TRow>,
  params: Signal<TParams>,
  options: DataQueryParamsBindingOptions<TRow, TParams> = {},
): DataQueryParamsBindingHandle<TParams> {
  const debounceMs = Math.max(0, options.debounceMs ?? 0);
  let disposed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const clearPending = () => {
    if (timeout === undefined) return;
    clearTimeout(timeout);
    timeout = undefined;
  };
  const restore = (next: TParams) => {
    query.restore(next)
      .then((result) => {
        if (result) return options.onRestore?.(result, next);
      })
      .catch((error) => options.onError?.(error, next));
  };
  const loadNow = (next: TParams) => {
    if (disposed) return;
    query.load(next)
      .then((result) => options.onLoad?.(result, next))
      .catch((error) => options.onError?.(error, next));
  };
  const schedule = (next: TParams) => {
    clearPending();
    if (debounceMs === 0) {
      loadNow(next);
      return;
    }
    timeout = setTimeout(() => {
      timeout = undefined;
      loadNow(next);
    }, debounceMs);
  };

  if (options.initialRestore) {
    restore(params.peek());
  }
  if (options.initialLoad ?? true) {
    schedule(params.peek());
  }
  params.subscribe(schedule);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearPending();
    params.unsubscribe(schedule);
    if (options.abortOnDispose ?? true) {
      query.abort();
    }
  };
  const flush = () => {
    if (disposed) return;
    clearPending();
    loadNow(params.peek());
  };
  const abort = () => {
    clearPending();
    query.abort();
  };

  return Object.assign(dispose, {
    dispose,
    flush,
    abort,
    load: (next = params.peek()) => {
      clearPending();
      loadNow(next);
    },
    inspect: () => ({
      disposed,
      pending: timeout !== undefined,
      debounceMs,
      abortOnDispose: options.abortOnDispose ?? true,
      params: params.peek(),
      query: query.inspect(),
    }),
  });
}

/** Binds data Query Result behavior and returns a disposer when applicable. */
export function bindDataQueryResult<TRow>(
  query: DataQueryController<TRow>,
  rows: Signal<readonly TRow[]>,
  options: DataQueryResultBindingOptions<TRow> = {},
): DataQueryResultBindingHandle {
  let disposed = false;
  let last = query.result.peek();
  const sync = () => {
    if (disposed) return;
    const state = query.state.peek();
    if (state.status === "loading" && !(options.includeLoadingData ?? true)) return;
    const result = state.data ?? query.result.peek();
    last = result;
    rows.value = options.cloneRows ?? true ? [...result.rows] : result.rows;
    options.onSync?.(result, state);
  };

  if (options.initialSync ?? true) {
    sync();
  }
  query.state.subscribe(sync);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    query.state.unsubscribe(sync);
  };

  return Object.assign(dispose, {
    dispose,
    sync,
    inspect: () => ({
      disposed,
      rowCount: last.rows.length,
      totalRows: last.totalRows,
      page: last.page,
      pageSize: last.pageSize,
      pageCount: last.pageCount,
    }),
  });
}

/** Binds data Query Table behavior and returns a disposer when applicable. */
export function bindDataQueryTable<TRow extends Record<string, unknown>>(
  query: DataQueryController<TRow>,
  table: DataTableController<TRow>,
  options: DataQueryTableBindingOptions<TRow> = {},
): DataQueryTableBindingHandle {
  const resultBinding = bindDataQueryResult(query, table.rows, {
    ...options,
    initialSync: false,
    onSync: (result, state) => {
      const current = table.state.peek();
      const next: DataTableState = {
        ...current,
        selectedKey: options.preserveSelectedKey ?? true ? current.selectedKey : undefined,
      };
      if (options.resetLocalQuery ?? true) next.query = "";
      if (options.resetLocalSort ?? true) next.sort = undefined;
      if (options.resetLocalPage ?? true) next.page = 0;
      if (options.syncPageSize ?? true) next.pageSize = Math.max(1, result.rows.length || result.pageSize);
      table.state.value = next;
      options.onSync?.(result, state);
    },
  });

  if (options.initialSync ?? true) {
    resultBinding.sync();
  }

  const dispose = resultBinding.dispose;
  const sync = resultBinding.sync;
  const inspectResult = resultBinding.inspect;
  return Object.assign(dispose, {
    dispose,
    sync,
    inspect: () => ({
      ...inspectResult(),
      table: table.inspect(),
    }),
  });
}
