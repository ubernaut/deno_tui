// Copyright 2023 Im-Beast. MIT license.
import type { Focusable, FocusManager, FocusManagerInspection } from "../focus.ts";
import type { Action } from "./actions.ts";
import { CommandGroupBuilder } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for focus Command variants. */
export type FocusCommandKind = "next" | "previous" | "clear" | "target";

/** Action union emitted by focus Command command helpers. */
export type FocusCommandAction =
  | Action<"focus.changed", FocusCommandPayload>
  | Action<"focus.cleared", FocusCommandPayload>;

/** Public interface describing a focus Command Target. */
export interface FocusCommandTarget {
  id: string;
  label: string;
  item: Focusable;
  keywords?: readonly string[];
}

/** Payload carried by focus Command actions. */
export interface FocusCommandPayload {
  id: string;
  index: number;
  inspection: FocusManagerInspection;
}

/** Options for configuring focus Command. */
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

/** Builds command definitions for focus. */
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
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includeMoveCommands ?? true) {
    builder.add(
      "previous",
      label("previous", "Previous Focus Target"),
      () => {
        manager.previous();
        return { type: "focus.changed", payload: payload() } as TAction;
      },
      ["focus", "previous"],
      empty,
      { key: "tab", shift: true },
    );
    builder.add(
      "next",
      label("next", "Next Focus Target"),
      () => {
        manager.next();
        return { type: "focus.changed", payload: payload() } as TAction;
      },
      ["focus", "next"],
      empty,
      { key: "tab" },
    );
  }

  if (options.includeClearCommand ?? true) {
    builder.add(
      "clear",
      label("clear", "Clear Focus"),
      () => {
        manager.clear();
        return { type: "focus.cleared", payload: payload() } as TAction;
      },
      ["focus", "clear"],
      () => !manager.current(),
    );
  }

  if (options.includeTargetCommands ?? false) {
    for (const target of options.targets ?? []) {
      builder.add(
        `target.${target.id}`,
        `${label("target", "Focus")}: ${target.label}`,
        () => {
          manager.focus(target.item);
          return { type: "focus.changed", payload: payload() } as TAction;
        },
        ["focus", target.id, target.label, ...(target.keywords ?? [])],
        () => manager.current() === target.item,
      );
    }
  }

  return builder.commands;
}

/** Binds focus Commands behavior and returns a disposer when applicable. */
export function bindFocusCommands<TAction extends Action = FocusCommandAction>(
  registry: CommandRegistry<TAction>,
  manager: FocusManager,
  options: FocusCommandOptions = {},
): () => void {
  return registry.registerAll(focusCommands<TAction>(manager, options));
}
