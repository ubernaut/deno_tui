// Copyright 2023 Im-Beast. MIT license.
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import { dataFooterRows, type RowStyle, type WorkbenchRowTheme } from "../src/app/workbench_rows.ts";
import { maxTextWidth, wrapPlainTextInto } from "../src/app/workbench_text.ts";
import {
  type DataColumn,
  type DataSort,
  type DataTableView,
  renderDataTableHeader,
  renderDataTableRowsInto,
} from "../src/components/data_table.ts";
import type { ModalContent } from "../src/components/modal.ts";
import type { TreeRow } from "../src/components/tree.ts";
import { workbenchHelpRows, type WorkbenchHelpRowsOptions } from "../src/app/workbench_status.ts";
import type { Rectangle } from "../src/types.ts";

/** Minimal column metadata needed to estimate API workbench data-table width. */
interface WorkbenchContentSizeColumn {
  width?: number;
}

/** Static and dynamic inputs used to estimate scrollable workbench window content size. */
interface WorkbenchContentSizeOptions {
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
interface WorkbenchContentSize {
  width: number;
  height: number;
}

/** Minimal theme tokens needed by the API workbench explorer panel. */
interface WorkbenchExplorerTheme {
  background: string;
  good: string;
  surface: string;
  text: string;
  warn: string;
}

/** Options for projecting file/tree explorer rows. */
interface WorkbenchExplorerRowsOptions {
  rows: readonly TreeRow[];
  selectedIndex: number;
  theme: WorkbenchExplorerTheme;
  contrast: (color: string, darkFallback: string, lightFallback: string) => string;
}

/** Minimal theme tokens needed by the API workbench inspector panel. */
interface WorkbenchInspectorTheme {
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
interface WorkbenchInspectorBuffers {
  actionTextRows: string[];
  wrappedTextRows: string[];
}

/** Options for projecting the API workbench inspector panel. */
interface WorkbenchInspectorRowsOptions {
  width: number;
  height: number;
  themeLabel: string;
  logs: readonly string[];
  theme: WorkbenchInspectorTheme;
  fit: (value: string, width: number) => string;
  buffers: WorkbenchInspectorBuffers;
}

/** Minimal theme tokens needed by the API workbench logs panel. */
interface WorkbenchLogsTheme {
  surface: string;
  text: string;
}

/** Minimal theme tokens needed by the API workbench data-table panel. */
interface WorkbenchDataTableTheme extends WorkbenchRowTheme {
  accentDeep: string;
  background: string;
  surface: string;
  text: string;
  warn: string;
}

/** Caller-owned buffers used to project workbench data table rows. */
interface WorkbenchDataTableBuffers {
  textRows: string[];
  bodyRows: RowStyle[];
}

/** Options for projecting a data-table view into terminal row styles. */
interface WorkbenchDataTableRowsOptions<TRow extends Record<string, unknown>> {
  view: DataTableView<TRow>;
  columns: readonly DataColumn<TRow>[];
  sort?: DataSort;
  width: number;
  theme: WorkbenchDataTableTheme;
  fit: (text: string, width: number) => string;
  contrast: (color: string, darkFallback: string, lightFallback: string) => string;
  buffers: WorkbenchDataTableBuffers;
}

interface ApiWorkbenchExplorerPanelRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  rect: Rectangle;
  rows: readonly TreeRow[];
  selectedIndex: number;
  renderRows: RowStyle[];
  theme: WorkbenchExplorerTheme;
  contrastText: (background: string, dark: string, light: string) => string;
  writeRows: (frame: Frame, rect: Rectangle, rows: readonly RowStyle[]) => void;
  addHit: (rect: Rectangle, action: { type: "explorerRow"; index: number }) => void;
}

interface ApiWorkbenchInspectorPanelRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  rect: Rectangle;
  themeLabel: string;
  logs: readonly string[];
  renderRows: RowStyle[];
  actionTextRows: string[];
  wrappedTextRows: string[];
  theme: WorkbenchInspectorTheme;
  fit: (text: string, width: number) => string;
  writeRows: (frame: Frame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

interface ApiWorkbenchDataPanelRenderBuffers {
  renderRows: RowStyle[];
  textRows: string[];
  bodyRows: RowStyle[];
}

interface ApiWorkbenchDataPanelRenderOptions<TRow extends Record<string, unknown>, Frame = WorkbenchFrame> {
  frame: Frame;
  rect: Rectangle;
  columns: readonly DataColumn<TRow>[];
  view: () => DataTableView<TRow>;
  sort: () => DataSort | undefined;
  setPageSize: (pageSize: number) => void;
  buffers: ApiWorkbenchDataPanelRenderBuffers;
  theme: WorkbenchDataTableTheme;
  fit: (text: string, width: number) => string;
  contrastText: (background: string, dark: string, light: string) => string;
  writeRows: (frame: Frame, rect: Rectangle, rows: readonly RowStyle[]) => void;
  addHit: (rect: Rectangle, action: { type: "dataRow"; index: number }) => void;
}

interface ApiWorkbenchLogsPanelRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  rect: Rectangle;
  sources: readonly (readonly string[])[];
  renderRows: RowStyle[];
  theme: WorkbenchLogsTheme;
  writeRows: (frame: Frame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

/** Builds the generic workbench modal demo content shared by terminal and browser adapters. */
export function workbenchDemoModalContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: "Confirm Action",
    tone: "confirm",
    body: web
      ? [
        "Modal windows sit above the browser workbench and use the same renderer-neutral controller as terminal modals.",
        "Keyboard focus is trapped while the modal is open. Use Tab, arrows, Enter, Escape, or click an action.",
      ]
      : [
        "Modal windows sit above the workspace and can contain text, menus, warnings, errors, and buttons.",
        "Keyboard focus is trapped while the modal is open. Use Tab, arrows, Enter, Escape, or click an action.",
      ],
    actions: [
      { id: "cancel", label: "Cancel" },
      { id: "details", label: "Details" },
      { id: "confirm", label: "Confirm", default: true },
    ],
  };
}

/** Builds workbench navigation help modal content shared by terminal and browser adapters. */
export function workbenchHelpModalContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: web ? "Web Workbench Help" : "Workbench Help",
    tone: "info",
    body: workbenchHelpRows(options),
    actions: [
      { id: "dismiss", label: "Dismiss", default: true },
      { id: "controls", label: "Focus Controls" },
    ],
  };
}

/** Builds quit/close confirmation modal content shared by terminal and browser adapters. */
export function workbenchQuitModalContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: web ? "Close Web Workbench?" : "Quit Workbench?",
    tone: "warning",
    body: web
      ? [
        "Hide the API workbench browser demo?",
        "This only removes the demo host from the page; reload the page to mount it again.",
      ]
      : [
        "Close the API workbench and return to the terminal?",
        "Use Enter to confirm, Escape to cancel, or Tab to choose an action.",
      ],
    actions: [
      { id: "cancel", label: "Cancel" },
      { id: "quit", label: web ? "Close" : "Quit", destructive: true, default: true },
    ],
  };
}

/** Builds the modal-details drilldown content shared by terminal and browser adapters. */
export function workbenchModalDetailsContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: "Modal Details",
    tone: "info",
    body: web
      ? [
        "ModalController owns open state, body rows, action focus, and keyboard behavior.",
        "The browser renderer adds a centered overlay, backdrop click blocking, and theme-aware action buttons.",
      ]
      : [
        "The ModalController is renderer-neutral and exposes open state, tone, content, action focus, and callbacks.",
        "Workbench rendering adds a theme-aware pop-over, blocks background clicks, and routes action hit targets back to the controller.",
      ],
    actions: [
      { id: "back", label: "Back" },
      { id: "confirm", label: "Confirm", default: true },
      { id: "dismiss", label: "Dismiss" },
    ],
  };
}

/** Builds the success content shown after confirming the generic workbench modal. */
export function workbenchModalConfirmedContent(options: WorkbenchHelpRowsOptions = {}): ModalContent {
  const web = options.profile === "web";
  return {
    title: "Action Confirmed",
    tone: "success",
    body: web
      ? "The web modal action completed."
      : "The modal action completed. This same surface can be used for confirmations, alerts, menus, and error dialogs.",
    actions: [{ id: "dismiss", label: "Dismiss", default: true }],
  };
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
function workbenchDataContentWidth(columns: readonly WorkbenchContentSizeColumn[]): number {
  let width = 8;
  for (let index = 0; index < columns.length; index += 1) {
    width += (columns[index]?.width ?? 12) + 2;
  }
  return width;
}

/** Projects header, body, spacer, and footer rows for the API workbench data table. */
export function workbenchDataTableRowsInto<TRow extends Record<string, unknown>>(
  target: RowStyle[],
  options: WorkbenchDataTableRowsOptions<TRow>,
): RowStyle[] {
  const { view, columns, width, theme: t, fit, contrast, buffers } = options;
  const textRows = renderDataTableRowsInto(buffers.textRows, view.rows, columns, view.selectedIndex);
  buffers.bodyRows.length = textRows.length;
  for (let index = 0; index < textRows.length; index += 1) {
    const selected = index === view.selectedIndex;
    const row = buffers.bodyRows[index] ?? { text: "" };
    row.text = textRows[index]!;
    row.fg = selected ? contrast(t.warn, t.background, t.text) : t.text;
    row.bg = selected ? t.warn : t.surface;
    row.bold = selected;
    buffers.bodyRows[index] = row;
  }

  const footerRows = dataFooterRows({
    page: view.page + 1,
    pageCount: view.pageCount,
    selectedKey: view.selectedKey,
    width,
    theme: t,
    fit,
  });

  target.length = 0;
  target.push({
    text: renderDataTableHeader(columns, options.sort),
    fg: contrast(t.accentDeep, t.background, t.text),
    bg: t.accentDeep,
    bold: true,
  });
  for (let index = 0; index < buffers.bodyRows.length; index += 1) {
    target.push(buffers.bodyRows[index]!);
  }
  target.push({ text: "", bg: t.surface });
  for (let index = 0; index < footerRows.length; index += 1) {
    target.push(footerRows[index]!);
  }
  return target;
}

/** Returns the page size that leaves room for header, spacer, and responsive footer rows. */
export function workbenchDataTablePageSize(options: {
  height: number;
  width: number;
  page: number;
  pageCount: number;
  selectedKey?: string;
  theme: WorkbenchRowTheme;
  fit: (text: string, width: number) => string;
}): number {
  const footerRows = dataFooterRows({
    page: options.page,
    pageCount: options.pageCount,
    selectedKey: options.selectedKey,
    width: options.width,
    theme: options.theme,
    fit: options.fit,
  });
  return Math.max(1, Math.floor(options.height) - 2 - footerRows.length);
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

/** Renders the file explorer panel and row hit targets from a visible tree snapshot. */
export function renderApiWorkbenchExplorerPanel<Frame = WorkbenchFrame>(
  options: ApiWorkbenchExplorerPanelRenderOptions<Frame>,
): void {
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
    const row = rows[index]!;
    addHit({ column: rect.column, row: rect.row + index, width: rect.width, height: 1 }, {
      type: "explorerRow",
      index: row.index,
    });
  }
}

/** Renders the API surface inspector panel from current theme/log snapshots. */
export function renderApiWorkbenchInspectorPanel<Frame = WorkbenchFrame>(
  options: ApiWorkbenchInspectorPanelRenderOptions<Frame>,
): void {
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
export function renderApiWorkbenchDataPanel<TRow extends Record<string, unknown>, Frame = WorkbenchFrame>(
  options: ApiWorkbenchDataPanelRenderOptions<TRow, Frame>,
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
export function renderApiWorkbenchLogsPanel<Frame = WorkbenchFrame>(
  options: ApiWorkbenchLogsPanelRenderOptions<Frame>,
): void {
  const { frame, rect, sources, renderRows, theme, writeRows } = options;
  writeRows(frame, rect, workbenchLogRowsFromSourcesInto(renderRows, sources, theme));
}
