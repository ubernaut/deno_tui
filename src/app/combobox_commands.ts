// Copyright 2023 Im-Beast. MIT license.
import type { ComboBoxController, ComboBoxInspection } from "../components/combobox.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type ComboBoxCommandKind =
  | "open"
  | "close"
  | "toggle"
  | "first"
  | "previous"
  | "next"
  | "last"
  | "select"
  | "item";

export type ComboBoxCommandAction =
  | Action<"comboBox.changed", ComboBoxCommandPayload>
  | Action<"comboBox.expandedChanged", ComboBoxCommandPayload & { expanded: boolean }>
  | Action<"comboBox.itemSelected", ComboBoxCommandPayload & { item: string; index: number }>;

export interface ComboBoxCommandPayload {
  id: string;
  inspection: ComboBoxInspection;
}

export interface ComboBoxCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeExpandCommands?: boolean;
  includeMoveCommands?: boolean;
  includeSelectCommand?: boolean;
  includeItemCommands?: boolean;
  labels?: Partial<Record<ComboBoxCommandKind, string>>;
  itemLabel?: (item: string, index: number) => string;
}

export function comboBoxCommands<TAction extends Action = ComboBoxCommandAction, Items extends string[] = string[]>(
  controller: ComboBoxController<Items>,
  options: ComboBoxCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "combobox";
  const idPrefix = options.idPrefix ?? "combobox";
  const group = options.group ?? "input";
  const label = (kind: ComboBoxCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const itemLabel = options.itemLabel ?? ((item: string) => item);
  const payload = (): ComboBoxCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeExpandCommands ?? true) {
    commands.push(
      expandCommand(`${idPrefix}.open`, label("open", "Open Combo Box"), group, () => controller.open(), payload),
      expandCommand(`${idPrefix}.close`, label("close", "Close Combo Box"), group, () => controller.close(), payload),
      expandCommand(
        `${idPrefix}.toggle`,
        label("toggle", "Toggle Combo Box"),
        group,
        () => controller.toggle(),
        payload,
      ),
    );
  }

  if (options.includeMoveCommands ?? true) {
    commands.push(
      moveCommand(
        `${idPrefix}.first`,
        label("first", "First Combo Box Item"),
        group,
        () => controller.first(),
        payload,
      ),
      moveCommand(
        `${idPrefix}.previous`,
        label("previous", "Previous Combo Box Item"),
        group,
        () => controller.move(-1),
        payload,
      ),
      moveCommand(`${idPrefix}.next`, label("next", "Next Combo Box Item"), group, () => controller.move(1), payload),
      moveCommand(`${idPrefix}.last`, label("last", "Last Combo Box Item"), group, () => controller.last(), payload),
    );
  }

  if (options.includeSelectCommand ?? true) {
    commands.push({
      id: `${idPrefix}.select`,
      label: label("select", "Select Combo Box Item"),
      group,
      keywords: ["combobox", "combo-box", "select", "active"],
      disabled: () => controller.selected() === undefined,
      action: () => {
        const item = controller.selectActive();
        if (item === undefined) return undefined;
        return {
          type: "comboBox.itemSelected",
          payload: { ...payload(), item, index: payload().inspection.selectedIndex! },
        } as TAction;
      },
    });
  }

  if (options.includeItemCommands ?? false) {
    for (const [index, item] of controller.items.peek().entries()) {
      commands.push({
        id: `${idPrefix}.item.${index}`,
        label: `${label("item", "Select Combo Box Item")}: ${itemLabel(item, index)}`,
        group,
        keywords: ["combobox", "combo-box", "item", item, `${index}`],
        disabled: () => controller.items.peek()[index] === undefined || controller.selectedIndex.peek() === index,
        action: () => {
          const selected = controller.selectIndex(index);
          if (selected === undefined) return undefined;
          return {
            type: "comboBox.itemSelected",
            payload: { ...payload(), item: selected, index },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

export function bindComboBoxCommands<TAction extends Action = ComboBoxCommandAction, Items extends string[] = string[]>(
  registry: CommandRegistry<TAction>,
  controller: ComboBoxController<Items>,
  options: ComboBoxCommandOptions = {},
): () => void {
  return registry.registerAll(comboBoxCommands<TAction, Items>(controller, options));
}

function expandCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  expand: () => boolean,
  payload: () => ComboBoxCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["combobox", "combo-box", "expand", label],
    disabled: () => payload().inspection.empty,
    action: () => {
      const expanded = expand();
      return {
        type: "comboBox.expandedChanged",
        payload: { ...payload(), expanded },
      } as TAction;
    },
  };
}

function moveCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  move: () => string | undefined,
  payload: () => ComboBoxCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["combobox", "combo-box", label],
    disabled: () => payload().inspection.empty,
    action: () => {
      move();
      return { type: "comboBox.changed", payload: payload() } as TAction;
    },
  };
}
