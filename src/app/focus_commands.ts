// Copyright 2023 Im-Beast. MIT license.
import type { Focusable, FocusManager, FocusManagerInspection } from "../focus.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type FocusCommandKind = "next" | "previous" | "clear" | "target";

export type FocusCommandAction =
  | Action<"focus.changed", FocusCommandPayload>
  | Action<"focus.cleared", FocusCommandPayload>;

export interface FocusCommandTarget {
  id: string;
  label: string;
  item: Focusable;
  keywords?: readonly string[];
}

export interface FocusCommandPayload {
  id: string;
  index: number;
  inspection: FocusManagerInspection;
}

export interface FocusCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includeClearCommand?: boolean;
  includeTargetCommands?: boolean;
  targets?: readonly FocusCommandTarget[];
  labels?: Partial<Record<FocusCommandKind, string>>;
}

export function focusCommands<TAction extends Action = FocusCommandAction>(
  manager: FocusManager,
  options: FocusCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "focus";
  const idPrefix = options.idPrefix ?? "focus";
  const group = options.group ?? "focus";
  const label = (kind: FocusCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = (): FocusCommandPayload => ({
    id,
    index: manager.index,
    inspection: manager.inspect(),
  });
  const empty = () => manager.items.length === 0;
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.previous`,
        label: label("previous", "Previous Focus Target"),
        group,
        keywords: ["focus", "previous"],
        binding: { key: "tab", shift: true },
        disabled: empty,
        action: () => {
          manager.previous();
          return { type: "focus.changed", payload: payload() } as TAction;
        },
      },
      {
        id: `${idPrefix}.next`,
        label: label("next", "Next Focus Target"),
        group,
        keywords: ["focus", "next"],
        binding: { key: "tab" },
        disabled: empty,
        action: () => {
          manager.next();
          return { type: "focus.changed", payload: payload() } as TAction;
        },
      },
    );
  }

  if (options.includeClearCommand ?? true) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear Focus"),
      group,
      keywords: ["focus", "clear"],
      disabled: () => !manager.current(),
      action: () => {
        manager.clear();
        return { type: "focus.cleared", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeTargetCommands ?? false) {
    for (const target of options.targets ?? []) {
      commands.push({
        id: `${idPrefix}.target.${target.id}`,
        label: `${label("target", "Focus")}: ${target.label}`,
        group,
        keywords: ["focus", target.id, target.label, ...(target.keywords ?? [])],
        disabled: () => manager.current() === target.item,
        action: () => {
          manager.focus(target.item);
          return { type: "focus.changed", payload: payload() } as TAction;
        },
      });
    }
  }

  return commands;
}

export function bindFocusCommands<TAction extends Action = FocusCommandAction>(
  registry: CommandRegistry<TAction>,
  manager: FocusManager,
  options: FocusCommandOptions = {},
): () => void {
  return registry.registerAll(focusCommands<TAction>(manager, options));
}
