// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

export type StepperOrientation = "horizontal" | "vertical";

export interface StepperStep {
  id: string;
  label: string;
  disabled?: boolean;
  completed?: boolean;
}

export interface StepperOptions extends ComponentOptions {
  steps: StepperStep[] | Signal<StepperStep[]>;
  activeIndex?: number | Signal<number>;
  orientation?: StepperOrientation | Signal<StepperOrientation>;
  separator?: string | Signal<string>;
  onChange?: (step: StepperStep, index: number) => void | Promise<void>;
}

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

export function clampStepperIndex(steps: readonly StepperStep[], activeIndex: number): number {
  if (steps.length === 0) return 0;
  const clamped = Math.max(0, Math.min(activeIndex, steps.length - 1));
  if (!steps[clamped]?.disabled) return clamped;
  const next = shiftStepperIndex(steps, clamped, 1);
  if (!steps[next]?.disabled) return next;
  const previous = shiftStepperIndex(steps, clamped, -1);
  return steps[previous]?.disabled ? clamped : previous;
}

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

export function stepForIndex(steps: readonly StepperStep[], activeIndex: number): StepperStep | undefined {
  const step = steps[clampStepperIndex(steps, activeIndex)];
  return step?.disabled ? undefined : step;
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

export class Stepper extends Component {
  steps: Signal<StepperStep[]>;
  activeIndex: Signal<number>;
  orientation: Signal<StepperOrientation>;
  separator: Signal<string>;

  constructor(private readonly stepperOptions: StepperOptions) {
    super(stepperOptions);
    this.steps = signalify(stepperOptions.steps, { deepObserve: true });
    this.activeIndex = signalify(stepperOptions.activeIndex ?? 0);
    this.orientation = signalify(stepperOptions.orientation ?? "horizontal");
    this.separator = signalify(stepperOptions.separator ?? "→");

    this.on("keyPress", ({ key, ctrl, meta, shift }) => {
      if (ctrl || meta || shift) return;
      const orientation = this.orientation.peek();
      if ((orientation === "horizontal" && key === "left") || (orientation === "vertical" && key === "up")) {
        this.move(-1);
      } else if ((orientation === "horizontal" && key === "right") || (orientation === "vertical" && key === "down")) {
        this.move(1);
      } else if (key === "home") {
        this.setActive(clampStepperIndex(this.steps.peek(), 0));
      } else if (key === "end") {
        this.setActive(clampStepperIndex(this.steps.peek(), this.steps.peek().length - 1));
      }
    });
  }

  active(): StepperStep | undefined {
    return stepForIndex(this.steps.peek(), this.activeIndex.peek());
  }

  move(delta: number): void {
    this.setActive(shiftStepperIndex(this.steps.peek(), this.activeIndex.peek(), delta));
  }

  setActive(index: number): void {
    const next = clampStepperIndex(this.steps.peek(), index);
    this.activeIndex.value = next;
    const step = this.steps.peek()[next];
    if (step && !step.disabled) {
      void this.stepperOptions.onChange?.(step, next);
    }
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
    Array.from({ length: this.rectangle.peek().height }, (_, index) => {
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
    });
  }
}
