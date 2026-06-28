// Copyright 2023 Im-Beast. MIT license.
import type { SliderController, SliderInspection } from "../components/slider.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type SliderCommandKind = "decrement" | "increment" | "min" | "max" | "value";

export type SliderCommandAction = Action<"slider.changed", SliderCommandPayload>;

export interface SliderCommandPayload {
  id: string;
  value: number;
  inspection: SliderInspection;
}

export interface SliderCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  stepMultiplier?: number;
  includeMoveCommands?: boolean;
  includeEdgeCommands?: boolean;
  includeValueCommands?: boolean;
  values?: readonly number[];
  labels?: Partial<Record<SliderCommandKind, string>>;
  valueLabel?: (value: number) => string;
}

export function sliderCommands<TAction extends Action = SliderCommandAction>(
  controller: SliderController,
  options: SliderCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "slider";
  const idPrefix = options.idPrefix ?? "slider";
  const group = options.group ?? "input";
  const stepMultiplier = options.stepMultiplier ?? 1;
  const label = (kind: SliderCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const valueLabel = options.valueLabel ?? ((value: number) => `${value}`);
  const payload = (): SliderCommandPayload => ({
    id,
    value: controller.value.peek(),
    inspection: controller.inspect(),
  });
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      sliderCommand(
        `${idPrefix}.decrement`,
        label("decrement", "Decrease Slider"),
        group,
        ["slider", "decrease", "decrement"],
        () => controller.decrement(stepMultiplier),
        payload,
      ),
      sliderCommand(
        `${idPrefix}.increment`,
        label("increment", "Increase Slider"),
        group,
        ["slider", "increase", "increment"],
        () => controller.increment(stepMultiplier),
        payload,
      ),
    );
  }

  if (options.includeEdgeCommands ?? true) {
    commands.push(
      sliderCommand(
        `${idPrefix}.min`,
        label("min", "Minimum Slider Value"),
        group,
        ["slider", "minimum", "min"],
        () => controller.setMin(),
        payload,
      ),
      sliderCommand(
        `${idPrefix}.max`,
        label("max", "Maximum Slider Value"),
        group,
        ["slider", "maximum", "max"],
        () => controller.setMax(),
        payload,
      ),
    );
  }

  if (options.includeValueCommands ?? false) {
    for (const value of options.values ?? []) {
      commands.push(sliderCommand(
        `${idPrefix}.value.${value}`,
        `${label("value", "Set Slider Value")}: ${valueLabel(value)}`,
        group,
        ["slider", "value", `${value}`],
        () => controller.setValue(value),
        payload,
        () => controller.value.peek() === value,
      ));
    }
  }

  return commands;
}

export function bindSliderCommands<TAction extends Action = SliderCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: SliderController,
  options: SliderCommandOptions = {},
): () => void {
  return registry.registerAll(sliderCommands<TAction>(controller, options));
}

function sliderCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  keywords: string[],
  setValue: () => number,
  payload: () => SliderCommandPayload,
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
      return { type: "slider.changed", payload: payload() } as TAction;
    },
  };
}
