// Copyright 2023 Im-Beast. MIT license.
import { type ModalInspection, renderModalRows } from "../components/modal.ts";
import type { Rectangle } from "../types.ts";
import { normalizeRectangle } from "../utils/rectangles.ts";
import { clipRect, inset } from "./hit_targets.ts";
import type { WorkbenchButtonTone } from "./workbench_button_style.ts";
import type { WorkbenchButtonRowItem } from "./workbench_control_layout.ts";

/** Options for laying out a centered workbench modal overlay. */
export interface WorkbenchModalLayoutOptions {
  bounds: Rectangle;
  contentHeight: number;
  minWidth?: number;
  maxWidth?: number;
  horizontalMargin?: number;
  minHeight?: number;
  verticalMargin?: number;
  topMargin?: number;
}

/** Serializable geometry for a modal overlay and its optional drop shadow. */
export interface WorkbenchModalLayout {
  rect: Rectangle;
  inner: Rectangle;
  shadow: Rectangle;
}

/** Options for projecting modal actions into workbench button-row items. */
export interface WorkbenchModalActionButtonOptions {
  dangerTone?: WorkbenchButtonTone;
  defaultTone?: WorkbenchButtonTone;
}

/** Options for clipping an already-positioned workbench popover/dropdown. */
export interface WorkbenchPopoverLayoutOptions {
  rect: Rectangle;
  bounds: Rectangle;
  minWidth?: number;
  minHeight?: number;
}

/** Options for projecting a dropdown/popover into renderer-neutral row commands. */
export interface WorkbenchDropdownOverlayRenderOptions {
  rect: Rectangle;
  bounds: Rectangle;
  items: readonly string[];
  selectedIndex?: number;
  itemIndexes?: readonly number[];
}

/** Renderer-neutral command for painting a workbench dropdown/popover overlay. */
export interface WorkbenchDropdownOverlayRenderCommand {
  kind: "fill" | "top" | "item" | "bottom";
  rect: Rectangle;
  text?: string;
  selected?: boolean;
  sourceIndex?: number;
  itemIndex?: number;
  hitRect?: Rectangle;
}

/** Options for projecting modal content rows into renderer-neutral row commands. */
export interface WorkbenchModalRowRenderOptions {
  inspection: ModalInspection;
  inner: Rectangle;
  contentWidth?: number;
}

/** Renderer-neutral command for painting modal title/body/action rows. */
export interface WorkbenchModalRowRenderCommand {
  kind: "title" | "body" | "actions";
  rect: Rectangle;
  text: string;
}

/** Returns centered modal geometry shared by terminal and browser workbench adapters. */
export function layoutWorkbenchModal(options: WorkbenchModalLayoutOptions): WorkbenchModalLayout {
  const bounds = normalizeRectangle(options.bounds);
  const horizontalMargin = Math.max(0, Math.floor(options.horizontalMargin ?? 8));
  const verticalMargin = Math.max(0, Math.floor(options.verticalMargin ?? 6));
  const topMargin = Math.max(0, Math.floor(options.topMargin ?? 1));
  const minWidth = Math.max(1, Math.floor(options.minWidth ?? 38));
  const maxWidth = Math.max(minWidth, Math.floor(options.maxWidth ?? 72));
  const minHeight = Math.max(1, Math.floor(options.minHeight ?? 9));
  const availableWidth = Math.max(1, bounds.width - horizontalMargin);
  const availableHeight = Math.max(1, bounds.height - verticalMargin);
  const width = Math.min(Math.max(minWidth, availableWidth), maxWidth, bounds.width);
  const height = Math.min(Math.max(minHeight, Math.floor(options.contentHeight)), Math.max(minHeight, availableHeight));
  const rect = {
    column: bounds.column + Math.max(0, Math.floor((bounds.width - width) / 2)),
    row: bounds.row + Math.max(topMargin, Math.floor((bounds.height - height) / 2)),
    width,
    height: Math.min(height, bounds.height),
  };
  const clippedRect = clipRect(rect, bounds);
  return {
    rect: clippedRect,
    inner: inset(clippedRect, 1),
    shadow: clipRect({
      column: clippedRect.column + 2,
      row: clippedRect.row + 1,
      width: clippedRect.width,
      height: clippedRect.height,
    }, bounds),
  };
}

/** Projects modal rows into reusable renderer-neutral row commands. */
export function workbenchModalRowRenderCommandsInto(
  target: WorkbenchModalRowRenderCommand[],
  options: WorkbenchModalRowRenderOptions,
): WorkbenchModalRowRenderCommand[] {
  const inner = normalizeRectangle(options.inner);
  const contentWidth = Math.max(0, Math.floor(options.contentWidth ?? inner.width));
  if (inner.width <= 0 || inner.height <= 0 || contentWidth <= 0) {
    target.length = 0;
    return target;
  }

  const rows = renderModalRows(options.inspection, { width: contentWidth, height: inner.height });
  let written = 0;
  for (let index = 0; index < rows.length && index < inner.height; index += 1) {
    const actionRow = options.inspection.actions.length > 0 && index === rows.length - 1;
    const titleRow = index === 0;
    const command = writeModalRowCommand(
      target,
      written++,
      actionRow ? "actions" : titleRow ? "title" : "body",
      {
        column: inner.column,
        row: inner.row + index,
        width: inner.width,
        height: 1,
      },
      actionRow ? "" : rows[index]!,
    );
    command.text = fitPlain(command.text, command.rect.width);
  }
  target.length = written;
  return target;
}

/** Clips a popover/dropdown rectangle and returns undefined when it is too small to render. */
export function layoutWorkbenchPopover(options: WorkbenchPopoverLayoutOptions): Rectangle | undefined {
  const minWidth = Math.max(0, Math.floor(options.minWidth ?? 8));
  const minHeight = Math.max(0, Math.floor(options.minHeight ?? 1));
  const clipped = clipRect(normalizeRectangle(options.rect), normalizeRectangle(options.bounds));
  return clipped.width < minWidth || clipped.height < minHeight ? undefined : clipped;
}

/** Projects dropdown/popover rows and hit rectangles into reusable command storage. */
export function workbenchDropdownOverlayRenderCommandsInto(
  target: WorkbenchDropdownOverlayRenderCommand[],
  options: WorkbenchDropdownOverlayRenderOptions,
): WorkbenchDropdownOverlayRenderCommand[] {
  const rect = normalizeRectangle(options.rect);
  const bounds = normalizeRectangle(options.bounds);
  const clipped = layoutWorkbenchPopover({ rect, bounds });
  if (!clipped || options.items.length === 0) {
    target.length = 0;
    return target;
  }

  let written = 0;
  writeDropdownCommand(target, written++, "fill", clipped);
  written = writeDropdownRow(target, written, "top", rect.row, rect.column, dropdownBorder("top", rect.width), bounds);

  const lastItemRow = rect.row + rect.height - 1;
  for (let index = 0; index < options.items.length; index += 1) {
    const row = rect.row + 1 + index;
    if (row >= lastItemRow) break;
    const selected = options.selectedIndex === index;
    const marker = selected ? "●" : "○";
    const text = `│ ${fitPlain(`${marker} ${options.items[index]!}`, rect.width - 4)} │`;
    const next = writeDropdownRow(target, written, "item", row, rect.column, text, bounds);
    if (next !== written) {
      const command = target[written]!;
      command.selected = selected;
      command.sourceIndex = index;
      command.itemIndex = options.itemIndexes?.[index] ?? index;
      command.hitRect = clipRect({
        column: rect.column + 1,
        row,
        width: Math.max(0, rect.width - 2),
        height: 1,
      }, bounds);
    }
    written = next;
  }

  written = writeDropdownRow(
    target,
    written,
    "bottom",
    rect.row + rect.height - 1,
    rect.column,
    dropdownBorder("bottom", rect.width),
    bounds,
  );
  target.length = written;
  return target;
}

/** Projects modal actions into reusable button-row items shared by terminal and browser adapters. */
export function workbenchModalActionButtonsInto(
  target: WorkbenchButtonRowItem<number>[],
  inspection: Pick<ModalInspection, "actions" | "selectedActionIndex">,
  options: WorkbenchModalActionButtonOptions = {},
): WorkbenchButtonRowItem<number>[] {
  const dangerTone = options.dangerTone ?? "danger";
  const defaultTone = options.defaultTone ?? "default";
  target.length = 0;
  for (let index = 0; index < inspection.actions.length; index += 1) {
    const action = inspection.actions[index]!;
    target.push({
      label: action.label,
      action: index,
      disabled: action.disabled,
      active: index === inspection.selectedActionIndex,
      tone: action.destructive ? dangerTone : defaultTone,
    });
  }
  return target;
}

function writeModalRowCommand(
  target: WorkbenchModalRowRenderCommand[],
  index: number,
  kind: WorkbenchModalRowRenderCommand["kind"],
  rect: Rectangle,
  text: string,
): WorkbenchModalRowRenderCommand {
  const command = target[index] ?? {
    kind,
    rect: { column: 0, row: 0, width: 0, height: 0 },
    text: "",
  };
  command.kind = kind;
  command.rect.column = rect.column;
  command.rect.row = rect.row;
  command.rect.width = rect.width;
  command.rect.height = rect.height;
  command.text = text;
  target[index] = command;
  return command;
}

function writeDropdownRow(
  target: WorkbenchDropdownOverlayRenderCommand[],
  index: number,
  kind: WorkbenchDropdownOverlayRenderCommand["kind"],
  row: number,
  column: number,
  text: string,
  bounds: Rectangle,
): number {
  if (row < bounds.row || row >= bounds.row + bounds.height) return index;
  const start = Math.max(column, bounds.column);
  const end = Math.min(column + text.length, bounds.column + bounds.width);
  if (end <= start) return index;
  const visibleWidth = end - start;
  const leftTrim = Math.max(0, start - column);
  const command = writeDropdownCommand(target, index, kind, {
    column: start,
    row,
    width: visibleWidth,
    height: 1,
  });
  command.text = fitPlain(text.slice(leftTrim, leftTrim + visibleWidth), visibleWidth);
  return index + 1;
}

function writeDropdownCommand(
  target: WorkbenchDropdownOverlayRenderCommand[],
  index: number,
  kind: WorkbenchDropdownOverlayRenderCommand["kind"],
  rect: Rectangle,
): WorkbenchDropdownOverlayRenderCommand {
  const command = target[index] ?? {
    kind,
    rect: { column: 0, row: 0, width: 0, height: 0 },
  };
  command.kind = kind;
  command.rect.column = rect.column;
  command.rect.row = rect.row;
  command.rect.width = rect.width;
  command.rect.height = rect.height;
  delete command.text;
  delete command.selected;
  delete command.sourceIndex;
  delete command.itemIndex;
  delete command.hitRect;
  target[index] = command;
  return command;
}

function dropdownBorder(kind: "top" | "bottom", width: number): string {
  const innerWidth = Math.max(0, width - 2);
  return kind === "top" ? `┌${"─".repeat(innerWidth)}┐` : `└${"─".repeat(innerWidth)}┘`;
}

function fitPlain(text: string, width: number): string {
  const normalizedWidth = Math.max(0, Math.floor(width));
  if (text.length >= normalizedWidth) return text.slice(0, normalizedWidth);
  return text.padEnd(normalizedWidth, " ");
}
