// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

export function normalizeRectangle(rect: Rectangle): Rectangle {
  return {
    column: Math.floor(rect.column),
    row: Math.floor(rect.row),
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  };
}
