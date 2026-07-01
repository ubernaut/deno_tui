// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { textWidth } from "../utils/strings.ts";
import { buttonText } from "./workbench_frame.ts";

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

/** Calculates a minimized-window shelf row with clipped button hit rectangles. */
export function layoutWorkbenchShelf<TId extends string>(
  options: WorkbenchShelfLayoutOptions<TId>,
): WorkbenchShelfLayout<TId> {
  return layoutButtonRow({
    row: options.row,
    column: options.column,
    width: options.width,
    prefix: options.prefix ?? "minimized ",
    entries: options.entries.map((entry) => ({ ...entry, selected: false, hidden: true })),
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
    entries: options.tabs.map((tab) => ({
      ...tab,
      title: `${tab.selected ? "●" : tab.hidden ? "○" : " "} ${tab.title}`,
      selected: tab.selected === true,
      hidden: tab.hidden === true,
    })),
  });
}

function layoutButtonRow<TId extends string>(
  options: {
    row: number;
    column: number;
    width: number;
    prefix: string;
    entries: ReadonlyArray<WorkbenchTabSource<TId>>;
  },
): WorkbenchShelfLayout<TId> {
  const right = options.column + Math.max(0, options.width);
  const prefixWidth = Math.min(textWidth(options.prefix), Math.max(0, right - options.column));
  let column = options.column + prefixWidth;
  const buttons: WorkbenchShelfButton<TId>[] = [];

  for (const entry of options.entries) {
    if (column >= right) break;
    const available = Math.max(0, right - column);
    const width = Math.min(textWidth(buttonText(entry.title)), available);
    if (width <= 0) break;
    buttons.push({
      id: entry.id,
      label: entry.title,
      rect: { column, row: options.row, width, height: 1 },
      selected: entry.selected === true,
      hidden: entry.hidden === true,
    });
    column += width + 1;
  }

  return {
    prefix: options.prefix,
    prefixRect: { column: options.column, row: options.row, width: prefixWidth, height: 1 },
    buttons,
  };
}
