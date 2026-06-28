// Copyright 2023 Im-Beast. MIT license.
import type { TableController, TableInspection } from "../components/table.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type TableCommandKind =
  | "first"
  | "previous"
  | "next"
  | "last"
  | "pagePrevious"
  | "pageNext"
  | "select";

export type TableCommandAction =
  | Action<"table.changed", TableCommandPayload>
  | Action<"table.rowSelected", TableCommandPayload & { row: number }>;

export interface TableCommandPayload {
  id: string;
  inspection: TableInspection;
}

export interface TableCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includePageCommands?: boolean;
  includeSelectCommand?: boolean;
  labels?: Partial<Record<TableCommandKind, string>>;
}

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
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      moveCommand(
        `${idPrefix}.first`,
        label("first", "First Table Row"),
        group,
        ["table", "first"],
        () => controller.first(),
        payload,
        empty,
      ),
      moveCommand(
        `${idPrefix}.previous`,
        label("previous", "Previous Table Row"),
        group,
        ["table", "previous"],
        () => controller.move(-1),
        payload,
        empty,
      ),
      moveCommand(
        `${idPrefix}.next`,
        label("next", "Next Table Row"),
        group,
        ["table", "next"],
        () => controller.move(1),
        payload,
        empty,
      ),
      moveCommand(
        `${idPrefix}.last`,
        label("last", "Last Table Row"),
        group,
        ["table", "last"],
        () => controller.last(),
        payload,
        empty,
      ),
    );
  }

  if (options.includePageCommands ?? true) {
    commands.push(
      moveCommand(
        `${idPrefix}.pagePrevious`,
        label("pagePrevious", "Previous Table Page"),
        group,
        ["table", "page", "previous"],
        () => controller.pageUp(),
        payload,
        empty,
      ),
      moveCommand(
        `${idPrefix}.pageNext`,
        label("pageNext", "Next Table Page"),
        group,
        ["table", "page", "next"],
        () => controller.pageDown(),
        payload,
        empty,
      ),
    );
  }

  if (options.includeSelectCommand ?? true) {
    commands.push({
      id: `${idPrefix}.select`,
      label: label("select", "Select Table Row"),
      group,
      keywords: ["table", "select", "row"],
      disabled: empty,
      action: () => {
        const row = controller.select(controller.selectedRow.peek(), false);
        return {
          type: "table.rowSelected",
          payload: { ...payload(), row },
        } as TAction;
      },
    });
  }

  return commands;
}

export function bindTableCommands<TAction extends Action = TableCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: TableController,
  options: TableCommandOptions = {},
): () => void {
  return registry.registerAll(tableCommands<TAction>(controller, options));
}

function moveCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  keywords: string[],
  move: () => number,
  payload: () => TableCommandPayload,
  disabled: () => boolean,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords,
    disabled,
    action: () => {
      move();
      return { type: "table.changed", payload: payload() } as TAction;
    },
  };
}
