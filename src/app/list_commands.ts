// Copyright 2023 Im-Beast. MIT license.
import type { ListController, ListInspection } from "../components/list.ts";
import type { Action } from "./actions.ts";
import { actionCommandGroup, CommandGroupBuilder } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for list Command variants. */
export type ListCommandKind = "first" | "previous" | "next" | "last" | "select" | "item";

/** Action union emitted by list Command command helpers. */
export type ListCommandAction =
  | Action<"list.changed", ListCommandPayload>
  | Action<"list.itemSelected", ListCommandPayload & { item: string; index: number }>;

/** Payload carried by list Command actions. */
export interface ListCommandPayload {
  id: string;
  inspection: ListInspection;
}

/** Options for configuring list Command. */
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

/** Builds command definitions for list. */
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
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includeMoveCommands ?? true) {
    builder.commands.push(...actionCommandGroup<TAction, ListCommandPayload, ListCommandKind, string | undefined>({
      idPrefix,
      group,
      type: "list.changed",
      keywords: ["list"],
      label,
      payload,
      disabled: () => payload().inspection.empty,
      entries: [
        ["first", "First List Item", () => controller.first()],
        ["previous", "Previous List Item", () => controller.move(-1)],
        ["next", "Next List Item", () => controller.move(1)],
        ["last", "Last List Item", () => controller.last()],
      ],
    }));
  }

  if (options.includeSelectCommand ?? true) {
    builder.addOptionalAction(
      "select",
      label("select", "Select List Item"),
      "list.itemSelected",
      () => controller.selectActive(),
      (item) => ({ ...payload(), item, index: controller.selectedIndex.peek() }),
      ["list", "select", "active"],
      () => controller.selected() === undefined,
    );
  }

  if (options.includeItemCommands ?? false) {
    for (const [index, item] of controller.items.peek().entries()) {
      builder.addOptionalAction(
        `item.${index}`,
        `${label("item", "Select List Item")}: ${itemLabel(item, index)}`,
        "list.itemSelected",
        () => {
          const selected = controller.setSelectedIndex(index);
          if (selected !== undefined) controller.selectActive();
          return selected;
        },
        (selected) => ({ ...payload(), item: selected, index }),
        ["list", "item", item, `${index}`],
        () => controller.items.peek()[index] === undefined || controller.selectedIndex.peek() === index,
      );
    }
  }

  return builder.commands;
}

/** Binds list Commands behavior and returns a disposer when applicable. */
export function bindListCommands<TAction extends Action = ListCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: ListController,
  options: ListCommandOptions = {},
): () => void {
  return registry.registerAll(listCommands<TAction>(controller, options));
}
