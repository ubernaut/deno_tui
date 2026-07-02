// Copyright 2023 Im-Beast. MIT license.

/** Human-readable density bucket for adaptive workbench tile layouts. */
export type WorkbenchTileDensityLabel = "wide" | "balanced" | "dense";

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
