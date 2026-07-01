// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

/** Options used to reserve workbench viewport cells for scrollbars. */
export interface WorkbenchContentViewportOptions {
  inner: Rectangle;
  contentWidth: number;
  contentHeight: number;
}

/** Options used to calculate the row offset needed to reveal an active workbench item. */
export interface WorkbenchRevealActiveRowOptions {
  activeRect?: Rectangle;
  contentHeight: number;
  viewportHeight: number;
  offsetRows: number;
}

/**
 * Calculates the visible content viewport after reserving a final column and/or row for scrollbars.
 *
 * The second pass handles coupled overflow: adding a vertical scrollbar can force horizontal overflow, and adding a
 * horizontal scrollbar can force vertical overflow.
 */
export function workbenchContentViewport(options: WorkbenchContentViewportOptions): Rectangle {
  let width = options.inner.width;
  let height = options.inner.height;
  let needsVertical = options.contentHeight > height;
  let needsHorizontal = options.contentWidth > width;
  if (needsVertical) width = Math.max(0, width - 1);
  if (needsHorizontal) height = Math.max(0, height - 1);
  needsVertical = options.contentHeight > height;
  needsHorizontal = options.contentWidth > width;
  if (needsVertical && width === options.inner.width) width = Math.max(0, width - 1);
  if (needsHorizontal && height === options.inner.height) height = Math.max(0, height - 1);
  return { column: options.inner.column, row: options.inner.row, width, height };
}

/** Calculates the workspace row offset that keeps an active window/panel visible. */
export function workbenchRevealActiveRowOffset(options: WorkbenchRevealActiveRowOptions): number | undefined {
  if (!options.activeRect) return undefined;
  if (options.contentHeight <= options.viewportHeight) return 0;
  const maxOffset = Math.max(0, options.contentHeight - Math.max(0, options.viewportHeight));
  const offset = Math.max(0, Math.min(maxOffset, options.offsetRows));
  const top = options.activeRect.row;
  const bottom = options.activeRect.row + options.activeRect.height;
  if (top < offset) return Math.max(0, Math.min(maxOffset, top));
  if (bottom > offset + options.viewportHeight) {
    return Math.max(0, Math.min(maxOffset, bottom - options.viewportHeight));
  }
  return undefined;
}
