// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { clipRect, inset } from "./hit_targets.ts";
import { type WorkbenchAsciiConfigAction, workbenchAsciiConfigVisibleRowStart } from "./workbench_ascii.ts";

/** Options for laying out the Three ASCII renderer configuration modal. */
export interface WorkbenchAsciiConfigModalLayoutOptions {
  bounds: Rectangle;
  rowCount: number;
  minWidth?: number;
  maxWidth?: number;
  horizontalMargin?: number;
  minHeight?: number;
  verticalMargin?: number;
  topMargin?: number;
}

/** Renderer-neutral geometry for the Three ASCII renderer configuration modal. */
export interface WorkbenchAsciiConfigModalLayout {
  rect: Rectangle;
  inner: Rectangle;
  shadow: Rectangle;
  rowsTop: number;
  actionRow: number;
  footerRow: number;
  visibleRows: number;
}

/** Concrete row placement for a visible Three ASCII config modal row. */
export interface WorkbenchAsciiConfigRowPlacement<Row> {
  row: Row;
  rowIndex: number;
  selected: boolean;
  rect: Rectangle;
  previousRect: Rectangle;
  nextRect: Rectangle;
}

/** Calculates centered, clipped geometry for the Three ASCII renderer configuration modal. */
export function layoutWorkbenchAsciiConfigModal(
  options: WorkbenchAsciiConfigModalLayoutOptions,
): WorkbenchAsciiConfigModalLayout {
  const bounds = normalizeRect(options.bounds);
  const minWidth = Math.max(1, Math.floor(options.minWidth ?? 54));
  const maxWidth = Math.max(minWidth, Math.floor(options.maxWidth ?? 82));
  const horizontalMargin = Math.max(0, Math.floor(options.horizontalMargin ?? 8));
  const minHeight = Math.max(1, Math.floor(options.minHeight ?? 16));
  const verticalMargin = Math.max(0, Math.floor(options.verticalMargin ?? 4));
  const topMargin = Math.max(0, Math.floor(options.topMargin ?? 1));
  const rowCount = Math.max(0, Math.floor(options.rowCount));
  const width = Math.min(Math.max(minWidth, bounds.width - horizontalMargin), maxWidth, bounds.width);
  const height = Math.min(Math.max(minHeight, rowCount + 7), Math.max(10, bounds.height - verticalMargin));
  const rect = clipRect({
    column: bounds.column + Math.max(0, Math.floor((bounds.width - width) / 2)),
    row: bounds.row + Math.max(topMargin, Math.floor((bounds.height - height) / 2)),
    width,
    height,
  }, bounds);
  const inner = inset(rect, 1);
  const rowsTop = inner.row + 2;
  const actionRow = inner.row + inner.height - 2;
  const footerRow = inner.row + inner.height - 1;
  return {
    rect,
    inner,
    shadow: clipRect({
      column: rect.column + 2,
      row: rect.row + 1,
      width: rect.width,
      height: rect.height,
    }, bounds),
    rowsTop,
    actionRow,
    footerRow,
    visibleRows: Math.max(0, actionRow - rowsTop),
  };
}

/** Projects visible Three ASCII config rows into exact row and previous/next hit rectangles. */
export function workbenchAsciiConfigRowPlacementsInto<Row>(
  target: WorkbenchAsciiConfigRowPlacement<Row>[],
  rows: readonly Row[],
  options: {
    inner: Rectangle;
    rowsTop: number;
    visibleRows: number;
    selectedIndex: number;
    splitMinWidth?: number;
  },
): WorkbenchAsciiConfigRowPlacement<Row>[] {
  target.length = 0;
  const visibleRows = Math.max(0, Math.floor(options.visibleRows));
  const firstRow = workbenchAsciiConfigVisibleRowStart(options.selectedIndex, rows.length, visibleRows);
  const count = Math.min(visibleRows, rows.length);
  const splitMinWidth = Math.max(1, Math.floor(options.splitMinWidth ?? 6));
  for (let visibleIndex = 0; visibleIndex < count; visibleIndex += 1) {
    const rowIndex = firstRow + visibleIndex;
    const row = rows[rowIndex];
    if (row === undefined) continue;
    const rect = {
      column: options.inner.column,
      row: options.rowsTop + visibleIndex,
      width: options.inner.width,
      height: 1,
    };
    const leftWidth = Math.max(splitMinWidth, Math.floor(rect.width / 2));
    const previousRect = { ...rect, width: Math.min(rect.width, leftWidth) };
    const nextRect = {
      column: rect.column + previousRect.width,
      row: rect.row,
      width: Math.max(0, rect.width - previousRect.width),
      height: 1,
    };
    target.push({
      row,
      rowIndex,
      selected: rowIndex === options.selectedIndex,
      rect,
      previousRect,
      nextRect,
    });
  }
  return target;
}

/** Convenience hit action type used by modal row placements. */
export type WorkbenchAsciiConfigRowPlacementAction = WorkbenchAsciiConfigAction;

function normalizeRect(rect: Rectangle): Rectangle {
  return {
    column: Math.floor(rect.column),
    row: Math.floor(rect.row),
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  };
}
