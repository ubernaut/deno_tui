// Copyright 2023 Im-Beast. MIT license.
import { Box } from "./box.ts";
import { Theme } from "../theme.ts";
import { ComponentOptions } from "../component.ts";

import { BoxObject } from "../canvas/box.ts";
import { TextObject } from "../canvas/text.ts";

import { normalize } from "../utils/numbers.ts";

import type { DeepPartial } from "../types.ts";
import { Computed, Signal, SignalOfObject } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";

/** Public type alias for a progress Bar Char Map Type. */
export type ProgressBarCharMapType = {
  vertical: string[];
  horizontal: string[];
};

/** Public constant for a progress Bar Char Map. */
export const progressBarCharMap: ProgressBarCharMapType = {
  vertical: ["█", "🮆", "🮅", "🮄", "🮃", "🮂", "▔"],
  horizontal: ["█", "▉", "▉", "▊", "▋", "▍", "▎", "▏"],
};

/** Public type alias for a progress Bar Orientation. */
export type ProgressBarOrientation = "vertical" | "horizontal";
/** Public type alias for a progress Bar Direction. */
export type ProgressBarDirection = "normal" | "reversed";

/** Public interface describing a progress Bar Theme. */
export interface ProgressBarTheme extends Theme {
  progress: Theme;
}

/** Options for configuring progress Bar. */
export interface ProgressBarOptions extends ComponentOptions {
  min: number | Signal<number>;
  max: number | Signal<number>;
  value: number | Signal<number>;
  smooth: boolean | Signal<boolean>;
  direction: ProgressBarDirection | Signal<ProgressBarDirection>;
  orientation: ProgressBarOrientation | Signal<ProgressBarOrientation>;
  charMap?: ProgressBarCharMapType | SignalOfObject<ProgressBarCharMapType>;
  controller?: ProgressBarController;
  onChange?: (value: number) => void | Promise<void>;

  theme: DeepPartial<ProgressBarTheme, "progress">;
}

/** Options for configuring progress Bar Controller. */
export interface ProgressBarControllerOptions {
  min: number | Signal<number>;
  max: number | Signal<number>;
  value: number | Signal<number>;
  smooth: boolean | Signal<boolean>;
  direction: ProgressBarDirection | Signal<ProgressBarDirection>;
  orientation: ProgressBarOrientation | Signal<ProgressBarOrientation>;
  charMap?: ProgressBarCharMapType | SignalOfObject<ProgressBarCharMapType>;
  onChange?: (value: number) => void | Promise<void>;
}

/** Serializable inspection snapshot for progress Bar. */
export interface ProgressBarInspection {
  min: number;
  max: number;
  value: number;
  normalizedValue: number;
  direction: ProgressBarDirection;
  orientation: ProgressBarOrientation;
  smooth: boolean;
  complete: boolean;
  empty: boolean;
}

/** Public interface describing a progress Bar Track Rectangle. */
export interface ProgressBarTrackRectangle {
  column: number;
  row: number;
  width: number;
  height: number;
}

/** Clamps progress Value to its valid range. */
export function clampProgressValue(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, Math.max(min, max)), Math.min(min, max));
}

/** Public helper for progress Ratio. */
export function progressRatio(
  value: number,
  min: number,
  max: number,
  direction: ProgressBarDirection = "normal",
): number {
  const ratio = normalize(clampProgressValue(value, min, max), min, max);
  return direction === "reversed" ? 1 - ratio : ratio;
}

/** Public helper for progress Rectangle. */
export function progressRectangle(
  track: ProgressBarTrackRectangle,
  value: number,
  min: number,
  max: number,
  orientation: ProgressBarOrientation,
  direction: ProgressBarDirection = "normal",
): ProgressBarTrackRectangle {
  const ratio = progressRatio(value, min, max, direction);
  return orientation === "horizontal"
    ? {
      column: track.column,
      row: track.row,
      width: Math.round(track.width * ratio),
      height: track.height,
    }
    : {
      column: track.column,
      row: track.row,
      width: track.width,
      height: Math.round(track.height * ratio),
    };
}

/** Public helper for progress Smooth Line. */
export function progressSmoothLine(
  offset: number,
  width: number,
  height: number,
  value: number,
  min: number,
  max: number,
  orientation: ProgressBarOrientation,
  direction: ProgressBarDirection,
  charMap: ProgressBarCharMapType,
): string {
  const ratio = progressRatio(value, min, max, direction);
  const chars = charMap[orientation];
  const step = 1 / chars.length;

  if (orientation === "horizontal") {
    const steps = ratio * width;
    const remainder = steps % 1;
    return chars[0].repeat(steps) +
      (remainder < step ? "" : chars[chars.length - Math.max(Math.round(remainder / step), 1)]);
  }

  const steps = ratio * height;
  const remainder = steps % 1;
  if (offset - 1 >= steps - remainder) return "";
  if (offset < steps - remainder) return chars[0].repeat(width);
  return remainder < step ? "" : chars[chars.length - Math.max(Math.round(remainder / step), 1)].repeat(width);
}

/** State controller for progress Bar behavior. */
export class ProgressBarController {
  readonly min: Signal<number>;
  readonly max: Signal<number>;
  readonly value: Signal<number>;
  readonly smooth: Signal<boolean>;
  readonly direction: Signal<ProgressBarDirection>;
  readonly orientation: Signal<ProgressBarOrientation>;
  readonly charMap: Signal<ProgressBarCharMapType>;
  readonly #ownsMin: boolean;
  readonly #ownsMax: boolean;
  readonly #ownsValue: boolean;
  readonly #ownsSmooth: boolean;
  readonly #ownsDirection: boolean;
  readonly #ownsOrientation: boolean;
  readonly #ownsCharMap: boolean;
  readonly #onChange?: (value: number) => void | Promise<void>;
  readonly #syncValue = () => {
    this.value.value = clampProgressValue(this.value.peek(), this.min.peek(), this.max.peek());
  };

  constructor(options: ProgressBarControllerOptions) {
    this.#ownsMin = !(options.min instanceof Signal);
    this.#ownsMax = !(options.max instanceof Signal);
    this.#ownsValue = !(options.value instanceof Signal);
    this.#ownsSmooth = !(options.smooth instanceof Signal);
    this.#ownsDirection = !(options.direction instanceof Signal);
    this.#ownsOrientation = !(options.orientation instanceof Signal);
    this.#ownsCharMap = !(options.charMap instanceof Signal);
    this.min = signalify(options.min);
    this.max = signalify(options.max);
    this.value = signalify(options.value);
    this.smooth = signalify(options.smooth);
    this.direction = signalify(options.direction);
    this.orientation = signalify(options.orientation);
    this.charMap = signalify(options.charMap ?? progressBarCharMap);
    this.#onChange = options.onChange;
    this.min.subscribe(this.#syncValue);
    this.max.subscribe(this.#syncValue);
    this.value.subscribe(this.#syncValue);
    this.#syncValue();
  }

  ratio(): number {
    return progressRatio(this.value.peek(), this.min.peek(), this.max.peek(), this.direction.peek());
  }

  setValue(value: number): number {
    const next = clampProgressValue(value, this.min.peek(), this.max.peek());
    this.value.value = next;
    void this.#onChange?.(next);
    return next;
  }

  increment(step = 1): number {
    return this.setValue(this.value.peek() + step);
  }

  decrement(step = 1): number {
    return this.setValue(this.value.peek() - step);
  }

  setMin(): number {
    return this.setValue(this.min.peek());
  }

  setMax(): number {
    return this.setValue(this.max.peek());
  }

  progressRectangle(track: ProgressBarTrackRectangle): ProgressBarTrackRectangle {
    return progressRectangle(
      track,
      this.value.peek(),
      this.min.peek(),
      this.max.peek(),
      this.orientation.peek(),
      this.direction.peek(),
    );
  }

  smoothLine(offset: number, width: number, height: number): string {
    return progressSmoothLine(
      offset,
      width,
      height,
      this.value.peek(),
      this.min.peek(),
      this.max.peek(),
      this.orientation.peek(),
      this.direction.peek(),
      this.charMap.peek(),
    );
  }

  inspect(): ProgressBarInspection {
    const normalizedValue = normalize(
      clampProgressValue(this.value.peek(), this.min.peek(), this.max.peek()),
      this.min.peek(),
      this.max.peek(),
    );
    return {
      min: this.min.peek(),
      max: this.max.peek(),
      value: this.value.peek(),
      normalizedValue,
      direction: this.direction.peek(),
      orientation: this.orientation.peek(),
      smooth: this.smooth.peek(),
      complete: normalizedValue >= 1,
      empty: normalizedValue <= 0,
    };
  }

  dispose(): void {
    this.min.unsubscribe(this.#syncValue);
    this.max.unsubscribe(this.#syncValue);
    this.value.unsubscribe(this.#syncValue);
    if (this.#ownsMin) this.min.dispose();
    if (this.#ownsMax) this.max.dispose();
    if (this.#ownsValue) this.value.dispose();
    if (this.#ownsSmooth) this.smooth.dispose();
    if (this.#ownsDirection) this.direction.dispose();
    if (this.#ownsOrientation) this.orientation.dispose();
    if (this.#ownsCharMap) this.charMap.dispose();
  }
}

/**
 * Component for creating interactive progressbars
 *
 * @example
 * ```ts
 * new ProgressBar({
 *  parent: tui,
 *  orientation: "horizontal",
 *  direction: "normal",
 *  theme: {
 *   base: crayon.bgLightBlue,
 *   focused: crayon.bgCyan,
 *   active: crayon.bgBlue,
 *   progress: {
 *    base: crayon.bgLightBlue.green,
 *    focused: crayon.bgCyan.lightGreen,
 *    active: crayon.bgBlue.lightYellow,
 *   },
 *  },
 *  value: 50,
 *  min: 0,
 *  max: 100,
 *  smooth: false,
 *  rectangle: {
 *   column: 48,
 *   height: 2,
 *   row: 3,
 *   width: 10,
 *  },
 *  zIndex: 0,
 * });
 * ```
 *
 * You can make the progressbar vertical by changing `orientation`
 * @example
 * ```ts
 * new ProgressBar({
 *  ...,
 *  orientation: "vertical",
 * });
 * ```
 *
 * You can reverse the flow of progress by changing `direction` to "reversed"
 * @example
 * ```ts
 * new ProgressBar({
 *  ...,
 *  direction: "reversed",
 * });
 * ```
 *
 * You can also make progress seem more granular by taking advantage of special characters.
 * Set smooth to `true` to do that.
 * @example
 * ```ts
 * new ProgressBar({
 *  ...,
 *  smooth: true,
 * });
 * ```
 */
export class ProgressBar extends Box {
  declare drawnObjects: { box: BoxObject; progress: BoxObject | TextObject[] };
  declare theme: ProgressBarTheme;

  min: Signal<number>;
  max: Signal<number>;
  value: Signal<number>;
  smooth: Signal<boolean>;
  direction: Signal<ProgressBarDirection>;
  orientation: Signal<ProgressBarOrientation>;
  charMap: Signal<ProgressBarCharMapType>;
  readonly controller: ProgressBarController;

  constructor(options: ProgressBarOptions) {
    super(options);

    const ownsController = !options.controller;
    this.controller = options.controller ??
      new ProgressBarController({
        min: options.min,
        max: options.max,
        value: options.value,
        smooth: options.smooth,
        direction: options.direction,
        orientation: options.orientation,
        charMap: options.charMap,
        onChange: options.onChange,
      });
    this.min = this.controller.min;
    this.max = this.controller.max;
    this.value = this.controller.value;
    this.smooth = this.controller.smooth;
    this.direction = this.controller.direction;
    this.orientation = this.controller.orientation;
    this.charMap = this.controller.charMap;
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  override draw(): void {
    super.draw();

    if (this.smooth.peek()) {
      this.drawnObjects.progress = [];
      this.#fillSmoothDrawObjects();
    } else {
      const progressRectangle = { column: 0, row: 0, width: 0, height: 0 };
      const progress = new BoxObject({
        canvas: this.tui.canvas,
        view: this.view,
        zIndex: this.zIndex,
        style: new Computed(() => this.theme.progress[this.state.value]),
        rectangle: new Computed(() => {
          const { column, row, width, height } = this.rectangle.value;
          Object.assign(progressRectangle, this.controller.progressRectangle({ column, row, width, height }));

          const { progress } = this.drawnObjects;
          if (Array.isArray(progress)) {
            if (progress.length > height) {
              this.#popUnusedSmoothDrawObjects();
            } else if (progress.length < height) {
              this.#fillSmoothDrawObjects();
            }
          }

          return progressRectangle;
        }),
      });

      this.drawnObjects.progress = progress;
      progress.draw();
    }
  }

  override interact(method: "mouse" | "keyboard"): void {
    this.state.value = this.nextInteractionState(method);
    super.interact(method);
  }

  #fillSmoothDrawObjects() {
    if (!Array.isArray(this.drawnObjects.progress)) {
      throw new Error("drawnObjects.progress needs to be an array");
    }

    for (let offset = this.drawnObjects.progress.length; offset < this.rectangle.peek().height; ++offset) {
      const progressLineRectangle = { column: 0, row: 0 };
      const progressLine = new TextObject({
        canvas: this.tui.canvas,
        multiCodePointSupport: true,
        view: this.view,
        zIndex: this.zIndex,
        style: new Computed(() => this.theme.progress[this.state.value]),
        rectangle: new Computed(() => {
          const { column, row } = this.rectangle.value;
          progressLineRectangle.column = column;
          progressLineRectangle.row = row + offset;
          return progressLineRectangle;
        }),
        value: new Computed(() => {
          const { width, height } = this.rectangle.value;
          return this.controller.smoothLine(offset, width, height);
        }),
      });

      this.drawnObjects.progress.push(progressLine);
      progressLine.draw();
    }
  }

  #popUnusedSmoothDrawObjects(): void {
    if (!Array.isArray(this.drawnObjects.progress)) {
      throw new Error("drawnObjects.progress needs to be an array");
    }

    for (const progressLine of this.drawnObjects.progress.splice(this.rectangle.peek().height)) {
      progressLine.erase();
    }
  }
}
