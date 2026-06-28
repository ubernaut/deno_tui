// Copyright 2023 Im-Beast. MIT license.
import type { StepperController, StepperInspection, StepperStep } from "../components/stepper.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type StepperCommandKind = "first" | "previous" | "next" | "last" | "step";

export type StepperCommandAction =
  | Action<"stepper.changed", StepperCommandPayload>
  | Action<"stepper.stepSelected", StepperCommandPayload & { step: StepperStep }>;

export interface StepperCommandPayload {
  id: string;
  inspection: StepperInspection;
}

export interface StepperCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includeStepCommands?: boolean;
  labels?: Partial<Record<StepperCommandKind, string>>;
  stepLabel?: (step: StepperStep, index: number) => string;
}

export function stepperCommands<TAction extends Action = StepperCommandAction>(
  controller: StepperController,
  options: StepperCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "stepper";
  const idPrefix = options.idPrefix ?? "stepper";
  const group = options.group ?? "navigation";
  const label = (kind: StepperCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const stepLabel = options.stepLabel ?? ((step: StepperStep) => step.label);
  const payload = (): StepperCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      moveCommand(`${idPrefix}.first`, label("first", "First Step"), group, () => controller.first(), payload),
      moveCommand(
        `${idPrefix}.previous`,
        label("previous", "Previous Step"),
        group,
        () => controller.move(-1),
        payload,
      ),
      moveCommand(`${idPrefix}.next`, label("next", "Next Step"), group, () => controller.move(1), payload),
      moveCommand(`${idPrefix}.last`, label("last", "Last Step"), group, () => controller.last(), payload),
    );
  }

  if (options.includeStepCommands ?? false) {
    for (const [index, step] of controller.steps.peek().entries()) {
      commands.push({
        id: `${idPrefix}.step.${step.id}`,
        label: `${label("step", "Go to Step")}: ${stepLabel(step, index)}`,
        group,
        keywords: ["step", "stepper", step.id, step.label],
        disabled: () => {
          const current = controller.steps.peek()[index];
          return current === undefined || current.disabled === true || controller.activeIndex.peek() === index;
        },
        action: () => {
          const selected = controller.setActive(index);
          return {
            type: "stepper.stepSelected",
            payload: { ...payload(), step: selected ?? controller.steps.peek()[index] ?? step },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

export function bindStepperCommands<TAction extends Action = StepperCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: StepperController,
  options: StepperCommandOptions = {},
): () => void {
  return registry.registerAll(stepperCommands<TAction>(controller, options));
}

function moveCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  move: () => StepperStep | undefined,
  payload: () => StepperCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["step", "stepper", label],
    action: () => {
      move();
      return { type: "stepper.changed", payload: payload() } as TAction;
    },
  };
}
