// Copyright 2023 Im-Beast. MIT license.
import type { DataTableController } from "../components/data_table.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for data Table Command variants. */
export type DataTableCommandKind =
  | "first"
  | "previous"
  | "next"
  | "last"
  | "pagePrevious"
  | "pageNext"
  | "clearQuery"
  | "sort";

/** Options for configuring data Table Command. */
export interface DataTableCommandOptions {
  idPrefix?: string;
  group?: string;
  includeSelectionCommands?: boolean;
  includePagingCommands?: boolean;
  includeQueryCommands?: boolean;
  includeSortCommands?: boolean;
  disabledWhenEmpty?: boolean;
  labels?: Partial<Record<DataTableCommandKind, string>>;
}

/** Builds command definitions for data Table. */
export function dataTableCommands<
  TAction extends Action = Action,
  TRow extends Record<string, unknown> = Record<string, unknown>,
>(
  table: DataTableController<TRow>,
  options: DataTableCommandOptions = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "table";
  const group = options.group ?? "table";
  const disabledWhenEmpty = options.disabledWhenEmpty ?? true;
  const empty = () => disabledWhenEmpty && table.view.peek().totalRows <= 0;
  const label = (kind: DataTableCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const commands: Command<TAction>[] = [];

  if (options.includeSelectionCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.first`,
        label: label("first", "First Row"),
        group,
        binding: { key: "home" },
        disabled: empty,
        action: () => table.first(),
      },
      {
        id: `${idPrefix}.previous`,
        label: label("previous", "Previous Row"),
        group,
        binding: { key: "up" },
        disabled: empty,
        action: () => table.moveSelection(-1),
      },
      {
        id: `${idPrefix}.next`,
        label: label("next", "Next Row"),
        group,
        binding: { key: "down" },
        disabled: empty,
        action: () => table.moveSelection(1),
      },
      {
        id: `${idPrefix}.last`,
        label: label("last", "Last Row"),
        group,
        binding: { key: "end" },
        disabled: empty,
        action: () => table.last(),
      },
    );
  }

  if (options.includePagingCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.pagePrevious`,
        label: label("pagePrevious", "Previous Page"),
        group,
        binding: { key: "pageup" },
        disabled: () => empty() || table.view.peek().page <= 0,
        action: () => table.previousPage(),
      },
      {
        id: `${idPrefix}.pageNext`,
        label: label("pageNext", "Next Page"),
        group,
        binding: { key: "pagedown" },
        disabled: () => empty() || table.view.peek().page >= table.view.peek().pageCount - 1,
        action: () => table.nextPage(),
      },
    );
  }

  if (options.includeQueryCommands ?? true) {
    commands.push({
      id: `${idPrefix}.clearQuery`,
      label: label("clearQuery", "Clear Table Query"),
      group,
      disabled: () => !table.state.peek().query,
      action: () => table.setQuery(""),
    });
  }

  if (options.includeSortCommands ?? true) {
    for (const column of table.columns.peek()) {
      if (column.sortable === false) continue;
      commands.push({
        id: `${idPrefix}.sort.${column.id}`,
        label: `${label("sort", "Sort")}: ${column.label ?? column.id}`,
        group,
        keywords: [column.id, column.label, "sort"].filter((keyword): keyword is string => !!keyword),
        action: () => table.toggleSort(column.id),
      });
    }
  }

  return commands;
}

/** Binds data Table Commands behavior and returns a disposer when applicable. */
export function bindDataTableCommands<
  TAction extends Action = Action,
  TRow extends Record<string, unknown> = Record<string, unknown>,
>(
  registry: CommandRegistry<TAction>,
  table: DataTableController<TRow>,
  options: DataTableCommandOptions = {},
): () => void {
  return registry.registerAll(dataTableCommands<TAction, TRow>(table, options));
}
