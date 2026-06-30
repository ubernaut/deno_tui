// Copyright 2023 Im-Beast. MIT license.
import type { PadController, PadInspection } from "../components/pad.ts";
import type { Action } from "./actions.ts";
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
export interface PadCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  step?: number;
  includeMoveCommands?: boolean;
  includePageCommands?: boolean;
  includeEdgeCommands?: boolean;
  includeCursorCommands?: boolean;
  labels?: Partial<Record<PadCommandKind, string>>;
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
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      padScrollCommand(
        `${idPrefix}.up`,
        label("up", "Pad Up"),
        group,
        ["pad", "up"],
        () => controller.scrollBy(0, -step),
        payload,
      ),
      padScrollCommand(
        `${idPrefix}.down`,
        label("down", "Pad Down"),
        group,
        ["pad", "down"],
        () => controller.scrollBy(0, step),
        payload,
      ),
      padScrollCommand(
        `${idPrefix}.left`,
        label("left", "Pad Left"),
        group,
        ["pad", "left"],
        () => controller.scrollBy(-step, 0),
        payload,
      ),
      padScrollCommand(
        `${idPrefix}.right`,
        label("right", "Pad Right"),
        group,
        ["pad", "right"],
        () => controller.scrollBy(step, 0),
        payload,
      ),
    );
  }

  if (options.includePageCommands ?? true) {
    commands.push(
      padScrollCommand(
        `${idPrefix}.pageUp`,
        label("pageUp", "Pad Page Up"),
        group,
        ["pad", "page", "up"],
        () => controller.scrollBy(0, -Math.max(1, controller.scroll.viewportHeight.peek() - 1)),
        payload,
      ),
      padScrollCommand(
        `${idPrefix}.pageDown`,
        label("pageDown", "Pad Page Down"),
        group,
        ["pad", "page", "down"],
        () => controller.scrollBy(0, Math.max(1, controller.scroll.viewportHeight.peek() - 1)),
        payload,
      ),
    );
  }

  if (options.includeEdgeCommands ?? true) {
    commands.push(
      padScrollCommand(
        `${idPrefix}.home`,
        label("home", "Pad Home"),
        group,
        ["pad", "home"],
        () => controller.scrollTo(0, 0),
        payload,
      ),
      padScrollCommand(
        `${idPrefix}.end`,
        label("end", "Pad End"),
        group,
        ["pad", "end"],
        () => controller.scrollTo(controller.scroll.maxOffset().columns, controller.scroll.maxOffset().rows),
        payload,
      ),
    );
  }

  if (options.includeCursorCommands ?? true) {
    commands.push({
      id: `${idPrefix}.cursor.reveal`,
      label: label("revealCursor", "Reveal Pad Cursor"),
      group,
      keywords: ["pad", "cursor", "reveal"],
      disabled: () => controller.cursor.peek() === undefined,
      action: () => {
        const cursor = controller.cursor.peek();
        if (cursor) controller.reveal(cursor.row, cursor.column);
        return { type: "pad.cursorRevealed", payload: payload() } as TAction;
      },
    });
  }

  return commands;
}

/** Binds pad commands behavior and returns a disposer when applicable. */
export function bindPadCommands<TAction extends Action = PadCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: PadController,
  options: PadCommandOptions = {},
): () => void {
  return registry.registerAll(padCommands<TAction>(controller, options));
}

function padScrollCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  keywords: string[],
  scroll: () => void,
  payload: () => PadCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords,
    action: () => {
      scroll();
      return { type: "pad.scrolled", payload: payload() } as TAction;
    },
  };
}
