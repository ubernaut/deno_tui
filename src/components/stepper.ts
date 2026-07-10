// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import {
  ActiveItemController,
  activeItemForIndex,
  BOUNDED_ACTIVE_ITEM_INDEX_POLICY,
  clampActiveItemIndex,
  cloneActiveItems,
  shiftActiveItemIndex,
} from "./active_item.ts";
import { drawTextRows } from "./text_children.ts";

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
export interface StepperOptions extends ComponentOptions, StepperControllerOptions {
  separator?: string | Signal<string>;
  controller?: StepperController;
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
  const active = clampStepperIndex(steps, activeIndex);
  if (orientation === "vertical") {
    const rows = new Array<string>(steps.length);
    for (let index = 0; index < steps.length; index += 1) {
      rows[index] = renderVerticalStep(steps[index]!, index === active);
    }
    return rows;
  }

  const separatorText = ` ${separator} `;
  let text = "";
  for (let index = 0; index < steps.length; index += 1) {
    if (text) text += separatorText;
    text += renderHorizontalStep(steps[index]!, index === active);
  }
  return [text.length <= width ? text : truncateStepperText(text, width)];
}

/** Clamps stepper Index to its valid range. */
export function clampStepperIndex(steps: readonly StepperStep[], activeIndex: number): number {
  return clampActiveItemIndex(steps, activeIndex, BOUNDED_ACTIVE_ITEM_INDEX_POLICY);
}

/** Moves stepper Index by a relative offset. */
export function shiftStepperIndex(steps: readonly StepperStep[], activeIndex: number, delta: number): number {
  return shiftActiveItemIndex(steps, activeIndex, delta, BOUNDED_ACTIVE_ITEM_INDEX_POLICY);
}

/** Public helper for step For Index. */
export function stepForIndex(steps: readonly StepperStep[], activeIndex: number): StepperStep | undefined {
  return activeItemForIndex(steps, activeIndex, BOUNDED_ACTIVE_ITEM_INDEX_POLICY);
}

/** State controller for stepper behavior. */
export class StepperController extends ActiveItemController<StepperStep> {
  readonly steps: Signal<StepperStep[]>;
  readonly orientation: Signal<StepperOrientation>;
  readonly #ownsOrientation: boolean;

  constructor(options: StepperControllerOptions) {
    super({
      items: options.steps,
      activeIndex: options.activeIndex,
      policy: BOUNDED_ACTIVE_ITEM_INDEX_POLICY,
      onChange: options.onChange,
    });
    this.steps = this.activeItems;
    this.#ownsOrientation = !(options.orientation instanceof Signal);
    this.orientation = signalify(options.orientation ?? "horizontal");
  }

  inspect(): StepperInspection {
    const steps = cloneActiveItems(this.steps.peek());
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

  override dispose(): void {
    super.dispose();
    if (this.#ownsOrientation) this.orientation.dispose();
  }

  protected override keyAxis(): StepperOrientation {
    return this.orientation.peek();
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
  readonly #rows: Computed<string[]>;

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
    this.#rows = new Computed(() =>
      renderStepper(
        this.steps.value,
        this.activeIndex.value,
        this.orientation.value,
        this.rectangle.value.width,
        this.separator.value,
      )
    );

    this.on("keyPress", (event) => this.controller.handleKeyPress(event));
    this.on("destroy", () => this.#rows.dispose());
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
    drawTextRows(this, this.#rows);
  }
}
