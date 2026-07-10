// Copyright 2023 Im-Beast. MIT license.
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import { dataFooterRows, type RowStyle, type WorkbenchRowTheme } from "../src/app/workbench_rows.ts";
import { compactSpaces, maxTextWidth, wrapPlainTextInto } from "../src/app/workbench_text.ts";
import { workbenchButtonPaintOptions } from "../src/app/workbench_button_style.ts";
import { wrappedControlOptionRowCount } from "../src/app/workbench_control_layout.ts";
import { workbenchAsciiRendererModeLabel } from "../src/app/workbench_ascii.ts";
import {
  type DataColumn,
  type DataSort,
  type DataTableView,
  renderDataTableHeader,
  renderDataTableRowsInto,
} from "../src/components/data_table.ts";
import type { ModalContent } from "../src/components/modal.ts";
import type { StepperStep } from "../src/components/stepper.ts";
import type { CursorPosition, TextBoxVisualLine } from "../src/components/textbox.ts";
import type { TreeRow } from "../src/components/tree.ts";
import { workbenchHelpRows, type WorkbenchHelpRowsOptions } from "../src/app/workbench_status.ts";
import type { Rectangle } from "../src/types.ts";
import {
  type ApiWorkbenchCheckboxOption,
  type ApiWorkbenchComboHeaderRowsOptions,
  apiWorkbenchControlBaseStyle,
  apiWorkbenchControlButtonDetailStyle,
  type ApiWorkbenchControlHitAction,
  type ApiWorkbenchControlHitPlacement,
  type ApiWorkbenchControlId,
  apiWorkbenchControlLineInto,
  type ApiWorkbenchControlLineOptions,
  type ApiWorkbenchControlLineRenderCommand,
  apiWorkbenchControlLineRenderCommandsInto,
  type ApiWorkbenchControlLineSegment,
  type ApiWorkbenchControlPaintStyle,
  apiWorkbenchControlsSnapshotRowsInto,
  apiWorkbenchControlTrack,
  type ApiWorkbenchDropdownHeaderRowOptions,
  apiWorkbenchDropdownPopoverRect,
  type ApiWorkbenchInputRowOptions,
  type ApiWorkbenchProjectedControlRow,
  type ApiWorkbenchRadioOption,
  type ApiWorkbenchRadioSourceOption,
  apiWorkbenchSliderSetHitInto,
  apiWorkbenchStepperHitPlacementsInto,
  apiWorkbenchTextboxCommandStyle,
  apiWorkbenchTextboxProjectionInto,
  type ApiWorkbenchTextboxProjectionRow,
  type ApiWorkbenchTextboxRenderCommand,
  apiWorkbenchTextboxRenderCommandsInto,
  type ApiWorkbenchTextboxRenderOptions,
  type ApiWorkbenchWrappedOptionsRenderCommand,
  apiWorkbenchWrappedOptionsRenderCommandsInto,
  apiWorkbenchWrappedOptionStyle,
} from "./api_workbench_controls.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";
import type { AsciiOptions, PanelRender, SystemSnapshot } from "./types.ts";
import { type CpuHexTileLayout, cpuHexTileLayoutInto } from "./visualization_system.ts";
import { terminalGlyphStyleLabel } from "../src/three_ascii/options.ts";

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

export class ApiWorkbenchControlsViewBufferCache {
  readonly lineSegments: ApiWorkbenchControlLineSegment[] = [];
  readonly lineRenderCommands: ApiWorkbenchControlLineRenderCommand[] = [];
  readonly lineHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
  readonly projectedRows: ApiWorkbenchProjectedControlRow[] = [];
  readonly checkboxOptions: ApiWorkbenchCheckboxOption[] = [];
  readonly radioOptions: ApiWorkbenchRadioOption[] = [];
  readonly textboxProjectionRows: ApiWorkbenchTextboxProjectionRow[] = [];
  readonly textboxRenderCommands: ApiWorkbenchTextboxRenderCommand[] = [];
  readonly textboxVisualLines: TextBoxVisualLine[] = [];
  readonly wrappedOptionRenderCommands: ApiWorkbenchWrappedOptionsRenderCommand[] = [];
  readonly wrappedOptionHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
  readonly sliderSetHit: ApiWorkbenchControlHitPlacement = {
    column: 0,
    row: 0,
    width: 0,
    height: 1,
    id: "slider",
    action: "set",
  };
  readonly stepperHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
}

interface ApiWorkbenchControlsViewHitAction {
  type: "control";
  id: ApiWorkbenchControlId;
  action?: ApiWorkbenchControlHitAction;
  index?: number;
}

interface ApiWorkbenchControlsDropdownOverlay {
  kind: "control";
  coordinate: "workspace";
  rect: Rectangle;
  items: string[];
  selectedIndex?: number;
}

interface ApiWorkbenchControlsViewState<Value extends string = string> {
  activeControl: ApiWorkbenchControlId;
  buttonPressCount: number;
  genericButtonPressCount: number;
  modalOpen: boolean;
  slider: {
    ratio: number;
    value: number;
    max: number;
  };
  checkboxLivePreview: boolean;
  checkboxCompactRows: boolean;
  radioOptions: readonly ApiWorkbenchRadioSourceOption<Value>[];
  radioSelectedValue: Value | undefined;
  radioActiveIndex: number;
  combo: Omit<ApiWorkbenchComboHeaderRowsOptions, "rectWidth"> & {
    title: string;
    label: string;
    expanded: boolean;
    items: string[];
    selectedIndex?: number;
  };
  dropdown: ApiWorkbenchDropdownHeaderRowOptions & {
    title: string;
    label: string;
    expanded: boolean;
    items: string[];
    selectedIndex?: number;
  };
  input: ApiWorkbenchInputRowOptions & {
    title: string;
    text: string;
    active: boolean;
  };
  stepper: {
    steps: readonly StepperStep[];
    activeIndex: number;
  };
  progress: {
    ratio: number;
    value: number;
  };
  textbox: {
    lines: readonly string[];
    cursor: CursorPosition;
    renderOptions?: ApiWorkbenchTextboxRenderOptions;
  };
}

interface ApiWorkbenchControlsViewOptions<Frame = WorkbenchFrame, Value extends string = string> {
  frame: Frame;
  rect: Rectangle;
  state: ApiWorkbenchControlsViewState<Value>;
  buffers: ApiWorkbenchControlsViewBufferCache;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchControlPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: ApiWorkbenchControlsViewHitAction) => void;
}

interface ApiWorkbenchControlsViewResult {
  dropdownOverlay?: ApiWorkbenchControlsDropdownOverlay;
}

interface ApiWorkbenchTextboxControlRenderOptions<Frame> {
  frame: Frame;
  rect: Rectangle;
  row: number;
  active: boolean;
  lines: readonly string[];
  cursor: CursorPosition;
  renderOptions?: ApiWorkbenchTextboxRenderOptions;
  buffers: ApiWorkbenchControlsViewBufferCache;
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchControlPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: ApiWorkbenchControlsViewHitAction) => void;
}

interface ApiWorkbenchWrappedOptionsRenderOptions<Frame> {
  frame: Frame;
  rect: Rectangle;
  startRow: number;
  id: ApiWorkbenchControlId;
  items: readonly string[];
  selectedIndex: number | undefined;
  activeId: ApiWorkbenchControlId;
  buffers: ApiWorkbenchControlsViewBufferCache;
  theme: ApiWorkbenchThemeSpec;
  paint: (text: string, style: ApiWorkbenchControlPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  addHit: (rect: Rectangle, action: ApiWorkbenchControlsViewHitAction) => void;
}

interface ApiWorkbenchVisualizationPaintStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
}

interface WorkbenchVisualizationWindowOption {
  label: string;
  description: string;
  group: string;
}

interface WorkbenchVisualizationRowsTheme {
  background: string;
  danger: string;
  muted: string;
  panelSoft: string;
  soft: string;
  surface: string;
  text: string;
  warn: string;
}

interface ApiWorkbenchVisualizationMissingRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  rect: Rectangle;
  theme: ApiWorkbenchThemeSpec;
  writeRows: (frame: Frame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

interface ApiWorkbenchVisualizationThreeChromeRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  rect: Rectangle;
  option: WorkbenchVisualizationWindowOption;
  rendered: PanelRender;
  ascii: AsciiOptions;
  accent: string;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchVisualizationPaintStyle) => string;
  write: (frame: Frame, row: number, column: number, value: string) => void;
  writeRows: (frame: Frame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

interface ApiWorkbenchVisualizationTextRenderOptions<Frame = WorkbenchFrame> {
  frame: Frame;
  rect: Rectangle;
  option: WorkbenchVisualizationWindowOption;
  rendered: PanelRender;
  accent: string;
  rows: RowStyle[];
  textRows: string[];
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  writeRows: (frame: Frame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

interface ApiWorkbenchCpuHexTileHitOptions<TId extends string> {
  id: TId;
  rect: Rectangle;
  cores: SystemSnapshot["cpuCores"];
  width: number;
  height: number;
  tiles: CpuHexTileLayout[];
  addHit: (
    rect: Rectangle,
    action: { type: "cpuHexTile"; id: TId; label: string },
  ) => void;
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

/** Renders the API workbench controls panel and returns any open dropdown overlay geometry. */
export function renderApiWorkbenchControls<Frame = WorkbenchFrame, Value extends string = string>(
  options: ApiWorkbenchControlsViewOptions<Frame, Value>,
): ApiWorkbenchControlsViewResult {
  const { frame, rect, state, buffers, theme, contrastText, fit, paint, write, addHit } = options;
  const result: ApiWorkbenchControlsViewResult = {};
  let row = rect.row;

  const writeControl = (
    id: ApiWorkbenchControlId,
    value: string,
    controlOptions: ApiWorkbenchControlLineOptions = {},
  ) => {
    const startRow = row;
    const nextRow = apiWorkbenchControlLineInto(
      buffers.lineSegments,
      buffers.lineHitPlacements,
      id,
      value,
      rect,
      row,
      state.activeControl,
      controlOptions,
    );
    if (nextRow === row) return;
    const active = state.activeControl === id;
    const baseStyle = apiWorkbenchControlBaseStyle(theme, active);
    const renderCommands = apiWorkbenchControlLineRenderCommandsInto(
      buffers.lineRenderCommands,
      buffers.lineSegments,
      {
        rect,
        row: startRow,
        button: controlOptions.button,
      },
    );
    for (const command of renderCommands) {
      if (command.kind === "fill") {
        write(
          frame,
          command.row,
          command.column,
          paint(" ".repeat(command.width), { fg: theme.text, bg: theme.surface, bold: false }),
        );
        continue;
      }
      if (controlOptions.button) {
        const style = command.role === "button"
          ? workbenchButtonPaintOptions(theme, contrastText, active ? "active" : "base")
          : command.role === "detail"
          ? apiWorkbenchControlButtonDetailStyle(theme, active)
          : baseStyle;
        write(frame, command.row, command.column, paint(command.text, style));
      } else {
        write(frame, command.row, command.column, paint(command.text, baseStyle));
      }
    }
    addControlHits(buffers.lineHitPlacements, addHit);
    row = nextRow;
  };

  const sliderTrack = apiWorkbenchControlTrack({
    ratio: state.slider.ratio,
    boundsWidth: rect.width,
    reservedWidth: 20,
    maxWidth: 24,
  });
  const progressTrack = apiWorkbenchControlTrack({
    ratio: state.progress.ratio,
    boundsWidth: rect.width,
    reservedWidth: 18,
    maxWidth: 24,
  });

  apiWorkbenchControlsSnapshotRowsInto(buffers.projectedRows, {
    buttonPressCount: state.buttonPressCount,
    genericButtonPressCount: state.genericButtonPressCount,
    modalOpen: state.modalOpen,
    slider: {
      track: sliderTrack,
      value: state.slider.value,
      max: state.slider.max,
    },
    checkboxLivePreview: state.checkboxLivePreview,
    checkboxCompactRows: state.checkboxCompactRows,
    radioOptions: state.radioOptions,
    radioSelectedValue: state.radioSelectedValue,
    radioActiveIndex: state.radioActiveIndex,
    combo: {
      title: state.combo.title,
      label: state.combo.label,
      expanded: state.combo.expanded,
      rectWidth: rect.width,
      expandedGlyph: state.combo.expandedGlyph,
      collapsedGlyph: state.combo.collapsedGlyph,
      splitMinWidth: state.combo.splitMinWidth,
      previous: state.combo.previous,
      next: state.combo.next,
    },
    dropdown: {
      title: state.dropdown.title,
      label: state.dropdown.label,
      expanded: state.dropdown.expanded,
      expandedGlyph: state.dropdown.expandedGlyph,
      collapsedGlyph: state.dropdown.collapsedGlyph,
    },
    input: state.input,
    stepper: {
      steps: state.stepper.steps,
      activeIndex: state.stepper.activeIndex,
      rectWidth: rect.width,
    },
    progress: {
      track: progressTrack,
      value: state.progress.value,
    },
    buffers: {
      checkboxes: buffers.checkboxOptions,
      radio: buffers.radioOptions,
    },
  });

  for (let index = 0; index < buffers.projectedRows.length; index += 1) {
    const controlRow = buffers.projectedRows[index]!;
    if (controlRow.id === "slider" && controlRow.value.startsWith("Progress")) {
      if (row < rect.row + rect.height) {
        write(
          frame,
          row,
          rect.column,
          paint(fit(controlRow.value, rect.width), {
            fg: theme.text,
            bg: theme.surface,
            bold: false,
          }),
        );
      }
      continue;
    }

    if (controlRow.id === "textbox") {
      row = renderApiWorkbenchTextboxControl({
        frame,
        rect,
        row,
        active: state.activeControl === "textbox",
        lines: state.textbox.lines,
        cursor: state.textbox.cursor,
        renderOptions: state.textbox.renderOptions,
        buffers,
        theme,
        paint,
        write,
        addHit,
      });
      continue;
    }

    const beforeRow = row;
    writeControl(controlRow.id, controlRow.value, controlRow.options);
    if (controlRow.id === "slider") {
      const sliderSetHit = apiWorkbenchSliderSetHitInto(buffers.sliderSetHit, rect, beforeRow, sliderTrack);
      addHit({
        column: sliderSetHit.column,
        row: sliderSetHit.row,
        width: sliderSetHit.width,
        height: sliderSetHit.height,
      }, {
        type: "control",
        id: sliderSetHit.id,
        action: sliderSetHit.action,
      });
    } else if (controlRow.id === "combo" && buffers.projectedRows[index + 1]?.id !== "combo") {
      renderApiWorkbenchWrappedOptions({
        frame,
        rect,
        startRow: row,
        id: "combo",
        items: state.combo.items,
        selectedIndex: state.combo.selectedIndex,
        activeId: state.activeControl,
        buffers,
        theme,
        paint,
        write,
        addHit,
      });
      row += wrappedControlOptionRowCount(state.combo.items, undefined, rect.width - 4);
    } else if (controlRow.id === "dropdown") {
      if (state.dropdown.expanded) {
        result.dropdownOverlay = {
          kind: "control",
          coordinate: "workspace",
          rect: apiWorkbenchDropdownPopoverRect({
            rect,
            row,
            items: state.dropdown.items,
            label: state.dropdown.label,
          }),
          items: state.dropdown.items,
          selectedIndex: state.dropdown.selectedIndex,
        };
      }
    } else if (controlRow.id === "stepper") {
      const stepperHits = apiWorkbenchStepperHitPlacementsInto(
        buffers.stepperHitPlacements,
        state.stepper.steps,
        state.stepper.activeIndex,
        rect,
        beforeRow,
      );
      addControlHits(stepperHits, addHit);
    }
  }

  return result;
}

function renderApiWorkbenchTextboxControl<Frame>(options: ApiWorkbenchTextboxControlRenderOptions<Frame>): number {
  const { frame, rect, row, active, lines, cursor, renderOptions, buffers, theme, paint, write, addHit } = options;
  const projection = apiWorkbenchTextboxProjectionInto(buffers.textboxProjectionRows, {
    rect,
    row,
    lines,
    visualLines: buffers.textboxVisualLines,
    cursor,
    active,
  });
  if (projection.height <= 0) return projection.nextRow;
  const commands = apiWorkbenchTextboxRenderCommandsInto(buffers.textboxRenderCommands, projection.rows, renderOptions);
  for (const command of commands) {
    write(
      frame,
      command.row,
      command.column,
      paint(command.text, apiWorkbenchTextboxCommandStyle(theme, command, active)),
    );
  }
  addHit(projection.hit, {
    type: "control",
    id: "textbox",
    action: "focus",
  });
  return projection.nextRow;
}

function renderApiWorkbenchWrappedOptions<Frame>(options: ApiWorkbenchWrappedOptionsRenderOptions<Frame>): void {
  const { frame, rect, startRow, id, items, selectedIndex, activeId, buffers, theme, paint, write, addHit } = options;
  const commands = apiWorkbenchWrappedOptionsRenderCommandsInto(
    buffers.wrappedOptionRenderCommands,
    buffers.wrappedOptionHitPlacements,
    {
      rect,
      startRow,
      id,
      items,
      selectedIndex,
      activeId,
    },
  );
  for (const command of commands) {
    write(
      frame,
      command.row,
      command.column,
      paint(command.text, apiWorkbenchWrappedOptionStyle(theme, command.active)),
    );
  }
  addControlHits(buffers.wrappedOptionHitPlacements, addHit);
}

function addControlHits(
  placements: readonly ApiWorkbenchControlHitPlacement[],
  addHit: (rect: Rectangle, action: ApiWorkbenchControlsViewHitAction) => void,
): void {
  for (let index = 0; index < placements.length; index += 1) {
    const hit = placements[index]!;
    addHit({ column: hit.column, row: hit.row, width: hit.width, height: hit.height }, {
      type: "control",
      id: hit.id,
      action: hit.action,
      index: hit.index,
    });
  }
}

/** Renders the missing-visualization placeholder used by dynamic workbench windows. */
export function renderApiWorkbenchVisualizationMissing<Frame = WorkbenchFrame>(
  options: ApiWorkbenchVisualizationMissingRenderOptions<Frame>,
): void {
  const { frame, rect, theme, writeRows } = options;
  writeRows(frame, rect, [
    { text: "Visualization window not found", fg: theme.warn, bg: theme.surface, bold: true },
  ]);
}

/** Renders visualization Three-window chrome and returns the viewport rect for the grid body. */
export function renderApiWorkbenchVisualizationThreeChrome<Frame = WorkbenchFrame>(
  options: ApiWorkbenchVisualizationThreeChromeRenderOptions<Frame>,
): Rectangle {
  const { frame, rect, option, rendered, ascii, accent, theme: t, contrastText, fit, paint, write, writeRows } =
    options;
  writeRows(frame, rect, [
    {
      text: ` ${option.group.toUpperCase()} · ${rendered.title ?? option.label.toUpperCase()} `,
      fg: contrastText(accent, t.background, t.text),
      bg: accent,
      bold: true,
    },
    {
      text: rendered.alert ? `! ${rendered.alert}` : option.description,
      fg: rendered.severity === "alarm" ? t.danger : rendered.severity === "warning" ? t.warn : t.soft,
      bg: t.surface,
      bold: rendered.severity !== "info",
    },
    {
      text: visualizationThreeStatusLine(rendered, option, ascii),
      fg: t.buttonActiveText,
      bg: t.buttonActiveBg,
      bold: true,
    },
  ]);
  if (rect.height > 3) {
    write(
      frame,
      rect.row + rect.height - 1,
      rect.column,
      paint(fit(rendered.footer, rect.width), { fg: t.muted, bg: t.panelSoft }),
    );
  }
  return visualizationThreeBodyRect(rect, { headerRows: 3, footerRows: 1 });
}

/** Renders a text-backed visualization window into caller-owned row buffers. */
export function renderApiWorkbenchVisualizationTextWindow<Frame = WorkbenchFrame>(
  options: ApiWorkbenchVisualizationTextRenderOptions<Frame>,
): void {
  const { frame, rect, option, rendered, accent, rows, textRows, theme, contrastText, writeRows } = options;
  writeRows(
    frame,
    rect,
    workbenchVisualizationRowsInto(rows, textRows, option, rendered, {
      accent,
      theme,
      contrast: contrastText,
    }),
  );
}

function workbenchVisualizationRowsInto(
  target: RowStyle[],
  textRows: string[],
  option: WorkbenchVisualizationWindowOption,
  rendered: PanelRender,
  options: {
    accent: string;
    theme: WorkbenchVisualizationRowsTheme;
    contrast: (color: string, darkFallback: string, lightFallback: string) => string;
  },
): RowStyle[] {
  const rows = visualizationWindowRowsInto(textRows, option, rendered);
  const { accent, theme: t, contrast } = options;
  target.length = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const row = target[index] ?? { text: "" };
    row.text = rows[index]!;
    if (index === 0) {
      row.fg = contrast(accent, t.background, t.text);
      row.bg = accent;
      row.bold = true;
    } else if (index === 1) {
      row.fg = rendered.severity === "alarm" ? t.danger : rendered.severity === "warning" ? t.warn : t.soft;
      row.bg = t.surface;
      row.bold = rendered.severity !== "info";
    } else if (index === rows.length - 1) {
      row.fg = t.muted;
      row.bg = t.panelSoft;
      row.bold = undefined;
    } else {
      const bodyIndex = index - 2;
      row.fg = bodyIndex % 3 === 0 ? accent : bodyIndex % 3 === 1 ? t.text : t.soft;
      row.bg = t.surface;
      row.bold = bodyIndex === 0;
    }
    target[index] = row;
  }
  return target;
}

function visualizationWindowRowsInto(
  target: string[],
  option: WorkbenchVisualizationWindowOption,
  rendered: PanelRender,
): string[] {
  target.length = 0;
  target.push(
    ` ${option.group.toUpperCase()} · ${rendered.title ?? option.label.toUpperCase()} `,
    rendered.alert ? `! ${rendered.alert}` : option.description,
  );
  appendBodyLines(target, rendered.body);
  target.push(rendered.footer);
  return target;
}

function visualizationThreeStatusLine(
  rendered: PanelRender,
  option: WorkbenchVisualizationWindowOption,
  options: AsciiOptions,
): string {
  const mode = rendered.three?.mode.toUpperCase() ?? "TEXT";
  const renderer = workbenchAsciiRendererModeLabel(options, terminalGlyphStyleLabel).toUpperCase();
  return compactSpaces(`ACEROLA ${mode} · ${renderer} · ${option.label}`);
}

function visualizationThreeBodyRect(
  rect: Rectangle,
  options: { headerRows?: number; footerRows?: number } = {},
): Rectangle {
  const headerRows = Math.max(0, Math.floor(options.headerRows ?? 0));
  const footerRows = Math.max(0, Math.floor(options.footerRows ?? 0));
  const reservedRows = Math.min(Math.max(0, rect.height), headerRows + footerRows);
  return {
    column: rect.column,
    row: rect.row + Math.min(headerRows, rect.height),
    width: rect.width,
    height: Math.max(0, rect.height - reservedRows),
  };
}

function appendBodyLines(target: string[], body: string): void {
  let start = 0;
  for (let index = 0; index <= body.length; index += 1) {
    if (index < body.length && body[index] !== "\n") continue;
    target.push(body.slice(start, index));
    start = index + 1;
  }
}

/** Registers hit targets for CPU hex tiles in the rendered visualization body. */
export function addApiWorkbenchCpuHexTileHits<TId extends string>(
  options: ApiWorkbenchCpuHexTileHitOptions<TId>,
): void {
  const { id, rect, cores, width, height, tiles, addHit } = options;
  const laidOutTiles = cpuHexTileLayoutInto(tiles, cores, width, height);
  const bodyHeaderRows = 2;
  const cpuHexSummaryRows = 2;
  const rowOffset = rect.row + bodyHeaderRows + cpuHexSummaryRows;
  for (const tile of laidOutTiles) {
    addHit({
      column: rect.column + tile.column,
      row: rowOffset + tile.row,
      width: tile.width,
      height: tile.height,
    }, { type: "cpuHexTile", id, label: tile.label });
  }
}
