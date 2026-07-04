// Copyright 2023 Im-Beast. MIT license.
import { wrapPlainTextInto } from "../src/app/workbench_text.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";

/** Minimal theme tokens needed by the API workbench inspector panel. */
export interface WorkbenchInspectorTheme {
  background: string;
  accent: string;
  border: string;
  good: string;
  panelSoft: string;
  surface: string;
  text: string;
  warn: string;
}

/** Caller-owned buffers used to project inspector rows without per-frame arrays. */
export interface WorkbenchInspectorBuffers {
  actionTextRows: string[];
  wrappedTextRows: string[];
}

/** Options for projecting the API workbench inspector panel. */
export interface WorkbenchInspectorRowsOptions {
  width: number;
  height: number;
  themeLabel: string;
  logs: readonly string[];
  theme: WorkbenchInspectorTheme;
  fit: (value: string, width: number) => string;
  buffers: WorkbenchInspectorBuffers;
}

/** Projects API surface and recent-action rows for the workbench inspector panel. */
export function workbenchInspectorRowsInto(
  target: RowStyle[],
  options: WorkbenchInspectorRowsOptions,
): RowStyle[] {
  const t = options.theme;
  target.length = 0;
  target.push(
    { text: " Composable API surfaces ", fg: t.background, bg: t.accent, bold: true },
    { text: "explorer  FileExplorerController", fg: t.good, bg: t.surface },
    { text: "menu      MenuBarController", fg: t.good, bg: t.surface },
    { text: "layout    WindowManagerController", fg: t.good, bg: t.surface },
    { text: "viewport  ScrollAreaController", fg: t.good, bg: t.surface },
    { text: "data      DataTableController", fg: t.good, bg: t.surface },
    { text: "controls  SliderController / CheckBoxController", fg: t.good, bg: t.surface },
    { text: "three     ThreePanelFrameView + Acerola ASCII", fg: t.good, bg: t.surface },
    { text: `theme     ${options.themeLabel}`, fg: t.warn, bg: t.surface, bold: true },
    { text: "", bg: t.surface },
    { text: " Recent actions ", fg: t.background, bg: t.border, bold: true },
  );

  const availableActionRows = Math.max(0, Math.floor(options.height) - target.length);
  const actionRows = options.buffers.actionTextRows;
  const wrappedRows = options.buffers.wrappedTextRows;
  actionRows.length = 0;
  if (availableActionRows <= 0) return target;

  const start = Math.max(0, options.logs.length - Math.max(4, availableActionRows));
  for (let index = start; index < options.logs.length; index += 1) {
    const wrapped = wrapPlainTextInto(wrappedRows, `• ${options.logs[index]!}`, options.width, options.fit);
    for (let row = 0; row < wrapped.length; row += 1) {
      actionRows.push(wrapped[row]!);
    }
  }

  const firstActionRow = Math.max(0, actionRows.length - availableActionRows);
  for (let index = firstActionRow; index < actionRows.length; index += 1) {
    target.push({
      text: actionRows[index]!,
      fg: t.text,
      bg: t.panelSoft,
    });
  }
  return target;
}
