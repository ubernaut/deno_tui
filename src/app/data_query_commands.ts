// Copyright 2023 Im-Beast. MIT license.
import type { DataQueryController, DataQueryInspection, DataQuerySort } from "../runtime/data_query.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

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
      disabled: () => loading() || Object.keys(query.params.peek().filters).length === 0,
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
