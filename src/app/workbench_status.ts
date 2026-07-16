// Copyright 2023 Im-Beast. MIT license.
import { renderStatusBar } from "../components/statusbar.ts";
import { type DiagnosticEntry, type DiagnosticsCollector, formatDiagnosticStatus } from "../runtime/diagnostics.ts";

/** Human-readable density bucket for adaptive workbench tile layouts. */
export type WorkbenchTileDensityLabel = "wide" | "balanced" | "dense";

/** Workbench host profile used for responsive shortcut text. */
export type WorkbenchStatusShortcutProfile = "terminal" | "web";

/** Workbench host profile used for navigation help text. */
export type WorkbenchHelpProfile = "terminal" | "web";

/** Options for composing a compact workbench status-bar left segment. */
export interface WorkbenchStatusLeftOptions {
  focus: string;
  theme: string;
  tileDensity: number;
  diagnostics?: string;
}

/** Minimal window state shape used when composing empty workspace messages. */
export interface WorkbenchEmptyWorkspaceWindowState {
  closed?: boolean;
  minimized?: boolean;
}

/** Options for composing the empty-workspace message shared by workbench adapters. */
export interface WorkbenchEmptyWorkspaceMessageOptions {
  windows: readonly WorkbenchEmptyWorkspaceWindowState[];
  labels?: {
    closed?: string;
    minimized?: string;
    empty?: string;
  };
}

/** Options for responsive workbench header help text. */
export interface WorkbenchHeaderHelpOptions {
  width: number;
  minVisibleWidth?: number;
  /** Expands the shortcut row. Header help is collapsed by default because the status bar already carries shortcuts. */
  expanded?: boolean;
}

/** Options for composing workbench navigation help rows. */
export interface WorkbenchHelpRowsOptions {
  profile?: WorkbenchHelpProfile;
}

/** Options for composing a full workbench status-bar row. */
export interface WorkbenchStatusLineOptions extends WorkbenchStatusLeftOptions {
  width: number;
  shortcutProfile?: WorkbenchStatusShortcutProfile;
  /** Set to false when another visible surface already presents the shortcut legend. */
  showShortcuts?: boolean;
}

/** Renderer-neutral snapshot used to compose workbench bottom status bars. */
export interface WorkbenchStatusSnapshot {
  focus: string;
  theme: string;
  tileDensity: number;
  diagnostics?: string;
}

/** Options for composing a bottom status bar from an already sampled workbench snapshot. */
export interface WorkbenchStatusSnapshotLineOptions {
  snapshot: WorkbenchStatusSnapshot;
  width: number;
  shortcutProfile?: WorkbenchStatusShortcutProfile;
  /** Set to false when another visible surface already presents the shortcut legend. */
  showShortcuts?: boolean;
}

/** Options for formatting diagnostics in workbench status bars and log panels. */
export interface WorkbenchDiagnosticFormatOptions {
  logLabel?: string;
  statusLabel?: string;
  maxLogEntries?: number;
}

/** Converts a signed tile-density preference into a status-bar label. */
export function workbenchTileDensityLabel(value: number): WorkbenchTileDensityLabel {
  if (value === 0 || !Number.isFinite(value)) return "balanced";
  return value > 0 ? "dense" : "wide";
}

/** Builds the common focus/theme/layout/diagnostics status text used by workbench adapters. */
export function workbenchStatusLeft(options: WorkbenchStatusLeftOptions): string {
  const parts = [
    `focus ${options.focus}`,
    options.theme,
    `tiles ${workbenchTileDensityLabel(options.tileDensity)}`,
  ];
  const diagnostics = options.diagnostics?.trim();
  if (diagnostics) parts.push(diagnostics);
  return parts.join(" | ");
}

/** Removes redundant diagnostic detail when the status bar needs room for shortcuts. */
export function workbenchCompactStatusDiagnostics(diagnostics: string | undefined): string | undefined {
  const text = diagnostics?.trim();
  if (!text) return undefined;
  const match = /^(.+?\b(\d+)\s+(debug|info|warning|error)s?)\s+\(\s*(\d+)\s+(debug|info|warning|error)s?\s*\)$/i
    .exec(text);
  if (!match || match[2] !== match[4] || match[3]?.toLowerCase() !== match[5]?.toLowerCase()) return text;
  return match[1]!.trim() || text;
}

/** Builds right-aligned shortcut text for the bottom workbench status bar. */
export function workbenchStatusShortcuts(
  profile: WorkbenchStatusShortcutProfile = "terminal",
  width = Number.POSITIVE_INFINITY,
): string {
  if (profile === "web") {
    if (width < 40) return "";
    if (width < 72) return "T theme  H help  Q quit";
    if (width < 112) return "1-8 focus  T theme  H help  Q quit";
    return "1-8 focus  T theme  H help  Q quit  click controls";
  }
  if (width < 40) return "";
  if (width < 72) return "F10 menu  F6 layout  Q quit";
  if (width < 132) return "F10 menu  N panels  F6 layout  G config  Q quit";
  return "F10 menu  N panels  F6 layout  Shift+T themes  G config";
}

/** Builds the fully-aligned workbench status-bar text shared by terminal and web adapters. */
export function workbenchStatusLine(options: WorkbenchStatusLineOptions): string {
  const right = options.showShortcuts === false ? "" : workbenchStatusShortcuts(options.shortcutProfile, options.width);
  const left = workbenchStatusLeft({
    ...options,
    diagnostics: workbenchCompactStatusDiagnostics(options.diagnostics),
  });
  return renderStatusBar(left, right, options.width, "right");
}

/** Builds the fully-aligned status row from a renderer-owned state snapshot. */
export function workbenchStatusSnapshotLine(options: WorkbenchStatusSnapshotLineOptions): string {
  return workbenchStatusLine({
    focus: options.snapshot.focus,
    theme: options.snapshot.theme,
    tileDensity: options.snapshot.tileDensity,
    diagnostics: options.snapshot.diagnostics,
    width: options.width,
    shortcutProfile: options.shortcutProfile,
    showShortcuts: options.showShortcuts,
  });
}

/** Builds opt-in responsive workbench header help, or an empty string while the row is collapsed or too narrow. */
export function workbenchHeaderHelp(options: WorkbenchHeaderHelpOptions): string {
  if (options.expanded !== true) return "";
  const width = Math.max(0, Math.floor(options.width));
  if (width < (options.minVisibleWidth ?? 34)) return "";
  if (width >= 132) return "F10 menu  N panels  F6 layout  T theme  G config  C close  Tab focus  Q quit";
  if (width >= 96) return "F10 menu  N panels  F6 layout  G config  Tab focus  Q quit";
  if (width >= 56) return "F10 menu  N panels  Tab focus  Q quit";
  return "F10 menu  Q quit";
}

/** Builds workbench navigation help rows shared by terminal and browser adapters. */
export function workbenchHelpRows(options: WorkbenchHelpRowsOptions = {}): string[] {
  return options.profile === "web" ? webWorkbenchHelpRows() : terminalWorkbenchHelpRows();
}

function webWorkbenchHelpRows(): string[] {
  return [
    "Keyboard: Tab cycles panels. Use 1-8 to focus Explorer, Inspector, Data, Controls, Logs, Three ASCII, HTML/CSS Layout, and Terminal.",
    "Use M to minimize, F or Enter to maximize/restore, R to restore all panels, T for themes, H for help, and Q to quit.",
    "Controls: arrow keys adjust sliders, radio groups, combo boxes, steppers, and dropdowns. Enter or Space activates.",
    "Mouse: click panels to focus, click rows to select, click controls to change values, and click scrollbars to jump.",
    "Touch: use the compact command strip, tap larger hit zones around controls, and drag inside panels to scroll.",
    "Resize the browser. The same tiled layout helper used by the terminal workbench recomputes panel geometry.",
  ];
}

function terminalWorkbenchHelpRows(): string[] {
  return [
    "Keyboard: Tab moves focus through windows. Inside Controls, Tab moves through controls and leaves the pane after the last control. Shift+Tab moves backward.",
    "Use F10 to focus the top menu, Left/Right to move, Down or Enter to open, arrows to choose menu items, Enter to activate, and Escape to leave.",
    "Use N to open Panels, Shift+T to open Theme, T to cycle themes, H or ? for help, Q to request quit, and 0 to restore the next minimized window.",
    "Use 1-8 to focus built-in windows, and higher numbers for added windows. Use M to minimize, F or Enter to maximize, C to close, and R or Escape to restore windows.",
    "When a window is fullscreen, use the bottom tabs, Tab, or number shortcuts to switch between fullscreen windows.",
    "Use F6 for Layout mode. Arrows change focus, Shift+Arrows move panes, Ctrl+Arrows resize the nearest split, Enter maximizes, and Escape exits Layout mode.",
    "Use G from any Three ASCII, Neon 3D, or NGE primitive window to open renderer config. In config, use Up/Down to select settings and Left/Right or Enter to change them.",
    "Use arrows in the Data Table, Explorer, Logs, and overflow windows. In Data Table, S cycles the sort column. Shift+Left/Right scrolls horizontally when content is wider than the pane.",
    "In Controls, arrows adjust sliders, radio groups, combo boxes, steppers, and dropdown selections. Enter or Space activates the selected control.",
    "Three ASCII widgets: mousewheel over the rendered scene zooms; click and drag the scene to rotate the model.",
    "Mouse: drag titlebars to dock or swap panes, drag highlighted split gutters to resize, click rows to select, and drag or click scrollbars for overflow content.",
    "Use Panels to show or hide core panels and add Monitor, Neon Exodus, and Neon 3D visualization windows.",
    "Panels also includes Shell, Terminal Output, and HTML/CSS Layout windows for interactive shells, process output, and markup/CSS layout demos.",
    "In Shell, P/S/U/K start, stop, restart, and clear. N opens a new shell, - splits horizontally, \\ splits vertically, Z toggles pane zoom, / searches scrollback, and I enters raw input.",
    "While Shell raw input is active, type normal commands, Ctrl+C interrupts the shell, and Escape returns to Workbench mode.",
    "In Terminal Output, P/S/U/K/V/Y run, stop, restart, clear, follow, and copy the command. Press I while the process is running to send printable keys to child stdin; Escape returns to workbench mode.",
    "Use File to save, open, rename, or delete complete workspace layouts, including panel states, split ratios, and renderer settings.",
    "Use the Theme menu to switch palettes. Click the [x] button in the top-right menu bar or press Q to open quit confirmation.",
  ];
}

/** Builds a user-facing message for workspace layouts with no visible normal windows. */
export function workbenchEmptyWorkspaceMessage(options: WorkbenchEmptyWorkspaceMessageOptions): string {
  let minimizedCount = 0;
  let openCount = 0;
  for (let index = 0; index < options.windows.length; index += 1) {
    const entry = options.windows[index]!;
    if (!entry.closed) openCount += 1;
    if (entry.minimized) minimizedCount += 1;
  }
  if (openCount === 0) {
    return options.labels?.closed ?? "All windows closed. Use Panels to add a window.";
  }
  if (minimizedCount > 0) {
    return options.labels?.minimized ?? "All open windows minimized. Press R or use the shelf to restore.";
  }
  return options.labels?.empty ?? "No visible windows. Use Panels to add a window.";
}

/** Formats one diagnostic entry for compact workbench logs. */
export function formatWorkbenchDiagnosticLogEntry(
  entry: DiagnosticEntry,
  options: WorkbenchDiagnosticFormatOptions = {},
): string {
  return formatDiagnosticStatus([entry], { label: options.logLabel ?? "diagnostic", includeLatest: true });
}

/** Formats all collected diagnostics for a compact workbench status segment. */
export function formatWorkbenchDiagnosticStatus(
  diagnostics: DiagnosticsCollector,
  options: WorkbenchDiagnosticFormatOptions = {},
): string {
  const status = formatDiagnosticStatus(diagnostics.entries(), {
    label: options.statusLabel ?? "diag",
    includeLatest: false,
  });
  return workbenchCompactStatusDiagnostics(status) ?? status;
}

/** Creates initial log rows that include diagnostics reported before the renderer subscribed. */
export function initialWorkbenchDiagnosticLogRows(
  diagnostics: DiagnosticsCollector,
  rows: readonly string[],
  options: WorkbenchDiagnosticFormatOptions = {},
): string[] {
  const maxLogEntries = Math.max(1, Math.floor(options.maxLogEntries ?? 40));
  const output: string[] = [];
  appendBoundedRows(output, rows, maxLogEntries);
  const entries = diagnostics.entries();
  for (let index = 0; index < entries.length; index += 1) {
    appendBoundedRow(output, formatWorkbenchDiagnosticLogEntry(entries[index]!, options), maxLogEntries);
  }
  return output;
}

/** Subscribes a workbench log sink to future diagnostics. */
export function subscribeWorkbenchDiagnosticLog(
  diagnostics: DiagnosticsCollector,
  onLog: (message: string) => void,
  options: WorkbenchDiagnosticFormatOptions = {},
): () => void {
  return diagnostics.subscribe((entry) => {
    if (!entry) return;
    onLog(formatWorkbenchDiagnosticLogEntry(entry, options));
  });
}

/** Returns a new bounded log row array with `row` appended and older rows trimmed from the front. */
export function appendBoundedWorkbenchLogRow(
  rows: readonly string[],
  row: string,
  limit = 40,
): string[] {
  const maxLogEntries = Math.max(1, Math.floor(limit));
  const retained = Math.min(rows.length, maxLogEntries - 1);
  const output = new Array<string>(retained + 1);
  const start = Math.max(0, rows.length - retained);
  for (let index = 0; index < retained; index += 1) {
    output[index] = rows[start + index]!;
  }
  output[retained] = row;
  return output;
}

function appendBoundedRows(target: string[], rows: readonly string[], limit: number): void {
  const start = Math.max(0, rows.length - limit);
  for (let index = start; index < rows.length; index += 1) appendBoundedRow(target, rows[index]!, limit);
}

function appendBoundedRow(target: string[], row: string, limit: number): void {
  if (target.length >= limit) target.shift();
  target.push(row);
}
