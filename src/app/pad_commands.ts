// Copyright 2023 Im-Beast. MIT license.
import type { PadController, PadInspection } from "../components/pad.ts";
import type { Action } from "./actions.ts";
import {
  actionCommandGroup,
  type ActionCommandGroupEntry,
  CommandGroupBuilder,
  type IdentifiedLabeledCommandGroupOptions,
} from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for pad command variants. */
export type PadCommandKind =
  | "up"
  | "down"
  | "left"
  | "right"
  | "pageUp"
  | "pageDown"
  | "home"
  | "end"
  | "revealCursor";

/** Action union emitted by pad command helpers. */
export type PadCommandAction =
  | Action<"pad.scrolled", PadCommandPayload>
  | Action<"pad.cursorRevealed", PadCommandPayload>;

/** Payload carried by pad command actions. */
export interface PadCommandPayload {
  id: string;
  inspection: PadInspection;
}

/** Options for configuring pad commands. */
export interface PadCommandOptions extends IdentifiedLabeledCommandGroupOptions<PadCommandKind> {
  step?: number;
  includeMoveCommands?: boolean;
  includePageCommands?: boolean;
  includeEdgeCommands?: boolean;
  includeCursorCommands?: boolean;
}

/** Builds command definitions for a PadController. */
export function padCommands<TAction extends Action = PadCommandAction>(
  controller: PadController,
  options: PadCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "pad";
  const idPrefix = options.idPrefix ?? "pad";
  const group = options.group ?? "viewport";
  const step = Math.max(1, Math.floor(options.step ?? 1));
  const label = (kind: PadCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = (): PadCommandPayload => ({ id, inspection: controller.inspect() });
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);
  const navigationEntries: ActionCommandGroupEntry<PadCommandKind, void>[] = [];

  if (options.includeMoveCommands ?? true) {
    navigationEntries.push(
      ["up", "Pad Up", () => controller.scrollBy(0, -step), ["pad", "up"]],
      ["down", "Pad Down", () => controller.scrollBy(0, step), ["pad", "down"]],
      ["left", "Pad Left", () => controller.scrollBy(-step, 0), ["pad", "left"]],
      ["right", "Pad Right", () => controller.scrollBy(step, 0), ["pad", "right"]],
    );
  }

  if (options.includePageCommands ?? true) {
    navigationEntries.push(
      [
        "pageUp",
        "Pad Page Up",
        () => controller.scrollBy(0, -Math.max(1, controller.scroll.viewportHeight.peek() - 1)),
        ["pad", "page", "up"],
      ],
      [
        "pageDown",
        "Pad Page Down",
        () => controller.scrollBy(0, Math.max(1, controller.scroll.viewportHeight.peek() - 1)),
        ["pad", "page", "down"],
      ],
    );
  }

  if (options.includeEdgeCommands ?? true) {
    navigationEntries.push(
      ["home", "Pad Home", () => controller.scrollTo(0, 0), ["pad", "home"]],
      [
        "end",
        "Pad End",
        () => controller.scrollTo(controller.scroll.maxOffset().columns, controller.scroll.maxOffset().rows),
        ["pad", "end"],
      ],
    );
  }

  if (navigationEntries.length > 0) {
    builder.commands.push(...actionCommandGroup<TAction, PadCommandPayload, PadCommandKind, void>({
      idPrefix,
      group,
      type: "pad.scrolled",
      keywords: ["pad"],
      label,
      payload,
      entries: navigationEntries,
    }));
  }

  if (options.includeCursorCommands ?? true) {
    builder.add(
      "cursor.reveal",
      label("revealCursor", "Reveal Pad Cursor"),
      () => {
        const cursor = controller.cursor.peek();
        if (cursor) controller.reveal(cursor.row, cursor.column);
        return { type: "pad.cursorRevealed", payload: payload() } as TAction;
      },
      ["pad", "cursor", "reveal"],
      () => controller.cursor.peek() === undefined,
    );
  }

  return builder.commands;
}

/** Binds pad commands behavior and returns a disposer when applicable. */
export function bindPadCommands<TAction extends Action = PadCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: PadController,
  options: PadCommandOptions = {},
): () => void {
  return registry.registerAll(padCommands<TAction>(controller, options));
}
