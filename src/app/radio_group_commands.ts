// Copyright 2023 Im-Beast. MIT license.
import type { RadioGroupController, RadioGroupInspection, RadioOption } from "../components/radio_group.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for radio Group Command variants. */
export type RadioGroupCommandKind = "first" | "previous" | "next" | "last" | "select" | "option";

/** Action union emitted by radio Group Command command helpers. */
export type RadioGroupCommandAction =
  | Action<"radioGroup.changed", RadioGroupCommandPayload>
  | Action<"radioGroup.optionSelected", RadioGroupCommandPayload & { option: RadioOption }>;

/** Payload carried by radio Group Command actions. */
export interface RadioGroupCommandPayload {
  id: string;
  inspection: RadioGroupInspection;
}

/** Options for configuring radio Group Command. */
export interface RadioGroupCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includeSelectCommand?: boolean;
  includeOptionCommands?: boolean;
  labels?: Partial<Record<RadioGroupCommandKind, string>>;
  optionLabel?: (option: RadioOption, index: number) => string;
}

/** Builds command definitions for radio Group. */
export function radioGroupCommands<TAction extends Action = RadioGroupCommandAction>(
  controller: RadioGroupController,
  options: RadioGroupCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "radio";
  const idPrefix = options.idPrefix ?? "radio";
  const group = options.group ?? "input";
  const label = (kind: RadioGroupCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const optionLabel = options.optionLabel ?? ((option: RadioOption) => option.label);
  const payload = (): RadioGroupCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      moveCommand(`${idPrefix}.first`, label("first", "First Radio Option"), group, () => controller.first(), payload),
      moveCommand(
        `${idPrefix}.previous`,
        label("previous", "Previous Radio Option"),
        group,
        () => controller.move(-1),
        payload,
      ),
      moveCommand(`${idPrefix}.next`, label("next", "Next Radio Option"), group, () => controller.move(1), payload),
      moveCommand(`${idPrefix}.last`, label("last", "Last Radio Option"), group, () => controller.last(), payload),
    );
  }

  if (options.includeSelectCommand ?? true) {
    commands.push({
      id: `${idPrefix}.select`,
      label: label("select", "Select Radio Option"),
      group,
      keywords: ["radio", "select", "active"],
      disabled: () => controller.active() === undefined,
      action: () => {
        const option = controller.selectActive();
        if (!option) return undefined;
        return {
          type: "radioGroup.optionSelected",
          payload: { ...payload(), option },
        } as TAction;
      },
    });
  }

  if (options.includeOptionCommands ?? false) {
    for (const [index, option] of controller.options.peek().entries()) {
      commands.push({
        id: `${idPrefix}.option.${option.value}`,
        label: `${label("option", "Select Radio Option")}: ${optionLabel(option, index)}`,
        group,
        keywords: ["radio", "option", option.value, option.label],
        disabled: () => {
          const current = controller.options.peek()[index];
          return current === undefined || current.disabled === true ||
            controller.selectedValue.peek() === current.value;
        },
        action: () => {
          const selected = controller.selectValue(option.value);
          if (!selected) return undefined;
          return {
            type: "radioGroup.optionSelected",
            payload: { ...payload(), option: selected },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

/** Binds radio Group Commands behavior and returns a disposer when applicable. */
export function bindRadioGroupCommands<TAction extends Action = RadioGroupCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: RadioGroupController,
  options: RadioGroupCommandOptions = {},
): () => void {
  return registry.registerAll(radioGroupCommands<TAction>(controller, options));
}

function moveCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  move: () => RadioOption | undefined,
  payload: () => RadioGroupCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["radio", "radio-group", label],
    action: () => {
      move();
      return { type: "radioGroup.changed", payload: payload() } as TAction;
    },
  };
}
