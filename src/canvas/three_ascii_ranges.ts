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
  let sourceColumn = start - rectangleColumn;
  for (let column = start; column < end; column += 1) {
    frameRow[column] = outputRow?.[sourceColumn] ?? " ";
    sourceColumn += 1;
  }
}
