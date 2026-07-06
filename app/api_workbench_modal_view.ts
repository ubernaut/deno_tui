import { modalContentHeight, type ModalInspection } from "../src/components/modal.ts";
import {
  layoutWorkbenchButtonRowInto,
  workbenchButtonRowRenderCommandsInto,
} from "../src/app/workbench_control_layout.ts";
import { projectWorkbenchButtonCommand } from "../src/app/workbench_button_style.ts";
import { type WorkbenchModalBufferCache } from "../src/app/workbench_buffers.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import type { WorkbenchAsciiConfigRow } from "../src/app/workbench_ascii.ts";
import {
  layoutWorkbenchAsciiConfigModal,
  type WorkbenchAsciiConfigModalAction,
  workbenchAsciiConfigModalActionRenderCommandsInto,
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
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";

interface ApiWorkbenchPaintStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
}

export interface ApiWorkbenchModalRenderOptions {
  frame: WorkbenchFrame;
  bounds: Rectangle;
  inspection: ModalInspection;
  buffers: WorkbenchModalBufferCache<number>;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  fillRect: (frame: WorkbenchFrame, rect: Rectangle, background: string) => void;
  drawFrame: (frame: WorkbenchFrame, rect: Rectangle, title: string, active: boolean) => void;
  addHit: (rect: Rectangle, action: { type: "modalAction"; index: number }) => void;
}

export interface ApiWorkbenchThreeConfigModalRenderOptions {
  frame: WorkbenchFrame;
  bounds: Rectangle;
  rows: readonly WorkbenchAsciiConfigRow[];
  selectedIndex: number;
  title: string;
  buffers: WorkbenchAsciiConfigModalBufferCache<WorkbenchAsciiConfigRow>;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  fillRect: (frame: WorkbenchFrame, rect: Rectangle, background: string) => void;
  drawFrame: (frame: WorkbenchFrame, rect: Rectangle, title: string, active: boolean) => void;
  rowText: (row: WorkbenchAsciiConfigRow) => string;
  addHit: (
    rect: Rectangle,
    action:
      | { type: "asciiConfigBackdrop" }
      | { type: "asciiConfig"; index: number; action?: "previous" | "next" | "activate" }
      | { type: "asciiConfigAction"; action: WorkbenchAsciiConfigModalAction },
  ) => void;
}

/** Renders a generic API Workbench modal overlay from renderer-neutral modal inspection data. */
export function renderApiWorkbenchModalOverlay(options: ApiWorkbenchModalRenderOptions): void {
  const { frame, bounds, inspection, buffers, theme, contrastText, fit, paint, write, fillRect, drawFrame, addHit } =
    options;
  addHit(bounds, { type: "modalAction", index: -1 });

  const probeWidth = Math.min(Math.max(38, bounds.width - 8), 72);
  const { rect, inner, shadow } = layoutWorkbenchModal({
    bounds,
    contentHeight: modalContentHeight(inspection, probeWidth),
    maxWidth: 72,
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
  layoutWorkbenchButtonRowInto(
    buffers.actionPlacements,
    buffers.actionItems,
    { column: inner.column, row: actionRow, width: inner.width, height: 1 },
    actionRow,
  );
  workbenchButtonRowRenderCommandsInto(buffers.actionCommands, buffers.actionPlacements);
  for (const command of buffers.actionCommands) {
    const button = projectWorkbenchButtonCommand(command, theme, contrastText);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(button.text, button.style),
    );
    addHit(command.hitRect, { type: "modalAction", index: command.item.action });
  }
}

/** Renders the Three ASCII configuration modal while keeping state mutation in the host workbench. */
export function renderApiWorkbenchThreeConfigModal(options: ApiWorkbenchThreeConfigModalRenderOptions): void {
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
  drawFrame(frame, layout.rect, "Three Renderer Config", true);

  const inner = layout.inner;
  write(
    frame,
    inner.row,
    inner.column,
    paint(fit(title, inner.width), {
      fg: theme.accent,
      bg: theme.panelSoft,
      bold: true,
    }),
  );
  const placements = workbenchAsciiConfigRowPlacementsInto(buffers.rowPlacements, rows, {
    inner,
    rowsTop: layout.rowsTop,
    visibleRows: layout.visibleRows,
    selectedIndex,
  });
  const rowCommands = workbenchAsciiConfigRowRenderCommandsInto(buffers.rowRenderCommands, placements, {
    text: rowText,
  });
  for (const command of rowCommands) {
    const selected = command.selected;
    const bg = selected ? theme.warn : theme.surface;
    const fg = selected ? theme.background : theme.text;
    const text = command.kind === "fill" ? " ".repeat(command.rect.width) : fit(command.text, command.rect.width);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(text, { fg, bg, bold: command.kind === "text" && selected }),
    );
  }
  for (const placement of placements) {
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
  workbenchAsciiConfigModalActionRenderCommandsInto(
    buffers.actionCommands,
    buffers.actionItems,
    buffers.actionPlacements,
    { inner, actionRow: layout.actionRow },
  );
  for (const command of buffers.actionCommands) {
    const button = projectWorkbenchButtonCommand(command, theme, contrastText);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(button.text, button.style),
    );
    addHit(command.hitRect, {
      type: "asciiConfigAction",
      action: command.item.action,
    });
  }
  const footer = "Up/Down select  Left/Right change  Enter toggle  A apply  O OK  Esc cancel";
  write(
    frame,
    layout.footerRow,
    inner.column,
    paint(fit(footer, inner.width), {
      fg: theme.muted,
      bg: theme.panel,
    }),
  );
}
