// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

/** Public interface describing a breakpoint. */
export interface Breakpoint {
  id: string;
  minWidth?: number;
  minHeight?: number;
}

/** Options for configuring adaptive Grid. */
export interface AdaptiveGridOptions {
  itemCount: number;
  minColumnWidth: number;
  minRowHeight: number;
  maxColumns?: number;
  maxRows?: number;
  gap?: number;
}

/** Public interface describing an adaptive Grid. */
export interface AdaptiveGrid {
  columns: number;
  rows: number;
  itemWidth: number;
  itemHeight: number;
  pageSize: number;
}

/** Public interface describing an adaptive Grid Page. */
export interface AdaptiveGridPage {
  grid: AdaptiveGrid;
  pageStart: number;
  pageIndex: number;
  pageCount: number;
}

/** Options for scoring a tiled rectangle layout from available terminal space. */
export interface TileLayoutOptions {
  itemCount: number;
  minTileWidth: number;
  minTileHeight: number;
  maxColumns?: number;
  maxRows?: number;
  gap?: number;
  targetAspectRatio?: number;
  allowVerticalOverflow?: boolean;
}

/** Solved tile layout with generated item rectangles and scrollable content height. */
export interface TileLayout {
  columns: number;
  rows: number;
  contentHeight: number;
  rects: Rectangle[];
}

/** Resolves breakpoint from the provided inputs. */
export function resolveBreakpoint(bounds: Rectangle, breakpoints: readonly Breakpoint[]): string {
  const matches = breakpoints
    .filter((breakpoint) => bounds.width >= (breakpoint.minWidth ?? 0) && bounds.height >= (breakpoint.minHeight ?? 0))
    .sort((a, b) => (b.minWidth ?? 0) - (a.minWidth ?? 0) || (b.minHeight ?? 0) - (a.minHeight ?? 0));
  return matches[0]?.id ?? breakpoints[0]?.id ?? "";
}

/** Public helper for inset Rect. */
export function insetRect(rect: Rectangle, inset: number): Rectangle {
  const safeInset = Math.max(0, inset);
  return {
    column: rect.column + safeInset,
    row: rect.row + safeInset,
    width: Math.max(0, rect.width - safeInset * 2),
    height: Math.max(0, rect.height - safeInset * 2),
  };
}

/** Public helper for adaptive Grid. */
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

/** Public helper for adaptive Grid Page. */
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

/** Public helper for adaptive Grid Item Rect. */
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

/** Builds balanced tile rectangles that can grow from one column to dense multi-column grids. */
export function tileRects(bounds: Rectangle, options: TileLayoutOptions): TileLayout {
  const itemCount = Math.max(0, Math.floor(options.itemCount));
  if (itemCount === 0) return { columns: 0, rows: 0, contentHeight: 0, rects: [] };

  const gap = Math.max(0, Math.floor(options.gap ?? 1));
  const width = Math.max(0, Math.floor(bounds.width));
  const height = Math.max(0, Math.floor(bounds.height));
  const minTileWidth = Math.max(1, Math.floor(options.minTileWidth));
  const minTileHeight = Math.max(1, Math.floor(options.minTileHeight));
  const maxColumns = Math.max(1, Math.min(itemCount, Math.floor(options.maxColumns ?? itemCount)));
  const maxRows = Math.max(1, Math.floor(options.maxRows ?? itemCount));
  const targetAspectRatio = Math.max(0.1, options.targetAspectRatio ?? 2.4);
  const columnsByWidth = Math.max(1, Math.floor((width + gap) / (minTileWidth + gap)));
  const upperColumns = Math.max(1, Math.min(maxColumns, columnsByWidth, itemCount));
  const allowVerticalOverflow = options.allowVerticalOverflow ?? false;

  let best:
    | { columns: number; rows: number; tileWidth: number; tileHeight: number; contentHeight: number; score: number }
    | undefined;

  for (let columns = 1; columns <= upperColumns; columns += 1) {
    const rows = Math.ceil(itemCount / columns);
    if (rows > maxRows && !allowVerticalOverflow) continue;

    const tileWidth = Math.max(0, Math.floor((width - gap * Math.max(0, columns - 1)) / columns));
    const fitHeight = Math.floor((height - gap * Math.max(0, rows - 1)) / rows);
    const tileHeight = allowVerticalOverflow ? Math.max(minTileHeight, fitHeight) : fitHeight;
    if (tileWidth < minTileWidth || tileHeight < minTileHeight) continue;

    const contentHeight = rows * tileHeight + gap * Math.max(0, rows - 1);
    const overflow = Math.max(0, contentHeight - height);
    const aspect = tileWidth / Math.max(1, tileHeight);
    const aspectPenalty = Math.abs(Math.log(aspect / targetAspectRatio));
    const emptySlots = columns * rows - itemCount;
    const rowPenalty = rows > maxRows ? (rows - maxRows) * 6 : 0;
    const score = overflow * 20 + aspectPenalty * 12 + emptySlots * 2 + rowPenalty - columns * 0.5;

    if (!best || score < best.score) {
      best = { columns, rows, tileWidth, tileHeight, contentHeight, score };
    }
  }

  if (!best) {
    const rows = itemCount;
    const tileHeight = allowVerticalOverflow
      ? minTileHeight
      : Math.max(0, Math.floor((height - gap * Math.max(0, rows - 1)) / rows));
    best = {
      columns: 1,
      rows,
      tileWidth: width,
      tileHeight,
      contentHeight: rows * tileHeight + gap * Math.max(0, rows - 1),
      score: 0,
    };
  }

  const stretchSparseColumns = best.contentHeight <= height;
  const layoutBottom = bounds.row + (stretchSparseColumns ? height : best.contentHeight);
  const rects = new Array<Rectangle>(itemCount);
  for (let index = 0; index < itemCount; index++) {
    const columnIndex = index % best.columns;
    const rowIndex = Math.floor(index / best.columns);
    const column = bounds.column + columnIndex * (best.tileWidth + gap);
    const row = bounds.row + rowIndex * (best.tileHeight + gap);
    const lastColumn = columnIndex === best.columns - 1;
    const lastRow = rowIndex === best.rows - 1;
    const lastInColumn = index + best.columns >= itemCount;
    rects[index] = {
      column,
      row,
      width: Math.max(0, lastColumn ? bounds.column + width - column : best.tileWidth),
      height: Math.max(
        0,
        stretchSparseColumns && lastInColumn
          ? layoutBottom - row
          : lastRow
          ? bounds.row + best.contentHeight - row
          : best.tileHeight,
      ),
    };
  }

  return {
    columns: best.columns,
    rows: best.rows,
    contentHeight: best.contentHeight,
    rects,
  };
}

/** Public helper for split Rect. */
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

/** Public helper for dock Rect. */
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
