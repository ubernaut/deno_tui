// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

export interface RectangleEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function normalizeRectangle(rect: Rectangle): Rectangle {
  return {
    column: Math.floor(rect.column),
    row: Math.floor(rect.row),
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  };
}

export function insetRectangleByEdges(
  rect: Rectangle,
  outer: RectangleEdges,
  inner: RectangleEdges,
): Rectangle {
  const left = outer.left + inner.left;
  const right = outer.right + inner.right;
  const top = outer.top + inner.top;
  const bottom = outer.bottom + inner.bottom;
  return {
    column: rect.column + left,
    row: rect.row + top,
    width: Math.max(0, rect.width - left - right),
    height: Math.max(0, rect.height - top - bottom),
  };
}

export function setRectangle(
  target: Rectangle,
  column: number,
  row: number,
  width: number,
  height: number,
): void {
  target.column = column;
  target.row = row;
  target.width = width;
  target.height = height;
}
