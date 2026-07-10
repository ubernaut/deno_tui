// Copyright 2023 Im-Beast. MIT license.
import { Box } from "./box.ts";
import { Theme } from "../theme.ts";
import { ComponentOptions } from "../component.ts";

import { BoxObject } from "../canvas/box.ts";

import { clamp, normalize } from "../utils/numbers.ts";

import type { DeepPartial } from "../types.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";

/** Public type alias for a slider Orientation. */
export type SliderOrientation = "vertical" | "horizontal";

/** Public interface describing a slider Theme. */
export interface SliderTheme extends Theme {
  thumb: Theme;
}

/** Options for configuring slider. */
export interface SliderOptions extends ComponentOptions {
  min: number | Signal<number>;
  max: number | Signal<number>;
  step: number | Signal<number>;
  value: number | Signal<number>;
  /**
   * When false thumb will be 1 cell wide/high.
   *
   * If this is set to true, thumb size will adjust so it takes as much space as it can so it looks more natural to interact with.
   *
   * Basically when set to true it'll make slider thumb work just like in browsers.
   */
  adjustThumbSize: boolean | Signal<boolean>;
  orientation: SliderOrientation | Signal<SliderOrientation>;
  theme: DeepPartial<SliderTheme, "thumb">;
  controller?: SliderController;
  onChange?: (value: number) => void | Promise<void>;
}

/** Options for configuring slider Controller. */
export interface SliderControllerOptions {
  min: number | Signal<number>;
  max: number | Signal<number>;
  step: number | Signal<number>;
  value: number | Signal<number>;
  adjustThumbSize?: boolean | Signal<boolean>;
  orientation: SliderOrientation | Signal<SliderOrientation>;
  onChange?: (value: number) => void | Promise<void>;
}

/** Serializable inspection snapshot for slider. */
export interface SliderInspection {
  min: number;
  max: number;
  step: number;
  value: number;
  normalizedValue: number;
  orientation: SliderOrientation;
  adjustThumbSize: boolean;
  range: number;
}

/** Public interface describing a slider Thumb Rectangle. */
export interface SliderThumbRectangle {
  column: number;
  row: number;
  width: number;
  height: number;
}

/** Public interface describing a slider Track Rectangle. */
export interface SliderTrackRectangle {
  column: number;
  row: number;
  width: number;
  height: number;
}

/** Clamps slider Value to its valid range. */
export function clampSliderValue(value: number, min: number, max: number): number {
  return clamp(value, Math.min(min, max), Math.max(min, max));
}

/** Public helper for slider Value By. */
export function sliderValueBy(value: number, min: number, max: number, step: number, delta: number): number {
  return clampSliderValue(value + step * delta, min, max);
}

/** Public helper for snap Slider Value. */
export function snapSliderValue(value: number, min: number, max: number, step: number): number {
  const rangeDirection = Math.sign(max - min) || 1;
  const safeStep = Math.max(Number.EPSILON, Math.abs(step)) * rangeDirection;
  const snapped = min + Math.round((value - min) / safeStep) * safeStep;
  return clampSliderValue(snapped, min, max);
}

/** Public helper for slider Value At. */
export function sliderValueAt(
  track: SliderTrackRectangle,
  point: { column: number; row: number },
  min: number,
  max: number,
  step: number,
  orientation: SliderOrientation,
): number {
  const span = Math.max(1, orientation === "horizontal" ? track.width - 1 : track.height - 1);
  const offset = orientation === "horizontal" ? point.column - track.column : point.row - track.row;
  const normalizedValue = clamp(offset, 0, span) / span;
  return snapSliderValue(min + (max - min) * normalizedValue, min, max, step);
}

/** Public helper for slider Thumb Rectangle. */
export function sliderThumbRectangle(
  track: SliderTrackRectangle,
  value: number,
  min: number,
  max: number,
  orientation: SliderOrientation,
  adjustThumbSize = false,
): SliderThumbRectangle {
  const range = Math.max(1, Math.abs(max - min));
  const normalizedValue = normalize(clampSliderValue(value, min, max), min, max);

  if (orientation === "horizontal") {
    const thumbSize = adjustThumbSize ? Math.max(1, Math.round(track.width / range)) : 1;
    return {
      column: Math.min(
        track.column + Math.max(0, track.width - thumbSize),
        track.column + Math.round(Math.max(0, track.width - 1) * normalizedValue),
      ),
      row: track.row,
      width: thumbSize,
      height: track.height,
    };
  }

  const thumbSize = adjustThumbSize ? Math.max(1, Math.round(track.height / range)) : 1;
  return {
    column: track.column,
    row: Math.min(
      track.row + Math.max(0, track.height - thumbSize),
      track.row + Math.round(Math.max(0, track.height - 1) * normalizedValue),
    ),
    width: track.width,
    height: thumbSize,
  };
}

/** State controller for slider behavior. */
export class SliderController {
  readonly min: Signal<number>;
  readonly max: Signal<number>;
  readonly step: Signal<number>;
  readonly value: Signal<number>;
  readonly adjustThumbSize: Signal<boolean>;
  readonly orientation: Signal<SliderOrientation>;
  readonly #ownsMin: boolean;
  readonly #ownsMax: boolean;
  readonly #ownsStep: boolean;
  readonly #ownsValue: boolean;
  readonly #ownsAdjustThumbSize: boolean;
  readonly #ownsOrientation: boolean;
  readonly #onChange?: (value: number) => void | Promise<void>;

  constructor(options: SliderControllerOptions) {
    this.#ownsMin = !(options.min instanceof Signal);
    this.#ownsMax = !(options.max instanceof Signal);
    this.#ownsStep = !(options.step instanceof Signal);
    this.#ownsValue = !(options.value instanceof Signal);
    this.#ownsAdjustThumbSize = !(options.adjustThumbSize instanceof Signal);
    this.#ownsOrientation = !(options.orientation instanceof Signal);
    this.min = signalify(options.min);
    this.max = signalify(options.max);
    this.step = signalify(options.step);
    this.value = signalify(options.value);
    this.adjustThumbSize = signalify(options.adjustThumbSize ?? false);
    this.orientation = signalify(options.orientation);
    this.#onChange = options.onChange;
    this.value.value = clampSliderValue(this.value.peek(), this.min.peek(), this.max.peek());
  }

  setValue(value: number): number {
    const next = clampSliderValue(value, this.min.peek(), this.max.peek());
    this.value.value = next;
    void this.#onChange?.(next);
    return next;
  }

  increment(steps = 1): number {
    return this.setValue(sliderValueBy(this.value.peek(), this.min.peek(), this.max.peek(), this.step.peek(), steps));
  }

  decrement(steps = 1): number {
    return this.increment(-steps);
  }

  setMin(): number {
    return this.setValue(this.min.peek());
  }

  setMax(): number {
    return this.setValue(this.max.peek());
  }

  handleKeyPress({ key, ctrl, meta, shift }: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
    if (ctrl || meta || shift) return;
    if (key === "up" || key === "right") {
      this.increment();
    } else if (key === "down" || key === "left") {
      this.decrement();
    } else if (key === "home") {
      this.setMin();
    } else if (key === "end") {
      this.setMax();
    }
  }

  handleDrag(movementX: number, movementY: number): number {
    const delta = this.orientation.peek() === "horizontal" ? movementX : movementY;
    return this.increment(delta);
  }

  handleScroll(scroll: number): number {
    return this.increment(scroll);
  }

  handlePointer(track: SliderTrackRectangle, column: number, row: number): number {
    return this.setValue(sliderValueAt(
      track,
      { column, row },
      this.min.peek(),
      this.max.peek(),
      this.step.peek(),
      this.orientation.peek(),
    ));
  }

  thumbRectangle(track: SliderTrackRectangle): SliderThumbRectangle {
    return sliderThumbRectangle(
      track,
      this.value.peek(),
      this.min.peek(),
      this.max.peek(),
      this.orientation.peek(),
      this.adjustThumbSize.peek(),
    );
  }

  inspect(): SliderInspection {
    const min = this.min.peek();
    const max = this.max.peek();
    const value = clampSliderValue(this.value.peek(), min, max);
    return {
      min,
      max,
      step: this.step.peek(),
      value,
      normalizedValue: normalize(value, min, max),
      orientation: this.orientation.peek(),
      adjustThumbSize: this.adjustThumbSize.peek(),
      range: Math.abs(max - min),
    };
  }

  dispose(): void {
    if (this.#ownsMin) this.min.dispose();
    if (this.#ownsMax) this.max.dispose();
    if (this.#ownsStep) this.step.dispose();
    if (this.#ownsValue) this.value.dispose();
    if (this.#ownsAdjustThumbSize) this.adjustThumbSize.dispose();
    if (this.#ownsOrientation) this.orientation.dispose();
  }
}

/**
 * Component for creating interactive sliders
 *
 * @example
 * ```ts
 * new Slider({
 *  parent: tui,
 *  min: 1,
 *  max: 10,
 *  value: 5,
 *  step: 1,
 *  adjustThumbSize: true,
 *  orientation: "horizontal",
 *  rectangle: {
 *    column: 1,
 *    row: 1,
 *    height: 2,
 *    width: 10,
 *  },
 *  theme: {
 *    base: crayon.bgBlue,
 *    thumb: { base: crayon.bgMagenta },
 *  },
 *  zIndex: 0,
 * });
 * ```
 */
export class Slider extends Box {
  declare drawnObjects: { box: BoxObject; thumb: BoxObject };
  declare theme: SliderTheme;

  min: Signal<number>;
  max: Signal<number>;
  step: Signal<number>;
  value: Signal<number>;
  adjustThumbSize: Signal<boolean>;
  orientation: Signal<SliderOrientation>;
  readonly controller: SliderController;

  constructor(options: SliderOptions) {
    super(options);
    const ownsController = !options.controller;
    this.controller = options.controller ??
      new SliderController({
        min: options.min,
        max: options.max,
        step: options.step,
        value: options.value,
        adjustThumbSize: options.adjustThumbSize,
        orientation: options.orientation,
        onChange: options.onChange,
      });
    this.min = this.controller.min;
    this.max = this.controller.max;
    this.step = this.controller.step;
    this.value = this.controller.value;
    this.orientation = this.controller.orientation;
    this.adjustThumbSize = this.controller.adjustThumbSize;

    this.on("keyPress", (event) => this.controller.handleKeyPress(event));

    this.on("mousePress", ({ x, y, drag, movementX, movementY, ctrl, shift, meta }) => {
      if (ctrl || shift || meta) return;
      if (drag) this.controller.handleDrag(movementX, movementY);
      else this.controller.handlePointer(this.rectangle.peek(), x, y);
    });

    this.on("mouseScroll", ({ scroll }) => {
      this.controller.handleScroll(scroll);
    });
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  override draw(): void {
    super.draw();

    const thumbRectangle = { column: 0, row: 0, width: 0, height: 0 };
    const thumb = new BoxObject({
      view: this.view,
      zIndex: this.zIndex,
      canvas: this.tui.canvas,
      style: new Computed(() => this.theme.thumb[this.state.value]),
      rectangle: new Computed(() => {
        const { column, row, width, height } = this.rectangle.value;
        const next = this.controller.thumbRectangle({ column, row, width, height });
        thumbRectangle.column = next.column;
        thumbRectangle.row = next.row;
        thumbRectangle.width = next.width;
        thumbRectangle.height = next.height;

        return thumbRectangle;
      }),
    });

    this.drawnObjects.thumb = thumb;
    thumb.draw();
  }

  override interact(method: "keyboard" | "mouse"): void {
    super.interact(method);
    this.state.value = this.nextInteractionState(method);
  }
}
