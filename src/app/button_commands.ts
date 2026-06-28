// Copyright 2023 Im-Beast. MIT license.
import type { ButtonController, ButtonInspection } from "../components/button.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type ButtonCommandKind = "press" | "enable" | "disable";

export type ButtonCommandAction =
  | Action<"button.pressed", ButtonCommandPayload>
  | Action<"button.changed", ButtonCommandPayload>;

export interface ButtonCommandPayload {
  id: string;
  inspection: ButtonInspection;
}

export interface ButtonCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includePressCommand?: boolean;
  includeStateCommands?: boolean;
  labels?: Partial<Record<ButtonCommandKind, string>>;
}

export function buttonCommands<TAction extends Action = ButtonCommandAction>(
  controller: ButtonController,
  options: ButtonCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "button";
  const idPrefix = options.idPrefix ?? "button";
  const group = options.group ?? "input";
  const label = (kind: ButtonCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = (): ButtonCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includePressCommand ?? true) {
    commands.push({
      id: `${idPrefix}.press`,
      label: label("press", "Press Button"),
      group,
      keywords: ["button", "press", "submit", controller.label.peek()],
      disabled: () => controller.disabled.peek(),
      action: () => {
        if (!controller.press()) return undefined;
        return { type: "button.pressed", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeStateCommands ?? true) {
    commands.push(
      stateCommand(
        `${idPrefix}.enable`,
        label("enable", "Enable Button"),
        group,
        ["button", "enable"],
        () => controller.enable(),
        payload,
        () => controller.disabled.peek() === false,
      ),
      stateCommand(
        `${idPrefix}.disable`,
        label("disable", "Disable Button"),
        group,
        ["button", "disable"],
        () => controller.disable(),
        payload,
        () => controller.disabled.peek() === true,
      ),
    );
  }

  return commands;
}

export function bindButtonCommands<TAction extends Action = ButtonCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: ButtonController,
  options: ButtonCommandOptions = {},
): () => void {
  return registry.registerAll(buttonCommands<TAction>(controller, options));
}

function stateCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  keywords: string[],
  update: () => boolean,
  payload: () => ButtonCommandPayload,
  disabled: () => boolean,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords,
    disabled,
    action: () => {
      update();
      return { type: "button.changed", payload: payload() } as TAction;
    },
  };
}
