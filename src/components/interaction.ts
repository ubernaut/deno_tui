// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

/** Input method that changed or activated a widget. */
export type WidgetInteractionMethod = "keyboard" | "mouse" | "programmatic";

/** Shared shape for simple widget hit regions. */
export interface WidgetHitRegion<TPayload = unknown> {
  id: string;
  bounds: Rectangle;
  disabled?: boolean;
  zIndex?: number;
  payload?: TPayload;
}

/** Result of hit testing a widget region. */
export interface WidgetHit<TPayload = unknown> {
  region: WidgetHitRegion<TPayload>;
  localColumn: number;
  localRow: number;
}

/** Returns the zero-based row index for a stacked widget row, or undefined when outside bounds. */
export function stackedRowIndexAt(
  row: number,
  top: number,
  rowCount: number,
  rowHeight = 1,
): number | undefined {
  const safeRowHeight = Math.max(1, Math.floor(rowHeight));
  const index = Math.floor((row - top) / safeRowHeight);
  return index >= 0 && index < rowCount ? index : undefined;
}

/** Builds vertical hit regions for list-like controls with one option per row. */
export function stackedRowHitRegions<TPayload>(
  bounds: Rectangle,
  rows: readonly TPayload[],
  options: {
    idPrefix?: string;
    rowHeight?: number;
    zIndex?: number;
    disabled?: (row: TPayload, index: number) => boolean;
  } = {},
): Array<WidgetHitRegion<TPayload>> {
  const rowHeight = Math.max(1, Math.floor(options.rowHeight ?? 1));
  const regions = new Array<WidgetHitRegion<TPayload>>(rows.length);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    regions[index] = {
      id: `${options.idPrefix ?? "row"}-${index}`,
      bounds: {
        column: bounds.column,
        row: bounds.row + index * rowHeight,
        width: bounds.width,
        height: rowHeight,
      },
      zIndex: options.zIndex,
      disabled: options.disabled?.(row, index) ?? false,
      payload: row,
    };
  }
  return regions;
}

/** Returns the topmost non-disabled region under a point. */
export function hitTestWidgetRegions<TPayload>(
  regions: readonly WidgetHitRegion<TPayload>[],
  point: { column: number; row: number },
): WidgetHit<TPayload> | undefined {
  let region: WidgetHitRegion<TPayload> | undefined;
  for (const candidate of regions) {
    if (candidate.disabled || !pointInWidgetRegion(candidate, point)) continue;
    if (!region || compareWidgetHitRegionPriority(candidate, region) > 0) {
      region = candidate;
    }
  }
  if (region === undefined) return undefined;
  return {
    region,
    localColumn: point.column - region.bounds.column,
    localRow: point.row - region.bounds.row,
  };
}

function compareWidgetHitRegionPriority(left: WidgetHitRegion, right: WidgetHitRegion): number {
  return (left.zIndex ?? 0) - (right.zIndex ?? 0) || left.id.localeCompare(right.id);
}

/** Returns true when a point is inside a widget hit region. */
export function pointInWidgetRegion(
  region: WidgetHitRegion,
  point: { column: number; row: number },
): boolean {
  const { bounds } = region;
  return point.column >= bounds.column && point.column < bounds.column + Math.max(0, bounds.width) &&
    point.row >= bounds.row && point.row < bounds.row + Math.max(0, bounds.height);
}
