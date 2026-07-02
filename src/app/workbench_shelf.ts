// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { textWidth } from "../utils/strings.ts";
import { layoutWorkbenchButtonRow, type WorkbenchButtonRowItem } from "./workbench_control_layout.ts";

/** Source item for minimized-window shelf buttons. */
export interface WorkbenchShelfSource<TId extends string = string> {
  id: TId;
  title: string;
}

/** Source item for fullscreen-window tab buttons. */
export interface WorkbenchTabSource<TId extends string = string> extends WorkbenchShelfSource<TId> {
  selected?: boolean;
  hidden?: boolean;
}

/** Renderer-neutral shelf or tab button geometry. */
export interface WorkbenchShelfButton<TId extends string = string> {
  id: TId;
  label: string;
  rect: Rectangle;
  selected: boolean;
  hidden: boolean;
}

/** Renderer-neutral shelf or tab row layout. */
export interface WorkbenchShelfLayout<TId extends string = string> {
  prefix: string;
  prefixRect: Rectangle;
  buttons: WorkbenchShelfButton<TId>[];
}

/** Options for calculating minimized-window shelf layout. */
export interface WorkbenchShelfLayoutOptions<TId extends string = string> {
  row: number;
  column: number;
  width: number;
  prefix?: string;
  entries: readonly WorkbenchShelfSource<TId>[];
}

/** Options for calculating fullscreen tab layout. */
export interface WorkbenchTabLayoutOptions<TId extends string = string> {
  row: number;
  column: number;
  width: number;
  prefix?: string;
  tabs: readonly WorkbenchTabSource<TId>[];
}

/** Minimal window inspection shape used to project shelf and tab row sources. */
export interface WorkbenchShelfWindowInspectionShape {
  id: string;
  fullscreen?: boolean;
  minimized?: boolean;
  closed?: boolean;
}

/** Projects minimized, open windows into a caller-owned shelf source buffer. */
export function workbenchShelfEntriesInto<TId extends string>(
  target: WorkbenchShelfSource<TId>[],
  windows: readonly WorkbenchShelfWindowInspectionShape[],
  titleForId: (id: TId) => string,
): WorkbenchShelfSource<TId>[] {
  target.length = 0;
  for (let index = 0; index < windows.length; index += 1) {
    const entry = windows[index]!;
    if (!entry.minimized || entry.closed) continue;
    const id = entry.id as TId;
    target.push({ id, title: titleForId(id) });
  }
  return target;
}

/** Projects fullscreen tabs into a caller-owned tab source buffer. */
export function workbenchTabEntriesInto<TId extends string>(
  target: WorkbenchTabSource<TId>[],
  tabs: readonly WorkbenchShelfWindowInspectionShape[],
  titleForId: (id: TId) => string,
): WorkbenchTabSource<TId>[] {
  target.length = tabs.length;
  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index]!;
    const id = tab.id as TId;
    target[index] = {
      id,
      title: titleForId(id),
      selected: tab.fullscreen === true,
      hidden: tab.minimized === true,
    };
  }
  return target;
}

/** Calculates a minimized-window shelf row with clipped button hit rectangles. */
export function layoutWorkbenchShelf<TId extends string>(
  options: WorkbenchShelfLayoutOptions<TId>,
): WorkbenchShelfLayout<TId> {
  return layoutButtonRow({
    row: options.row,
    column: options.column,
    width: options.width,
    prefix: options.prefix ?? "minimized ",
    entries: options.entries,
    mode: "shelf",
  });
}

/** Calculates fullscreen window tabs with selected/hidden markers. */
export function layoutWorkbenchTabs<TId extends string>(
  options: WorkbenchTabLayoutOptions<TId>,
): WorkbenchShelfLayout<TId> {
  return layoutButtonRow({
    row: options.row,
    column: options.column,
    width: options.width,
    prefix: options.prefix ?? "windows ",
    entries: options.tabs,
    mode: "tabs",
  });
}

function layoutButtonRow<TId extends string>(
  options: {
    row: number;
    column: number;
    width: number;
    prefix: string;
    entries: ReadonlyArray<WorkbenchShelfSource<TId> | WorkbenchTabSource<TId>>;
    mode: "shelf" | "tabs";
  },
): WorkbenchShelfLayout<TId> {
  const right = options.column + Math.max(0, options.width);
  const prefixWidth = Math.min(textWidth(options.prefix), Math.max(0, right - options.column));
  const items = new Array<ShelfButtonRowItem<TId>>(options.entries.length);

  for (let index = 0; index < options.entries.length; index += 1) {
    const entry = options.entries[index]!;
    const tab = entry as WorkbenchTabSource<TId>;
    const selected = options.mode === "tabs" && tab.selected === true;
    const hidden = options.mode === "shelf" || (options.mode === "tabs" && tab.hidden === true);
    const label = options.mode === "tabs" ? `${selected ? "●" : hidden ? "○" : " "} ${entry.title}` : entry.title;
    items[index] = { action: entry.id, label, selected, hidden };
  }
  const buttonBounds = {
    column: options.column + prefixWidth,
    row: options.row,
    width: Math.max(0, options.width - prefixWidth),
    height: 1,
  };
  const placements = layoutWorkbenchButtonRow(items, buttonBounds, options.row).placements;
  const buttons = new Array<WorkbenchShelfButton<TId>>(placements.length);
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index]!;
    const item = placement.item as ShelfButtonRowItem<TId>;
    buttons[index] = {
      id: item.action,
      label: item.label,
      rect: placement.rect,
      selected: item.selected,
      hidden: item.hidden,
    };
  }

  return {
    prefix: options.prefix,
    prefixRect: { column: options.column, row: options.row, width: prefixWidth, height: 1 },
    buttons,
  };
}

interface ShelfButtonRowItem<TId extends string> extends WorkbenchButtonRowItem<TId> {
  selected: boolean;
  hidden: boolean;
}
