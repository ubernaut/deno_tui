import type { RowStyle } from "../src/app/workbench_rows.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import type { DataColumn, DataSort, DataTableView } from "../src/components/data_table.ts";
import type { TreeRow } from "../src/components/tree.ts";
import type { Rectangle } from "../src/types.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";
import {
  workbenchDataTablePageSize,
  workbenchDataTableRowsInto,
  workbenchExplorerRowsInto,
  workbenchInspectorRowsInto,
  workbenchLogRowsFromSourcesInto,
} from "./workbench_panels.ts";

export interface ApiWorkbenchExplorerPanelRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  rows: readonly TreeRow[];
  selectedIndex: number;
  renderRows: RowStyle[];
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
  addHit: (rect: Rectangle, action: { type: "explorerRow"; index: number }) => void;
}

export interface ApiWorkbenchInspectorPanelRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  themeLabel: string;
  logs: readonly string[];
  renderRows: RowStyle[];
  actionTextRows: string[];
  wrappedTextRows: string[];
  theme: ApiWorkbenchThemeSpec;
  fit: (text: string, width: number) => string;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

export interface ApiWorkbenchDataPanelRenderBuffers {
  renderRows: RowStyle[];
  textRows: string[];
  bodyRows: RowStyle[];
}

export interface ApiWorkbenchDataPanelRenderOptions<TRow extends Record<string, unknown>> {
  frame: WorkbenchFrame;
  rect: Rectangle;
  columns: readonly DataColumn<TRow>[];
  view: () => DataTableView<TRow>;
  sort: () => DataSort | undefined;
  setPageSize: (pageSize: number) => void;
  buffers: ApiWorkbenchDataPanelRenderBuffers;
  theme: ApiWorkbenchThemeSpec;
  fit: (text: string, width: number) => string;
  contrastText: (background: string, dark: string, light: string) => string;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
  addHit: (rect: Rectangle, action: { type: "dataRow"; index: number }) => void;
}

export interface ApiWorkbenchLogsPanelRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  sources: readonly (readonly string[])[];
  renderRows: RowStyle[];
  theme: ApiWorkbenchThemeSpec;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

/** Renders the file explorer panel and row hit targets from a visible tree snapshot. */
export function renderApiWorkbenchExplorerPanel(options: ApiWorkbenchExplorerPanelRenderOptions): void {
  const { frame, rect, rows, selectedIndex, renderRows, theme, contrastText, writeRows, addHit } = options;
  writeRows(
    frame,
    rect,
    workbenchExplorerRowsInto(renderRows, {
      rows,
      selectedIndex,
      theme,
      contrast: contrastText,
    }),
  );
  for (let index = 0; index < rows.length; index += 1) {
    addHit({ column: rect.column, row: rect.row + index, width: rect.width, height: 1 }, {
      type: "explorerRow",
      index,
    });
  }
}

/** Renders the API surface inspector panel from current theme/log snapshots. */
export function renderApiWorkbenchInspectorPanel(options: ApiWorkbenchInspectorPanelRenderOptions): void {
  const { frame, rect, themeLabel, logs, renderRows, actionTextRows, wrappedTextRows, theme, fit, writeRows } = options;
  writeRows(
    frame,
    rect,
    workbenchInspectorRowsInto(renderRows, {
      width: rect.width,
      height: rect.height,
      themeLabel,
      logs,
      theme,
      fit,
      buffers: {
        actionTextRows,
        wrappedTextRows,
      },
    }),
  );
}

/** Renders the process data table panel and keeps page size synchronized with the visible viewport. */
export function renderApiWorkbenchDataPanel<TRow extends Record<string, unknown>>(
  options: ApiWorkbenchDataPanelRenderOptions<TRow>,
): void {
  const { frame, rect, columns, view, sort, setPageSize, buffers, theme, fit, contrastText, writeRows, addHit } =
    options;
  const pendingView = view();
  setPageSize(workbenchDataTablePageSize({
    height: rect.height,
    width: rect.width,
    page: pendingView.page + 1,
    pageCount: pendingView.pageCount,
    selectedKey: pendingView.selectedKey,
    theme,
    fit,
  }));
  const currentView = view();
  writeRows(
    frame,
    rect,
    workbenchDataTableRowsInto(buffers.renderRows, {
      view: currentView,
      columns,
      sort: sort(),
      width: rect.width,
      theme,
      fit,
      contrast: contrastText,
      buffers: { textRows: buffers.textRows, bodyRows: buffers.bodyRows },
    }),
  );
  for (let index = 0; index < Math.min(currentView.rows.length, Math.max(0, rect.height - 1)); index += 1) {
    addHit({ column: rect.column, row: rect.row + 1 + index, width: rect.width, height: 1 }, {
      type: "dataRow",
      index,
    });
  }
}

/** Renders static docs and recent command-log sources into the log/detail panel. */
export function renderApiWorkbenchLogsPanel(options: ApiWorkbenchLogsPanelRenderOptions): void {
  const { frame, rect, sources, renderRows, theme, writeRows } = options;
  writeRows(frame, rect, workbenchLogRowsFromSourcesInto(renderRows, sources, theme));
}
