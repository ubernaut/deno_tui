// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { type WorkbenchFrame, writeFrameCells, writeFrameCellsUnchecked } from "./workbench_frame.ts";

export type WorkbenchThreeGridScaleMode = boolean | "down";

const scaleIndexMetadata = new WeakMap<number[], { targetSize: number; sourceSize: number }>();

export interface WorkbenchThreeGridProjection {
  sourceRows: number;
  sourceColumns: number;
  targetHeight: number;
  targetWidth: number;
  rowOffset: number;
  columnOffset: number;
  scaled: boolean;
  capped: boolean;
}

/** Retained scratch buffers for repeated Three ASCII grid projection. */
export class WorkbenchThreeGridProjectionCache {
  readonly rowBuffer: string[] = [];
  readonly sourceRowIndexes: number[] = [];
  readonly sourceColumnIndexes: number[] = [];
  readonly #options: WorkbenchThreeGridWriteOptions = {
    rowBuffer: this.rowBuffer,
    sourceRowIndexes: this.sourceRowIndexes,
    sourceColumnIndexes: this.sourceColumnIndexes,
  };

  options(
    grid: readonly (readonly string[] | undefined)[],
    scale: WorkbenchThreeGridScaleMode = "down",
  ): WorkbenchThreeGridWriteOptions {
    this.#options.scale = scale;
    this.#options.sourceColumns = grid[0]?.length ?? 0;
    return this.#options;
  }

  clear(): void {
    this.rowBuffer.length = 0;
    this.sourceRowIndexes.length = 0;
    this.sourceColumnIndexes.length = 0;
  }
}

export interface WorkbenchThreeGridWriteOptions {
  scale?: WorkbenchThreeGridScaleMode;
  rowBuffer?: string[];
  sourceColumns?: number;
  sourceRowIndexes?: number[];
  sourceColumnIndexes?: number[];
}

/** Copies a Three ASCII ANSI grid into a workbench frame rectangle. */
export function writeWorkbenchThreeGrid(
  frame: WorkbenchFrame,
  rect: Rectangle,
  grid: readonly (readonly string[] | undefined)[],
  fallbackCell: string,
  options: WorkbenchThreeGridWriteOptions = {},
): WorkbenchThreeGridProjection | undefined {
  const projection = resolveWorkbenchThreeGridProjection(rect, grid, {
    scale: options.scale,
    sourceColumns: options.sourceColumns,
  });
  if (!projection) return undefined;
  const { sourceRows, sourceColumns, targetHeight, targetWidth, rowOffset, columnOffset } = projection;
  const shouldScale = projection.scaled;
  const rowBuffer = options.rowBuffer ?? [];
  const sourceRowIndexes = shouldScale && sourceRows > 0 && sourceRows !== targetHeight
    ? scaledIndexesInto(options.sourceRowIndexes ?? [], targetHeight, sourceRows)
    : undefined;
  const sourceColumnIndexes = shouldScale && options.sourceColumns !== undefined && sourceColumns > 0 &&
      sourceColumns !== targetWidth
    ? scaledIndexesInto(options.sourceColumnIndexes ?? [], targetWidth, sourceColumns)
    : undefined;
  let lastProjectedSourceRow = -1;
  let lastProjectedRow: readonly string[] | undefined;
  let lastProjectedFallback = false;

  for (let row = 0; row < targetHeight; row += 1) {
    const sourceRow = sourceRowIndexes?.[row] ?? row;
    const source = grid[sourceRow];
    const sourceWidth = source?.length ?? 0;
    const target = frame[rect.row + rowOffset + row] ??= [];
    if (!source || sourceWidth <= 0) {
      if (lastProjectedFallback && lastProjectedRow && lastProjectedRow.length >= targetWidth) {
        writeProjectedGridRow(target, rect.column + columnOffset, lastProjectedRow, targetWidth);
        continue;
      }
      rowBuffer.length = targetWidth;
      rowBuffer.fill(fallbackCell, 0, targetWidth);
      writeProjectedGridRow(target, rect.column + columnOffset, rowBuffer, targetWidth);
      lastProjectedSourceRow = -1;
      lastProjectedFallback = true;
      lastProjectedRow = rowBuffer;
      continue;
    }
    if (sourceRow === lastProjectedSourceRow && lastProjectedRow && lastProjectedRow.length >= targetWidth) {
      writeProjectedGridRow(target, rect.column + columnOffset, lastProjectedRow, targetWidth);
      continue;
    }
    lastProjectedFallback = false;

    if (shouldScale && source && sourceColumns === targetWidth && sourceWidth >= sourceColumns && sourceColumns > 0) {
      writeProjectedGridRow(target, rect.column + columnOffset, source, targetWidth);
      lastProjectedSourceRow = sourceRow;
      lastProjectedRow = source;
      continue;
    }

    if (shouldScale && source && sourceColumnIndexes && sourceWidth >= sourceColumns && sourceColumns > 0) {
      projectScaledGridRowInto(rowBuffer, source, sourceColumnIndexes, targetWidth, fallbackCell);
      writeProjectedGridRow(target, rect.column + columnOffset, rowBuffer, targetWidth);
      lastProjectedSourceRow = sourceRow;
      lastProjectedRow = rowBuffer;
      continue;
    }

    if (shouldScale && source && sourceWidth === targetWidth && !sourceColumnIndexes) {
      writeProjectedGridRow(target, rect.column + columnOffset, source, targetWidth);
      lastProjectedSourceRow = sourceRow;
      lastProjectedRow = source;
      continue;
    }

    if (!shouldScale && source && sourceWidth >= targetWidth) {
      writeProjectedGridRow(target, rect.column + columnOffset, source, targetWidth);
      lastProjectedSourceRow = sourceRow;
      lastProjectedRow = source;
      continue;
    }

    rowBuffer.length = targetWidth;
    for (let column = 0; column < targetWidth; column += 1) {
      const sourceColumn = sourceColumnIndexes?.[column] ??
        (shouldScale && sourceWidth > 0
          ? Math.min(sourceWidth - 1, Math.floor((column * sourceWidth) / targetWidth))
          : column);
      rowBuffer[column] = source?.[sourceColumn] ?? fallbackCell;
    }
    writeProjectedGridRow(target, rect.column + columnOffset, rowBuffer, targetWidth);
    lastProjectedSourceRow = sourceRow;
    lastProjectedRow = rowBuffer;
  }
  return projection;
}

function writeProjectedGridRow(
  target: string[],
  column: number,
  values: readonly string[],
  targetWidth: number,
): void {
  if (column < 0 || targetWidth > values.length) {
    writeFrameCells(target, column, values, 0, targetWidth);
    return;
  }
  if (column === 0 && target.length < targetWidth) target.length = targetWidth;
  writeFrameCellsUnchecked(target, column, values, targetWidth);
}

function projectScaledGridRowInto(
  target: string[],
  source: readonly string[],
  sourceColumnIndexes: readonly number[],
  targetWidth: number,
  fallbackCell: string,
): string[] {
  target.length = targetWidth;
  for (let column = 0; column < targetWidth;) {
    const sourceColumn = sourceColumnIndexes[column]!;
    const cell = source[sourceColumn] ?? fallbackCell;
    let next = column + 1;
    while (next < targetWidth && sourceColumnIndexes[next] === sourceColumn) {
      next += 1;
    }
    if (next - column === 1) {
      target[column] = cell;
    } else {
      target.fill(cell, column, next);
    }
    column = next;
  }
  return target;
}

export function resolveWorkbenchThreeGridProjection(
  rect: Pick<Rectangle, "width" | "height">,
  grid: readonly (readonly string[] | undefined)[],
  options: {
    scale?: WorkbenchThreeGridScaleMode;
    sourceColumns?: number;
  } = {},
): WorkbenchThreeGridProjection | undefined {
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  const sourceRows = grid.length;
  const sourceColumns = options.sourceColumns === undefined
    ? maxGridColumns(grid)
    : Math.max(0, Math.floor(options.sourceColumns));
  const scaleMode = options.scale;
  const scaled = scaleMode === true ||
    (scaleMode === "down" && (sourceRows > rect.height || sourceColumns > rect.width));
  const capped = scaleMode === "down" && !scaled;
  const targetHeight = capped ? Math.min(rect.height, sourceRows || rect.height) : rect.height;
  const targetWidth = capped ? Math.min(rect.width, sourceColumns || rect.width) : rect.width;
  return {
    sourceRows,
    sourceColumns,
    targetHeight,
    targetWidth,
    rowOffset: capped ? Math.max(0, Math.floor((rect.height - targetHeight) / 2)) : 0,
    columnOffset: capped ? Math.max(0, Math.floor((rect.width - targetWidth) / 2)) : 0,
    scaled,
    capped,
  };
}

function maxGridColumns(grid: readonly (readonly string[] | undefined)[]): number {
  let columns = 0;
  for (const row of grid) {
    columns = Math.max(columns, row?.length ?? 0);
  }
  return columns;
}

function scaledIndexesInto(target: number[], targetSize: number, sourceSize: number): number[] {
  const metadata = scaleIndexMetadata.get(target);
  if (metadata?.targetSize === targetSize && metadata.sourceSize === sourceSize && target.length === targetSize) {
    return target;
  }

  target.length = targetSize;
  for (let index = 0; index < targetSize; index += 1) {
    target[index] = Math.min(sourceSize - 1, Math.floor((index * sourceSize) / targetSize));
  }
  scaleIndexMetadata.set(target, { targetSize, sourceSize });
  return target;
}
