// Copyright 2023 Im-Beast. MIT license.
import { renderStatusBar } from "../components/statusbar.ts";

/** Human-readable density bucket for adaptive workbench tile layouts. */
export type WorkbenchTileDensityLabel = "wide" | "balanced" | "dense";

/** Workbench host profile used for responsive shortcut text. */
export type WorkbenchStatusShortcutProfile = "terminal" | "web";

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
}

/** Options for composing a full workbench status-bar row. */
export interface WorkbenchStatusLineOptions extends WorkbenchStatusLeftOptions {
  width: number;
  shortcutProfile?: WorkbenchStatusShortcutProfile;
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
  if (width < 72) return "F10 menu  G config  Q quit";
  if (width < 132) return "F10 menu  N new  G config  M/F/R  Q quit";
  return "F10 menu  N new  Shift+T themes  G config  0 restore minimized";
}

/** Builds the fully-aligned workbench status-bar text shared by terminal and web adapters. */
export function workbenchStatusLine(options: WorkbenchStatusLineOptions): string {
  return renderStatusBar(
    workbenchStatusLeft(options),
    workbenchStatusShortcuts(options.shortcutProfile, options.width),
    options.width,
    "right",
  );
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
  });
}

/** Builds the responsive workbench header help text, or an empty string when too narrow. */
export function workbenchHeaderHelp(options: WorkbenchHeaderHelpOptions): string {
  const width = Math.max(0, Math.floor(options.width));
  if (width < (options.minVisibleWidth ?? 34)) return "";
  if (width >= 132) return "F10 menu  N new  T theme  G config  C close  Tab focus  M/F/R  Q quit";
  if (width >= 96) return "F10 menu  N new  G config  Tab  M/F/R  Q quit";
  if (width >= 56) return "F10 menu  N new  Tab focus  Q quit";
  return "F10 menu  Q quit";
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
    return options.labels?.closed ?? "All windows closed. Use New to add a widget window.";
  }
  if (minimizedCount > 0) {
    return options.labels?.minimized ?? "All open windows minimized. Press R or use the shelf to restore.";
  }
  return options.labels?.empty ?? "No visible windows. Use New to add a widget window.";
}
