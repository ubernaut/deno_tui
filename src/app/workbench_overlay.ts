// Copyright 2023 Im-Beast. MIT license.
import type { ModalInspection } from "../components/modal.ts";
import type { Rectangle } from "../types.ts";
import { clipRect } from "./hit_targets.ts";
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

/** Returns centered modal geometry shared by terminal and browser workbench adapters. */
export function layoutWorkbenchModal(options: WorkbenchModalLayoutOptions): WorkbenchModalLayout {
  const bounds = normalizeRect(options.bounds);
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
    inner: insetRect(clippedRect, 1),
    shadow: clipRect({
      column: clippedRect.column + 2,
      row: clippedRect.row + 1,
      width: clippedRect.width,
      height: clippedRect.height,
    }, bounds),
  };
}

/** Clips a popover/dropdown rectangle and returns undefined when it is too small to render. */
export function layoutWorkbenchPopover(options: WorkbenchPopoverLayoutOptions): Rectangle | undefined {
  const minWidth = Math.max(0, Math.floor(options.minWidth ?? 8));
  const minHeight = Math.max(0, Math.floor(options.minHeight ?? 1));
  const clipped = clipRect(normalizeRect(options.rect), normalizeRect(options.bounds));
  return clipped.width < minWidth || clipped.height < minHeight ? undefined : clipped;
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

function insetRect(rect: Rectangle, amount: number): Rectangle {
  const inset = Math.max(0, Math.floor(amount));
  return {
    column: rect.column + inset,
    row: rect.row + inset,
    width: Math.max(0, rect.width - inset * 2),
    height: Math.max(0, rect.height - inset * 2),
  };
}

function normalizeRect(rect: Rectangle): Rectangle {
  return {
    column: Math.floor(rect.column),
    row: Math.floor(rect.row),
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  };
}
