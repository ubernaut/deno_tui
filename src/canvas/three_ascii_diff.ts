// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

/** Terminal canvas size used when clipping changed three ASCII grid cells. */
export interface ThreeAsciiDiffCanvasSize {
  columns: number;
  rows: number;
}

/** Mutable queue shape used by DrawObject rerender scheduling. */
export type ThreeAsciiDiffQueue = Array<Set<number> | undefined>;

/** State retained between three ASCII frames so unchanged terminal cells are not queued again. */
export interface ThreeAsciiGridDiffState {
  cells: string[];
  columns: number;
  rows: number;
}

/** Create an empty retained state object for three ASCII grid diffing. */
export function createThreeAsciiGridDiffState(): ThreeAsciiGridDiffState {
  return { cells: [], columns: 0, rows: 0 };
}

/** Clear retained grid-diff state after renderer rebuilds, moves, or invalidation. */
export function clearThreeAsciiGridDiffState(state: ThreeAsciiGridDiffState): void {
  state.cells.length = 0;
  state.columns = 0;
  state.rows = 0;
}

/** Diff a three ASCII grid against the previous frame and queue only visible changed cells. */
export function queueChangedThreeAsciiGridCells(
  grid: readonly (readonly string[] | undefined)[],
  rectangle: Rectangle,
  canvasSize: ThreeAsciiDiffCanvasSize,
  rerenderCells: ThreeAsciiDiffQueue,
  previous: ThreeAsciiGridDiffState,
  viewRectangle?: Rectangle,
): boolean {
  const columns = Math.max(0, rectangle.width);
  const rows = Math.max(0, rectangle.height);
  const cellCount = columns * rows;
  const cacheValid = previous.columns === columns && previous.rows === rows && previous.cells.length === cellCount;

  if (!cacheValid) {
    previous.cells.length = cellCount;
    previous.columns = columns;
    previous.rows = rows;
  }

  if (columns <= 0 || rows <= 0) return false;

  if (Number.isInteger(rectangle.column) && Number.isInteger(rectangle.row)) {
    if (
      viewRectangle === undefined &&
      rectangle.column >= 0 &&
      rectangle.row >= 0 &&
      rectangle.column + columns <= canvasSize.columns &&
      rectangle.row + rows <= canvasSize.rows
    ) {
      return queueChangedFullyVisibleIntegerCells({
        grid,
        rectangle,
        rerenderCells,
        previous,
        cacheValid,
        columns,
        rows,
      });
    }
    return queueChangedIntegerAlignedCells({
      grid,
      rectangle,
      canvasSize,
      viewRectangle,
      rerenderCells,
      previous,
      cacheValid,
      columns,
      rows,
    });
  }

  return queueChangedFractionalCells({
    grid,
    rectangle,
    rerenderCells,
    previous,
    cacheValid,
    columns,
    rows,
    canvasSize,
    viewRectangle,
  });
}

interface QueueChangedCellsInternalOptions {
  grid: readonly (readonly string[] | undefined)[];
  rectangle: Rectangle;
  previous: ThreeAsciiGridDiffState;
  cacheValid: boolean;
  columns: number;
  rows: number;
}

interface QueueIntegerAlignedCellsOptions extends QueueChangedCellsInternalOptions {
  canvasSize: ThreeAsciiDiffCanvasSize;
  rerenderCells: ThreeAsciiDiffQueue;
  viewRectangle?: Rectangle;
}

interface QueueFullyVisibleIntegerCellsOptions extends QueueChangedCellsInternalOptions {
  rerenderCells: ThreeAsciiDiffQueue;
}

function queueChangedFullyVisibleIntegerCells(options: QueueFullyVisibleIntegerCellsOptions): boolean {
  const { grid, rectangle, rerenderCells, previous, cacheValid, columns, rows } = options;
  let changed = false;
  const rectangleColumn = rectangle.column;
  const rectangleRow = rectangle.row;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangleRow + row;
    let queueRow: Set<number> | undefined;

    if (outputRow && outputRow.length >= columns) {
      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const cell = outputRow[column] as string;
        if (cacheValid && previous.cells[index] === cell) continue;
        previous.cells[index] = cell;
        queueRow ??= rerenderCells[canvasRow] ??= new Set<number>();
        queueRow.add(rectangleColumn + column);
        changed = true;
      }
      continue;
    }

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previous.cells[index] === cell) continue;
      previous.cells[index] = cell;
      queueRow ??= rerenderCells[canvasRow] ??= new Set<number>();
      queueRow.add(rectangleColumn + column);
      changed = true;
    }
  }

  return changed;
}

function queueChangedIntegerAlignedCells(options: QueueIntegerAlignedCellsOptions): boolean {
  const { grid, rectangle, canvasSize, viewRectangle, rerenderCells, previous, cacheValid, columns, rows } = options;
  let changed = false;
  const rectangleColumn = rectangle.column;
  const rectangleRow = rectangle.row;
  const canvasColumnStart = Math.max(0, rectangleColumn);
  const canvasColumnEnd = Math.min(canvasSize.columns, rectangleColumn + columns);
  const visibleColumnStart = viewRectangle ? Math.max(canvasColumnStart, viewRectangle.column) : canvasColumnStart;
  const visibleColumnEnd = viewRectangle
    ? Math.min(canvasColumnEnd, viewRectangle.column + viewRectangle.width)
    : canvasColumnEnd;
  const visibleGridColumnStart = Math.max(0, visibleColumnStart - rectangleColumn);
  const visibleGridColumnEnd = Math.min(columns, visibleColumnEnd - rectangleColumn);

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangleRow + row;
    const rowVisible = canvasRow >= 0 && canvasRow < canvasSize.rows &&
      (!viewRectangle || (canvasRow >= viewRectangle.row && canvasRow < viewRectangle.row + viewRectangle.height));
    let queueRow: Set<number> | undefined;

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previous.cells[index] === cell) continue;
      previous.cells[index] = cell;
      if (
        rowVisible && column >= visibleGridColumnStart && column < visibleGridColumnEnd
      ) {
        queueRow ??= rerenderCells[canvasRow] ??= new Set<number>();
        queueRow.add(rectangleColumn + column);
      }
      changed = true;
    }
  }

  return changed;
}

interface QueueFractionalCellsOptions extends QueueChangedCellsInternalOptions {
  canvasSize: ThreeAsciiDiffCanvasSize;
  viewRectangle?: Rectangle;
  rerenderCells: ThreeAsciiDiffQueue;
}

function queueChangedFractionalCells(options: QueueFractionalCellsOptions): boolean {
  const { grid, rectangle, previous, cacheValid, columns, rows } = options;
  let changed = false;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangle.row + row;

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previous.cells[index] === cell) continue;
      previous.cells[index] = cell;
      queueFractionalRerenderCell(options, canvasRow, rectangle.column + column);
      changed = true;
    }
  }

  return changed;
}

function queueFractionalRerenderCell(options: QueueFractionalCellsOptions, row: number, column: number): void {
  if (row < 0) return;
  const canvasRow = Math.floor(row);
  if (canvasRow >= options.canvasSize.rows) return;
  let start = Math.max(0, Math.floor(column));
  const end = Math.min(options.canvasSize.columns, Math.ceil(column + 1));
  const viewRectangle = options.viewRectangle;
  if (viewRectangle) {
    if (canvasRow < viewRectangle.row || canvasRow >= viewRectangle.row + viewRectangle.height) return;
    start = Math.max(start, viewRectangle.column);
    if (Math.min(end, viewRectangle.column + viewRectangle.width) <= start) return;
  } else if (end <= start) {
    return;
  }
  const queueRow = options.rerenderCells[canvasRow] ??= new Set<number>();
  queueRow.add(start);
}
