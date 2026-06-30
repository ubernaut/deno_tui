// Copyright 2023 Im-Beast. MIT license.
import type { TabItem, TabsController, TabsInspection } from "../components/tabs.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for tabs Command variants. */
export type TabsCommandKind = "first" | "previous" | "next" | "last" | "tab";

/** Action union emitted by tabs Command command helpers. */
export type TabsCommandAction =
  | Action<"tabs.changed", TabsCommandPayload>
  | Action<"tabs.tabSelected", TabsCommandPayload & { tab: TabItem }>;

/** Payload carried by tabs Command actions. */
export interface TabsCommandPayload {
  id: string;
  inspection: TabsInspection;
}

/** Options for configuring tabs Command. */
export interface TabsCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includeTabCommands?: boolean;
  labels?: Partial<Record<TabsCommandKind, string>>;
  tabLabel?: (tab: TabItem, index: number) => string;
}

/** Builds command definitions for tabs. */
export function tabsCommands<TAction extends Action = TabsCommandAction>(
  controller: TabsController,
  options: TabsCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "tabs";
  const idPrefix = options.idPrefix ?? "tabs";
  const group = options.group ?? "navigation";
  const label = (kind: TabsCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const tabLabel = options.tabLabel ?? ((tab: TabItem) => tab.label);
  const payload = (): TabsCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      moveCommand(`${idPrefix}.first`, label("first", "First Tab"), group, () => controller.first(), payload),
      moveCommand(`${idPrefix}.previous`, label("previous", "Previous Tab"), group, () => controller.move(-1), payload),
      moveCommand(`${idPrefix}.next`, label("next", "Next Tab"), group, () => controller.move(1), payload),
      moveCommand(`${idPrefix}.last`, label("last", "Last Tab"), group, () => controller.last(), payload),
    );
  }

  if (options.includeTabCommands ?? false) {
    for (const [index, tab] of controller.tabs.peek().entries()) {
      commands.push({
        id: `${idPrefix}.tab.${tab.id}`,
        label: `${label("tab", "Go to Tab")}: ${tabLabel(tab, index)}`,
        group,
        keywords: ["tab", "tabs", tab.id, tab.label],
        disabled: () => {
          const current = controller.tabs.peek()[index];
          return current === undefined || current.disabled === true || controller.activeIndex.peek() === index;
        },
        action: () => {
          const selected = controller.setActive(index) ?? controller.tabs.peek()[index] ?? tab;
          return {
            type: "tabs.tabSelected",
            payload: { ...payload(), tab: selected },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

/** Binds tabs Commands behavior and returns a disposer when applicable. */
export function bindTabsCommands<TAction extends Action = TabsCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: TabsController,
  options: TabsCommandOptions = {},
): () => void {
  return registry.registerAll(tabsCommands<TAction>(controller, options));
}

function moveCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  move: () => TabItem | undefined,
  payload: () => TabsCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["tab", "tabs", label],
    action: () => {
      move();
      return { type: "tabs.changed", payload: payload() } as TAction;
    },
  };
}
