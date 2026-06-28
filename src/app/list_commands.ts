// Copyright 2023 Im-Beast. MIT license.
import type { ListController, ListInspection } from "../components/list.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type ListCommandKind = "first" | "previous" | "next" | "last" | "select" | "item";

export type ListCommandAction =
  | Action<"list.changed", ListCommandPayload>
  | Action<"list.itemSelected", ListCommandPayload & { item: string; index: number }>;

export interface ListCommandPayload {
  id: string;
  inspection: ListInspection;
}

export interface ListCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includeSelectCommand?: boolean;
  includeItemCommands?: boolean;
  labels?: Partial<Record<ListCommandKind, string>>;
  itemLabel?: (item: string, index: number) => string;
}

export function listCommands<TAction extends Action = ListCommandAction>(
  controller: ListController,
  options: ListCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "list";
  const idPrefix = options.idPrefix ?? "list";
  const group = options.group ?? "selection";
  const label = (kind: ListCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const itemLabel = options.itemLabel ?? ((item: string) => item);
  const payload = (): ListCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      moveCommand(`${idPrefix}.first`, label("first", "First List Item"), group, () => controller.first(), payload),
      moveCommand(
        `${idPrefix}.previous`,
        label("previous", "Previous List Item"),
        group,
        () => controller.move(-1),
        payload,
      ),
      moveCommand(`${idPrefix}.next`, label("next", "Next List Item"), group, () => controller.move(1), payload),
      moveCommand(`${idPrefix}.last`, label("last", "Last List Item"), group, () => controller.last(), payload),
    );
  }

  if (options.includeSelectCommand ?? true) {
    commands.push({
      id: `${idPrefix}.select`,
      label: label("select", "Select List Item"),
      group,
      keywords: ["list", "select", "active"],
      disabled: () => controller.selected() === undefined,
      action: () => {
        const item = controller.selectActive();
        if (item === undefined) return undefined;
        return {
          type: "list.itemSelected",
          payload: { ...payload(), item, index: controller.selectedIndex.peek() },
        } as TAction;
      },
    });
  }

  if (options.includeItemCommands ?? false) {
    for (const [index, item] of controller.items.peek().entries()) {
      commands.push({
        id: `${idPrefix}.item.${index}`,
        label: `${label("item", "Select List Item")}: ${itemLabel(item, index)}`,
        group,
        keywords: ["list", "item", item, `${index}`],
        disabled: () => controller.items.peek()[index] === undefined || controller.selectedIndex.peek() === index,
        action: () => {
          const selected = controller.setSelectedIndex(index);
          if (selected === undefined) return undefined;
          controller.selectActive();
          return {
            type: "list.itemSelected",
            payload: { ...payload(), item: selected, index },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

export function bindListCommands<TAction extends Action = ListCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: ListController,
  options: ListCommandOptions = {},
): () => void {
  return registry.registerAll(listCommands<TAction>(controller, options));
}

function moveCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  move: () => string | undefined,
  payload: () => ListCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["list", label],
    disabled: () => moveDisabled(payload),
    action: () => {
      move();
      return { type: "list.changed", payload: payload() } as TAction;
    },
  };
}

function moveDisabled(payload: () => ListCommandPayload): boolean {
  return payload().inspection.empty;
}
