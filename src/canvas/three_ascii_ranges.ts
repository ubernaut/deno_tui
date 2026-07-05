// Copyright 2023 Im-Beast. MIT license.
import type { DirtyRowSegment } from "./dirty_region.ts";

export interface ApplyThreeAsciiRerenderRangesOptions {
  frameRow: (string | Uint8Array)[];
  outputRow: readonly string[] | undefined;
  ranges: DirtyRowSegment[];
  row: number;
  rectangleColumn: number;
  columnLimit: number;
  omitColumns?: ReadonlySet<number>;
  directRanges?: DirtyRowSegment[];
  fallbackCells?: Set<number>;
}

export interface ApplyThreeAsciiRerenderCellsOptions {
  frameRow: (string | Uint8Array)[];
  outputRow: readonly string[] | undefined;
  columns: ReadonlySet<number>;
  rectangleColumn: number;
  columnLimit: number;
  omitColumns?: ReadonlySet<number>;
  queueCells: Set<number>;
}

export function applyThreeAsciiRerenderRanges(options: ApplyThreeAsciiRerenderRangesOptions): void {
  const {
    frameRow,
    outputRow,
    ranges,
    row,
    rectangleColumn,
    columnLimit,
    omitColumns,
    directRanges,
    fallbackCells,
  } = options;
  const hasOmissions = !!omitColumns?.size;

  for (const range of ranges) {
    const start = Math.max(range.startColumn, rectangleColumn);
    const end = Math.min(range.endColumn, columnLimit);
    if (end <= start) continue;

    if (!hasOmissions) {
      copyThreeAsciiRange(frameRow, outputRow, rectangleColumn, start, end);
      directRanges?.push({ row, startColumn: start, endColumn: end });
      continue;
    }

    for (let column = start; column < end; column += 1) {
      if (omitColumns!.has(column)) continue;
      frameRow[column] = outputRow?.[column - rectangleColumn] ?? " ";
      fallbackCells?.add(column);
    }
  }
}

export function applyThreeAsciiRerenderCells(options: ApplyThreeAsciiRerenderCellsOptions): void {
  const { frameRow, outputRow, columns, rectangleColumn, columnLimit, omitColumns, queueCells } = options;
  for (const column of columns) {
    if (column < rectangleColumn || column >= columnLimit || omitColumns?.has(column)) continue;
    frameRow[column] = outputRow?.[column - rectangleColumn] ?? " ";
    queueCells.add(column);
  }
}

function copyThreeAsciiRange(
  frameRow: (string | Uint8Array)[],
  outputRow: readonly string[] | undefined,
  rectangleColumn: number,
  start: number,
  end: number,
): void {
  if (frameRow.length < end) frameRow.length = end;
  if (!outputRow) {
    frameRow.fill(" ", start, end);
    return;
  }

  let column = start;
  let sourceColumn = start - rectangleColumn;
  while (column < end) {
    const cell = outputRow[sourceColumn] ?? " ";
    let nextColumn = column + 1;
    let nextSourceColumn = sourceColumn + 1;
    while (nextColumn < end && (outputRow[nextSourceColumn] ?? " ") === cell) {
      nextColumn += 1;
      nextSourceColumn += 1;
    }

    if (nextColumn - column === 1) {
      frameRow[column] = cell;
    } else {
      frameRow.fill(cell, column, nextColumn);
    }
    column = nextColumn;
    sourceColumn = nextSourceColumn;
  }
}
