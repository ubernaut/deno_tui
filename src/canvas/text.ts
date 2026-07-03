// Copyright 2023 Im-Beast. MIT license.
import { DrawObject, DrawObjectOptions } from "./draw_object.ts";

import { getMultiCodePointCharacters, textWidth } from "../utils/strings.ts";
import { fitsInRectangle, rectangleEquals, rectangleIntersection } from "../utils/numbers.ts";
import { Effect, Signal, SignalOfObject } from "../signals/mod.ts";
import { Rectangle } from "../types.ts";
import { signalify } from "../utils/signals.ts";
import { Subscription } from "../signals/types.ts";
import type { DirtyRowSegment } from "./dirty_region.ts";

/**
 * Type that describes position and size of TextObject
 *
 * When `width` isn't set, it gets automatically calculated depending of given `value` text width
 */
export type TextRectangle = { column: number; row: number; width?: number };

/** Options for configuring text Object. */
export interface TextObjectOptions extends DrawObjectOptions {
  value: string | Signal<string>;
  overwriteRectangle?: boolean | Signal<boolean>;
  rectangle: TextRectangle | SignalOfObject<TextRectangle>;
  multiCodePointSupport?: boolean | Signal<boolean>;
}

/**
 * DrawObject that's responsible for rendering text.
 *
 * Keep in mind its not designed to render mutliline text!
 */
export class TextObject extends DrawObject<"text"> {
  text: Signal<string>;
  valueChars: string[] | string;
  overwriteRectangle: Signal<boolean>;
  multiCodePointSupport: Signal<boolean>;
  rerenderRanges: DirtyRowSegment[][];

  #rectangleSubscription: Subscription<Rectangle>;
  #updateEffect: Effect;

  constructor(options: TextObjectOptions) {
    super("text", options);

    this.text = signalify(options.value);
    this.rectangle = signalify(options.rectangle as Rectangle);
    this.overwriteRectangle = signalify(options.overwriteRectangle ?? false);
    this.multiCodePointSupport = signalify(options.multiCodePointSupport ?? false);
    this.valueChars = this.multiCodePointSupport.value ? getMultiCodePointCharacters(this.text.value) : this.text.value;
    this.rerenderRanges = [];

    const { updateObjects } = this.canvas;

    const update = (
      text: string,
      rectangle: Rectangle,
      multiCodePointSupport: boolean,
      overwriteRectangle: boolean,
    ): void => {
      if (!overwriteRectangle) {
        const lastWidth = rectangle.width;
        rectangle.width = textWidth(text);

        if (rectangle.width !== lastWidth) {
          this.moved = true;
          for (const objectUnder of this.objectsUnder) {
            objectUnder.moved = true;
          }
        }
      }
      rectangle.height = 1;

      const { valueChars: previousValueChars } = this;
      const valueChars: string | string[] = this.valueChars = multiCodePointSupport
        ? getMultiCodePointCharacters(text)
        : text;

      const { row, column, width } = rectangle;
      const barrier = overwriteRectangle
        ? (width < previousValueChars.length ? width : -1)
        : (valueChars.length < previousValueChars.length ? valueChars.length : -1);

      const columnRange = Math.max(valueChars.length, previousValueChars.length);
      if (overwriteRectangle && width !== undefined && valueChars.length >= width) {
        this.queueRerenderRange(row, column, column + width);
        return;
      }

      if (barrier !== -1) {
        for (let c = 0; c < columnRange; ++c) {
          if (c >= barrier) {
            for (const objectUnder of this.objectsUnder) {
              objectUnder.queueRerender(row, column + c);
            }
          } else if (valueChars[c] !== previousValueChars[c]) {
            this.queueRerender(row, column + c);
          }
        }
      } else {
        for (let c = 0; c < columnRange; ++c) {
          if (valueChars[c] !== previousValueChars[c]) {
            this.queueRerender(row, column + c);
          }
        }
      }
    };

    this.#rectangleSubscription = (rectangle) => {
      const text = this.text.peek();
      const multiCodePointSupport = this.multiCodePointSupport.peek();
      const overwriteRectangle = this.overwriteRectangle.peek();

      this.moved = true;
      this.updated = false;
      updateObjects.push(this);
      for (const objectUnder of this.objectsUnder) {
        objectUnder.moved = true;
        objectUnder.updated = false;
        updateObjects.push(objectUnder);
      }

      update(text, rectangle, multiCodePointSupport, overwriteRectangle);
    };

    this.#updateEffect = new Effect(() => {
      const text = this.text.value;
      const rectangle = this.rectangle.peek();
      const overwriteRectangle = this.overwriteRectangle.value;
      const multiCodePointSupport = this.multiCodePointSupport.value;

      this.updated = false;
      updateObjects.push(this);

      for (const objectUnder of this.objectsUnder) {
        objectUnder.updated = false;
        updateObjects.push(objectUnder);
      }

      update(text, rectangle, multiCodePointSupport, overwriteRectangle);
    });
  }

  override draw(): void {
    this.#updateEffect.resume();
    this.rectangle.subscribe(this.#rectangleSubscription);
    super.draw();
  }

  override erase(): void {
    this.#updateEffect.pause();
    this.rectangle.unsubscribe(this.#rectangleSubscription);
    super.erase();
  }

  override queueRerender(row: number, column: number): void {
    this.queueRerenderRange(row, column, column + 1);
  }

  override queueRerenderRange(row: number, startColumn: number, endColumn: number): void {
    const viewRectangle = this.view.peek()?.rectangle?.peek();
    if (row < 0) return;
    const { columns, rows } = this.canvas.size.peek();
    if (row >= rows) return;

    let start = Math.max(0, Math.floor(startColumn));
    let end = Math.min(columns, Math.ceil(endColumn));
    if (viewRectangle) {
      if (row < viewRectangle.row || row >= viewRectangle.row + viewRectangle.height) return;
      start = Math.max(start, viewRectangle.column);
      end = Math.min(end, viewRectangle.column + viewRectangle.width);
    }
    if (end <= start) return;

    const normalizedRow = Math.floor(row);
    const ranges = this.rerenderRanges[normalizedRow] ??= [];
    ranges.push({ row: normalizedRow, startColumn: start, endColumn: end });
  }

  override updateMovement(): void {
    const { objectsUnder, previousRectangle } = this;
    const rectangle = this.rectangle.peek();

    // Rerender cells that changed because objects position changed
    if (!previousRectangle || rectangleEquals(rectangle, previousRectangle)) return;

    const intersection = rectangleIntersection(rectangle, previousRectangle, true);

    const previousRow = previousRectangle.row;
    const previousColumnRange = previousRectangle.column + previousRectangle.width;
    for (let column = previousRectangle.column; column < previousColumnRange; ++column) {
      if (intersection && fitsInRectangle(column, previousRow, intersection)) {
        continue;
      }

      for (const objectUnder of objectsUnder) {
        objectUnder.queueRerender(previousRow, column);
      }
    }

    const hasOriginMoved = rectangle.column !== previousRectangle.column || rectangle.row !== previousRectangle.row;

    const { row } = rectangle;
    const columnRange = rectangle.column + rectangle.width;
    for (let column = rectangle.column; column < columnRange; ++column) {
      // When text moves it needs to be rerendered completely because of text continuity
      if (hasOriginMoved) this.queueRerender(row, column);

      if (intersection && fitsInRectangle(column, row, intersection)) {
        continue;
      }

      for (const objectUnder of objectsUnder) {
        objectUnder.queueRerender(row, column);
      }
    }
  }

  override rerender(): void {
    const { canvas, valueChars, omitCells, rerenderCells, rerenderRanges } = this;

    const { frameBuffer, rerenderQueue } = canvas;
    const { columns, rows } = canvas.size.peek();

    const rectangle = this.rectangle.peek();
    const style = this.style.peek();

    const { row } = rectangle;

    let rowRange = Math.min(row, rows);
    let columnRange = Math.min(rectangle.column + valueChars.length, columns);

    const viewRectangle = this.view.peek()?.rectangle?.peek();
    if (viewRectangle) {
      rowRange = Math.min(row, viewRectangle.row + viewRectangle.height);
      columnRange = Math.min(columnRange, viewRectangle.column + viewRectangle.width);
    }

    if (row > rowRange) return;

    const rerenderColumns = rerenderCells[row];
    const ranges = rerenderRanges[row];
    if (!rerenderColumns?.size && !ranges?.length) return;

    const omitColumns = omitCells[row];
    if (omitColumns?.size === valueChars.length) {
      rerenderColumns?.clear();
      if (ranges) ranges.length = 0;
      return;
    }

    const rowBuffer = frameBuffer[row] ??= [];

    const rerenderQueueRow = rerenderQueue[row] ??= new Set();

    if (ranges?.length) {
      mergeTextRowRanges(ranges);
      const directRanges = omitColumns?.size ? undefined : canvas.rerenderRanges[row] ??= [];
      for (const range of ranges) {
        const start = Math.max(range.startColumn, rectangle.column);
        const end = Math.min(range.endColumn, columnRange);
        if (end <= start) continue;
        for (let column = start; column < end; column += 1) {
          if (omitColumns?.has(column)) continue;
          rowBuffer[column] = style(valueChars[column - rectangle.column] ?? " ");
          if (!directRanges) rerenderQueueRow.add(column);
        }
        if (directRanges) directRanges.push({ row, startColumn: start, endColumn: end });
      }
      ranges.length = 0;
    }

    if (rerenderColumns?.size) {
      for (const column of rerenderColumns) {
        if (
          column >= columnRange ||
          column < rectangle.column ||
          omitColumns?.has(column)
        ) {
          continue;
        }

        rowBuffer[column] = style(valueChars[column - rectangle.column]);
        rerenderQueueRow.add(column);
      }

      rerenderColumns.clear();
    }
  }
}

function mergeTextRowRanges(ranges: DirtyRowSegment[]): void {
  if (ranges.length < 2) return;
  ranges.sort((left, right) => left.startColumn - right.startColumn || left.endColumn - right.endColumn);

  let writeIndex = 0;
  for (let readIndex = 1; readIndex < ranges.length; readIndex += 1) {
    const active = ranges[writeIndex]!;
    const next = ranges[readIndex]!;
    if (next.startColumn <= active.endColumn) {
      active.endColumn = Math.max(active.endColumn, next.endColumn);
      continue;
    }
    writeIndex += 1;
    ranges[writeIndex] = next;
  }
  ranges.length = writeIndex + 1;
}
