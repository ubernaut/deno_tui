// Copyright 2023 Im-Beast. MIT license.
import type { ButtonController, ButtonInspection } from "../components/button.ts";
import type { CheckBoxController, CheckBoxInspection } from "../components/checkbox.ts";
import type { ComboBoxController, ComboBoxInspection } from "../components/combobox.ts";
import type { ProgressBarController, ProgressBarInspection } from "../components/progressbar.ts";
import type { RadioGroupController, RadioGroupInspection, RadioOption } from "../components/radio_group.ts";
import type { SliderController, SliderInspection } from "../components/slider.ts";
import type { StepperController, StepperInspection, StepperStep } from "../components/stepper.ts";
import type { TextBoxController, TextBoxInspection } from "../components/textbox.ts";
import type { Action } from "./actions.ts";
import { actionCommand, actionCommandGroup } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for button Command variants. */
export type ButtonCommandKind = "press" | "enable" | "disable";

/** Action union emitted by button Command command helpers. */
export type ButtonCommandAction =
  | Action<"button.pressed", ButtonCommandPayload>
  | Action<"button.changed", ButtonCommandPayload>;

/** Payload carried by button Command actions. */
export interface ButtonCommandPayload {
  id: string;
  inspection: ButtonInspection;
}

/** Options for configuring button Command. */
export interface ButtonCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includePressCommand?: boolean;
  includeStateCommands?: boolean;
  labels?: Partial<Record<ButtonCommandKind, string>>;
}

/** Builds command definitions for button. */
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
    commands.push(...actionCommandGroup<TAction, ButtonCommandPayload, ButtonCommandKind, boolean>({
      idPrefix,
      group,
      type: "button.changed",
      keywords: ["button"],
      label,
      payload,
      entries: [
        ["enable", "Enable Button", () => controller.enable(), ["button", "enable"], () => !controller.disabled.peek()],
        [
          "disable",
          "Disable Button",
          () => controller.disable(),
          ["button", "disable"],
          () => controller.disabled.peek(),
        ],
      ],
    }));
  }

  return commands;
}

/** Binds button Commands behavior and returns a disposer when applicable. */
export function bindButtonCommands<TAction extends Action = ButtonCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: ButtonController,
  options: ButtonCommandOptions = {},
): () => void {
  return registry.registerAll(buttonCommands<TAction>(controller, options));
}

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
    commands.push(actionCommand(
      `${idPrefix}.toggle`,
      label("toggle", "Toggle Checkbox"),
      group,
      ["checkbox", "toggle"],
      "checkbox.changed",
      () => controller.toggle(),
      payload,
    ));
  }

  if (options.includeSetCommands ?? true) {
    commands.push(...actionCommandGroup<TAction, CheckBoxCommandPayload, CheckBoxCommandKind, boolean>({
      idPrefix,
      group,
      type: "checkbox.changed",
      keywords: ["checkbox"],
      label,
      payload,
      entries: [
        [
          "check",
          "Check Checkbox",
          () => controller.check(),
          ["checkbox", "check", "enable"],
          () => controller.checked.peek(),
        ],
        [
          "uncheck",
          "Uncheck Checkbox",
          () => controller.uncheck(),
          ["checkbox", "uncheck", "disable"],
          () => !controller.checked.peek(),
        ],
      ],
    }));
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

/** Identifier union for combo Box Command variants. */
export type ComboBoxCommandKind =
  | "open"
  | "close"
  | "toggle"
  | "first"
  | "previous"
  | "next"
  | "last"
  | "select"
  | "item";

/** Action union emitted by combo Box Command command helpers. */
export type ComboBoxCommandAction =
  | Action<"comboBox.changed", ComboBoxCommandPayload>
  | Action<"comboBox.expandedChanged", ComboBoxCommandPayload & { expanded: boolean }>
  | Action<"comboBox.itemSelected", ComboBoxCommandPayload & { item: string; index: number }>;

/** Payload carried by combo Box Command actions. */
export interface ComboBoxCommandPayload {
  id: string;
  inspection: ComboBoxInspection;
}

/** Options for configuring combo Box Command. */
export interface ComboBoxCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeExpandCommands?: boolean;
  includeMoveCommands?: boolean;
  includeSelectCommand?: boolean;
  includeItemCommands?: boolean;
  labels?: Partial<Record<ComboBoxCommandKind, string>>;
  itemLabel?: (item: string, index: number) => string;
}

/** Builds command definitions for combo Box. */
export function comboBoxCommands<TAction extends Action = ComboBoxCommandAction, Items extends string[] = string[]>(
  controller: ComboBoxController<Items>,
  options: ComboBoxCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "combobox";
  const idPrefix = options.idPrefix ?? "combobox";
  const group = options.group ?? "input";
  const label = (kind: ComboBoxCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const itemLabel = options.itemLabel ?? ((item: string) => item);
  const payload = (): ComboBoxCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeExpandCommands ?? true) {
    commands.push(...actionCommandGroup<
      TAction,
      ComboBoxCommandPayload & { expanded: boolean },
      ComboBoxCommandKind,
      boolean
    >({
      idPrefix,
      group,
      type: "comboBox.expandedChanged",
      keywords: ["combobox", "combo-box", "expand"],
      label,
      payload: (expanded) => ({ ...payload(), expanded }),
      disabled: () => payload().inspection.empty,
      entries: [
        ["open", "Open Combo Box", () => controller.open()],
        ["close", "Close Combo Box", () => controller.close()],
        ["toggle", "Toggle Combo Box", () => controller.toggle()],
      ],
    }));
  }

  if (options.includeMoveCommands ?? true) {
    commands.push(...actionCommandGroup<
      TAction,
      ComboBoxCommandPayload,
      ComboBoxCommandKind,
      string | undefined
    >({
      idPrefix,
      group,
      type: "comboBox.changed",
      keywords: ["combobox", "combo-box"],
      label,
      payload,
      disabled: () => payload().inspection.empty,
      entries: [
        ["first", "First Combo Box Item", () => controller.first()],
        ["previous", "Previous Combo Box Item", () => controller.move(-1)],
        ["next", "Next Combo Box Item", () => controller.move(1)],
        ["last", "Last Combo Box Item", () => controller.last()],
      ],
    }));
  }

  if (options.includeSelectCommand ?? true) {
    commands.push({
      id: `${idPrefix}.select`,
      label: label("select", "Select Combo Box Item"),
      group,
      keywords: ["combobox", "combo-box", "select", "active"],
      disabled: () => controller.selected() === undefined,
      action: () => {
        const item = controller.selectActive();
        if (item === undefined) return undefined;
        return {
          type: "comboBox.itemSelected",
          payload: { ...payload(), item, index: payload().inspection.selectedIndex! },
        } as TAction;
      },
    });
  }

  if (options.includeItemCommands ?? false) {
    for (const [index, item] of controller.items.peek().entries()) {
      commands.push({
        id: `${idPrefix}.item.${index}`,
        label: `${label("item", "Select Combo Box Item")}: ${itemLabel(item, index)}`,
        group,
        keywords: ["combobox", "combo-box", "item", item, `${index}`],
        disabled: () => controller.items.peek()[index] === undefined || controller.selectedIndex.peek() === index,
        action: () => {
          const selected = controller.selectIndex(index);
          if (selected === undefined) return undefined;
          return {
            type: "comboBox.itemSelected",
            payload: { ...payload(), item: selected, index },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

/** Binds combo Box Commands behavior and returns a disposer when applicable. */
export function bindComboBoxCommands<TAction extends Action = ComboBoxCommandAction, Items extends string[] = string[]>(
  registry: CommandRegistry<TAction>,
  controller: ComboBoxController<Items>,
  options: ComboBoxCommandOptions = {},
): () => void {
  return registry.registerAll(comboBoxCommands<TAction, Items>(controller, options));
}

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
    commands.push(...actionCommandGroup<TAction, ProgressBarCommandPayload, ProgressBarCommandKind, number>({
      idPrefix,
      group,
      type: "progressBar.changed",
      keywords: ["progress"],
      label,
      payload,
      entries: [
        ["decrement", "Decrease Progress", () => controller.decrement(step), ["progress", "decrease", "decrement"]],
        ["increment", "Increase Progress", () => controller.increment(step), ["progress", "increase", "increment"]],
      ],
    }));
  }

  if (options.includeEdgeCommands ?? true) {
    commands.push(...actionCommandGroup<TAction, ProgressBarCommandPayload, ProgressBarCommandKind, number>({
      idPrefix,
      group,
      type: "progressBar.changed",
      keywords: ["progress"],
      label,
      payload,
      entries: [
        ["min", "Minimum Progress", () => controller.setMin(), ["progress", "minimum", "min"]],
        ["max", "Maximum Progress", () => controller.setMax(), ["progress", "maximum", "max"]],
      ],
    }));
  }

  if (options.includeValueCommands ?? false) {
    for (const value of options.values ?? []) {
      commands.push(actionCommand(
        `${idPrefix}.value.${value}`,
        `${label("value", "Set Progress")}: ${valueLabel(value)}`,
        group,
        ["progress", "value", `${value}`],
        "progressBar.changed",
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
    commands.push(...actionCommandGroup<
      TAction,
      RadioGroupCommandPayload,
      RadioGroupCommandKind,
      RadioOption | undefined
    >({
      idPrefix,
      group,
      type: "radioGroup.changed",
      keywords: ["radio", "radio-group"],
      label,
      payload,
      entries: [
        ["first", "First Radio Option", () => controller.first()],
        ["previous", "Previous Radio Option", () => controller.move(-1)],
        ["next", "Next Radio Option", () => controller.move(1)],
        ["last", "Last Radio Option", () => controller.last()],
      ],
    }));
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

/** Identifier union for slider Command variants. */
export type SliderCommandKind = "decrement" | "increment" | "min" | "max" | "value";

/** Action union emitted by slider Command command helpers. */
export type SliderCommandAction = Action<"slider.changed", SliderCommandPayload>;

/** Payload carried by slider Command actions. */
export interface SliderCommandPayload {
  id: string;
  value: number;
  inspection: SliderInspection;
}

/** Options for configuring slider Command. */
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

/** Builds command definitions for slider. */
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
    commands.push(...actionCommandGroup<TAction, SliderCommandPayload, SliderCommandKind, number>({
      idPrefix,
      group,
      type: "slider.changed",
      keywords: ["slider"],
      label,
      payload,
      entries: [
        ["decrement", "Decrease Slider", () => controller.decrement(stepMultiplier), [
          "slider",
          "decrease",
          "decrement",
        ]],
        ["increment", "Increase Slider", () => controller.increment(stepMultiplier), [
          "slider",
          "increase",
          "increment",
        ]],
      ],
    }));
  }

  if (options.includeEdgeCommands ?? true) {
    commands.push(...actionCommandGroup<TAction, SliderCommandPayload, SliderCommandKind, number>({
      idPrefix,
      group,
      type: "slider.changed",
      keywords: ["slider"],
      label,
      payload,
      entries: [
        ["min", "Minimum Slider Value", () => controller.setMin(), ["slider", "minimum", "min"]],
        ["max", "Maximum Slider Value", () => controller.setMax(), ["slider", "maximum", "max"]],
      ],
    }));
  }

  if (options.includeValueCommands ?? false) {
    for (const value of options.values ?? []) {
      commands.push(actionCommand(
        `${idPrefix}.value.${value}`,
        `${label("value", "Set Slider Value")}: ${valueLabel(value)}`,
        group,
        ["slider", "value", `${value}`],
        "slider.changed",
        () => controller.setValue(value),
        payload,
        () => controller.value.peek() === value,
      ));
    }
  }

  return commands;
}

/** Binds slider Commands behavior and returns a disposer when applicable. */
export function bindSliderCommands<TAction extends Action = SliderCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: SliderController,
  options: SliderCommandOptions = {},
): () => void {
  return registry.registerAll(sliderCommands<TAction>(controller, options));
}

/** Identifier union for stepper Command variants. */
export type StepperCommandKind = "first" | "previous" | "next" | "last" | "step";

/** Action union emitted by stepper Command command helpers. */
export type StepperCommandAction =
  | Action<"stepper.changed", StepperCommandPayload>
  | Action<"stepper.stepSelected", StepperCommandPayload & { step: StepperStep }>;

/** Payload carried by stepper Command actions. */
export interface StepperCommandPayload {
  id: string;
  inspection: StepperInspection;
}

/** Options for configuring stepper Command. */
export interface StepperCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includeStepCommands?: boolean;
  labels?: Partial<Record<StepperCommandKind, string>>;
  stepLabel?: (step: StepperStep, index: number) => string;
}

/** Builds command definitions for stepper. */
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
    commands.push(...actionCommandGroup<TAction, StepperCommandPayload, StepperCommandKind, StepperStep | undefined>({
      idPrefix,
      group,
      type: "stepper.changed",
      keywords: ["step", "stepper"],
      label,
      payload,
      entries: [
        ["first", "First Step", () => controller.first()],
        ["previous", "Previous Step", () => controller.move(-1)],
        ["next", "Next Step", () => controller.move(1)],
        ["last", "Last Step", () => controller.last()],
      ],
    }));
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

/** Binds stepper Commands behavior and returns a disposer when applicable. */
export function bindStepperCommands<TAction extends Action = StepperCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: StepperController,
  options: StepperCommandOptions = {},
): () => void {
  return registry.registerAll(stepperCommands<TAction>(controller, options));
}

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
    commands.push(...actionCommandGroup<TAction, TextBoxCommandPayload, TextBoxCommandKind, unknown>({
      idPrefix,
      group,
      type: "textbox.cursorMoved",
      keywords: ["textbox", "cursor"],
      label,
      payload,
      disabled: () => payload().inspection.lineCount <= 0,
      entries: [
        ["home", "Text Box Line Home", () => controller.home(), ["textbox", "cursor", "home"]],
        ["left", "Text Box Cursor Left", () => controller.moveCursor({ x: -1 }), ["textbox", "cursor", "left"]],
        ["right", "Text Box Cursor Right", () => controller.moveCursor({ x: 1 }), ["textbox", "cursor", "right"]],
        ["up", "Text Box Cursor Up", () => controller.moveCursor({ y: -1 }), ["textbox", "cursor", "up"]],
        ["down", "Text Box Cursor Down", () => controller.moveCursor({ y: 1 }), ["textbox", "cursor", "down"]],
        ["end", "Text Box Line End", () => controller.end(), ["textbox", "cursor", "end"]],
      ],
    }));
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
