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

/** Overflow policy for one viewport axis. */
export type ViewportOverflowMode = "auto" | "scroll" | "hidden" | "visible";

/** Options for resolving overflow on one viewport axis. */
export interface ViewportAxisOverflowOptions {
  contentLength: number;
  viewportLength: number;
  offset?: number;
  overflow?: ViewportOverflowMode;
}

/** Normalized overflow, scroll, and scrollbar state for one viewport axis. */
export interface ViewportAxisOverflow {
  contentLength: number;
  viewportLength: number;
  maxOffset: number;
  offset: number;
  overflow: ViewportOverflowMode;
  hasOverflow: boolean;
  canScroll: boolean;
  scrollbarVisible: boolean;
  thumb: ViewportThumb;
  visibleRange: ViewportWindow;
}

/** Options for resolving overflow on a two-dimensional viewport. */
export interface ViewportOverflowOptions {
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  offset?: Offset;
  overflowX?: ViewportOverflowMode;
  overflowY?: ViewportOverflowMode;
}

/** Normalized overflow contract shared by scrollable widgets and layouts. */
export interface ViewportOverflowInspection {
  columns: ViewportAxisOverflow;
  rows: ViewportAxisOverflow;
  maxOffset: Offset;
  offset: Offset;
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

/** Maps a pointer position on a scrollbar track to a scroll offset. */
export function viewportOffsetForPointer(
  contentLength: number,
  viewportLength: number,
  pointerIndex: number,
): number {
  const content = normalizedViewportDimension(contentLength);
  const viewport = normalizedViewportDimension(viewportLength);
  const maxOffset = Math.max(0, content - viewport);
  if (maxOffset === 0) return 0;
  const trackLength = Math.max(1, viewport);
  const local = clamp(Math.floor(Number.isFinite(pointerIndex) ? pointerIndex : 0), 0, trackLength - 1);
  const ratio = trackLength <= 1 ? 0 : local / (trackLength - 1);
  return clamp(Math.round(maxOffset * ratio), 0, maxOffset);
}

/** Resolves overflow, scroll, and scrollbar state for one viewport axis. */
export function inspectViewportAxisOverflow(options: ViewportAxisOverflowOptions): ViewportAxisOverflow {
  const contentLength = normalizedViewportDimension(options.contentLength);
  const viewportLength = normalizedViewportDimension(options.viewportLength);
  const overflow = options.overflow ?? "auto";
  const hasOverflow = contentLength > viewportLength;
  const rawMaxOffset = Math.max(0, contentLength - viewportLength);
  const canScroll = (overflow === "auto" || overflow === "scroll") && rawMaxOffset > 0;
  const maxOffset = canScroll ? rawMaxOffset : 0;
  const offset = clamp(Math.floor(Number.isFinite(options.offset ?? 0) ? options.offset ?? 0 : 0), 0, maxOffset);
  const scrollbarVisible = viewportLength > 0 && (overflow === "scroll" || (overflow === "auto" && hasOverflow));
  const visibleRange = overflow === "visible"
    ? { start: 0, end: contentLength }
    : { start: offset, end: Math.min(contentLength, offset + viewportLength) };

  return {
    contentLength,
    viewportLength,
    maxOffset,
    offset,
    overflow,
    hasOverflow,
    canScroll,
    scrollbarVisible,
    thumb: scrollbarVisible
      ? viewportThumb(contentLength, viewportLength, offset)
      : { start: 0, size: viewportLength, visible: false },
    visibleRange,
  };
}

/** Resolves overflow, scroll, and scrollbar state for a two-dimensional viewport. */
export function inspectViewportOverflow(options: ViewportOverflowOptions): ViewportOverflowInspection {
  const columns = inspectViewportAxisOverflow({
    contentLength: options.contentWidth,
    viewportLength: options.viewportWidth,
    offset: options.offset?.columns,
    overflow: options.overflowX,
  });
  const rows = inspectViewportAxisOverflow({
    contentLength: options.contentHeight,
    viewportLength: options.viewportHeight,
    offset: options.offset?.rows,
    overflow: options.overflowY,
  });

  return {
    columns,
    rows,
    maxOffset: { columns: columns.maxOffset, rows: rows.maxOffset },
    offset: { columns: columns.offset, rows: rows.offset },
  };
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

function normalizedViewportDimension(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}
