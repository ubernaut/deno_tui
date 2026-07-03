// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../src/types.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";

/** Copies a Three ASCII ANSI grid into a workbench frame rectangle. */
export function writeWorkbenchThreeGrid(
  frame: WorkbenchFrame,
  rect: Rectangle,
  grid: readonly (readonly string[] | undefined)[],
  fallbackCell: string,
  options: { scale?: boolean } = {},
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const scale = options.scale === true && grid.length > 0;

  for (let row = 0; row < rect.height; row += 1) {
    const sourceRow = scale ? Math.min(grid.length - 1, Math.floor((row * grid.length) / rect.height)) : row;
    const source = grid[sourceRow];
    const sourceWidth = source?.length ?? 0;
    const target = frame[rect.row + row] ??= [];
    for (let column = 0; column < rect.width; column += 1) {
      const sourceColumn = scale && sourceWidth > 0
        ? Math.min(sourceWidth - 1, Math.floor((column * sourceWidth) / rect.width))
        : column;
      target[rect.column + column] = source?.[sourceColumn] ?? fallbackCell;
    }
  }
}
