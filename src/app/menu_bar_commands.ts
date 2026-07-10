// Copyright 2023 Im-Beast. MIT license.
import type { MenuBarController, MenuBarInspection, MenuBarItem } from "../components/menu_bar.ts";
import type { Action } from "./actions.ts";
import { actionCommandGroup, CommandGroupBuilder, selectionNavigationCommandEntries } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for menu Bar Command variants. */
export type MenuBarCommandKind = "first" | "previous" | "next" | "last" | "select" | "item";

/** Action union emitted by menu Bar Command command helpers. */
export type MenuBarCommandAction =
  | Action<"menuBar.changed", MenuBarCommandPayload>
  | Action<"menuBar.itemSelected", MenuBarCommandPayload & { item: MenuBarItem }>;

/** Payload carried by menu Bar Command actions. */
export interface MenuBarCommandPayload {
  id: string;
  inspection: MenuBarInspection;
}

/** Options for configuring menu Bar Command. */
export interface MenuBarCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includeSelectCommand?: boolean;
  includeItemCommands?: boolean;
  labels?: Partial<Record<MenuBarCommandKind, string>>;
  itemLabel?: (item: MenuBarItem, index: number) => string;
}

/** Builds command definitions for menu Bar. */
export function menuBarCommands<TAction extends Action = MenuBarCommandAction>(
  controller: MenuBarController,
  options: MenuBarCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "menu";
  const idPrefix = options.idPrefix ?? "menu";
  const group = options.group ?? "navigation";
  const label = (kind: MenuBarCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const itemLabel = options.itemLabel ?? ((item: MenuBarItem) => item.label);
  const payload = (): MenuBarCommandPayload => ({ id, inspection: controller.inspect() });
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includeMoveCommands ?? true) {
    builder.commands.push(...actionCommandGroup<
      TAction,
      MenuBarCommandPayload,
      MenuBarCommandKind,
      MenuBarItem | undefined
    >({
      idPrefix,
      group,
      type: "menuBar.changed",
      keywords: ["menu", "menu-bar"],
      label,
      payload,
      entries: selectionNavigationCommandEntries(controller, "Menu Item"),
    }));
  }

  if (options.includeSelectCommand ?? true) {
    builder.addOptionalAction(
      "select",
      label("select", "Select Menu Item"),
      "menuBar.itemSelected",
      () => controller.selectActive(),
      (item) => ({ ...payload(), item }),
      ["menu", "select", "active"],
      () => controller.active() === undefined,
    );
  }

  if (options.includeItemCommands ?? false) {
    for (const [index, item] of controller.items.peek().entries()) {
      builder.addOptionalAction(
        `item.${item.id}`,
        `${label("item", "Select Menu Item")}: ${itemLabel(item, index)}`,
        "menuBar.itemSelected",
        () => {
          const selected = controller.setActive(index) ?? controller.items.peek()[index] ?? item;
          controller.selectActive();
          return selected;
        },
        (selected) => ({ ...payload(), item: selected }),
        ["menu", "item", item.id, item.label],
        () => {
          const current = controller.items.peek()[index];
          return current === undefined || current.disabled === true;
        },
      );
    }
  }

  return builder.commands;
}

/** Binds menu Bar Commands behavior and returns a disposer when applicable. */
export function bindMenuBarCommands<TAction extends Action = MenuBarCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: MenuBarController,
  options: MenuBarCommandOptions = {},
): () => void {
  return registry.registerAll(menuBarCommands<TAction>(controller, options));
}
