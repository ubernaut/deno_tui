// Copyright 2023 Im-Beast. MIT license.
import type { MenuBarController, MenuBarInspection, MenuBarItem } from "../components/menu_bar.ts";
import type { Action } from "./actions.ts";
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
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      moveCommand(`${idPrefix}.first`, label("first", "First Menu Item"), group, () => controller.first(), payload),
      moveCommand(
        `${idPrefix}.previous`,
        label("previous", "Previous Menu Item"),
        group,
        () => controller.move(-1),
        payload,
      ),
      moveCommand(`${idPrefix}.next`, label("next", "Next Menu Item"), group, () => controller.move(1), payload),
      moveCommand(`${idPrefix}.last`, label("last", "Last Menu Item"), group, () => controller.last(), payload),
    );
  }

  if (options.includeSelectCommand ?? true) {
    commands.push({
      id: `${idPrefix}.select`,
      label: label("select", "Select Menu Item"),
      group,
      keywords: ["menu", "select", "active"],
      disabled: () => controller.active() === undefined,
      action: () => {
        const item = controller.selectActive();
        if (!item) return undefined;
        return {
          type: "menuBar.itemSelected",
          payload: { ...payload(), item },
        } as TAction;
      },
    });
  }

  if (options.includeItemCommands ?? false) {
    for (const [index, item] of controller.items.peek().entries()) {
      commands.push({
        id: `${idPrefix}.item.${item.id}`,
        label: `${label("item", "Select Menu Item")}: ${itemLabel(item, index)}`,
        group,
        keywords: ["menu", "item", item.id, item.label],
        disabled: () => {
          const current = controller.items.peek()[index];
          return current === undefined || current.disabled === true;
        },
        action: () => {
          const selected = controller.setActive(index) ?? controller.items.peek()[index] ?? item;
          controller.selectActive();
          return {
            type: "menuBar.itemSelected",
            payload: { ...payload(), item: selected },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

/** Binds menu Bar Commands behavior and returns a disposer when applicable. */
export function bindMenuBarCommands<TAction extends Action = MenuBarCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: MenuBarController,
  options: MenuBarCommandOptions = {},
): () => void {
  return registry.registerAll(menuBarCommands<TAction>(controller, options));
}

function moveCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  move: () => MenuBarItem | undefined,
  payload: () => MenuBarCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["menu", "menu-bar", label],
    action: () => {
      move();
      return { type: "menuBar.changed", payload: payload() } as TAction;
    },
  };
}
