// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../src/types.ts";
import { type WorkbenchFrame, writeFrameCells } from "../src/app/workbench_frame.ts";

export type WorkbenchThreeGridScaleMode = boolean | "down";

/** Copies a Three ASCII ANSI grid into a workbench frame rectangle. */
export function writeWorkbenchThreeGrid(
  frame: WorkbenchFrame,
  rect: Rectangle,
  grid: readonly (readonly string[] | undefined)[],
  fallbackCell: string,
  options: { scale?: WorkbenchThreeGridScaleMode } = {},
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const sourceRows = grid.length;
  const sourceColumns = maxGridColumns(grid);
  const scaleMode = options.scale;
  const shouldScale = scaleMode === true ||
    (scaleMode === "down" && (sourceRows > rect.height || sourceColumns > rect.width));
  const capOutput = scaleMode === "down" && !shouldScale;
  const targetHeight = capOutput ? Math.min(rect.height, sourceRows || rect.height) : rect.height;
  const targetWidth = capOutput ? Math.min(rect.width, sourceColumns || rect.width) : rect.width;
  const rowOffset = capOutput ? Math.max(0, Math.floor((rect.height - targetHeight) / 2)) : 0;
  const columnOffset = capOutput ? Math.max(0, Math.floor((rect.width - targetWidth) / 2)) : 0;
  const rowBuffer: string[] = [];

  for (let row = 0; row < targetHeight; row += 1) {
    const sourceRow = shouldScale && sourceRows > 0
      ? Math.min(sourceRows - 1, Math.floor((row * sourceRows) / targetHeight))
      : row;
    const source = grid[sourceRow];
    const sourceWidth = source?.length ?? 0;
    const target = frame[rect.row + rowOffset + row] ??= [];

    if (!shouldScale && source && sourceWidth >= targetWidth) {
      writeFrameCells(target, rect.column + columnOffset, source, 0, targetWidth);
      continue;
    }

    rowBuffer.length = targetWidth;
    for (let column = 0; column < targetWidth; column += 1) {
      const sourceColumn = shouldScale && sourceWidth > 0
        ? Math.min(sourceWidth - 1, Math.floor((column * sourceWidth) / targetWidth))
        : column;
      rowBuffer[column] = source?.[sourceColumn] ?? fallbackCell;
    }
    writeFrameCells(target, rect.column + columnOffset, rowBuffer, 0, targetWidth);
  }
}

function maxGridColumns(grid: readonly (readonly string[] | undefined)[]): number {
  let columns = 0;
  for (const row of grid) {
    columns = Math.max(columns, row?.length ?? 0);
  }
  return columns;
}
