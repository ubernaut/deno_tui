// Copyright 2023 Im-Beast. MIT license.
import type { CursorPosition, TextBoxController, TextBoxInspection } from "../components/textbox.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for text Box Command variants. */
export type TextBoxCommandKind =
  | "clear"
  | "home"
  | "end"
  | "left"
  | "right"
  | "up"
  | "down"
  | "value";

/** Action union emitted by text Box Command command helpers. */
export type TextBoxCommandAction =
  | Action<"textbox.changed", TextBoxCommandPayload>
  | Action<"textbox.cursorMoved", TextBoxCommandPayload>;

/** Payload carried by text Box Command actions. */
export interface TextBoxCommandPayload {
  id: string;
  inspection: TextBoxInspection;
}

/** Options for configuring text Box Command. */
export interface TextBoxCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeClearCommand?: boolean;
  includeCursorCommands?: boolean;
  includeValueCommands?: boolean;
  values?: readonly string[];
  labels?: Partial<Record<TextBoxCommandKind, string>>;
  valueLabel?: (value: string) => string;
}

/** Builds command definitions for text Box. */
export function textBoxCommands<TAction extends Action = TextBoxCommandAction>(
  controller: TextBoxController,
  options: TextBoxCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "textbox";
  const idPrefix = options.idPrefix ?? "textbox";
  const group = options.group ?? "input";
  const label = (kind: TextBoxCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = (): TextBoxCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeClearCommand ?? true) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear Text Box"),
      group,
      keywords: ["textbox", "clear", "reset"],
      disabled: () => controller.text.peek().length === 0,
      action: () => {
        controller.clear();
        return { type: "textbox.changed", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeCursorCommands ?? true) {
    commands.push(
      cursorCommand(
        `${idPrefix}.home`,
        label("home", "Text Box Line Home"),
        group,
        ["textbox", "cursor", "home"],
        () => controller.home(),
        payload,
      ),
      cursorCommand(
        `${idPrefix}.left`,
        label("left", "Text Box Cursor Left"),
        group,
        ["textbox", "cursor", "left"],
        () => controller.moveCursor({ x: -1 }),
        payload,
      ),
      cursorCommand(
        `${idPrefix}.right`,
        label("right", "Text Box Cursor Right"),
        group,
        [
          "textbox",
          "cursor",
          "right",
        ],
        () => controller.moveCursor({ x: 1 }),
        payload,
      ),
      cursorCommand(
        `${idPrefix}.up`,
        label("up", "Text Box Cursor Up"),
        group,
        ["textbox", "cursor", "up"],
        () => controller.moveCursor({ y: -1 }),
        payload,
      ),
      cursorCommand(
        `${idPrefix}.down`,
        label("down", "Text Box Cursor Down"),
        group,
        ["textbox", "cursor", "down"],
        () => controller.moveCursor({ y: 1 }),
        payload,
      ),
      cursorCommand(
        `${idPrefix}.end`,
        label("end", "Text Box Line End"),
        group,
        ["textbox", "cursor", "end"],
        () => controller.end(),
        payload,
      ),
    );
  }

  if (options.includeValueCommands ?? false) {
    const valueLabel = options.valueLabel ?? ((value: string) => value.split("\n")[0] ?? value);
    for (const value of options.values ?? []) {
      commands.push({
        id: `${idPrefix}.value.${encodeURIComponent(value)}`,
        label: `${label("value", "Set Text Box")}: ${valueLabel(value)}`,
        group,
        keywords: ["textbox", "value", value],
        disabled: () => controller.text.peek() === value,
        action: () => {
          controller.setText(value);
          return { type: "textbox.changed", payload: payload() } as TAction;
        },
      });
    }
  }

  return commands;
}

/** Binds text Box Commands behavior and returns a disposer when applicable. */
export function bindTextBoxCommands<TAction extends Action = TextBoxCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: TextBoxController,
  options: TextBoxCommandOptions = {},
): () => void {
  return registry.registerAll(textBoxCommands<TAction>(controller, options));
}

function cursorCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  keywords: string[],
  move: () => CursorPosition,
  payload: () => TextBoxCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords,
    disabled: () => payload().inspection.lineCount <= 0,
    action: () => {
      move();
      return { type: "textbox.cursorMoved", payload: payload() } as TAction;
    },
  };
}
