// Copyright 2023 Im-Beast. MIT license.
import type { Offset } from "./types.ts";
import { clamp } from "./utils/numbers.ts";

export interface ViewportWindow {
  start: number;
  end: number;
}

export interface ViewportThumb {
  start: number;
  size: number;
  visible: boolean;
}

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

export function clampViewportOffset(offset: Offset, maxOffset: Offset): Offset {
  return {
    columns: clamp(offset.columns, 0, Math.max(0, maxOffset.columns)),
    rows: clamp(offset.rows, 0, Math.max(0, maxOffset.rows)),
  };
}

export function viewportOffsetBy(offset: Offset, maxOffset: Offset, columns: number, rows: number): Offset {
  return clampViewportOffset({
    columns: offset.columns + columns,
    rows: offset.rows + rows,
  }, maxOffset);
}

export function viewportWindow(length: number, activeIndex: number, capacity: number): ViewportWindow {
  const safeCapacity = Math.max(0, Math.floor(capacity));
  if (length <= 0 || safeCapacity <= 0) return { start: 0, end: 0 };
  const active = clamp(Math.floor(activeIndex), 0, length - 1);
  const start = Math.max(0, Math.min(active - Math.floor(safeCapacity / 2), Math.max(0, length - safeCapacity)));
  return { start, end: Math.min(length, start + safeCapacity) };
}

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

export function viewportThumbGlyph(row: number, thumb: ViewportThumb): string {
  if (!thumb.visible) return " ";
  return row >= thumb.start && row < thumb.start + thumb.size ? "█" : "│";
}
