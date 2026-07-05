// Copyright 2023 Im-Beast. MIT license.
import type { TileLayoutOptions } from "../layout/responsive.ts";
import type { Rectangle } from "../types.ts";
import type { ViewportOverflowInspection } from "../viewport.ts";
import { scrollbarGlyph, type ScrollbarThumb } from "../components/scroll_area.ts";

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

/** Minimal window manager shape needed to compute an adaptive workbench layout. */
export interface WorkbenchAdaptiveWindowLayoutManager {
  layout(options: {
    bounds: Rectangle;
    tileOptions?: Partial<Omit<TileLayoutOptions, "itemCount">>;
  }): WorkbenchLayoutShape;
}

/** Options for projecting a window manager layout with shared workbench tile defaults. */
export interface WorkbenchAdaptiveWindowLayoutOptions extends Omit<WorkbenchAdaptiveTileOptions, "bounds"> {
  bounds: Rectangle;
}

/** Options for locating a workbench vertical scrollbar hit region. */
export interface WorkbenchVerticalScrollbarRectOptions {
  bounds: Rectangle;
  visible: boolean;
  minWidth?: number;
}

/** Options for locating per-window content scrollbar hit/render regions. */
export interface WorkbenchWindowScrollbarRectOptions {
  inner: Rectangle;
  viewport: Rectangle;
  overflow: ViewportOverflowInspection;
}

/** Per-window scrollbar rectangles shared by terminal and browser render adapters. */
export interface WorkbenchWindowScrollbarRects {
  vertical?: Rectangle;
  horizontal?: Rectangle;
}

/** Options used to reserve workbench viewport cells for scrollbars. */
export interface WorkbenchContentViewportOptions {
  inner: Rectangle;
  contentWidth: number;
  contentHeight: number;
}

/** Options used to calculate the row offset needed to reveal an active workbench item. */
export interface WorkbenchRevealActiveRowOptions {
  activeRect?: Rectangle;
  contentHeight: number;
  viewportHeight: number;
  offsetRows: number;
}

/** Renderer-neutral scrollbar cell placement. */
export interface WorkbenchScrollbarCell {
  column: number;
  row: number;
  glyph: string;
}

/** Axis for a renderer-neutral workbench scrollbar render command. */
export type WorkbenchScrollbarAxis = "vertical" | "horizontal";

/** Renderer-neutral command for painting and hit-testing a scrollbar. */
export interface WorkbenchScrollbarRenderCommand<TCell extends WorkbenchScrollbarCell = WorkbenchScrollbarCell> {
  axis: WorkbenchScrollbarAxis;
  rect: Rectangle;
  cells: TCell[];
}

/** Options for updating active workbench item reveal tracking. */
export interface WorkbenchActiveRevealOptions<Id extends string = string> {
  activeId: Id;
  activeRect?: Rectangle;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  offsetRows: number;
}

/** Minimal scroll-area shape needed by shared workbench viewport tracking. */
export interface WorkbenchWorkspaceScrollAdapter {
  offset: { peek(): { rows: number } };
  setViewportSize(width: number, height: number): unknown;
  setContentSize(width: number, height: number): unknown;
  scrollTo(columns: number, rows: number): unknown;
}

/** Options for a shared workbench workspace viewport update. */
export interface WorkbenchWorkspaceViewportUpdate<Id extends string = string> {
  layout: WorkbenchWindowLayout<Id>;
  viewportHeight: number;
  activeId: Id;
}

/** Shared workbench layout result consumed by terminal and browser render adapters. */
export interface WorkbenchWindowLayout<Id extends string = string> {
  bounds: Rectangle;
  contentHeight: number;
  rects: Map<Id, Rectangle>;
}

/** Options for filtering virtual workspace window rectangles to the visible viewport. */
export interface WorkbenchVisibleWindowRectsOptions {
  viewport: Rectangle;
}

/** Returns the viewport-sized rectangle used when a workbench window is maximized. */
export function workbenchFullscreenWindowRect(bounds: Rectangle): Rectangle {
  return {
    column: bounds.column,
    row: bounds.row,
    width: Math.max(0, bounds.width),
    height: Math.max(0, bounds.height),
  };
}

/** Coordinates workspace scroll sizing and active-window reveal behavior. */
export class WorkbenchWorkspaceViewportController<Id extends string = string> {
  readonly scroll: WorkbenchWorkspaceScrollAdapter;
  readonly revealTracker: WorkbenchActiveRevealTracker<Id>;

  constructor(options: {
    scroll: WorkbenchWorkspaceScrollAdapter;
    revealTracker?: WorkbenchActiveRevealTracker<Id>;
  }) {
    this.scroll = options.scroll;
    this.revealTracker = options.revealTracker ?? new WorkbenchActiveRevealTracker<Id>();
  }

  update(options: WorkbenchWorkspaceViewportUpdate<Id>): number {
    this.scroll.setViewportSize(options.layout.bounds.width, options.viewportHeight);
    this.scroll.setContentSize(options.layout.bounds.width, options.layout.contentHeight);
    const offset = this.revealTracker.revealOffset({
      activeId: options.activeId,
      activeRect: options.layout.rects.get(options.activeId),
      contentHeight: options.layout.contentHeight,
      viewportWidth: options.layout.bounds.width,
      viewportHeight: options.viewportHeight,
      offsetRows: this.scroll.offset.peek().rows,
    });
    if (offset !== undefined) this.scroll.scrollTo(0, offset);
    return this.scroll.offset.peek().rows;
  }

  resetReveal(): void {
    this.revealTracker.reset();
  }
}

/** Tracks active window visibility across workbench layout changes. */
export class WorkbenchActiveRevealTracker<Id extends string = string> {
  #lastActiveId: Id | null = null;
  #lastViewportWidth = 0;
  #lastViewportHeight = 0;

  revealOffset(options: WorkbenchActiveRevealOptions<Id>): number | undefined {
    const activeChanged = this.#lastActiveId !== options.activeId;
    const viewportChanged = this.#lastViewportWidth !== options.viewportWidth ||
      this.#lastViewportHeight !== options.viewportHeight;
    if (!options.activeRect || (!activeChanged && !viewportChanged)) return undefined;

    this.#lastActiveId = options.activeId;
    this.#lastViewportWidth = options.viewportWidth;
    this.#lastViewportHeight = options.viewportHeight;

    return workbenchRevealActiveRowOffset({
      activeRect: options.activeRect,
      contentHeight: options.contentHeight,
      viewportHeight: options.viewportHeight,
      offsetRows: options.offsetRows,
    });
  }

  reset(): void {
    this.#lastActiveId = null;
    this.#lastViewportWidth = 0;
    this.#lastViewportHeight = 0;
  }
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

/** Runs a compatible window manager with shared adaptive tile defaults and projects visible rectangles. */
export function workbenchAdaptiveWindowLayout<Id extends string>(
  manager: WorkbenchAdaptiveWindowLayoutManager,
  options: WorkbenchAdaptiveWindowLayoutOptions,
): WorkbenchWindowLayout<Id> {
  const bounds = options.bounds;
  const layout = manager.layout({
    bounds,
    tileOptions: workbenchAdaptiveTileOptions(options),
  });
  return workbenchWindowLayout<Id>(bounds, layout);
}

/**
 * Calculates the visible content viewport after reserving a final column and/or row for scrollbars.
 *
 * The second pass handles coupled overflow: adding a vertical scrollbar can force horizontal overflow, and adding a
 * horizontal scrollbar can force vertical overflow.
 */
export function workbenchContentViewport(options: WorkbenchContentViewportOptions): Rectangle {
  let width = options.inner.width;
  let height = options.inner.height;
  let needsVertical = options.contentHeight > height;
  let needsHorizontal = options.contentWidth > width;
  if (needsVertical) width = Math.max(0, width - 1);
  if (needsHorizontal) height = Math.max(0, height - 1);
  needsVertical = options.contentHeight > height;
  needsHorizontal = options.contentWidth > width;
  if (needsVertical && width === options.inner.width) width = Math.max(0, width - 1);
  if (needsHorizontal && height === options.inner.height) height = Math.max(0, height - 1);
  return { column: options.inner.column, row: options.inner.row, width, height };
}

/** Calculates the workspace row offset that keeps an active window/panel visible. */
export function workbenchRevealActiveRowOffset(options: WorkbenchRevealActiveRowOptions): number | undefined {
  if (!options.activeRect) return undefined;
  if (options.contentHeight <= options.viewportHeight) return 0;
  const maxOffset = Math.max(0, options.contentHeight - Math.max(0, options.viewportHeight));
  const offset = Math.max(0, Math.min(maxOffset, options.offsetRows));
  const top = options.activeRect.row;
  const bottom = options.activeRect.row + options.activeRect.height;
  if (top < offset) return Math.max(0, Math.min(maxOffset, top));
  if (bottom > offset + options.viewportHeight) {
    return Math.max(0, Math.min(maxOffset, bottom - options.viewportHeight));
  }
  return undefined;
}

/** Filters virtual workspace rectangles to those intersecting the visible workspace viewport. */
export function workbenchVisibleWindowRectsInto<Id extends string>(
  target: Map<Id, Rectangle>,
  rects: ReadonlyMap<Id, Rectangle>,
  options: WorkbenchVisibleWindowRectsOptions,
): Map<Id, Rectangle> {
  target.clear();
  for (const [id, rect] of rects) {
    if (rectanglesIntersect(rect, options.viewport)) target.set(id, rect);
  }
  return target;
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

/** Locates scrollbars for scrollable content inside a workbench window. */
export function workbenchWindowScrollbarRects(
  options: WorkbenchWindowScrollbarRectOptions,
): WorkbenchWindowScrollbarRects {
  const inner = options.inner;
  const viewport = options.viewport;
  const vertical = options.overflow.rows.scrollbarVisible && viewport.height > 0
    ? {
      column: inner.column + inner.width - 1,
      row: viewport.row,
      width: 1,
      height: viewport.height,
    }
    : undefined;
  const horizontal = options.overflow.columns.scrollbarVisible && viewport.width > 0
    ? {
      column: viewport.column,
      row: inner.row + inner.height - 1,
      width: viewport.width,
      height: 1,
    }
    : undefined;
  return { vertical, horizontal };
}

/** Projects vertical scrollbar glyph cells into a caller-owned buffer. */
export function workbenchVerticalScrollbarCellsInto<TCell extends WorkbenchScrollbarCell>(
  cells: TCell[],
  rect: Rectangle,
  thumb: ScrollbarThumb,
): TCell[] {
  if (rect.width <= 0 || rect.height <= 0) {
    cells.length = 0;
    return cells;
  }
  const column = rect.column + rect.width - 1;
  for (let row = 0; row < rect.height; row += 1) {
    const cell = cells[row] ??= { column: 0, row: 0, glyph: "" } as TCell;
    cell.column = column;
    cell.row = rect.row + row;
    cell.glyph = scrollbarGlyph(row, thumb);
  }
  cells.length = rect.height;
  return cells;
}

/** Projects horizontal scrollbar glyph cells into a caller-owned buffer. */
export function workbenchHorizontalScrollbarCellsInto<TCell extends WorkbenchScrollbarCell>(
  cells: TCell[],
  rect: Rectangle,
  thumb: ScrollbarThumb,
): TCell[] {
  if (rect.width <= 0 || rect.height <= 0) {
    cells.length = 0;
    return cells;
  }
  const row = rect.row + rect.height - 1;
  for (let column = 0; column < rect.width; column += 1) {
    const cell = cells[column] ??= { column: 0, row: 0, glyph: "" } as TCell;
    cell.column = rect.column + column;
    cell.row = row;
    cell.glyph = scrollbarGlyph(column, thumb);
  }
  cells.length = rect.width;
  return cells;
}

/** Projects a workspace vertical scrollbar into caller-owned render command storage. */
export function workbenchWorkspaceScrollbarRenderCommandsInto<TCell extends WorkbenchScrollbarCell>(
  target: WorkbenchScrollbarRenderCommand<TCell>[],
  options: WorkbenchVerticalScrollbarRectOptions & { thumb: ScrollbarThumb },
): WorkbenchScrollbarRenderCommand<TCell>[] {
  const rect = workbenchVerticalScrollbarRect(options);
  if (!rect) {
    target.length = 0;
    return target;
  }
  const command = scrollbarRenderCommand(target, 0, "vertical", rect);
  workbenchVerticalScrollbarCellsInto(command.cells, rect, options.thumb);
  target[0] = command;
  target.length = 1;
  return target;
}

/** Projects per-window content scrollbars into caller-owned render command storage. */
export function workbenchWindowScrollbarRenderCommandsInto<TCell extends WorkbenchScrollbarCell>(
  target: WorkbenchScrollbarRenderCommand<TCell>[],
  options: WorkbenchWindowScrollbarRectOptions,
): WorkbenchScrollbarRenderCommand<TCell>[] {
  const rects = workbenchWindowScrollbarRects(options);
  let written = 0;
  if (rects.vertical) {
    const command = scrollbarRenderCommand(target, written, "vertical", rects.vertical);
    workbenchVerticalScrollbarCellsInto(command.cells, rects.vertical, options.overflow.rows.thumb);
    target[written] = command;
    written += 1;
  }
  if (rects.horizontal) {
    const command = scrollbarRenderCommand(target, written, "horizontal", rects.horizontal);
    workbenchHorizontalScrollbarCellsInto(command.cells, rects.horizontal, options.overflow.columns.thumb);
    target[written] = command;
    written += 1;
  }
  target.length = written;
  return target;
}

function scrollbarRenderCommand<TCell extends WorkbenchScrollbarCell>(
  target: WorkbenchScrollbarRenderCommand<TCell>[],
  index: number,
  axis: WorkbenchScrollbarAxis,
  rect: Rectangle,
): WorkbenchScrollbarRenderCommand<TCell> {
  const command = target[index] ?? {
    axis,
    rect: { column: 0, row: 0, width: 0, height: 0 },
    cells: [],
  };
  command.axis = axis;
  command.rect.column = rect.column;
  command.rect.row = rect.row;
  command.rect.width = rect.width;
  command.rect.height = rect.height;
  return command;
}

function rectanglesIntersect(left: Rectangle, right: Rectangle): boolean {
  return left.column < right.column + right.width && left.column + left.width > right.column &&
    left.row < right.row + right.height && left.row + left.height > right.row;
}
