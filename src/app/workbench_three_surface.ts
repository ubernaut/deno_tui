// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import type { RowStyle } from "./workbench_rows.ts";
import type { WorkbenchFrame } from "./workbench_frame.ts";
import {
  type WorkbenchThreeGridProjection,
  WorkbenchThreeGridProjectionCache,
  type WorkbenchThreeGridScaleMode,
  writeWorkbenchThreeGrid,
} from "./workbench_three_grid.ts";

export interface WorkbenchThreeSurfaceRenderResult {
  kind: "grid" | "status" | "empty";
  projection?: WorkbenchThreeGridProjection;
}

export interface WorkbenchThreeSurfaceRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  grid: readonly (readonly string[] | undefined)[];
  fallbackCell: string;
  projectionCache: WorkbenchThreeGridProjectionCache;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
  statusRows?: readonly RowStyle[] | (() => readonly RowStyle[]);
  scale?: WorkbenchThreeGridScaleMode;
  countForPressure?: boolean;
  onPressureRows?: (rows: number) => void;
}

/** Renders a Three ASCII grid into a workbench surface or a caller-provided status body. */
export function renderWorkbenchThreeSurface(
  options: WorkbenchThreeSurfaceRenderOptions,
): WorkbenchThreeSurfaceRenderResult {
  const { frame, rect, grid, fallbackCell, projectionCache, writeRows, statusRows } = options;
  if (rect.width <= 0 || rect.height <= 0) return { kind: "empty" };

  if (grid.length === 0) {
    if (statusRows) writeRows(frame, rect, resolveWorkbenchThreeSurfaceStatusRows(statusRows));
    return { kind: "status" };
  }

  const projection = writeWorkbenchThreeGrid(
    frame,
    rect,
    grid,
    fallbackCell,
    projectionCache.options(grid, options.scale ?? "down"),
  );
  if ((options.countForPressure ?? true) && projection) {
    options.onPressureRows?.(projection.targetHeight);
  }
  return { kind: "grid", projection };
}

function resolveWorkbenchThreeSurfaceStatusRows(
  rows: readonly RowStyle[] | (() => readonly RowStyle[]),
): readonly RowStyle[] {
  return typeof rows === "function" ? rows() : rows;
}
