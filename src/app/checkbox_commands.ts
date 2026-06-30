// Copyright 2023 Im-Beast. MIT license.
import type { CheckBoxController, CheckBoxInspection } from "../components/checkbox.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for check Box Command variants. */
export type CheckBoxCommandKind = "toggle" | "check" | "uncheck";

/** Action union emitted by check Box Command command helpers. */
export type CheckBoxCommandAction = Action<"checkbox.changed", CheckBoxCommandPayload>;

/** Payload carried by check Box Command actions. */
export interface CheckBoxCommandPayload {
  id: string;
  checked: boolean;
  inspection: CheckBoxInspection;
}

/** Options for configuring check Box Command. */
export interface CheckBoxCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeToggleCommand?: boolean;
  includeSetCommands?: boolean;
  labels?: Partial<Record<CheckBoxCommandKind, string>>;
}

/** Builds command definitions for check Box. */
export function checkBoxCommands<TAction extends Action = CheckBoxCommandAction>(
  controller: CheckBoxController,
  options: CheckBoxCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "checkbox";
  const idPrefix = options.idPrefix ?? "checkbox";
  const group = options.group ?? "input";
  const label = (kind: CheckBoxCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = (): CheckBoxCommandPayload => ({
    id,
    checked: controller.checked.peek(),
    inspection: controller.inspect(),
  });
  const commands: Command<TAction>[] = [];

  if (options.includeToggleCommand ?? true) {
    commands.push(checkBoxCommand(
      `${idPrefix}.toggle`,
      label("toggle", "Toggle Checkbox"),
      group,
      ["checkbox", "toggle"],
      () => controller.toggle(),
      payload,
    ));
  }

  if (options.includeSetCommands ?? true) {
    commands.push(
      checkBoxCommand(
        `${idPrefix}.check`,
        label("check", "Check Checkbox"),
        group,
        ["checkbox", "check", "enable"],
        () => controller.check(),
        payload,
        () => controller.checked.peek() === true,
      ),
      checkBoxCommand(
        `${idPrefix}.uncheck`,
        label("uncheck", "Uncheck Checkbox"),
        group,
        ["checkbox", "uncheck", "disable"],
        () => controller.uncheck(),
        payload,
        () => controller.checked.peek() === false,
      ),
    );
  }

  return commands;
}

/** Binds check Box Commands behavior and returns a disposer when applicable. */
export function bindCheckBoxCommands<TAction extends Action = CheckBoxCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: CheckBoxController,
  options: CheckBoxCommandOptions = {},
): () => void {
  return registry.registerAll(checkBoxCommands<TAction>(controller, options));
}

function checkBoxCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  keywords: string[],
  setChecked: () => boolean,
  payload: () => CheckBoxCommandPayload,
  disabled?: () => boolean,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords,
    disabled,
    action: () => {
      setChecked();
      return { type: "checkbox.changed", payload: payload() } as TAction;
    },
  };
}
