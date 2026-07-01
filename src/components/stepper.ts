// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

/** Public type alias for a stepper Orientation. */
export type StepperOrientation = "horizontal" | "vertical";

/** Public interface describing a stepper Step. */
export interface StepperStep {
  id: string;
  label: string;
  disabled?: boolean;
  completed?: boolean;
}

/** Options for configuring stepper. */
export interface StepperOptions extends ComponentOptions {
  steps: StepperStep[] | Signal<StepperStep[]>;
  activeIndex?: number | Signal<number>;
  orientation?: StepperOrientation | Signal<StepperOrientation>;
  separator?: string | Signal<string>;
  controller?: StepperController;
  onChange?: (step: StepperStep, index: number) => void | Promise<void>;
}

/** Options for configuring stepper Controller. */
export interface StepperControllerOptions {
  steps: StepperStep[] | Signal<StepperStep[]>;
  activeIndex?: number | Signal<number>;
  orientation?: StepperOrientation | Signal<StepperOrientation>;
  onChange?: (step: StepperStep, index: number) => void | Promise<void>;
}

/** Serializable inspection snapshot for stepper. */
export interface StepperInspection {
  steps: StepperStep[];
  stepCount: number;
  activeIndex: number;
  active?: StepperStep;
  orientation: StepperOrientation;
  empty: boolean;
}

/** Renders stepper into deterministic text rows. */
export function renderStepper(
  steps: readonly StepperStep[],
  activeIndex: number,
  orientation: StepperOrientation = "horizontal",
  width = Number.POSITIVE_INFINITY,
  separator = "→",
): string[] {
  if (orientation === "vertical") {
    return steps.map((step, index) => renderVerticalStep(step, index === clampStepperIndex(steps, activeIndex)));
  }

  const text = steps.map((step, index) => renderHorizontalStep(step, index === clampStepperIndex(steps, activeIndex)))
    .join(` ${separator} `);
  return [text.length <= width ? text : truncateStepperText(text, width)];
}

/** Clamps stepper Index to its valid range. */
export function clampStepperIndex(steps: readonly StepperStep[], activeIndex: number): number {
  if (steps.length === 0) return 0;
  const clamped = Math.max(0, Math.min(activeIndex, steps.length - 1));
  if (!steps[clamped]?.disabled) return clamped;
  const next = shiftStepperIndex(steps, clamped, 1);
  if (!steps[next]?.disabled) return next;
  const previous = shiftStepperIndex(steps, clamped, -1);
  return steps[previous]?.disabled ? clamped : previous;
}

/** Moves stepper Index by a relative offset. */
export function shiftStepperIndex(steps: readonly StepperStep[], activeIndex: number, delta: number): number {
  if (steps.length === 0) return 0;
  let next = Math.max(0, Math.min(activeIndex, steps.length - 1));
  for (let count = 0; count < steps.length; count += 1) {
    next = Math.max(0, Math.min(steps.length - 1, next + delta));
    if (!steps[next]?.disabled) return next;
    if (next === 0 || next === steps.length - 1) break;
  }
  return activeIndex;
}

/** Public helper for step For Index. */
export function stepForIndex(steps: readonly StepperStep[], activeIndex: number): StepperStep | undefined {
  const step = steps[clampStepperIndex(steps, activeIndex)];
  return step?.disabled ? undefined : step;
}

/** State controller for stepper behavior. */
export class StepperController {
  readonly steps: Signal<StepperStep[]>;
  readonly activeIndex: Signal<number>;
  readonly orientation: Signal<StepperOrientation>;
  readonly #ownsSteps: boolean;
  readonly #ownsActiveIndex: boolean;
  readonly #ownsOrientation: boolean;
  readonly #onChange?: (step: StepperStep, index: number) => void | Promise<void>;

  constructor(options: StepperControllerOptions) {
    this.#ownsSteps = !(options.steps instanceof Signal);
    this.#ownsActiveIndex = !(options.activeIndex instanceof Signal);
    this.#ownsOrientation = !(options.orientation instanceof Signal);
    this.steps = signalify(options.steps, { deepObserve: true });
    this.activeIndex = signalify(options.activeIndex ?? 0);
    this.orientation = signalify(options.orientation ?? "horizontal");
    this.#onChange = options.onChange;
    this.activeIndex.value = clampStepperIndex(this.steps.peek(), this.activeIndex.peek());
  }

  active(): StepperStep | undefined {
    return stepForIndex(this.steps.peek(), this.activeIndex.peek());
  }

  move(delta: number): StepperStep | undefined {
    return this.setActive(shiftStepperIndex(this.steps.peek(), this.activeIndex.peek(), delta));
  }

  first(): StepperStep | undefined {
    return this.setActive(0);
  }

  last(): StepperStep | undefined {
    return this.setActive(this.steps.peek().length - 1);
  }

  setActive(index: number): StepperStep | undefined {
    const next = clampStepperIndex(this.steps.peek(), index);
    this.activeIndex.value = next;
    const step = this.steps.peek()[next];
    if (step && !step.disabled) {
      void this.#onChange?.(step, next);
      return step;
    }
    return undefined;
  }

  handleKeyPress({ key, ctrl, meta, shift }: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
    if (ctrl || meta || shift) return;
    const orientation = this.orientation.peek();
    if ((orientation === "horizontal" && key === "left") || (orientation === "vertical" && key === "up")) {
      this.move(-1);
    } else if ((orientation === "horizontal" && key === "right") || (orientation === "vertical" && key === "down")) {
      this.move(1);
    } else if (key === "home") {
      this.first();
    } else if (key === "end") {
      this.last();
    }
  }

  inspect(): StepperInspection {
    const steps = this.steps.peek().map((step) => ({ ...step }));
    const activeIndex = clampStepperIndex(steps, this.activeIndex.peek());
    const active = stepForIndex(steps, activeIndex);
    return {
      steps,
      stepCount: steps.length,
      activeIndex,
      active: active ? { ...active } : undefined,
      orientation: this.orientation.peek(),
      empty: steps.length === 0,
    };
  }

  dispose(): void {
    if (this.#ownsSteps) this.steps.dispose();
    if (this.#ownsActiveIndex) this.activeIndex.dispose();
    if (this.#ownsOrientation) this.orientation.dispose();
  }
}

function renderHorizontalStep(step: StepperStep, active: boolean): string {
  const label = step.disabled ? `(${step.label})` : step.label;
  if (active) return `[${label}]`;
  if (step.completed) return `✓ ${label}`;
  return label;
}

function renderVerticalStep(step: StepperStep, active: boolean): string {
  const cursor = active && !step.disabled ? ">" : " ";
  const mark = step.disabled ? "-" : step.completed ? "✓" : "○";
  const label = step.disabled ? `(${step.label})` : step.label;
  return `${cursor} ${mark} ${label}`;
}

function truncateStepperText(text: string, width: number): string {
  const safeWidth = Math.max(0, width);
  if (safeWidth === 0) return "";
  if (safeWidth === 1) return "…";
  return `${text.slice(0, safeWidth - 1)}…`;
}

/** Public class implementing a stepper. */
export class Stepper extends Component {
  steps: Signal<StepperStep[]>;
  activeIndex: Signal<number>;
  orientation: Signal<StepperOrientation>;
  separator: Signal<string>;
  readonly controller: StepperController;

  constructor(private readonly stepperOptions: StepperOptions) {
    super(stepperOptions);
    const ownsController = !stepperOptions.controller;
    this.controller = stepperOptions.controller ??
      new StepperController({
        steps: stepperOptions.steps,
        activeIndex: stepperOptions.activeIndex,
        orientation: stepperOptions.orientation,
        onChange: stepperOptions.onChange,
      });
    this.steps = this.controller.steps;
    this.activeIndex = this.controller.activeIndex;
    this.orientation = this.controller.orientation;
    this.separator = signalify(stepperOptions.separator ?? "→");

    this.on("keyPress", (event) => this.controller.handleKeyPress(event));
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  active(): StepperStep | undefined {
    return this.controller.active();
  }

  move(delta: number): void {
    this.controller.move(delta);
  }

  setActive(index: number): void {
    this.controller.setActive(index);
  }

  override draw(): void {
    super.draw();
    const rows = new Computed(() =>
      renderStepper(
        this.steps.value,
        this.activeIndex.value,
        this.orientation.value,
        this.rectangle.value.width,
        this.separator.value,
      )
    );
    const height = this.rectangle.peek().height;
    for (let index = 0; index < height; index++) {
      const row = new Text({
        parent: this,
        theme: this.theme,
        zIndex: this.zIndex,
        text: new Computed(() => rows.value[index] ?? ""),
        overwriteWidth: true,
        rectangle: new Computed<TextRectangle>(() => ({
          column: this.rectangle.value.column,
          row: this.rectangle.value.row + index,
          width: this.rectangle.value.width,
        })),
        visible: this.visible,
      });
      row.subComponentOf = this;
      this.subComponents[`row-${index}`] = row;
    }
  }
}
