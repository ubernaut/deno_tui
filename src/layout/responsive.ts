// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

export interface Breakpoint {
  id: string;
  minWidth?: number;
  minHeight?: number;
}

export interface AdaptiveGridOptions {
  itemCount: number;
  minColumnWidth: number;
  minRowHeight: number;
  maxColumns?: number;
  maxRows?: number;
  gap?: number;
}

export interface AdaptiveGrid {
  columns: number;
  rows: number;
  itemWidth: number;
  itemHeight: number;
  pageSize: number;
}

export interface AdaptiveGridPage {
  grid: AdaptiveGrid;
  pageStart: number;
  pageIndex: number;
  pageCount: number;
}

export function resolveBreakpoint(bounds: Rectangle, breakpoints: readonly Breakpoint[]): string {
  const matches = breakpoints
    .filter((breakpoint) => bounds.width >= (breakpoint.minWidth ?? 0) && bounds.height >= (breakpoint.minHeight ?? 0))
    .sort((a, b) => (b.minWidth ?? 0) - (a.minWidth ?? 0) || (b.minHeight ?? 0) - (a.minHeight ?? 0));
  return matches[0]?.id ?? breakpoints[0]?.id ?? "";
}

export function insetRect(rect: Rectangle, inset: number): Rectangle {
  const safeInset = Math.max(0, inset);
  return {
    column: rect.column + safeInset,
    row: rect.row + safeInset,
    width: Math.max(0, rect.width - safeInset * 2),
    height: Math.max(0, rect.height - safeInset * 2),
  };
}

export function adaptiveGrid(bounds: Rectangle, options: AdaptiveGridOptions): AdaptiveGrid {
  const gap = Math.max(0, Math.floor(options.gap ?? 1));
  const itemCount = Math.max(0, Math.floor(options.itemCount));
  const minColumnWidth = Math.max(1, Math.floor(options.minColumnWidth));
  const minRowHeight = Math.max(1, Math.floor(options.minRowHeight));
  const maxColumns = Math.max(1, Math.floor(options.maxColumns ?? (itemCount || 1)));
  const maxRows = Math.max(1, Math.floor(options.maxRows ?? (itemCount || 1)));
  const width = Math.max(0, Math.floor(bounds.width));
  const height = Math.max(0, Math.floor(bounds.height));

  const columnsByWidth = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
  const rowsByHeight = Math.max(1, Math.floor((height + gap) / (minRowHeight + gap)));
  const columns = Math.max(1, Math.min(maxColumns, itemCount || 1, columnsByWidth));
  const rows = Math.max(1, Math.min(maxRows, Math.ceil(Math.max(1, itemCount) / columns), rowsByHeight));
  const itemWidth = Math.max(0, Math.floor((width - Math.max(0, columns - 1) * gap) / columns));
  const itemHeight = Math.max(0, Math.floor((height - Math.max(0, rows - 1) * gap) / rows));

  return {
    columns,
    rows,
    itemWidth,
    itemHeight,
    pageSize: Math.max(1, columns * rows),
  };
}

export function adaptiveGridPage(
  bounds: Rectangle,
  selectedIndex: number,
  options: AdaptiveGridOptions,
): AdaptiveGridPage {
  const grid = adaptiveGrid(bounds, options);
  const itemCount = Math.max(0, Math.floor(options.itemCount));
  const pageCount = Math.max(1, Math.ceil(Math.max(1, itemCount) / grid.pageSize));
  const safeSelected = Math.max(0, Math.min(Math.floor(selectedIndex), Math.max(0, itemCount - 1)));
  const pageIndex = Math.min(pageCount - 1, Math.floor(safeSelected / grid.pageSize));
  return {
    grid,
    pageStart: pageIndex * grid.pageSize,
    pageIndex,
    pageCount,
  };
}

export function adaptiveGridItemRect(bounds: Rectangle, grid: AdaptiveGrid, localIndex: number, gap = 1): Rectangle {
  const safeGap = Math.max(0, Math.floor(gap));
  const column = Math.max(0, Math.floor(localIndex)) % grid.columns;
  const row = Math.floor(Math.max(0, Math.floor(localIndex)) / grid.columns);
  const lastColumn = column === grid.columns - 1;
  const lastRow = row === grid.rows - 1;
  const x = bounds.column + column * (grid.itemWidth + safeGap);
  const y = bounds.row + row * (grid.itemHeight + safeGap);

  return {
    column: x,
    row: y,
    width: Math.max(0, lastColumn ? bounds.column + bounds.width - x : grid.itemWidth),
    height: Math.max(0, lastRow ? bounds.row + bounds.height - y : grid.itemHeight),
  };
}

export function splitRect(rect: Rectangle, direction: "row" | "column", firstSize: number, gap = 0) {
  const safeGap = Math.max(0, gap);
  const size = Math.max(0, Math.floor(firstSize));
  if (direction === "row") {
    const first = { column: rect.column, row: rect.row, width: Math.min(size, rect.width), height: rect.height };
    const secondColumn = rect.column + first.width + safeGap;
    return {
      first,
      second: {
        column: secondColumn,
        row: rect.row,
        width: Math.max(0, rect.column + rect.width - secondColumn),
        height: rect.height,
      },
    };
  }

  const first = { column: rect.column, row: rect.row, width: rect.width, height: Math.min(size, rect.height) };
  const secondRow = rect.row + first.height + safeGap;
  return {
    first,
    second: {
      column: rect.column,
      row: secondRow,
      width: rect.width,
      height: Math.max(0, rect.row + rect.height - secondRow),
    },
  };
}

export function dockRect(rect: Rectangle, edge: "top" | "right" | "bottom" | "left", size: number, gap = 0) {
  const safeSize = Math.max(0, Math.floor(size));
  const safeGap = Math.max(0, gap);
  switch (edge) {
    case "top":
      return splitRect(rect, "column", safeSize, safeGap);
    case "bottom": {
      const bodyHeight = Math.max(0, rect.height - safeSize - safeGap);
      const split = splitRect(rect, "column", bodyHeight, safeGap);
      return { first: split.second, second: split.first };
    }
    case "left":
      return splitRect(rect, "row", safeSize, safeGap);
    case "right": {
      const bodyWidth = Math.max(0, rect.width - safeSize - safeGap);
      const split = splitRect(rect, "row", bodyWidth, safeGap);
      return { first: split.second, second: split.first };
    }
  }
}
