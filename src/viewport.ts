// Copyright 2023 Im-Beast. MIT license.
import type { Offset } from "./types.ts";
import { clamp } from "./utils/numbers.ts";

/** Half-open visible item range for a one-dimensional viewport. */
export interface ViewportWindow {
  start: number;
  end: number;
}

/** Scrollbar thumb geometry for one viewport axis. */
export interface ViewportThumb {
  start: number;
  size: number;
  visible: boolean;
}

/** Serializable scroll state and derived viewport geometry. */
export interface ViewportInspection {
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  maxOffset: Offset;
  offset: Offset;
  horizontalThumb: ViewportThumb;
  verticalThumb: ViewportThumb;
  visibleColumns: ViewportWindow;
  visibleRows: ViewportWindow;
  canScrollColumns: boolean;
  canScrollRows: boolean;
}

/** Returns the maximum scroll offset for content inside a viewport. */
export function maxViewportOffset(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): Offset {
  return {
    columns: Math.max(0, contentWidth - Math.max(0, viewportWidth)),
    rows: Math.max(0, contentHeight - Math.max(0, viewportHeight)),
  };
}

/** Clamps a scroll offset to a maximum offset on both axes. */
export function clampViewportOffset(offset: Offset, maxOffset: Offset): Offset {
  return {
    columns: clamp(offset.columns, 0, Math.max(0, maxOffset.columns)),
    rows: clamp(offset.rows, 0, Math.max(0, maxOffset.rows)),
  };
}

/** Moves a scroll offset by a delta and clamps it to the maximum offset. */
export function viewportOffsetBy(offset: Offset, maxOffset: Offset, columns: number, rows: number): Offset {
  return clampViewportOffset({
    columns: offset.columns + columns,
    rows: offset.rows + rows,
  }, maxOffset);
}

/** Returns a centered visible index window around an active item when possible. */
export function viewportWindow(length: number, activeIndex: number, capacity: number): ViewportWindow {
  const safeCapacity = Math.max(0, Math.floor(capacity));
  if (length <= 0 || safeCapacity <= 0) return { start: 0, end: 0 };
  const active = clamp(Math.floor(activeIndex), 0, length - 1);
  const start = Math.max(0, Math.min(active - Math.floor(safeCapacity / 2), Math.max(0, length - safeCapacity)));
  return { start, end: Math.min(length, start + safeCapacity) };
}

/** Computes scrollbar thumb geometry for one content axis. */
export function viewportThumb(contentLength: number, viewportLength: number, offset: number): ViewportThumb {
  const viewport = Math.max(0, viewportLength);
  const content = Math.max(0, contentLength);
  if (viewport === 0 || content <= viewport) {
    return { start: 0, size: viewport, visible: false };
  }

  const size = clamp(Math.round((viewport / content) * viewport), 1, viewport);
  const maxStart = Math.max(0, viewport - size);
  const maxOffset = Math.max(1, content - viewport);
  return {
    start: clamp(Math.round((offset / maxOffset) * maxStart), 0, maxStart),
    size,
    visible: true,
  };
}

/** Renders one vertical scrollbar cell for a computed thumb. */
export function viewportThumbGlyph(row: number, thumb: ViewportThumb): string {
  if (!thumb.visible) return " ";
  return row >= thumb.start && row < thumb.start + thumb.size ? "█" : "│";
}

/** Normalizes and inspects scroll state for a two-dimensional viewport. */
export function inspectViewport(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  offset: Offset = { columns: 0, rows: 0 },
): ViewportInspection {
  const safeContentWidth = Math.max(0, Math.floor(contentWidth));
  const safeContentHeight = Math.max(0, Math.floor(contentHeight));
  const safeViewportWidth = Math.max(0, Math.floor(viewportWidth));
  const safeViewportHeight = Math.max(0, Math.floor(viewportHeight));
  const maxOffset = maxViewportOffset(safeContentWidth, safeContentHeight, safeViewportWidth, safeViewportHeight);
  const clampedOffset = clampViewportOffset(offset, maxOffset);

  return {
    contentWidth: safeContentWidth,
    contentHeight: safeContentHeight,
    viewportWidth: safeViewportWidth,
    viewportHeight: safeViewportHeight,
    maxOffset,
    offset: clampedOffset,
    horizontalThumb: viewportThumb(safeContentWidth, safeViewportWidth, clampedOffset.columns),
    verticalThumb: viewportThumb(safeContentHeight, safeViewportHeight, clampedOffset.rows),
    visibleColumns: {
      start: clampedOffset.columns,
      end: Math.min(safeContentWidth, clampedOffset.columns + safeViewportWidth),
    },
    visibleRows: {
      start: clampedOffset.rows,
      end: Math.min(safeContentHeight, clampedOffset.rows + safeViewportHeight),
    },
    canScrollColumns: maxOffset.columns > 0,
    canScrollRows: maxOffset.rows > 0,
  };
}
