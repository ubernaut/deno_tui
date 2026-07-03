// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../src/types.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";

/** Copies a Three ASCII ANSI grid into a workbench frame rectangle. */
export function writeWorkbenchThreeGrid(
  frame: WorkbenchFrame,
  rect: Rectangle,
  grid: readonly (readonly string[] | undefined)[],
  fallbackCell: string,
): void {
  if (rect.width <= 0 || rect.height <= 0) return;

  for (let row = 0; row < rect.height; row += 1) {
    const source = grid[row];
    const target = frame[rect.row + row] ??= [];
    for (let column = 0; column < rect.width; column += 1) {
      target[rect.column + column] = source?.[column] ?? fallbackCell;
    }
  }
}
