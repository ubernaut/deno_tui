// Copyright 2023 Im-Beast. MIT license.
import type { ProgressBarController, ProgressBarInspection } from "../components/progressbar.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for progress Bar Command variants. */
export type ProgressBarCommandKind = "decrement" | "increment" | "min" | "max" | "value";

/** Action union emitted by progress Bar Command command helpers. */
export type ProgressBarCommandAction = Action<"progressBar.changed", ProgressBarCommandPayload>;

/** Payload carried by progress Bar Command actions. */
export interface ProgressBarCommandPayload {
  id: string;
  value: number;
  inspection: ProgressBarInspection;
}

/** Options for configuring progress Bar Command. */
export interface ProgressBarCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  step?: number;
  includeMoveCommands?: boolean;
  includeEdgeCommands?: boolean;
  includeValueCommands?: boolean;
  values?: readonly number[];
  labels?: Partial<Record<ProgressBarCommandKind, string>>;
  valueLabel?: (value: number) => string;
}

/** Builds command definitions for progress Bar. */
export function progressBarCommands<TAction extends Action = ProgressBarCommandAction>(
  controller: ProgressBarController,
  options: ProgressBarCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "progress";
  const idPrefix = options.idPrefix ?? "progress";
  const group = options.group ?? "feedback";
  const step = options.step ?? 1;
  const label = (kind: ProgressBarCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const valueLabel = options.valueLabel ?? ((value: number) => `${value}`);
  const payload = (): ProgressBarCommandPayload => ({
    id,
    value: controller.value.peek(),
    inspection: controller.inspect(),
  });
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      progressCommand(
        `${idPrefix}.decrement`,
        label("decrement", "Decrease Progress"),
        group,
        ["progress", "decrease", "decrement"],
        () => controller.decrement(step),
        payload,
      ),
      progressCommand(
        `${idPrefix}.increment`,
        label("increment", "Increase Progress"),
        group,
        ["progress", "increase", "increment"],
        () => controller.increment(step),
        payload,
      ),
    );
  }

  if (options.includeEdgeCommands ?? true) {
    commands.push(
      progressCommand(
        `${idPrefix}.min`,
        label("min", "Minimum Progress"),
        group,
        ["progress", "minimum", "min"],
        () => controller.setMin(),
        payload,
      ),
      progressCommand(
        `${idPrefix}.max`,
        label("max", "Maximum Progress"),
        group,
        ["progress", "maximum", "max"],
        () => controller.setMax(),
        payload,
      ),
    );
  }

  if (options.includeValueCommands ?? false) {
    for (const value of options.values ?? []) {
      commands.push(progressCommand(
        `${idPrefix}.value.${value}`,
        `${label("value", "Set Progress")}: ${valueLabel(value)}`,
        group,
        ["progress", "value", `${value}`],
        () => controller.setValue(value),
        payload,
        () => controller.value.peek() === value,
      ));
    }
  }

  return commands;
}

/** Binds progress Bar Commands behavior and returns a disposer when applicable. */
export function bindProgressBarCommands<TAction extends Action = ProgressBarCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: ProgressBarController,
  options: ProgressBarCommandOptions = {},
): () => void {
  return registry.registerAll(progressBarCommands<TAction>(controller, options));
}

function progressCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  keywords: string[],
  setValue: () => number,
  payload: () => ProgressBarCommandPayload,
  disabled?: () => boolean,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords,
    disabled,
    action: () => {
      setValue();
      return { type: "progressBar.changed", payload: payload() } as TAction;
    },
  };
}
