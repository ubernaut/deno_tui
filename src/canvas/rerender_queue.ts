// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import type { DirtyRowSegment } from "./dirty_region.ts";

/** Existing row-indexed rerender queue shape used by canvas draw objects. */
export type RerenderCellQueue = Array<Set<number> | undefined>;

/** Existing row-indexed rerender range queue shape used by dense draw-object paths. */
export type RerenderRangeQueue = Array<DirtyRowSegment[] | undefined>;

/** Terminal canvas size used when clipping queued rerender ranges. */
export interface RerenderQueueCanvasSize {
  columns: number;
  rows: number;
}

/** Result returned after attempting to queue a clipped rerender range. */
export interface QueueRerenderRangeResult {
  row: number;
  startColumn: number;
  endColumn: number;
  queuedCells: number;
}

/** Queue one row range into the legacy per-row cell set after applying canvas and optional view clipping. */
export function queueRerenderRangeInto(
  queue: RerenderCellQueue,
  row: number,
  startColumn: number,
  endColumn: number,
  canvasSize: RerenderQueueCanvasSize,
  viewRectangle?: Rectangle,
): QueueRerenderRangeResult {
  const clipped = clipRerenderRange(row, startColumn, endColumn, canvasSize, viewRectangle);
  if (!clipped) {
    return emptyQueueResult(row);
  }

  const queueRow = queue[clipped.row] ??= new Set<number>();
  const before = queueRow.size;
  for (let column = clipped.startColumn; column < clipped.endColumn; column += 1) {
    queueRow.add(column);
  }
  return {
    row: clipped.row,
    startColumn: clipped.startColumn,
    endColumn: clipped.endColumn,
    queuedCells: queueRow.size - before,
  };
}

/** Queue one row range without expanding it to cells after applying canvas and optional view clipping. */
export function queueRerenderRangeOnlyInto(
  queue: RerenderRangeQueue,
  row: number,
  startColumn: number,
  endColumn: number,
  canvasSize: RerenderQueueCanvasSize,
  viewRectangle?: Rectangle,
): QueueRerenderRangeResult {
  const clipped = clipRerenderRange(row, startColumn, endColumn, canvasSize, viewRectangle);
  if (!clipped) {
    return emptyQueueResult(row);
  }

  const queueRow = queue[clipped.row] ??= [];
  queueRow.push(clipped);
  return {
    row: clipped.row,
    startColumn: clipped.startColumn,
    endColumn: clipped.endColumn,
    queuedCells: clipped.endColumn - clipped.startColumn,
  };
}

/** Queue one floored cell coordinate into the legacy row set after applying canvas and optional view clipping. */
export function queueRerenderCellInto(
  queue: RerenderCellQueue,
  row: number,
  column: number,
  canvasSize: RerenderQueueCanvasSize,
  viewRectangle?: Rectangle,
): QueueRerenderRangeResult {
  const start = Math.floor(column);
  return queueRerenderRangeInto(queue, row, start, start + 1, canvasSize, viewRectangle);
}

function emptyQueueResult(row: number): QueueRerenderRangeResult {
  return { row, startColumn: 0, endColumn: 0, queuedCells: 0 };
}

function clipRerenderRange(
  row: number,
  startColumn: number,
  endColumn: number,
  canvasSize: RerenderQueueCanvasSize,
  viewRectangle?: Rectangle,
): DirtyRowSegment | undefined {
  if (row < 0 || row >= canvasSize.rows) {
    return undefined;
  }

  let start = Math.max(0, Math.floor(startColumn));
  let end = Math.min(canvasSize.columns, Math.ceil(endColumn));
  if (viewRectangle) {
    if (row < viewRectangle.row || row >= viewRectangle.row + viewRectangle.height) {
      return undefined;
    }
    start = Math.max(start, viewRectangle.column);
    end = Math.min(end, viewRectangle.column + viewRectangle.width);
  }
  if (end <= start) {
    return undefined;
  }
  return { row, startColumn: start, endColumn: end };
}
