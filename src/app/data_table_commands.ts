// Copyright 2023 Im-Beast. MIT license.
import type { DataTableController } from "../components/data_table.ts";
import type { Action } from "./actions.ts";
import { CommandGroupBuilder } from "./command_helpers.ts";
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
  const commands = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includeSelectionCommands ?? true) {
    commands.add("first", label("first", "First Row"), () => table.first(), undefined, empty, { key: "home" });
    commands.add("previous", label("previous", "Previous Row"), () => table.moveSelection(-1), undefined, empty, {
      key: "up",
    });
    commands.add("next", label("next", "Next Row"), () => table.moveSelection(1), undefined, empty, { key: "down" });
    commands.add("last", label("last", "Last Row"), () => table.last(), undefined, empty, { key: "end" });
  }

  if (options.includePagingCommands ?? true) {
    commands.add(
      "pagePrevious",
      label("pagePrevious", "Previous Page"),
      () => table.previousPage(),
      undefined,
      () => empty() || table.view.peek().page <= 0,
      { key: "pageup" },
    );
    commands.add(
      "pageNext",
      label("pageNext", "Next Page"),
      () => table.nextPage(),
      undefined,
      () => empty() || table.view.peek().page >= table.view.peek().pageCount - 1,
      { key: "pagedown" },
    );
  }

  if (options.includeQueryCommands ?? true) {
    commands.add(
      "clearQuery",
      label("clearQuery", "Clear Table Query"),
      () => table.setQuery(""),
      undefined,
      () => !table.state.peek().query,
    );
  }

  if (options.includeSortCommands ?? true) {
    for (const column of table.columns.peek()) {
      if (column.sortable === false) continue;
      commands.add(
        `sort.${column.id}`,
        `${label("sort", "Sort")}: ${column.label ?? column.id}`,
        () => table.toggleSort(column.id),
        dataTableSortKeywords(column.id, column.label),
      );
    }
  }

  return commands.commands;
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

function dataTableSortKeywords(id: string, label: string | undefined): string[] {
  if (!label) return [id, "sort"];
  return [id, label, "sort"];
}
