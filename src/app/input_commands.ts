// Copyright 2023 Im-Beast. MIT license.
import type { InputController, InputInspection } from "../components/input.ts";
import type { Action } from "./actions.ts";
import { actionCommandGroup } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for input Command variants. */
export type InputCommandKind =
  | "submit"
  | "clear"
  | "home"
  | "end"
  | "left"
  | "right"
  | "value";

/** Action union emitted by input Command command helpers. */
export type InputCommandAction =
  | Action<"input.submitted", InputCommandPayload & { value: string }>
  | Action<"input.changed", InputCommandPayload>
  | Action<"input.cursorMoved", InputCommandPayload>;

/** Payload carried by input Command actions. */
export interface InputCommandPayload {
  id: string;
  inspection: InputInspection;
}

/** Options for configuring input Command. */
export interface InputCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeSubmitCommand?: boolean;
  includeClearCommand?: boolean;
  includeCursorCommands?: boolean;
  includeValueCommands?: boolean;
  values?: readonly string[];
  labels?: Partial<Record<InputCommandKind, string>>;
  valueLabel?: (value: string) => string;
}

/** Builds command definitions for input. */
export function inputCommands<TAction extends Action = InputCommandAction>(
  controller: InputController,
  options: InputCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "input";
  const idPrefix = options.idPrefix ?? "input";
  const group = options.group ?? "input";
  const label = (kind: InputCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = (): InputCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeSubmitCommand ?? true) {
    commands.push({
      id: `${idPrefix}.submit`,
      label: label("submit", "Submit Input"),
      group,
      keywords: ["input", "submit", "enter"],
      action: () => {
        const value = controller.submit();
        return { type: "input.submitted", payload: { ...payload(), value } } as TAction;
      },
    });
  }

  if (options.includeClearCommand ?? true) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear Input"),
      group,
      keywords: ["input", "clear", "reset"],
      disabled: () => controller.text.peek().length === 0,
      action: () => {
        controller.clear();
        return { type: "input.changed", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeCursorCommands ?? true) {
    commands.push(...actionCommandGroup<TAction, InputCommandPayload, InputCommandKind, number>({
      idPrefix,
      group,
      type: "input.cursorMoved",
      keywords: ["input", "cursor"],
      label,
      payload,
      disabled: () => payload().inspection.length === 0,
      entries: [
        ["home", "Input Cursor Home", () => controller.home(), ["input", "cursor", "home"]],
        ["left", "Input Cursor Left", () => controller.moveCursor(-1), ["input", "cursor", "left"]],
        ["right", "Input Cursor Right", () => controller.moveCursor(1), ["input", "cursor", "right"]],
        ["end", "Input Cursor End", () => controller.end(), ["input", "cursor", "end"]],
      ],
    }));
  }

  if (options.includeValueCommands ?? false) {
    const valueLabel = options.valueLabel ?? ((value: string) => value);
    for (const value of options.values ?? []) {
      commands.push({
        id: `${idPrefix}.value.${encodeURIComponent(value)}`,
        label: `${label("value", "Set Input")}: ${valueLabel(value)}`,
        group,
        keywords: ["input", "value", value],
        disabled: () => controller.text.peek() === value,
        action: () => {
          controller.setText(value);
          return { type: "input.changed", payload: payload() } as TAction;
        },
      });
    }
  }

  return commands;
}

/** Binds input Commands behavior and returns a disposer when applicable. */
export function bindInputCommands<TAction extends Action = InputCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: InputController,
  options: InputCommandOptions = {},
): () => void {
  return registry.registerAll(inputCommands<TAction>(controller, options));
}
