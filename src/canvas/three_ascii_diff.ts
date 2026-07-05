// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import type { DirtyRowSegment } from "./dirty_region.ts";
import { queueRerenderCellInto, queueRerenderRangeInto, queueRerenderRangeOnlyInto } from "./rerender_queue.ts";

/** Terminal canvas size used when clipping changed three ASCII grid cells. */
export interface ThreeAsciiDiffCanvasSize {
  columns: number;
  rows: number;
}

/** Mutable queue shape used by DrawObject rerender scheduling. */
export type ThreeAsciiDiffQueue = Array<Set<number> | undefined>;
export type ThreeAsciiDiffRangeQueue = Array<DirtyRowSegment[] | undefined>;

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
  rerenderRanges?: ThreeAsciiDiffRangeQueue,
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
        rerenderRanges,
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
      rerenderRanges,
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
  rerenderRanges?: ThreeAsciiDiffRangeQueue;
}

interface QueueFullyVisibleIntegerCellsOptions extends QueueChangedCellsInternalOptions {
  rerenderCells: ThreeAsciiDiffQueue;
  rerenderRanges?: ThreeAsciiDiffRangeQueue;
}

function queueChangedFullyVisibleIntegerCells(options: QueueFullyVisibleIntegerCellsOptions): boolean {
  const { grid, rectangle, rerenderCells, rerenderRanges, previous, cacheValid, columns, rows } = options;
  if (rerenderRanges) {
    return queueChangedFullyVisibleIntegerRanges({
      grid,
      rectangle,
      previous,
      cacheValid,
      columns,
      rows,
      rerenderRanges,
    });
  }

  let changed = false;
  const rectangleColumn = rectangle.column;
  const rectangleRow = rectangle.row;
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangleRow + row;
    let runStart = -1;

    if (outputRow && outputRow.length >= columns) {
      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const cell = outputRow[column] as string;
        if (cacheValid && previousCells[index] === cell) {
          if (runStart !== -1) {
            queueFullyVisibleCellRun(rerenderCells, canvasRow, rectangleColumn + runStart, rectangleColumn + column);
            runStart = -1;
          }
          continue;
        }
        previousCells[index] = cell;
        if (runStart === -1) runStart = column;
        changed = true;
      }
      if (runStart !== -1) {
        queueFullyVisibleCellRun(rerenderCells, canvasRow, rectangleColumn + runStart, rectangleColumn + columns);
      }
      continue;
    }

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previousCells[index] === cell) {
        if (runStart !== -1) {
          queueFullyVisibleCellRun(rerenderCells, canvasRow, rectangleColumn + runStart, rectangleColumn + column);
          runStart = -1;
        }
        continue;
      }
      previousCells[index] = cell;
      if (runStart === -1) runStart = column;
      changed = true;
    }
    if (runStart !== -1) {
      queueFullyVisibleCellRun(rerenderCells, canvasRow, rectangleColumn + runStart, rectangleColumn + columns);
    }
  }

  return changed;
}

interface QueueFullyVisibleIntegerRangesOptions extends QueueChangedCellsInternalOptions {
  rerenderRanges: ThreeAsciiDiffRangeQueue;
}

function queueChangedFullyVisibleIntegerRanges(options: QueueFullyVisibleIntegerRangesOptions): boolean {
  const { grid, rectangle, rerenderRanges, previous, cacheValid, columns, rows } = options;
  if (!cacheValid) {
    return queueInitialFullyVisibleIntegerRanges(options);
  }
  let changed = false;
  const rectangleColumn = rectangle.column;
  const rectangleRow = rectangle.row;
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangleRow + row;
    let runStart = -1;

    if (outputRow && outputRow.length >= columns) {
      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const cell = outputRow[column] as string;
        if (cacheValid && previousCells[index] === cell) {
          if (runStart !== -1) {
            queueFullyVisibleRangeRun(rerenderRanges, canvasRow, rectangleColumn + runStart, rectangleColumn + column);
            runStart = -1;
          }
          continue;
        }
        previousCells[index] = cell;
        if (runStart === -1) runStart = column;
        changed = true;
      }
      if (runStart !== -1) {
        queueFullyVisibleRangeRun(rerenderRanges, canvasRow, rectangleColumn + runStart, rectangleColumn + columns);
      }
      continue;
    }

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previousCells[index] === cell) {
        if (runStart !== -1) {
          queueFullyVisibleRangeRun(rerenderRanges, canvasRow, rectangleColumn + runStart, rectangleColumn + column);
          runStart = -1;
        }
        continue;
      }
      previousCells[index] = cell;
      if (runStart === -1) runStart = column;
      changed = true;
    }
    if (runStart !== -1) {
      queueFullyVisibleRangeRun(rerenderRanges, canvasRow, rectangleColumn + runStart, rectangleColumn + columns);
    }
  }

  return changed;
}

function queueInitialFullyVisibleIntegerRanges(options: QueueFullyVisibleIntegerRangesOptions): boolean {
  const { grid, rectangle, rerenderRanges, previous, columns, rows } = options;
  const rectangleColumn = rectangle.column;
  const rectangleRow = rectangle.row;
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    if (outputRow && outputRow.length >= columns) {
      for (let column = 0; column < columns; column += 1) {
        previousCells[rowOffset + column] = outputRow[column] as string;
      }
    } else {
      for (let column = 0; column < columns; column += 1) {
        previousCells[rowOffset + column] = outputRow?.[column] ?? " ";
      }
    }
    queueFullyVisibleRangeRun(
      rerenderRanges,
      rectangleRow + row,
      rectangleColumn,
      rectangleColumn + columns,
    );
  }

  return rows > 0 && columns > 0;
}

function queueChangedIntegerAlignedCells(options: QueueIntegerAlignedCellsOptions): boolean {
  const {
    grid,
    rectangle,
    canvasSize,
    viewRectangle,
    rerenderCells,
    rerenderRanges,
    previous,
    cacheValid,
    columns,
    rows,
  } = options;
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
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangleRow + row;
    const rowVisible = canvasRow >= 0 && canvasRow < canvasSize.rows &&
      (!viewRectangle || (canvasRow >= viewRectangle.row && canvasRow < viewRectangle.row + viewRectangle.height));
    let runStart = -1;

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previousCells[index] === cell) {
        if (runStart !== -1 && rowVisible) {
          queueChangedRun(
            rerenderCells,
            rerenderRanges,
            canvasRow,
            rectangleColumn + runStart,
            rectangleColumn + column,
            canvasSize,
            viewRectangle,
          );
          runStart = -1;
        }
        continue;
      }
      previousCells[index] = cell;
      if (
        rowVisible && column >= visibleGridColumnStart && column < visibleGridColumnEnd
      ) {
        if (runStart === -1) runStart = column;
      } else if (runStart !== -1) {
        queueChangedRun(
          rerenderCells,
          rerenderRanges,
          canvasRow,
          rectangleColumn + runStart,
          rectangleColumn + column,
          canvasSize,
          viewRectangle,
        );
        runStart = -1;
      }
      changed = true;
    }
    if (runStart !== -1 && rowVisible) {
      queueChangedRun(
        rerenderCells,
        rerenderRanges,
        canvasRow,
        rectangleColumn + runStart,
        rectangleColumn + columns,
        canvasSize,
        viewRectangle,
      );
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
  const previousCells = previous.cells;

  for (let row = 0; row < rows; row += 1) {
    const outputRow = grid[row];
    const rowOffset = row * columns;
    const canvasRow = rectangle.row + row;

    for (let column = 0; column < columns; column += 1) {
      const index = rowOffset + column;
      const cell = outputRow?.[column] ?? " ";
      if (cacheValid && previousCells[index] === cell) continue;
      previousCells[index] = cell;
      queueFractionalRerenderCell(options, canvasRow, rectangle.column + column);
      changed = true;
    }
  }

  return changed;
}

function queueFractionalRerenderCell(options: QueueFractionalCellsOptions, row: number, column: number): void {
  const canvasRow = Math.floor(row);
  queueRerenderCellInto(
    options.rerenderCells,
    canvasRow,
    column,
    options.canvasSize,
    options.viewRectangle,
  );
}

function queueChangedRun(
  rerenderCells: ThreeAsciiDiffQueue,
  rerenderRanges: ThreeAsciiDiffRangeQueue | undefined,
  row: number,
  startColumn: number,
  endColumn: number,
  canvasSize: ThreeAsciiDiffCanvasSize,
  viewRectangle?: Rectangle,
): void {
  if (rerenderRanges) {
    queueRerenderRangeOnlyInto(rerenderRanges, row, startColumn, endColumn, canvasSize, viewRectangle);
    return;
  }
  queueRerenderRangeInto(rerenderCells, row, startColumn, endColumn, canvasSize, viewRectangle);
}

function queueFullyVisibleCellRun(
  rerenderCells: ThreeAsciiDiffQueue,
  row: number,
  startColumn: number,
  endColumn: number,
): void {
  const queueRow = rerenderCells[row] ??= new Set<number>();
  for (let column = startColumn; column < endColumn; column += 1) {
    queueRow.add(column);
  }
}

function queueFullyVisibleRangeRun(
  rerenderRanges: ThreeAsciiDiffRangeQueue,
  row: number,
  startColumn: number,
  endColumn: number,
): void {
  (rerenderRanges[row] ??= []).push({ row, startColumn, endColumn });
}
