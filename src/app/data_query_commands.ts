// Copyright 2023 Im-Beast. MIT license.
import type { DataTableController, DataTableState } from "../components/data_table.ts";
import type {
  DataQueryController,
  DataQueryControllerOptions,
  DataQueryInspection,
  DataQueryParams,
  DataQueryResult,
  DataQuerySort,
} from "../runtime/data_query.ts";
import { createDataQueryController } from "../runtime/data_query.ts";
import type { AsyncResourceState } from "../runtime/resource.ts";
import type { Signal } from "../signals/mod.ts";
import type { Action } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer, TuiApp } from "./app.ts";
import { bindCommandKeymap, type CommandKeymapBindingOptions } from "./command_bindings.ts";
import type { Command, CommandRegistry } from "./commands.ts";
import { DisposableStack } from "./disposables.ts";
import type { Route } from "./router.ts";
import type { SettingsController } from "./settings.ts";
import { bindDataQuerySetting, type DataQuerySettingBindingOptions, type SettingBinding } from "./settings_bindings.ts";

/** Identifier union for data Query Command variants. */
export type DataQueryCommandKind =
  | "reload"
  | "restore"
  | "clearCache"
  | "clearQuery"
  | "clearFilters"
  | "previousPage"
  | "nextPage"
  | "pageSize"
  | "sort";

/** Action union emitted by data Query Command command helpers. */
export type DataQueryCommandAction<TRow = unknown> =
  | Action<"dataQuery.loaded", DataQueryCommandPayload<TRow>>
  | Action<"dataQuery.restored", DataQueryCommandPayload<TRow>>
  | Action<"dataQuery.cacheCleared", DataQueryCommandPayload<TRow>>
  | Action<"dataQuery.queryCleared", DataQueryCommandPayload<TRow>>
  | Action<"dataQuery.filtersCleared", DataQueryCommandPayload<TRow>>
  | Action<"dataQuery.pageChanged", DataQueryCommandPayload<TRow> & { page: number }>
  | Action<"dataQuery.pageSizeChanged", DataQueryCommandPayload<TRow> & { pageSize: number }>
  | Action<"dataQuery.sortChanged", DataQueryCommandPayload<TRow> & { sort?: DataQuerySort }>;

/** Payload carried by data Query Command actions. */
export interface DataQueryCommandPayload<TRow = unknown> {
  id: string;
  inspection: DataQueryInspection<TRow>;
}

/** Public interface describing a data Query Sort Command. */
export interface DataQuerySortCommand {
  field: string;
  label?: string;
  keywords?: readonly string[];
}

/** Options for configuring data Query Command. */
export interface DataQueryCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeReload?: boolean;
  includeRestore?: boolean;
  includeCacheCommands?: boolean;
  includeQueryCommands?: boolean;
  includeFilterCommands?: boolean;
  includePagingCommands?: boolean;
  includePageSizeCommands?: boolean;
  includeSortCommands?: boolean;
  disabledWhileLoading?: boolean;
  pageSizes?: readonly number[];
  sortFields?: readonly (string | DataQuerySortCommand)[];
  labels?: Partial<Record<DataQueryCommandKind, string>>;
}

/** Options for configuring the data query plugin. */
export interface DataQueryPluginOptions<
  TRow extends Record<string, unknown>,
  TParams extends DataQueryParams = DataQueryParams,
> {
  id?: string;
  label?: string;
  controller?: DataQueryController<TRow>;
  controllerOptions?: DataQueryControllerOptions<TRow>;
  params?: Signal<TParams>;
  bindParams?: boolean | Omit<Parameters<typeof bindDataQueryParams<TRow, TParams>>[2], "initialRestore">;
  table?: DataTableController<TRow>;
  tableBinding?: boolean | DataQueryTableBindingOptions<TRow>;
  settings?: SettingsController;
  persistParams?: boolean | DataQuerySettingBindingOptions;
  commands?: boolean | DataQueryCommandOptions;
  mirrorKeymap?: boolean | CommandKeymapBindingOptions;
  install?: (context: DataQueryPluginInstallContext<TRow, TParams>) => AppPluginDisposer;
}

/** Context object passed to data query plugin install callbacks. */
export interface DataQueryPluginInstallContext<
  TRow extends Record<string, unknown>,
  TParams extends DataQueryParams = DataQueryParams,
> {
  app: TuiApp<Action, Route>;
  controller: DataQueryController<TRow>;
  paramsBinding?: DataQueryParamsBindingHandle<TParams>;
  tableBinding?: DataQueryTableBindingHandle;
  paramsSetting?: SettingBinding<ReturnType<DataQueryController<TRow>["params"]["peek"]>, unknown>;
}

/** Serializable inspection snapshot for the data query plugin. */
export interface DataQueryPluginInspection<TRow = unknown> {
  id?: string;
  label?: string;
  query: ReturnType<DataQueryController<TRow>["inspect"]>;
  commandsEnabled: boolean;
  settingsEnabled: boolean;
  paramsPersistenceEnabled: boolean;
  paramsBindingEnabled: boolean;
  tableBindingEnabled: boolean;
  keymapMirroringEnabled: boolean;
}

/** Public interface describing a data query app plugin. */
export interface DataQueryAppPlugin<
  TRow extends Record<string, unknown>,
  TAction extends Action = DataQueryCommandAction<TRow>,
  TRoute extends Route = Route,
> extends AppPlugin<TAction, TRoute> {
  readonly controller: DataQueryController<TRow>;
  inspect(): DataQueryPluginInspection<TRow>;
}

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

/** Builds command definitions for data Query. */
export function dataQueryCommands<
  TRow = unknown,
  TAction extends Action = DataQueryCommandAction<TRow>,
>(
  query: DataQueryController<TRow>,
  options: DataQueryCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "query";
  const idPrefix = options.idPrefix ?? "query";
  const group = options.group ?? "query";
  const disabledWhileLoading = options.disabledWhileLoading ?? true;
  const label = (kind: DataQueryCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const loading = () => disabledWhileLoading && query.inspect().loading;
  const payload = (): DataQueryCommandPayload<TRow> => ({ id, inspection: query.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeReload ?? true) {
    commands.push({
      id: `${idPrefix}.reload`,
      label: label("reload", "Reload Data Query"),
      description: "Reload the current data query parameters.",
      group,
      keywords: ["data", "query", "reload", "refresh"],
      disabled: loading,
      action: async () => {
        await query.reload();
        return { type: "dataQuery.loaded", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeRestore ?? true) {
    commands.push({
      id: `${idPrefix}.restore`,
      label: label("restore", "Restore Data Query Cache"),
      description: "Restore the cached result for the current data query parameters.",
      group,
      keywords: ["data", "query", "restore", "cache"],
      disabled: loading,
      action: async () => {
        await query.restore();
        return { type: "dataQuery.restored", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeCacheCommands ?? true) {
    commands.push({
      id: `${idPrefix}.clearCache`,
      label: label("clearCache", "Clear Data Query Cache"),
      description: "Clear the cached result for the current data query parameters.",
      group,
      keywords: ["data", "query", "clear", "cache"],
      disabled: loading,
      action: async () => {
        await query.clearCache();
        return { type: "dataQuery.cacheCleared", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeQueryCommands ?? true) {
    commands.push({
      id: `${idPrefix}.clearQuery`,
      label: label("clearQuery", "Clear Data Query Text"),
      description: "Clear the current data query search text.",
      group,
      keywords: ["data", "query", "search", "clear"],
      disabled: () => loading() || query.params.peek().query.length === 0,
      action: async () => {
        await query.setQuery("");
        return { type: "dataQuery.queryCleared", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeFilterCommands ?? true) {
    commands.push({
      id: `${idPrefix}.clearFilters`,
      label: label("clearFilters", "Clear Data Query Filters"),
      description: "Clear every active data query filter.",
      group,
      keywords: ["data", "query", "filter", "clear"],
      disabled: () => loading() || !hasDataQueryFilters(query.params.peek().filters),
      action: async () => {
        await query.clearFilters();
        return { type: "dataQuery.filtersCleared", payload: payload() } as TAction;
      },
    });
  }

  if (options.includePagingCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.previousPage`,
        label: label("previousPage", "Previous Query Page"),
        description: "Move to the previous data query page.",
        group,
        binding: { key: "pageup" },
        keywords: ["data", "query", "page", "previous"],
        disabled: () => loading() || query.result.peek().page <= 0,
        action: async () => {
          const result = await query.previousPage();
          return { type: "dataQuery.pageChanged", payload: { ...payload(), page: result.page } } as TAction;
        },
      },
      {
        id: `${idPrefix}.nextPage`,
        label: label("nextPage", "Next Query Page"),
        description: "Move to the next data query page.",
        group,
        binding: { key: "pagedown" },
        keywords: ["data", "query", "page", "next"],
        disabled: () => loading() || query.result.peek().page >= query.result.peek().pageCount - 1,
        action: async () => {
          const result = await query.nextPage();
          return { type: "dataQuery.pageChanged", payload: { ...payload(), page: result.page } } as TAction;
        },
      },
    );
  }

  if (options.includePageSizeCommands ?? false) {
    for (const size of options.pageSizes ?? [10, 25, 50, 100]) {
      const pageSize = Math.max(1, Math.floor(size));
      commands.push({
        id: `${idPrefix}.pageSize.${pageSize}`,
        label: `${label("pageSize", "Set Query Page Size")}: ${pageSize}`,
        description: `Show ${pageSize} rows per data query page.`,
        group,
        keywords: ["data", "query", "page", "size", String(pageSize)],
        disabled: () => loading() || query.params.peek().pageSize === pageSize,
        action: async () => {
          const result = await query.setPageSize(pageSize);
          return {
            type: "dataQuery.pageSizeChanged",
            payload: { ...payload(), pageSize: result.pageSize },
          } as TAction;
        },
      });
    }
  }

  if (options.includeSortCommands ?? false) {
    for (const field of options.sortFields ?? []) {
      const sort = normalizeSortCommand(field);
      commands.push({
        id: `${idPrefix}.sort.${encodeURIComponent(sort.field)}`,
        label: `${label("sort", "Sort Query")}: ${sort.label}`,
        description: `Cycle the data query sort for ${sort.label}.`,
        group,
        keywords: ["data", "query", "sort", sort.field, sort.label, ...(sort.keywords ?? [])],
        disabled: loading,
        action: async () => {
          await query.toggleSort(sort.field);
          return {
            type: "dataQuery.sortChanged",
            payload: { ...payload(), sort: query.params.peek().sort },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

/** Binds data Query Commands behavior and returns a disposer when applicable. */
export function bindDataQueryCommands<
  TRow = unknown,
  TAction extends Action = DataQueryCommandAction<TRow>,
>(
  registry: CommandRegistry<TAction>,
  query: DataQueryController<TRow>,
  options: DataQueryCommandOptions = {},
): () => void {
  return registry.registerAll(dataQueryCommands<TRow, TAction>(query, options));
}

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

/** Creates a data query plugin. */
export function createDataQueryPlugin<
  TRow extends Record<string, unknown>,
  TAction extends Action = DataQueryCommandAction<TRow>,
  TRoute extends Route = Route,
  TParams extends DataQueryParams = DataQueryParams,
>(
  options: DataQueryPluginOptions<TRow, TParams>,
): DataQueryAppPlugin<TRow, TAction, TRoute> {
  const controller = options.controller ?? createDataQueryPluginController(options.controllerOptions);
  const id = options.id ?? "data-query";
  const label = options.label ?? "Data Query";

  return {
    id,
    label,
    controller,
    install(app) {
      const stack = new DisposableStack();
      let paramsBinding: DataQueryParamsBindingHandle<TParams> | undefined;
      let tableBinding: DataQueryTableBindingHandle | undefined;
      let paramsSetting: SettingBinding<ReturnType<DataQueryController<TRow>["params"]["peek"]>, unknown> | undefined;

      try {
        if (options.params && (options.bindParams ?? true)) {
          paramsBinding = bindDataQueryParams(
            controller,
            options.params,
            dataQueryPluginParamsBindingOptions(dataQueryPluginEnabled(options.bindParams)),
          );
          stack.defer(paramsBinding.dispose);
        }

        if (options.table && (options.tableBinding ?? true)) {
          tableBinding = bindDataQueryTable(
            controller,
            options.table,
            dataQueryPluginTableBindingOptions(dataQueryPluginEnabled(options.tableBinding)),
          );
          stack.defer(tableBinding.dispose);
        }

        const persistParams = options.persistParams ?? true;
        if (options.settings && persistParams) {
          const binding = bindDataQuerySetting(
            controller,
            options.settings,
            dataQueryPluginSettingOptions(persistParams),
          );
          paramsSetting = binding as SettingBinding<ReturnType<DataQueryController<TRow>["params"]["peek"]>, unknown>;
          stack.defer(binding.dispose);
        }

        if (options.commands ?? true) {
          const commandOptions = dataQueryPluginCommandOptions(options.commands);
          stack.defer(bindDataQueryCommands(app.commands, controller, commandOptions));
          if (options.mirrorKeymap) {
            stack.defer(
              bindCommandKeymap(
                app.commands,
                app.keymap,
                dataQueryPluginKeymapOptions(options.mirrorKeymap, commandOptions),
              ),
            );
          }
        }

        stack.defer(
          options.install?.({
            app: app as unknown as TuiApp<Action, Route>,
            controller,
            paramsBinding,
            tableBinding,
            paramsSetting,
          }),
        );
      } catch (error) {
        stack.dispose();
        throw error;
      }

      return stack.dispose;
    },
    inspect() {
      return {
        id,
        label,
        query: controller.inspect(),
        commandsEnabled: (options.commands ?? true) !== false,
        settingsEnabled: options.settings !== undefined,
        paramsPersistenceEnabled: options.settings !== undefined && (options.persistParams ?? true) !== false,
        paramsBindingEnabled: options.params !== undefined && (options.bindParams ?? true) !== false,
        tableBindingEnabled: options.table !== undefined && (options.tableBinding ?? true) !== false,
        keymapMirroringEnabled: options.mirrorKeymap !== undefined && options.mirrorKeymap !== false,
      };
    },
  };
}

function normalizeSortCommand(field: string | DataQuerySortCommand): Required<DataQuerySortCommand> {
  if (typeof field === "string") {
    return { field, label: field, keywords: [] };
  }
  return {
    field: field.field,
    label: field.label ?? field.field,
    keywords: field.keywords ?? [],
  };
}

function hasDataQueryFilters(filters: Record<string, unknown>): boolean {
  for (const _field in filters) return true;
  return false;
}

function createDataQueryPluginController<TRow extends Record<string, unknown>>(
  options: DataQueryControllerOptions<TRow> | undefined,
): DataQueryController<TRow> {
  if (!options) {
    throw new Error("createDataQueryPlugin requires either controller or controllerOptions.");
  }
  return createDataQueryController(options);
}

function dataQueryPluginCommandOptions(
  options: boolean | DataQueryCommandOptions | undefined,
): DataQueryCommandOptions {
  return typeof options === "object" ? options : {};
}

function dataQueryPluginKeymapOptions(
  options: true | CommandKeymapBindingOptions,
  commandOptions: DataQueryCommandOptions,
): CommandKeymapBindingOptions {
  return options === true ? { group: commandOptions.group ?? "query" } : options;
}

function dataQueryPluginParamsBindingOptions<TRow, TParams extends DataQueryParams>(
  options: true | DataQueryPluginOptions<TRow & Record<string, unknown>, TParams>["bindParams"],
): Omit<Parameters<typeof bindDataQueryParams<TRow & Record<string, unknown>, TParams>>[2], "initialRestore"> {
  return typeof options === "object" ? options : {};
}

function dataQueryPluginTableBindingOptions<TRow extends Record<string, unknown>>(
  options: true | DataQueryTableBindingOptions<TRow>,
): DataQueryTableBindingOptions<TRow> {
  return typeof options === "object" ? options : {};
}

function dataQueryPluginSettingOptions<TOptions>(options: true | TOptions): TOptions {
  return options === true ? {} as TOptions : options;
}

function dataQueryPluginEnabled<TOptions>(options: boolean | TOptions | undefined): true | TOptions {
  return options === undefined || options === true ? true : options as TOptions;
}
