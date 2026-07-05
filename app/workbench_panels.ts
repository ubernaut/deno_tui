// Copyright 2023 Im-Beast. MIT license.
import type { RowStyle } from "../src/app/workbench_rows.ts";
import { maxTextWidth, maxTextWidthBy, wrapPlainTextInto } from "../src/app/workbench_text.ts";
import type { TreeRow } from "../src/components/tree.ts";
import type { Rectangle } from "../src/types.ts";

/** Minimal column metadata needed to estimate API workbench data-table width. */
export interface WorkbenchContentSizeColumn {
  width?: number;
}

/** Static and dynamic inputs used to estimate scrollable workbench window content size. */
export interface WorkbenchContentSizeOptions {
  id: string;
  viewport: Rectangle;
  docs: readonly string[];
  explorerRows: readonly string[];
  dataColumns: readonly WorkbenchContentSizeColumn[];
  dataRowCount: number;
  terminalOutputLines: readonly string[];
  terminalOutputWindowId: string;
  terminalShellWindowId: string;
  isVisualizationWindow: (id: string) => boolean;
  visualizationContentSize: (
    id: string,
    viewport: Rectangle,
    baseWidth: number,
    baseHeight: number,
  ) => WorkbenchContentSize;
}

/** Scrollable content dimensions for a workbench window. */
export interface WorkbenchContentSize {
  width: number;
  height: number;
}

/** Minimal theme tokens needed by the API workbench explorer panel. */
export interface WorkbenchExplorerTheme {
  background: string;
  good: string;
  surface: string;
  text: string;
  warn: string;
}

/** Options for projecting file/tree explorer rows. */
export interface WorkbenchExplorerRowsOptions {
  rows: readonly TreeRow[];
  selectedIndex: number;
  theme: WorkbenchExplorerTheme;
  contrast: (color: string, darkFallback: string, lightFallback: string) => string;
}

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

/** Minimal theme tokens needed by the API workbench logs panel. */
export interface WorkbenchLogsTheme {
  surface: string;
  text: string;
}

/** Estimates scrollable content size for API workbench windows. */
export function workbenchWindowContentSize(options: WorkbenchContentSizeOptions): WorkbenchContentSize {
  const baseWidth = Math.max(1, Math.floor(options.viewport.width));
  const baseHeight = Math.max(1, Math.floor(options.viewport.height));
  const id = options.id;
  if (id === "explorer") {
    return {
      width: Math.max(baseWidth, maxTextWidth(options.explorerRows) + 2),
      height: Math.max(baseHeight, options.explorerRows.length),
    };
  }
  if (id === "controls") return { width: baseWidth, height: Math.max(baseHeight, 44) };
  if (id === "inspector") return { width: baseWidth, height: Math.max(baseHeight, 18) };
  if (id === "logs") {
    return {
      width: Math.max(baseWidth, maxTextWidth(options.docs) + 2),
      height: Math.max(baseHeight, options.docs.length),
    };
  }
  if (id === "data") {
    return {
      width: Math.max(baseWidth, workbenchDataContentWidth(options.dataColumns)),
      height: Math.max(baseHeight, options.dataRowCount + 4),
    };
  }
  if (id === "three") return { width: baseWidth, height: baseHeight };
  if (id === "htmlLayout") return { width: baseWidth, height: Math.max(baseHeight, 20) };
  if (id === options.terminalShellWindowId) return { width: Math.max(baseWidth, 72), height: Math.max(baseHeight, 24) };
  if (id === options.terminalOutputWindowId) {
    const outputWidth = maxTextWidth(options.terminalOutputLines);
    return {
      width: Math.max(baseWidth, Math.min(120, Math.max(64, outputWidth + 2))),
      height: Math.max(baseHeight, options.terminalOutputLines.length + 4, 16),
    };
  }
  if (options.isVisualizationWindow(id)) {
    return options.visualizationContentSize(id, options.viewport, baseWidth, baseHeight);
  }
  return { width: baseWidth, height: Math.max(baseHeight, 16) };
}

/** Estimates the scrollable width needed for data-table columns. */
export function workbenchDataContentWidth(columns: readonly WorkbenchContentSizeColumn[]): number {
  let width = 8;
  for (let index = 0; index < columns.length; index += 1) {
    width += (columns[index]?.width ?? 12) + 2;
  }
  return width;
}

/** Projects explorer entry text before passing it to {@link workbenchWindowContentSize}. */
export function explorerTextRowsInto<T>(
  target: string[],
  entries: Iterable<T>,
  project: (entry: T) => string,
): string[] {
  target.length = 0;
  for (const entry of entries) target.push(project(entry));
  return target;
}

/** Measures projected text without retaining rows. */
export function projectedTextWidth<T>(values: Iterable<T>, project: (value: T) => string): number {
  return maxTextWidthBy(values, project);
}

/** Projects explorer tree rows into caller-owned row storage. */
export function workbenchExplorerRowsInto(
  target: RowStyle[],
  options: WorkbenchExplorerRowsOptions,
): RowStyle[] {
  const { rows, selectedIndex, theme: t, contrast } = options;
  target.length = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const treeRow = rows[index]!;
    const selected = treeRow.index === selectedIndex;
    const node = treeRow.node as { kind?: string };
    const icon = treeRow.hasChildren ? treeRow.expanded ? "▾" : "▸" : node.kind === "file" ? "·" : " ";
    const row = target[index] ?? { text: "" };
    row.text = `${"  ".repeat(treeRow.depth)}${icon} ${treeRow.label}`;
    row.fg = selected ? contrast(t.warn, t.background, t.text) : node.kind === "directory" ? t.good : t.text;
    row.bg = selected ? t.warn : t.surface;
    row.bold = selected || node.kind === "directory";
    target[index] = row;
  }
  return target;
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

/** Projects static workbench log/detail rows into caller-owned storage. */
export function workbenchLogRowsInto(
  target: RowStyle[],
  docs: readonly string[],
  theme: WorkbenchLogsTheme,
): RowStyle[] {
  return workbenchLogRowsFromSourcesInto(target, [docs], theme);
}

/** Projects one or more log/detail row sources into caller-owned storage without concatenating source arrays. */
export function workbenchLogRowsFromSourcesInto(
  target: RowStyle[],
  sources: readonly (readonly string[])[],
  theme: WorkbenchLogsTheme,
): RowStyle[] {
  let rowCount = 0;
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    rowCount += sources[sourceIndex]!.length;
  }
  target.length = rowCount;

  let targetIndex = 0;
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = sources[sourceIndex]!;
    for (let index = 0; index < source.length; index += 1) {
      const row = target[targetIndex] ?? { text: "" };
      row.text = source[index]!;
      row.fg = theme.text;
      row.bg = theme.surface;
      row.bold = undefined;
      target[targetIndex] = row;
      targetIndex += 1;
    }
  }
  return target;
}
