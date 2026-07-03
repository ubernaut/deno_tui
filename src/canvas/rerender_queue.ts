// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

/** Existing row-indexed rerender queue shape used by canvas draw objects. */
export type RerenderCellQueue = Array<Set<number> | undefined>;

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
  if (row < 0 || row >= canvasSize.rows) {
    return emptyQueueResult(row);
  }

  let start = Math.max(0, Math.floor(startColumn));
  let end = Math.min(canvasSize.columns, Math.ceil(endColumn));
  if (viewRectangle) {
    if (row < viewRectangle.row || row >= viewRectangle.row + viewRectangle.height) {
      return emptyQueueResult(row);
    }
    start = Math.max(start, viewRectangle.column);
    end = Math.min(end, viewRectangle.column + viewRectangle.width);
  }
  if (end <= start) {
    return emptyQueueResult(row);
  }

  const queueRow = queue[row] ??= new Set<number>();
  const before = queueRow.size;
  for (let column = start; column < end; column += 1) {
    queueRow.add(column);
  }
  return { row, startColumn: start, endColumn: end, queuedCells: queueRow.size - before };
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
