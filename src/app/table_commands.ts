// Copyright 2023 Im-Beast. MIT license.
import type { TableController, TableInspection } from "../components/table.ts";
import type { Action } from "./actions.ts";
import { actionCommandGroup, CommandGroupBuilder } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for table Command variants. */
export type TableCommandKind =
  | "first"
  | "previous"
  | "next"
  | "last"
  | "pagePrevious"
  | "pageNext"
  | "select";

/** Action union emitted by table Command command helpers. */
export type TableCommandAction =
  | Action<"table.changed", TableCommandPayload>
  | Action<"table.rowSelected", TableCommandPayload & { row: number }>;

/** Payload carried by table Command actions. */
export interface TableCommandPayload {
  id: string;
  inspection: TableInspection;
}

/** Options for configuring table Command. */
export interface TableCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includePageCommands?: boolean;
  includeSelectCommand?: boolean;
  labels?: Partial<Record<TableCommandKind, string>>;
}

/** Builds command definitions for table. */
export function tableCommands<TAction extends Action = TableCommandAction>(
  controller: TableController,
  options: TableCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "table";
  const idPrefix = options.idPrefix ?? "table";
  const group = options.group ?? "table";
  const label = (kind: TableCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = (): TableCommandPayload => ({ id, inspection: controller.inspect() });
  const empty = () => controller.inspect().empty;
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includeMoveCommands ?? true) {
    builder.commands.push(...actionCommandGroup<TAction, TableCommandPayload, TableCommandKind, number>({
      idPrefix,
      group,
      type: "table.changed",
      keywords: ["table"],
      label,
      payload,
      disabled: empty,
      entries: [
        ["first", "First Table Row", () => controller.first(), ["table", "first"]],
        ["previous", "Previous Table Row", () => controller.move(-1), ["table", "previous"]],
        ["next", "Next Table Row", () => controller.move(1), ["table", "next"]],
        ["last", "Last Table Row", () => controller.last(), ["table", "last"]],
      ],
    }));
  }

  if (options.includePageCommands ?? true) {
    builder.commands.push(...actionCommandGroup<TAction, TableCommandPayload, TableCommandKind, number>({
      idPrefix,
      group,
      type: "table.changed",
      keywords: ["table"],
      label,
      payload,
      disabled: empty,
      entries: [
        ["pagePrevious", "Previous Table Page", () => controller.pageUp(), ["table", "page", "previous"]],
        ["pageNext", "Next Table Page", () => controller.pageDown(), ["table", "page", "next"]],
      ],
    }));
  }

  if (options.includeSelectCommand ?? true) {
    builder.addOptionalAction(
      "select",
      label("select", "Select Table Row"),
      "table.rowSelected",
      () => controller.select(controller.selectedRow.peek(), false),
      (row) => ({ ...payload(), row }),
      ["table", "select", "row"],
      empty,
    );
  }

  return builder.commands;
}

/** Binds table Commands behavior and returns a disposer when applicable. */
export function bindTableCommands<TAction extends Action = TableCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: TableController,
  options: TableCommandOptions = {},
): () => void {
  return registry.registerAll(tableCommands<TAction>(controller, options));
}
