// Copyright 2023 Im-Beast. MIT license.
import type { TileLayoutOptions } from "../layout/responsive.ts";
import type { Rectangle } from "../types.ts";

/** Options for deriving adaptive workbench tile layout defaults. */
export interface WorkbenchAdaptiveTileOptions {
  bounds: Rectangle;
  tileDensity?: number;
  minTileWidth?: number;
  minTileHeight?: number;
  wideBreakpoint?: number;
  narrowMaxColumns?: number;
  wideMaxColumns?: number;
  targetAspectRatio?: number;
  aspectDensityStep?: number;
  allowVerticalOverflow?: boolean;
  gap?: number;
}

/** Minimal layout entry shape emitted by renderer-neutral window managers. */
export interface WorkbenchLayoutEntryShape {
  id: string;
  rect?: Rectangle;
}

/** Minimal layout inspection shape used to project visible windows into a render map. */
export interface WorkbenchLayoutShape {
  contentHeight: number;
  visible: readonly WorkbenchLayoutEntryShape[];
}

/** Options for locating a workbench vertical scrollbar hit region. */
export interface WorkbenchVerticalScrollbarRectOptions {
  bounds: Rectangle;
  visible: boolean;
  minWidth?: number;
}

/** Shared workbench layout result consumed by terminal and browser render adapters. */
export interface WorkbenchWindowLayout<Id extends string = string> {
  bounds: Rectangle;
  contentHeight: number;
  rects: Map<Id, Rectangle>;
}

/** Clamps tile-density preferences to the supported compact/wide range. */
export function clampWorkbenchTileDensity(value: number, min = -3, max = 3): number {
  if (!Number.isFinite(value)) return 0;
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.max(lower, Math.min(upper, Math.trunc(value)));
}

/**
 * Builds the adaptive tile defaults used by the API workbench adapters.
 *
 * Positive density favors more compact tiles; negative density favors wider tiles.
 */
export function workbenchAdaptiveTileOptions(
  options: WorkbenchAdaptiveTileOptions,
): Partial<Omit<TileLayoutOptions, "itemCount">> {
  const density = clampWorkbenchTileDensity(options.tileDensity ?? 0);
  const densityOffset = density * 4;
  const minTileWidth = Math.max(1, Math.floor((options.minTileWidth ?? 38) - densityOffset));
  return {
    minTileWidth: Math.max(26, minTileWidth),
    minTileHeight: Math.max(1, Math.floor(options.minTileHeight ?? 10)),
    maxColumns: options.bounds.width >= (options.wideBreakpoint ?? 172)
      ? Math.max(1, Math.floor(options.wideMaxColumns ?? 4))
      : Math.max(1, Math.floor(options.narrowMaxColumns ?? 3)),
    targetAspectRatio: (options.targetAspectRatio ?? 2.25) + density * (options.aspectDensityStep ?? 0.12),
    allowVerticalOverflow: options.allowVerticalOverflow ?? true,
    gap: Math.max(0, Math.floor(options.gap ?? 1)),
  };
}

/** Projects a window manager layout inspection into bounds, content height, and visible rectangles. */
export function workbenchWindowLayout<Id extends string>(
  bounds: Rectangle,
  layout: WorkbenchLayoutShape,
): WorkbenchWindowLayout<Id> {
  const rects = new Map<Id, Rectangle>();
  for (const entry of layout.visible) {
    if (entry.rect) rects.set(entry.id as Id, entry.rect);
  }
  return { bounds, contentHeight: Math.max(bounds.height, layout.contentHeight), rects };
}

/** Locates the workspace vertical scrollbar hit rectangle, or undefined when it should be hidden. */
export function workbenchVerticalScrollbarRect(
  options: WorkbenchVerticalScrollbarRectOptions,
): Rectangle | undefined {
  const minWidth = Math.max(1, Math.floor(options.minWidth ?? 2));
  const bounds = options.bounds;
  if (!options.visible || bounds.width < minWidth || bounds.height <= 0) return undefined;
  return {
    column: bounds.column + bounds.width - 1,
    row: bounds.row,
    width: 1,
    height: bounds.height,
  };
}
