// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { setRectangle } from "../utils/rectangles.ts";
import { textWidth } from "../utils/strings.ts";
import {
  layoutWorkbenchButtonRowInto,
  type WorkbenchButtonRowItem,
  type WorkbenchButtonRowPlacement,
} from "./workbench_control_layout.ts";
import type { WorkbenchButtonState, WorkbenchButtonTone } from "./workbench_button_style.ts";
import { buttonText, fitCellText } from "./workbench_frame.ts";

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

/** Renderer-neutral command for painting the shelf or tab row prefix. */
export interface WorkbenchShelfPrefixRenderCommand {
  kind: "prefix";
  text: string;
  rect: Rectangle;
}

/** Renderer-neutral command for painting one shelf or tab button. */
export interface WorkbenchShelfButtonRenderCommand<TId extends string = string> {
  kind: "button";
  id: TId;
  label: string;
  text: string;
  rect: Rectangle;
  hitRect: Rectangle;
  selected: boolean;
  hidden: boolean;
  state: WorkbenchButtonState;
  tone: WorkbenchButtonTone;
}

/** Renderer-neutral command for painting a shelf or fullscreen tab row. */
export type WorkbenchShelfRenderCommand<TId extends string = string> =
  | WorkbenchShelfPrefixRenderCommand
  | WorkbenchShelfButtonRenderCommand<TId>;

/** Reusable storage for shelf and tab layout projection. */
export interface WorkbenchShelfLayoutBuffers<TId extends string = string> {
  buttons: WorkbenchShelfButton<TId>[];
  items: WorkbenchShelfButtonRowItem<TId>[];
  placements: WorkbenchButtonRowPlacement<TId>[];
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
  return layoutWorkbenchShelfInto(createWorkbenchShelfLayoutBuffers<TId>(), options);
}

/** Calculates a minimized-window shelf row into caller-owned storage. */
export function layoutWorkbenchShelfInto<TId extends string>(
  target: WorkbenchShelfLayoutBuffers<TId>,
  options: WorkbenchShelfLayoutOptions<TId>,
): WorkbenchShelfLayout<TId> {
  return layoutButtonRowInto(target, {
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
  return layoutWorkbenchTabsInto(createWorkbenchShelfLayoutBuffers<TId>(), options);
}

/** Calculates fullscreen window tabs into caller-owned storage. */
export function layoutWorkbenchTabsInto<TId extends string>(
  target: WorkbenchShelfLayoutBuffers<TId>,
  options: WorkbenchTabLayoutOptions<TId>,
): WorkbenchShelfLayout<TId> {
  return layoutButtonRowInto(target, {
    row: options.row,
    column: options.column,
    width: options.width,
    prefix: options.prefix ?? "windows ",
    entries: options.tabs,
    mode: "tabs",
  });
}

/** Creates reusable storage for shelf and tab layout projection. */
export function createWorkbenchShelfLayoutBuffers<TId extends string = string>(): WorkbenchShelfLayoutBuffers<TId> {
  return {
    buttons: [],
    items: [],
    placements: [],
  };
}

/** Projects a shelf or fullscreen tab layout into clipped renderer-neutral paint and hit commands. */
export function workbenchShelfRenderCommandsInto<TId extends string>(
  target: WorkbenchShelfRenderCommand<TId>[],
  layout: WorkbenchShelfLayout<TId>,
): WorkbenchShelfRenderCommand<TId>[] {
  let written = 0;
  const prefixWidth = Math.max(0, layout.prefixRect.width);
  if (prefixWidth > 0 && layout.prefix.length > 0) {
    const command = (target[written] ?? {
      kind: "prefix",
      text: "",
      rect: { column: 0, row: 0, width: 0, height: 1 },
    }) as WorkbenchShelfPrefixRenderCommand;
    command.kind = "prefix";
    command.text = fitCellText(layout.prefix, prefixWidth);
    setRectangle(command.rect, layout.prefixRect.column, layout.prefixRect.row, prefixWidth, 1);
    target[written] = command;
    written += 1;
  }

  for (let index = 0; index < layout.buttons.length; index += 1) {
    const button = layout.buttons[index]!;
    const text = buttonText(button.label);
    const width = Math.max(0, Math.min(textWidth(text), button.rect.width));
    if (width <= 0) continue;
    const command = (target[written] ?? {
      kind: "button",
      id: button.id,
      label: "",
      text: "",
      rect: { column: 0, row: 0, width: 0, height: 1 },
      hitRect: { column: 0, row: 0, width: 0, height: 1 },
      selected: false,
      hidden: false,
      state: "base",
      tone: "default",
    }) as WorkbenchShelfButtonRenderCommand<TId>;
    command.kind = "button";
    command.id = button.id;
    command.label = button.label;
    command.text = fitCellText(text, width);
    command.selected = button.selected;
    command.hidden = button.hidden;
    command.state = button.selected ? "active" : "base";
    command.tone = button.hidden ? "muted" : "default";
    setRectangle(command.rect, button.rect.column, button.rect.row, width, 1);
    setRectangle(command.hitRect, button.rect.column, button.rect.row, width, 1);
    target[written] = command;
    written += 1;
  }

  target.length = written;
  return target;
}

function layoutButtonRowInto<TId extends string>(
  target: WorkbenchShelfLayoutBuffers<TId>,
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
  const items = target.items;
  items.length = options.entries.length;

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
  layoutWorkbenchButtonRowInto(target.placements, items, buttonBounds, options.row);
  const placements = target.placements;
  const buttons = target.buttons;
  buttons.length = placements.length;
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index]!;
    const item = placement.item as WorkbenchShelfButtonRowItem<TId>;
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

/** Intermediate toolbar item state used while projecting shelf and tab layouts. */
export interface WorkbenchShelfButtonRowItem<TId extends string> extends WorkbenchButtonRowItem<TId> {
  selected: boolean;
  hidden: boolean;
}
