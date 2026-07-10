// Copyright 2023 Im-Beast. MIT license.
import type { TabItem, TabsController, TabsInspection } from "../components/tabs.ts";
import type { Action } from "./actions.ts";
import { actionCommandGroup, CommandGroupBuilder } from "./command_helpers.ts";
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
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includeMoveCommands ?? true) {
    builder.commands.push(...actionCommandGroup<TAction, TabsCommandPayload, TabsCommandKind, TabItem | undefined>({
      idPrefix,
      group,
      type: "tabs.changed",
      keywords: ["tab", "tabs"],
      label,
      payload,
      entries: [
        ["first", "First Tab", () => controller.first()],
        ["previous", "Previous Tab", () => controller.move(-1)],
        ["next", "Next Tab", () => controller.move(1)],
        ["last", "Last Tab", () => controller.last()],
      ],
    }));
  }

  if (options.includeTabCommands ?? false) {
    for (const [index, tab] of controller.tabs.peek().entries()) {
      builder.addOptionalAction(
        `tab.${tab.id}`,
        `${label("tab", "Go to Tab")}: ${tabLabel(tab, index)}`,
        "tabs.tabSelected",
        () => controller.setActive(index) ?? controller.tabs.peek()[index] ?? tab,
        (selected) => ({ ...payload(), tab: selected }),
        ["tab", "tabs", tab.id, tab.label],
        () => {
          const current = controller.tabs.peek()[index];
          return current === undefined || current.disabled === true || controller.activeIndex.peek() === index;
        },
      );
    }
  }

  return builder.commands;
}

/** Binds tabs Commands behavior and returns a disposer when applicable. */
export function bindTabsCommands<TAction extends Action = TabsCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: TabsController,
  options: TabsCommandOptions = {},
): () => void {
  return registry.registerAll(tabsCommands<TAction>(controller, options));
}
