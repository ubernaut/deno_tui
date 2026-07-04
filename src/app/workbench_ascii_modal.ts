// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { clipRect, inset } from "./hit_targets.ts";
import { workbenchAsciiConfigVisibleRowStart } from "./workbench_ascii.ts";
import {
  layoutWorkbenchButtonRowInto,
  type WorkbenchButtonRowItem,
  type WorkbenchButtonRowPlacement,
  type WorkbenchButtonRowRenderCommand,
  workbenchButtonRowRenderCommandsInto,
} from "./workbench_control_layout.ts";

/** Options for laying out the Three ASCII renderer configuration modal. */
export interface WorkbenchAsciiConfigModalLayoutOptions {
  bounds: Rectangle;
  rowCount: number;
  minWidth?: number;
  maxWidth?: number;
  horizontalMargin?: number;
  minHeight?: number;
  verticalMargin?: number;
  topMargin?: number;
}

/** Renderer-neutral geometry for the Three ASCII renderer configuration modal. */
export interface WorkbenchAsciiConfigModalLayout {
  rect: Rectangle;
  inner: Rectangle;
  shadow: Rectangle;
  rowsTop: number;
  actionRow: number;
  footerRow: number;
  visibleRows: number;
}

/** Concrete row placement for a visible Three ASCII config modal row. */
export interface WorkbenchAsciiConfigRowPlacement<Row> {
  row: Row;
  rowIndex: number;
  selected: boolean;
  rect: Rectangle;
  previousRect: Rectangle;
  nextRect: Rectangle;
}

/** Render command for one visible Three ASCII config row. */
export interface WorkbenchAsciiConfigRowRenderCommand<Row> {
  kind: "fill" | "text";
  row: Row;
  rowIndex: number;
  selected: boolean;
  rect: Rectangle;
  text: string;
}

/** Action ids used by Three ASCII config modal buttons. */
export type WorkbenchAsciiConfigModalAction = "cancel" | "apply" | "ok";

/** Retained buffers used by Three ASCII config modal render adapters. */
export class WorkbenchAsciiConfigModalBufferCache<Row> {
  /** Reusable visible row placement buffer. */
  readonly rowPlacements: WorkbenchAsciiConfigRowPlacement<Row>[] = [];

  /** Reusable row render-command buffer. */
  readonly rowRenderCommands: WorkbenchAsciiConfigRowRenderCommand<Row>[] = [];

  /** Reusable action button descriptors. */
  readonly actionItems: WorkbenchButtonRowItem<WorkbenchAsciiConfigModalAction>[] = [];

  /** Reusable action button placements. */
  readonly actionPlacements: WorkbenchButtonRowPlacement<WorkbenchAsciiConfigModalAction>[] = [];

  /** Reusable action button render commands. */
  readonly actionCommands: WorkbenchButtonRowRenderCommand<WorkbenchAsciiConfigModalAction>[] = [];

  /** Clears retained buffers without replacing their array identities. */
  clear(): void {
    this.rowPlacements.length = 0;
    this.rowRenderCommands.length = 0;
    this.actionItems.length = 0;
    this.actionPlacements.length = 0;
    this.actionCommands.length = 0;
  }

  /** Reports retained buffer sizes for diagnostics and tests. */
  inspect(): {
    rowPlacements: number;
    rowRenderCommands: number;
    actionItems: number;
    actionPlacements: number;
    actionCommands: number;
  } {
    return {
      rowPlacements: this.rowPlacements.length,
      rowRenderCommands: this.rowRenderCommands.length,
      actionItems: this.actionItems.length,
      actionPlacements: this.actionPlacements.length,
      actionCommands: this.actionCommands.length,
    };
  }
}

/** Calculates centered, clipped geometry for the Three ASCII renderer configuration modal. */
export function layoutWorkbenchAsciiConfigModal(
  options: WorkbenchAsciiConfigModalLayoutOptions,
): WorkbenchAsciiConfigModalLayout {
  const bounds = normalizeRect(options.bounds);
  const minWidth = Math.max(1, Math.floor(options.minWidth ?? 54));
  const maxWidth = Math.max(minWidth, Math.floor(options.maxWidth ?? 82));
  const horizontalMargin = Math.max(0, Math.floor(options.horizontalMargin ?? 8));
  const minHeight = Math.max(1, Math.floor(options.minHeight ?? 16));
  const verticalMargin = Math.max(0, Math.floor(options.verticalMargin ?? 4));
  const topMargin = Math.max(0, Math.floor(options.topMargin ?? 1));
  const rowCount = Math.max(0, Math.floor(options.rowCount));
  const width = Math.min(Math.max(minWidth, bounds.width - horizontalMargin), maxWidth, bounds.width);
  const height = Math.min(Math.max(minHeight, rowCount + 7), Math.max(10, bounds.height - verticalMargin));
  const rect = clipRect({
    column: bounds.column + Math.max(0, Math.floor((bounds.width - width) / 2)),
    row: bounds.row + Math.max(topMargin, Math.floor((bounds.height - height) / 2)),
    width,
    height,
  }, bounds);
  const inner = inset(rect, 1);
  const rowsTop = inner.row + 2;
  const actionRow = inner.row + inner.height - 2;
  const footerRow = inner.row + inner.height - 1;
  return {
    rect,
    inner,
    shadow: clipRect({
      column: rect.column + 2,
      row: rect.row + 1,
      width: rect.width,
      height: rect.height,
    }, bounds),
    rowsTop,
    actionRow,
    footerRow,
    visibleRows: Math.max(0, actionRow - rowsTop),
  };
}

/** Projects visible Three ASCII config rows into exact row and previous/next hit rectangles. */
export function workbenchAsciiConfigRowPlacementsInto<Row>(
  target: WorkbenchAsciiConfigRowPlacement<Row>[],
  rows: readonly Row[],
  options: {
    inner: Rectangle;
    rowsTop: number;
    visibleRows: number;
    selectedIndex: number;
    splitMinWidth?: number;
  },
): WorkbenchAsciiConfigRowPlacement<Row>[] {
  target.length = 0;
  const visibleRows = Math.max(0, Math.floor(options.visibleRows));
  const firstRow = workbenchAsciiConfigVisibleRowStart(options.selectedIndex, rows.length, visibleRows);
  const count = Math.min(visibleRows, rows.length);
  const splitMinWidth = Math.max(1, Math.floor(options.splitMinWidth ?? 6));
  for (let visibleIndex = 0; visibleIndex < count; visibleIndex += 1) {
    const rowIndex = firstRow + visibleIndex;
    const row = rows[rowIndex];
    if (row === undefined) continue;
    const rect = {
      column: options.inner.column,
      row: options.rowsTop + visibleIndex,
      width: options.inner.width,
      height: 1,
    };
    const leftWidth = Math.max(splitMinWidth, Math.floor(rect.width / 2));
    const previousRect = { ...rect, width: Math.min(rect.width, leftWidth) };
    const nextRect = {
      column: rect.column + previousRect.width,
      row: rect.row,
      width: Math.max(0, rect.width - previousRect.width),
      height: 1,
    };
    target.push({
      row,
      rowIndex,
      selected: rowIndex === options.selectedIndex,
      rect,
      previousRect,
      nextRect,
    });
  }
  return target;
}

/** Projects visible Three ASCII config rows into reusable fill/text render commands. */
export function workbenchAsciiConfigRowRenderCommandsInto<Row>(
  target: WorkbenchAsciiConfigRowRenderCommand<Row>[],
  placements: readonly WorkbenchAsciiConfigRowPlacement<Row>[],
  options: {
    text: (row: Row) => string;
  },
): WorkbenchAsciiConfigRowRenderCommand<Row>[] {
  target.length = placements.length * 2;
  let written = 0;
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index]!;
    const fill = target[written] ?? {
      kind: "fill",
      row: placement.row,
      rowIndex: placement.rowIndex,
      selected: placement.selected,
      rect: placement.rect,
      text: "",
    };
    fill.kind = "fill";
    fill.row = placement.row;
    fill.rowIndex = placement.rowIndex;
    fill.selected = placement.selected;
    fill.rect = placement.rect;
    fill.text = "";
    target[written] = fill;
    written += 1;

    const text = target[written] ?? {
      kind: "text",
      row: placement.row,
      rowIndex: placement.rowIndex,
      selected: placement.selected,
      rect: placement.rect,
      text: "",
    };
    text.kind = "text";
    text.row = placement.row;
    text.rowIndex = placement.rowIndex;
    text.selected = placement.selected;
    text.rect = placement.rect;
    text.text = options.text(placement.row);
    target[written] = text;
    written += 1;
  }
  return target;
}

/** Projects the standard Three ASCII config modal action buttons into reusable button-row items. */
export function workbenchAsciiConfigModalActionItemsInto(
  target: WorkbenchButtonRowItem<WorkbenchAsciiConfigModalAction>[],
): WorkbenchButtonRowItem<WorkbenchAsciiConfigModalAction>[] {
  target.length = 0;
  target.push(
    { label: "Cancel", action: "cancel", tone: "muted" },
    { label: "Apply", action: "apply" },
    { label: "OK", action: "ok", active: true, tone: "success" },
  );
  return target;
}

/** Projects the standard Three ASCII config modal action buttons into render commands. */
export function workbenchAsciiConfigModalActionRenderCommandsInto(
  target: WorkbenchButtonRowRenderCommand<WorkbenchAsciiConfigModalAction>[],
  items: WorkbenchButtonRowItem<WorkbenchAsciiConfigModalAction>[],
  placements: WorkbenchButtonRowPlacement<WorkbenchAsciiConfigModalAction>[],
  options: {
    inner: Rectangle;
    actionRow: number;
  },
): WorkbenchButtonRowRenderCommand<WorkbenchAsciiConfigModalAction>[] {
  workbenchAsciiConfigModalActionItemsInto(items);
  layoutWorkbenchButtonRowInto(
    placements,
    items,
    { column: options.inner.column, row: options.actionRow, width: options.inner.width, height: 1 },
    options.actionRow,
  );
  return workbenchButtonRowRenderCommandsInto(target, placements);
}

function normalizeRect(rect: Rectangle): Rectangle {
  return {
    column: Math.floor(rect.column),
    row: Math.floor(rect.row),
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  };
}
