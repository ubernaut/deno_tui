// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

export interface Breakpoint {
  id: string;
  minWidth?: number;
  minHeight?: number;
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
