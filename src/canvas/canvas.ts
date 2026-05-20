// Copyright 2023 Im-Beast. MIT license.

// TODO; on style change, dont update intersections, just clear current ones
import { EmitterEvent, EventEmitter } from "../event_emitter.ts";

import { moveCursor } from "../utils/ansi_codes.ts";
import { SortedArray } from "../utils/sorted_array.ts";
import { rectangleIntersection } from "../utils/numbers.ts";

import type { ConsoleSize, Stdout } from "../types.ts";
import { DrawObject } from "./draw_object.ts";
import { Signal, SignalOfObject } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";

const textEncoder = new TextEncoder();
const DRAW_SEQUENCE_FLUSH_LIMIT = Deno.build.os === "windows" ? 1024 : 16384;

/** Interface defining object that {Canvas}'s constructor can interpret */
export interface CanvasOptions {
  /** Stdout to which canvas will render frameBuffer */
  stdout: Stdout;
  size: ConsoleSize | SignalOfObject<ConsoleSize>;
}

/** Map that contains events that {Canvas} can dispatch */
export type CanvasEventMap = {
  render: EmitterEvent<[]>;
};

/**
 * Object, which stores data about currently rendered objects.
 *
 * It is responsible for outputting to stdout.
 */
export class Canvas extends EventEmitter<CanvasEventMap> {
  stdout: Stdout;
  size: Signal<ConsoleSize>;
  rerenderedObjects?: number;
  frameBuffer: (string | Uint8Array)[][];
  rerenderQueue: Set<number>[];
  drawnObjects: SortedArray<DrawObject>;
  updateObjects: DrawObject[];
  resizeNeeded: boolean;

  constructor(options: CanvasOptions) {
    super();

    this.frameBuffer = [];
    this.rerenderQueue = [];
    this.stdout = options.stdout;
    this.drawnObjects = new SortedArray((a, b) => a.zIndex.peek() - b.zIndex.peek() || a.id - b.id);
    this.updateObjects = [];
    this.resizeNeeded = false;

    this.size = signalify(options.size, { deepObserve: true });

    this.size.subscribe(() => {
      this.resizeNeeded = true;
    });
  }

  resize() {
    const { columns, rows } = this.size.peek();

    for (const drawObject of this.drawnObjects) {
      const { column, row } = drawObject.rectangle.peek();
      if (column >= columns || row >= rows) continue;

      drawObject.rendered = false;
      drawObject.updated = false;
      this.updateObjects.push(drawObject);
    }
  }

  updateIntersections(object: DrawObject): void {
    const { omitCells, objectsUnder } = object;

    const zIndex = object.zIndex.peek();
    const rectangle = object.rectangle.peek();

    for (const omitRows of omitCells) {
      omitRows?.clear();
    }

    objectsUnder.clear();

    for (const object2 of this.drawnObjects) {
      if (object === object2 || object2.outOfBounds) continue;

      const zIndex2 = object2.zIndex.peek();

      if (zIndex2 < zIndex || (zIndex2 === zIndex && object2.id < object.id)) {
        if (rectangleIntersection(rectangle, object2.rectangle.peek(), false)) {
          objectsUnder.add(object2);
        }
        continue;
      }

      const intersection = rectangleIntersection(rectangle, object2.rectangle.peek(), true);

      if (!intersection) continue;

      const rowRange = intersection.row + intersection.height;
      const columnRange = intersection.column + intersection.width;
      for (let row = intersection.row; row < rowRange; ++row) {
        const omitColumns = omitCells[row] ??= new Set();

        for (let column = intersection.column; column < columnRange; ++column) {
          omitColumns.add(column);
        }
      }
    }
  }

  render(): void {
    const { stdout, frameBuffer, updateObjects } = this;

    if (this.resizeNeeded) {
      this.resize();
      this.resizeNeeded = false;
    }

    if (!updateObjects.length) {
      return;
    }

    const objectsToUpdate: DrawObject[] = [];
    const seenObjects = new Set<DrawObject>();

    while (updateObjects.length) {
      const object = updateObjects.pop()!;
      if (seenObjects.has(object)) {
        continue;
      }
      seenObjects.add(object);
      objectsToUpdate.push(object);
    }

    objectsToUpdate.sort((a, b) => b.zIndex.peek() - a.zIndex.peek() || b.id - a.id);

    let i = 0;
    let intersectionsDirty = false;

    for (const object of objectsToUpdate) {
      object.updated = true;
      ++i;
      object.update();

      object.updateMovement();
      object.updatePreviousRectangle();
      object.updateOutOfBounds();

      if (object.outOfBounds) {
        object.rendered = false;
      }

      intersectionsDirty ||= object.moved;
    }

    const objectsToRender = intersectionsDirty ? [...this.drawnObjects] : objectsToUpdate;
    if (intersectionsDirty) {
      objectsToRender.sort((a, b) => b.zIndex.peek() - a.zIndex.peek() || b.id - a.id);
      for (const object of objectsToRender) {
        this.updateIntersections(object);
        object.moved = false;
        if (!object.outOfBounds) {
          object.rendered = false;
        }
      }
    } else {
      for (const object of objectsToRender) {
        object.moved = false;
      }
    }

    for (const object of objectsToRender) {
      if (object.outOfBounds) {
        continue;
      }

      if (object.rendered) {
        object.rerender();
      } else {
        object.render();
        object.rendered = true;
      }
    }

    this.rerenderedObjects = i;

    let drawSequence = "";
    let lastRow = -1;
    let lastColumn = -1;

    const { rerenderQueue } = this;
    const size = this.size.peek();

    for (let row = 0; row < size.rows; ++row) {
      const columns = rerenderQueue[row];
      if (!columns?.size) continue;

      const rowBuffer = frameBuffer[row] ??= [];

      for (const column of columns) {
        if (row !== lastRow || column !== lastColumn + 1) {
          drawSequence += moveCursor(row, column);
        }

        const cell = rowBuffer[column];

        // This is required to render properly on windows
        if (drawSequence.length + cell.length > DRAW_SEQUENCE_FLUSH_LIMIT) {
          stdout.writeSync(textEncoder.encode(moveCursor(lastRow, lastColumn) + drawSequence));
          drawSequence = moveCursor(row, column);
        }

        drawSequence += cell;

        lastRow = row;
        lastColumn = column;
      }

      columns.clear();
    }

    // Complete final loop draw sequence
    if (drawSequence.length > 0) {
      stdout.writeSync(textEncoder.encode(moveCursor(lastRow, lastColumn) + drawSequence));
    }

    this.emit("render");
  }
}
