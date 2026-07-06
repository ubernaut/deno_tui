import { modalContentHeight, type ModalInspection } from "../src/components/modal.ts";
import { type WorkbenchModalBufferCache } from "../src/app/workbench_buffers.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import type { WorkbenchAsciiConfigRow } from "../src/app/workbench_ascii.ts";
import {
  layoutWorkbenchAsciiConfigModal,
  type WorkbenchAsciiConfigModalAction,
  workbenchAsciiConfigModalActionItemsInto,
  type WorkbenchAsciiConfigModalBufferCache,
  workbenchAsciiConfigRowPlacementsInto,
  workbenchAsciiConfigRowRenderCommandsInto,
} from "../src/app/workbench_ascii_modal.ts";
import {
  layoutWorkbenchModal,
  workbenchModalActionButtonsInto,
  workbenchModalRowRenderCommandsInto,
} from "../src/app/workbench_overlay.ts";
import type { Rectangle } from "../src/types.ts";
import { renderApiWorkbenchButtonRow } from "./api_workbench_button_row_view.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";

interface ApiWorkbenchPaintStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
}

interface ApiWorkbenchModalRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  bounds: Rectangle;
  inspection: ModalInspection;
  buffers: WorkbenchModalBufferCache<number>;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  fillRect: (frame: Frame, rect: Rectangle, background: string) => void;
  drawFrame: (frame: Frame, rect: Rectangle, title: string, active: boolean) => void;
  maxWidth?: number;
  addHit: (rect: Rectangle, action: { type: "modalAction"; index: number }) => void;
}

interface ApiWorkbenchThreeConfigModalRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  bounds: Rectangle;
  rows: readonly WorkbenchAsciiConfigRow[];
  selectedIndex: number;
  title: string;
  frameTitle?: string;
  titleStyle?: ApiWorkbenchPaintStyle;
  helpText?: string;
  footerText?: string;
  footerStyle?: ApiWorkbenchPaintStyle;
  rowSplitMinWidth?: number;
  activateRowHits?: boolean;
  buffers: WorkbenchAsciiConfigModalBufferCache<WorkbenchAsciiConfigRow>;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  fillRect: (frame: Frame, rect: Rectangle, background: string) => void;
  drawFrame: (frame: Frame, rect: Rectangle, title: string, active: boolean) => void;
  rowText: (row: WorkbenchAsciiConfigRow, layout: { inner: Rectangle }) => string;
  rowStyle?: (selected: boolean, theme: ApiWorkbenchThemeSpec) => ApiWorkbenchPaintStyle;
  addHit: (
    rect: Rectangle,
    action:
      | { type: "asciiConfigBackdrop" }
      | { type: "asciiConfig"; index: number; action?: "previous" | "next" | "activate" }
      | { type: "asciiConfigAction"; action: WorkbenchAsciiConfigModalAction },
  ) => void;
}

/** Renders a generic API Workbench modal overlay from renderer-neutral modal inspection data. */
export function renderApiWorkbenchModalOverlay<Frame = WorkbenchFrame>(
  options: ApiWorkbenchModalRenderOptions<Frame>,
): void {
  const { frame, bounds, inspection, buffers, theme, contrastText, fit, paint, write, fillRect, drawFrame, addHit } =
    options;
  addHit(bounds, { type: "modalAction", index: -1 });

  const maxWidth = Math.max(38, Math.floor(options.maxWidth ?? 72));
  const probeWidth = Math.min(Math.max(38, bounds.width - 8), maxWidth);
  const { rect, inner, shadow } = layoutWorkbenchModal({
    bounds,
    contentHeight: modalContentHeight(inspection, probeWidth),
    maxWidth,
  });
  if (shadow.width > 0 && shadow.height > 0) fillRect(frame, shadow, theme.background);

  fillRect(frame, rect, theme.panelSoft);
  drawFrame(frame, rect, inspection.title, true);

  const rowCommands = workbenchModalRowRenderCommandsInto(buffers.rowCommands, {
    inspection,
    inner,
    contentWidth: rect.width,
  });
  let actionRow: number | undefined;
  for (const command of rowCommands) {
    if (command.kind === "actions") actionRow = command.rect.row;
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(fit(command.text, command.rect.width), {
        fg: command.kind === "title" ? theme.accent : theme.text,
        bg: command.kind === "actions" ? theme.panel : theme.panelSoft,
        bold: command.kind === "actions" || command.kind === "title",
      }),
    );
  }

  if (inspection.actions.length === 0 || actionRow === undefined) return;
  workbenchModalActionButtonsInto(buffers.actionItems, inspection);
  renderApiWorkbenchButtonRow({
    frame,
    rect: { column: inner.column, row: actionRow, width: inner.width, height: 1 },
    startRow: actionRow,
    items: buffers.actionItems,
    placements: buffers.actionPlacements,
    commands: buffers.actionCommands,
    theme,
    contrastText,
    paint,
    write,
    addHit,
    hitAction: (index) => ({ type: "modalAction" as const, index }),
  });
}

/** Renders the Three ASCII configuration modal while keeping state mutation in the host workbench. */
export function renderApiWorkbenchThreeConfigModal<Frame = WorkbenchFrame>(
  options: ApiWorkbenchThreeConfigModalRenderOptions<Frame>,
): void {
  const {
    frame,
    bounds,
    rows,
    selectedIndex,
    title,
    buffers,
    theme,
    contrastText,
    fit,
    paint,
    write,
    fillRect,
    drawFrame,
    rowText,
    addHit,
  } = options;
  addHit(bounds, { type: "asciiConfigBackdrop" });
  const layout = layoutWorkbenchAsciiConfigModal({ bounds, rowCount: rows.length });
  if (layout.shadow.width > 0 && layout.shadow.height > 0) fillRect(frame, layout.shadow, theme.background);
  fillRect(frame, layout.rect, theme.panelSoft);
  drawFrame(frame, layout.rect, options.frameTitle ?? "Three Renderer Config", true);

  const inner = layout.inner;
  write(
    frame,
    inner.row,
    inner.column,
    paint(
      fit(title, inner.width),
      options.titleStyle ?? {
        fg: theme.accent,
        bg: theme.panelSoft,
        bold: true,
      },
    ),
  );
  if (options.helpText) {
    write(
      frame,
      inner.row + 1,
      inner.column,
      paint(fit(options.helpText, inner.width), {
        fg: theme.muted,
        bg: theme.panelSoft,
      }),
    );
  }
  const placements = workbenchAsciiConfigRowPlacementsInto(buffers.rowPlacements, rows, {
    inner,
    rowsTop: layout.rowsTop,
    visibleRows: layout.visibleRows,
    selectedIndex,
    splitMinWidth: options.rowSplitMinWidth ?? 6,
  });
  const rowCommands = workbenchAsciiConfigRowRenderCommandsInto(buffers.rowRenderCommands, placements, {
    text: (row) => rowText(row, { inner }),
  });
  for (const command of rowCommands) {
    const selected = command.selected;
    const style = options.rowStyle?.(selected, theme) ?? {
      fg: selected ? theme.background : theme.text,
      bg: selected ? theme.warn : theme.surface,
      bold: selected,
    };
    const text = command.kind === "fill" ? " ".repeat(command.rect.width) : fit(command.text, command.rect.width);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(text, { ...style, bold: command.kind === "text" && style.bold }),
    );
  }
  for (const placement of placements) {
    if (options.activateRowHits) {
      addHit(placement.rect, {
        type: "asciiConfig",
        index: placement.rowIndex,
        action: "activate",
      });
    }
    addHit(placement.previousRect, {
      type: "asciiConfig",
      index: placement.rowIndex,
      action: "previous",
    });
    addHit(placement.nextRect, {
      type: "asciiConfig",
      index: placement.rowIndex,
      action: "next",
    });
  }
  workbenchAsciiConfigModalActionItemsInto(buffers.actionItems);
  renderApiWorkbenchButtonRow({
    frame,
    rect: { column: inner.column, row: layout.actionRow, width: inner.width, height: 1 },
    startRow: layout.actionRow,
    items: buffers.actionItems,
    placements: buffers.actionPlacements,
    commands: buffers.actionCommands,
    theme,
    contrastText,
    paint,
    write,
    addHit,
    hitAction: (action) => ({ type: "asciiConfigAction" as const, action }),
  });
  const footer = options.footerText ?? "Up/Down select  Left/Right change  Enter toggle  A apply  O OK  Esc cancel";
  write(
    frame,
    layout.footerRow,
    inner.column,
    paint(
      fit(footer, inner.width),
      options.footerStyle ?? {
        fg: theme.muted,
        bg: theme.panel,
      },
    ),
  );
}
