// Copyright 2023 Im-Beast. MIT license.
import { Component, ComponentOptions } from "../component.ts";
import { TextObject, TextRectangle } from "../canvas/text.ts";
import { Computed, Effect, Signal, SignalOfObject } from "../signals/mod.ts";

import { signalify } from "../utils/signals.ts";
import { cropToWidth, textWidth } from "../utils/strings.ts";

/**
 * Type that describes position and size of Label
 * When `width` or `height` isn't set, they gets automatically calculated depending of given value text width and amount of lines
 */
export type LabelRectangle = {
  column: number;
  row: number;
  width?: number;
  height?: number;
};

/** Type that describes text positioning in label */
export interface LabelAlign {
  vertical: "top" | "center" | "bottom";
  horizontal: "left" | "center" | "right";
}

/** One cropped, positioned row produced by `labelLineLayout()`. */
export interface LabelLineLayout {
  sourceIndex: number;
  value: string;
  rectangle: TextRectangle;
}

/** Options for configuring label. */
export interface LabelOptions extends Omit<ComponentOptions, "rectangle"> {
  text: string | Signal<string>;
  rectangle: LabelRectangle | SignalOfObject<LabelRectangle>;
  align?: LabelAlign | SignalOfObject<LabelAlign>;
  multiCodePointSupport?: boolean | Signal<boolean>;
  overwriteRectangle?: boolean | Signal<boolean>;
}

/**
 * Component for creating multi-line, non interactive text
 *
 * @example
 * ```ts
 * new Label({
 *  parent: tui,
 *  text: "Hello\nthere"
 *  align: {
 *    horizontal: "center",
 *    vertical: "center",
 *  },
 *  theme: {
 *    base: crayon.magenta,
 *  },
 *  rectangle: {
 *    column: 1,
 *    row: 1,
 *  },
 *  zIndex: 0,
 * });
 * ```
 *
 * If you need to use emojis or other multi codepoint characters set `multiCodePointSupport` property to true.
 * @example
 * ```ts
 * new Label({
 *  ...,
 *  text: "🧡",
 *  multiCodePointCharacter: true,
 * });
 * ```
 * Rectangle properties – `width` and `height` are calculated automatically by default.
 * To overwrite that behaviour set `overwriteRectangle` property to true.
 *
 * @example
 * ```ts
 * new Label({
 *  ...,
 *  text: "1 2 3 cut me",
 *  overwriteRectangle: true,
 *  rectangle: {
 *    column: 1,
 *    row: 1,
 *    width: 6,
 *    height: 1,
 *  },
 * })
 * ```
 */
export class Label extends Component {
  declare drawnObjects: { texts: TextObject[] };

  #valueLines: Signal<string[]>;
  #lineLayout: Signal<LabelLineLayout[]>;

  text: Signal<string>;
  align: Signal<LabelAlign>;
  overwriteRectangle: Signal<boolean>;
  multiCodePointSupport: Signal<boolean>;

  constructor(options: LabelOptions) {
    super(options as ComponentOptions);

    this.text = signalify(options.text);
    this.overwriteRectangle = signalify(options.overwriteRectangle ?? false);
    this.multiCodePointSupport = signalify(options.multiCodePointSupport ?? false);
    this.align = signalify(options.align ?? { vertical: "top", horizontal: "left" }, { deepObserve: true });

    this.#valueLines = new Computed(() => this.text.value.split("\n"));
    this.#lineLayout = new Computed(() =>
      labelLineLayout(this.#valueLines.value, this.rectangle.value, this.align.value)
    );

    new Effect(() => {
      const rectangle = this.rectangle.value;
      const overwriteRectangle = this.overwriteRectangle.value;
      const valueLines = this.#valueLines.value;

      if (!overwriteRectangle) {
        rectangle.width = valueLines.reduce((p, c) => Math.max(p, textWidth(c)), 0);
        rectangle.height = valueLines.length;
      }

      const drawnTexts = (this.drawnObjects.texts ??= []).length;
      const lineLayout = this.#lineLayout.value;

      if (lineLayout.length > drawnTexts) {
        this.#fillDrawObjects();
      } else if (lineLayout.length < drawnTexts) {
        this.#popUnusedDrawObjects();
      }
    });
  }

  override draw(): void {
    super.draw();
    this.drawnObjects.texts ??= [];
    this.#fillDrawObjects();
  }

  #fillDrawObjects(): void {
    if (!this.#valueLines) throw new Error("#valueLines has to be set");

    const { drawnObjects } = this;

    for (let offset = drawnObjects.texts.length; offset < this.#lineLayout.peek().length; ++offset) {
      const textRectangle: TextRectangle = { column: 0, row: 0, width: 0 };
      const text = new TextObject({
        canvas: this.tui.canvas,
        view: this.view,
        style: this.style,
        zIndex: this.zIndex,
        multiCodePointSupport: this.multiCodePointSupport,
        value: new Computed(() => {
          return this.#lineLayout.value[offset]?.value ?? "";
        }),
        rectangle: new Computed(() => {
          const rectangle = this.#lineLayout.value[offset]?.rectangle ?? { column: 0, row: 0, width: 0 };
          textRectangle.column = rectangle.column;
          textRectangle.row = rectangle.row;
          textRectangle.width = rectangle.width;
          return textRectangle;
        }),
      });

      drawnObjects.texts[offset] = text;
      text.draw();
    }
  }

  #popUnusedDrawObjects(): void {
    if (!this.#valueLines) throw new Error("#valueLines has to be set");

    for (const text of this.drawnObjects.texts.splice(this.#lineLayout.peek().length)) {
      text.erase();
    }
  }
}

/** Computes cropped, aligned, in-bounds text rows for a label rectangle. */
export function labelLineLayout(
  lines: readonly string[],
  rectangle: LabelRectangle,
  align: LabelAlign = { vertical: "top", horizontal: "left" },
): LabelLineLayout[] {
  const width = Math.max(0, rectangle.width ?? maxLineWidth(lines));
  const height = Math.max(0, rectangle.height ?? lines.length);
  if (width === 0 || height === 0 || lines.length === 0) return [];

  const visibleCount = Math.min(lines.length, height);
  const sourceOffset = labelSourceOffset(lines.length, visibleCount, align.vertical);
  const rowOffset = labelRowOffset(height, visibleCount, align.vertical);

  return Array.from({ length: visibleCount }, (_, index) => {
    const sourceIndex = sourceOffset + index;
    const value = cropToWidth(lines[sourceIndex] ?? "", width);
    const valueWidth = textWidth(value);
    return {
      sourceIndex,
      value,
      rectangle: {
        column: rectangle.column + labelColumnOffset(width, valueWidth, align.horizontal),
        row: rectangle.row + rowOffset + index,
        width: valueWidth,
      },
    };
  });
}

function labelColumnOffset(width: number, valueWidth: number, horizontal: LabelAlign["horizontal"]): number {
  switch (horizontal) {
    case "center":
      return Math.max(0, Math.floor((width - valueWidth) / 2));
    case "right":
      return Math.max(0, width - valueWidth);
    default:
      return 0;
  }
}

function labelRowOffset(height: number, visibleCount: number, vertical: LabelAlign["vertical"]): number {
  switch (vertical) {
    case "center":
      return Math.max(0, Math.floor((height - visibleCount) / 2));
    case "bottom":
      return Math.max(0, height - visibleCount);
    default:
      return 0;
  }
}

function labelSourceOffset(lineCount: number, visibleCount: number, vertical: LabelAlign["vertical"]): number {
  switch (vertical) {
    case "center":
      return Math.max(0, Math.floor((lineCount - visibleCount) / 2));
    case "bottom":
      return Math.max(0, lineCount - visibleCount);
    default:
      return 0;
  }
}

function maxLineWidth(lines: readonly string[]): number {
  return lines.reduce((width, line) => Math.max(width, textWidth(line)), 0);
}
