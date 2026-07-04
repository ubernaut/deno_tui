// Copyright 2023 Im-Beast. MIT license.
import { DrawObject, DrawObjectOptions } from "./draw_object.ts";
import { Signal, SignalOfObject } from "../signals/mod.ts";

import type { Rectangle } from "../types.ts";
import { signalify } from "../utils/signals.ts";
import { Subscription } from "../signals/types.ts";
import { type DirtyRowSegment, mergeDirtyRowSegmentsInPlace } from "./dirty_region.ts";

/** Options for configuring box Object. */
export interface BoxObjectOptions extends DrawObjectOptions {
  rectangle: Rectangle | SignalOfObject<Rectangle>;
  filler?: string | Signal<string>;
}

/**
 * DrawObject that's responsible for rendering rectangles (boxes).
 */
export class BoxObject extends DrawObject<"box"> {
  filler: Signal<string>;
  rerenderRanges: DirtyRowSegment[][];

  #rectangleSubscription: Subscription<Rectangle>;

  constructor(options: BoxObjectOptions) {
    super("box", options);

    this.rectangle = signalify(options.rectangle);
    this.filler = signalify(options.filler ?? " ");
    this.rerenderRanges = [];

    const { updateObjects } = this.canvas;

    this.#rectangleSubscription = () => {
      this.moved = true;
      this.updated = false;
      updateObjects.push(this);

      for (const objectUnder of this.objectsUnder) {
        objectUnder.moved = true;
        objectUnder.updated = false;
        updateObjects.push(objectUnder);
      }
    };
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

  override draw(): void {
    this.rectangle.subscribe(this.#rectangleSubscription);
    super.draw();
  }

  override erase(): void {
    this.rectangle.unsubscribe(this.#rectangleSubscription);
    super.erase();
  }

  override rerender(): void {
    const { canvas, rerenderCells, rerenderRanges, omitCells } = this;
    const { frameBuffer, rerenderQueue, rerenderRanges: canvasRerenderRanges } = canvas;
    const { rows, columns } = canvas.size.peek();

    const rectangle = this.rectangle.peek();
    const style = this.style.peek();
    const filler = this.filler.peek();
    const styledFiller = style(filler);

    let rowRange = Math.min(rectangle.row + rectangle.height, rows);
    let columnRange = Math.min(rectangle.column + rectangle.width, columns);

    const viewRectangle = this.view.peek()?.rectangle?.peek();
    if (viewRectangle) {
      rowRange = Math.min(rowRange, viewRectangle.row + viewRectangle.height);
      columnRange = Math.min(columnRange, viewRectangle.column + viewRectangle.width);
    }

    const rowStart = Math.max(0, Math.floor(rectangle.row));
    const rerenderRowRange = Math.max(rerenderCells.length, rerenderRanges.length);
    for (let row = rowStart; row < rerenderRowRange; ++row) {
      if (row >= rowRange) continue;

      const rerenderColumns = rerenderCells[row];
      const ranges = rerenderRanges[row];
      if (!rerenderColumns?.size && !ranges?.length) continue;

      const omitColumns = omitCells[row];

      if (omitColumns?.size === rectangle.width) {
        rerenderColumns?.clear();
        if (ranges) ranges.length = 0;
        continue;
      }

      const rowBuffer = frameBuffer[row] ??= [];

      if (ranges?.length) {
        mergeDirtyRowSegmentsInPlace(ranges);
        const directRanges = omitColumns?.size ? undefined : canvasRerenderRanges[row] ??= [];
        const rerenderQueueRow = directRanges ? undefined : rerenderQueue[row] ??= new Set();
        for (const range of ranges) {
          const start = Math.max(range.startColumn, rectangle.column);
          const end = Math.min(range.endColumn, columnRange);
          if (directRanges) {
            for (let column = start; column < end; column += 1) {
              rowBuffer[column] = styledFiller;
            }
            directRanges.push({ row, startColumn: start, endColumn: end });
            continue;
          }
          for (let column = start; column < end; column += 1) {
            if (omitColumns?.has(column)) continue;
            rowBuffer[column] = styledFiller;
            rerenderQueueRow!.add(column);
          }
        }
        ranges.length = 0;
      }

      if (rerenderColumns?.size) {
        const rerenderQueueRow = rerenderQueue[row] ??= new Set();
        for (const column of rerenderColumns) {
          if (omitColumns?.has(column) || column < rectangle.column || column >= columnRange) {
            continue;
          }

          rowBuffer[column] = styledFiller;
          rerenderQueueRow.add(column);
        }

        rerenderColumns.clear();
      }
    }
  }
}
