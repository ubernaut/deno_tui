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
import {
  actionCommand,
  actionCommandGroup,
  type ActionCommandGroupEntry,
  CommandGroupBuilder,
  selectionNavigationCommandEntries,
} from "./command_helpers.ts";
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
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includePressCommand ?? true) {
    builder.addOptionalAction(
      "press",
      label("press", "Press Button"),
      "button.pressed",
      () => controller.press() || undefined,
      payload,
      ["button", "press", "submit", controller.label.peek()],
      () => controller.disabled.peek(),
    );
  }

  if (options.includeStateCommands ?? true) {
    builder.commands.push(...actionCommandGroup<TAction, ButtonCommandPayload, ButtonCommandKind, boolean>({
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

  return builder.commands;
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
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includeExpandCommands ?? true) {
    builder.commands.push(...actionCommandGroup<
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
    builder.commands.push(...actionCommandGroup<
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
      entries: selectionNavigationCommandEntries(controller, "Combo Box Item"),
    }));
  }

  if (options.includeSelectCommand ?? true) {
    builder.addOptionalAction(
      "select",
      label("select", "Select Combo Box Item"),
      "comboBox.itemSelected",
      () => controller.selectActive(),
      (item) => ({ ...payload(), item, index: payload().inspection.selectedIndex! }),
      ["combobox", "combo-box", "select", "active"],
      () => controller.selected() === undefined,
    );
  }

  if (options.includeItemCommands ?? false) {
    for (const [index, item] of controller.items.peek().entries()) {
      builder.addOptionalAction(
        `item.${index}`,
        `${label("item", "Select Combo Box Item")}: ${itemLabel(item, index)}`,
        "comboBox.itemSelected",
        () => controller.selectIndex(index),
        (selected) => ({ ...payload(), item: selected, index }),
        ["combobox", "combo-box", "item", item, `${index}`],
        () => controller.items.peek()[index] === undefined || controller.selectedIndex.peek() === index,
      );
    }
  }

  return builder.commands;
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

type NumericWidgetCommandOptions = Omit<ProgressBarCommandOptions, "step">;

interface NumericWidgetCommandProfile<TAction extends Action> {
  id: string;
  group: string;
  type: TAction["type"] & string;
  label: string;
  valueLabel?: string;
}

function numericWidgetCommands<TAction extends Action>(
  controller: ProgressBarController | SliderController,
  options: NumericWidgetCommandOptions,
  step: number,
  profile: NumericWidgetCommandProfile<TAction>,
): Command<TAction>[] {
  const id = options.id ?? profile.id;
  const idPrefix = options.idPrefix ?? profile.id;
  const group = options.group ?? profile.group;
  const valueName = profile.valueLabel ?? profile.label;
  const label = (kind: ProgressBarCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = () => ({ id, value: controller.value.peek(), inspection: controller.inspect() });
  const entries: ActionCommandGroupEntry<ProgressBarCommandKind, number>[] = [];

  if (options.includeMoveCommands ?? true) {
    entries.push(
      ["decrement", `Decrease ${profile.label}`, () => controller.decrement(step), [
        profile.id,
        "decrease",
        "decrement",
      ]],
      ["increment", `Increase ${profile.label}`, () => controller.increment(step), [
        profile.id,
        "increase",
        "increment",
      ]],
    );
  }
  if (options.includeEdgeCommands ?? true) {
    entries.push(
      ["min", `Minimum ${valueName}`, () => controller.setMin(), [profile.id, "minimum", "min"]],
      ["max", `Maximum ${valueName}`, () => controller.setMax(), [profile.id, "maximum", "max"]],
    );
  }

  const commands = actionCommandGroup<TAction, ReturnType<typeof payload>, ProgressBarCommandKind, number>({
    idPrefix,
    group,
    type: profile.type,
    keywords: [profile.id],
    label,
    payload,
    entries,
  });

  if (options.includeValueCommands ?? false) {
    const formatValue = options.valueLabel ?? ((value: number) => `${value}`);
    for (const value of options.values ?? []) {
      commands.push(actionCommand(
        `${idPrefix}.value.${value}`,
        `${label("value", `Set ${valueName}`)}: ${formatValue(value)}`,
        group,
        [profile.id, "value", `${value}`],
        profile.type,
        () => controller.setValue(value),
        payload,
        () => controller.value.peek() === value,
      ));
    }
  }

  return commands;
}

/** Builds command definitions for progress Bar. */
export function progressBarCommands<TAction extends Action = ProgressBarCommandAction>(
  controller: ProgressBarController,
  options: ProgressBarCommandOptions = {},
): Command<TAction>[] {
  return numericWidgetCommands<TAction>(controller, options, options.step ?? 1, {
    id: "progress",
    group: "feedback",
    type: "progressBar.changed",
    label: "Progress",
  });
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
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includeMoveCommands ?? true) {
    builder.commands.push(...actionCommandGroup<
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
      entries: selectionNavigationCommandEntries(controller, "Radio Option"),
    }));
  }

  if (options.includeSelectCommand ?? true) {
    builder.addOptionalAction(
      "select",
      label("select", "Select Radio Option"),
      "radioGroup.optionSelected",
      () => controller.selectActive(),
      (option) => ({ ...payload(), option }),
      ["radio", "select", "active"],
      () => controller.active() === undefined,
    );
  }

  if (options.includeOptionCommands ?? false) {
    for (const [index, option] of controller.options.peek().entries()) {
      builder.addOptionalAction(
        `option.${option.value}`,
        `${label("option", "Select Radio Option")}: ${optionLabel(option, index)}`,
        "radioGroup.optionSelected",
        () => controller.selectValue(option.value),
        (selected) => ({ ...payload(), option: selected }),
        ["radio", "option", option.value, option.label],
        () => {
          const current = controller.options.peek()[index];
          return current === undefined || current.disabled === true ||
            controller.selectedValue.peek() === current.value;
        },
      );
    }
  }

  return builder.commands;
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
  return numericWidgetCommands<TAction>(controller, options, options.stepMultiplier ?? 1, {
    id: "slider",
    group: "input",
    type: "slider.changed",
    label: "Slider",
    valueLabel: "Slider Value",
  });
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
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);

  if (options.includeMoveCommands ?? true) {
    builder.commands.push(
      ...actionCommandGroup<TAction, StepperCommandPayload, StepperCommandKind, StepperStep | undefined>({
        idPrefix,
        group,
        type: "stepper.changed",
        keywords: ["step", "stepper"],
        label,
        payload,
        entries: selectionNavigationCommandEntries(controller, "Step"),
      }),
    );
  }

  if (options.includeStepCommands ?? false) {
    for (const [index, step] of controller.steps.peek().entries()) {
      builder.addOptionalAction(
        `step.${step.id}`,
        `${label("step", "Go to Step")}: ${stepLabel(step, index)}`,
        "stepper.stepSelected",
        () => controller.setActive(index) ?? controller.steps.peek()[index] ?? step,
        (selected) => ({ ...payload(), step: selected }),
        ["step", "stepper", step.id, step.label],
        () => {
          const current = controller.steps.peek()[index];
          return current === undefined || current.disabled === true || controller.activeIndex.peek() === index;
        },
      );
    }
  }

  return builder.commands;
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
