// Copyright 2023 Im-Beast. MIT license.
import { createProcessTerminalBackend, type TerminalBackend } from "../runtime/terminal_backend.ts";
import { createSigmaPtyTerminalBackend } from "../runtime/pty_backend.ts";
import { TerminalShellController, type TerminalShellControllerOptions } from "../runtime/terminal_shell.ts";
import type { Rectangle } from "../types.ts";
import { textWidth } from "../utils/strings.ts";
import { buttonText, fitCellText } from "./workbench_frame.ts";
import type { WorkbenchButtonRowItem } from "./workbench_control_layout.ts";

type MaybePromise<T> = T | Promise<T>;

/** Options for resolving the API Workbench shell backend. */
export interface WorkbenchShellBackendResolverOptions {
  ptyFactory?: () => MaybePromise<TerminalBackend>;
  processFactory?: () => TerminalBackend;
  onFallback?: (message: string) => void;
}

/** Resolution result for the API Workbench shell backend. */
export interface WorkbenchShellBackendResolution {
  backend: TerminalBackend;
  fallback: boolean;
  reason?: string;
}

/** Options for creating an API Workbench shell controller through the workbench backend resolver. */
export interface WorkbenchShellSessionOptions
  extends Omit<TerminalShellControllerOptions, "backend" | "backendFactory"> {
  resolver?: WorkbenchShellBackendResolverOptions;
}

/** Shell controller plus backend resolution metadata for workbench terminal windows. */
export interface WorkbenchShellSession {
  shell: TerminalShellController;
  resolution: WorkbenchShellBackendResolution;
}

/** Minimal session metadata needed to project terminal session tabs for any renderer. */
export interface WorkbenchTerminalSessionTab {
  id: string;
  title: string;
  running?: boolean;
  status?: string;
}

/** Projected terminal session tab geometry and label. */
export interface WorkbenchTerminalSessionTabPlacement {
  id: string;
  label: string;
  column: number;
  row: number;
  width: number;
  active: boolean;
}

/** Options for projecting terminal session tabs into one terminal-cell row. */
export interface WorkbenchTerminalSessionTabOptions {
  minWidth?: number;
  maxWidth?: number;
}

/** Common Workbench terminal toolbar actions shared by console and browser adapters. */
export type WorkbenchTerminalToolbarAction =
  | "new"
  | "previous"
  | "next"
  | "close"
  | "splitRow"
  | "splitColumn"
  | "zoomPane"
  | "closePane"
  | "start"
  | "stop"
  | "restart"
  | "clear"
  | "raw"
  | "copy"
  | "search"
  | "previousMatch"
  | "nextMatch"
  | "top"
  | "bottom";

/** State snapshot used to project terminal toolbar actions without knowing the renderer. */
export interface WorkbenchTerminalToolbarState {
  sessionCount: number;
  activeId?: string;
  paneCount?: number;
  zoomedPaneId?: string;
  shellRunning?: boolean;
  shellStarting?: boolean;
  inputMode?: "raw" | "workbench";
  copyMode?: boolean;
  scrollbackTotalRows?: number;
  scrollbackViewportRows?: number;
  searchQuery?: string;
  searchMatchCount?: number;
}

/** Options for projecting a terminal toolbar action list. */
export interface WorkbenchTerminalToolbarItemOptions {
  actions?: readonly WorkbenchTerminalToolbarAction[];
}

/** Default Workbench terminal toolbar action ordering for full console shell panes. */
export const WORKBENCH_TERMINAL_TOOLBAR_ACTIONS: readonly WorkbenchTerminalToolbarAction[] = [
  "new",
  "previous",
  "next",
  "close",
  "splitRow",
  "splitColumn",
  "zoomPane",
  "closePane",
  "start",
  "stop",
  "restart",
  "clear",
  "raw",
  "copy",
  "search",
  "previousMatch",
  "nextMatch",
  "top",
  "bottom",
] as const;

/** Resolves the preferred PTY shell backend and falls back to the process backend when PTY is unavailable. */
export async function resolveWorkbenchShellBackend(
  options: WorkbenchShellBackendResolverOptions = {},
): Promise<WorkbenchShellBackendResolution> {
  const ptyFactory = options.ptyFactory ??
    (() => createSigmaPtyTerminalBackend({ pollingIntervalMs: 8 }));
  const processFactory = options.processFactory ?? (() => createProcessTerminalBackend());

  try {
    return {
      backend: await ptyFactory(),
      fallback: false,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    options.onFallback?.(reason);
    return {
      backend: processFactory(),
      fallback: true,
      reason,
    };
  }
}

/** Creates a workbench shell controller using the same PTY-first backend resolution policy as the demo workbench. */
export async function createWorkbenchShellSession(
  options: WorkbenchShellSessionOptions = {},
): Promise<WorkbenchShellSession> {
  const { resolver, ...shellOptions } = options;
  const resolution = await resolveWorkbenchShellBackend(resolver);
  return {
    shell: new TerminalShellController({
      ...shellOptions,
      backend: resolution.backend,
    }),
    resolution,
  };
}

/** Projects terminal session tabs into a single row, returning caller-owned placements for rendering and hit testing. */
export function workbenchTerminalSessionTabsInto(
  target: WorkbenchTerminalSessionTabPlacement[],
  sessions: readonly WorkbenchTerminalSessionTab[],
  activeId: string | undefined,
  rect: Rectangle,
  options: WorkbenchTerminalSessionTabOptions = {},
): WorkbenchTerminalSessionTabPlacement[] {
  target.length = 0;
  if (rect.width <= 0 || rect.height <= 0) return target;
  const minWidth = Math.max(1, Math.floor(options.minWidth ?? 4));
  const maxWidth = Math.max(minWidth, Math.floor(options.maxWidth ?? 22));
  let column = rect.column;
  const endColumn = rect.column + rect.width;
  for (let index = 0; index < sessions.length && column < endColumn; index += 1) {
    const session = sessions[index]!;
    const active = session.id === activeId;
    const status = session.running ? "*" : session.status?.[0]?.toUpperCase() ?? "?";
    const available = endColumn - column;
    const width = Math.max(
      1,
      Math.min(available, Math.max(minWidth, Math.min(maxWidth, textWidth(session.title) + 6))),
    );
    const label = fitCellText(buttonText(`${status} ${session.title}`), width);
    target.push({
      id: session.id,
      label,
      column,
      row: rect.row,
      width: textWidth(label),
      active,
    });
    column += width + 1;
  }
  return target;
}

/** Projects terminal toolbar button descriptors into caller-owned storage. */
export function workbenchTerminalToolbarItemsInto(
  target: WorkbenchButtonRowItem<WorkbenchTerminalToolbarAction>[],
  state: WorkbenchTerminalToolbarState,
  options: WorkbenchTerminalToolbarItemOptions = {},
): WorkbenchButtonRowItem<WorkbenchTerminalToolbarAction>[] {
  const actions = options.actions ?? WORKBENCH_TERMINAL_TOOLBAR_ACTIONS;
  const hasMatches = (state.searchMatchCount ?? 0) > 0;
  const scrollDisabled = (state.scrollbackTotalRows ?? 0) <= (state.scrollbackViewportRows ?? 0);
  let written = 0;
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]!;
    const item = workbenchTerminalToolbarItemForAction(target[written], action);
    if (action === "previous" || action === "next") {
      item.disabled = state.sessionCount < 2;
    } else if (action === "close") {
      item.disabled = state.activeId === undefined || state.sessionCount <= 1;
    } else if (action === "zoomPane") {
      item.active = state.zoomedPaneId !== undefined;
    } else if (action === "closePane") {
      item.disabled = (state.paneCount ?? 1) < 2;
    } else if (action === "start") {
      item.disabled = state.activeId === undefined || state.shellRunning === true || state.shellStarting === true;
    } else if (action === "stop") {
      item.disabled = state.shellRunning !== true;
    } else if (action === "restart") {
      item.disabled = state.activeId === undefined;
    } else if (action === "raw") {
      item.active = state.inputMode === "raw";
      item.disabled = state.shellRunning !== true;
    } else if (action === "copy") {
      item.active = state.copyMode === true;
    } else if (action === "search") {
      item.active = !!state.searchQuery;
      item.disabled = (state.scrollbackTotalRows ?? 0) <= 0;
    } else if (action === "previousMatch" || action === "nextMatch") {
      item.disabled = !hasMatches;
    } else if (action === "top" || action === "bottom") {
      item.disabled = scrollDisabled;
    }
    target[written] = item;
    written += 1;
  }
  target.length = written;
  return target;
}

function workbenchTerminalToolbarItemForAction(
  target: WorkbenchButtonRowItem<WorkbenchTerminalToolbarAction> | undefined,
  action: WorkbenchTerminalToolbarAction,
): WorkbenchButtonRowItem<WorkbenchTerminalToolbarAction> {
  const item = target ?? { label: "", action };
  item.action = action;
  item.disabled = false;
  item.active = false;
  item.tone = undefined;
  if (action === "new") {
    item.label = "New";
    item.tone = "success";
  } else if (action === "previous") {
    item.label = "Prev";
    item.tone = "muted";
  } else if (action === "next") {
    item.label = "Next";
    item.tone = "muted";
  } else if (action === "close") {
    item.label = "Close";
    item.tone = "danger";
  } else if (action === "splitRow") {
    item.label = "Split H";
  } else if (action === "splitColumn") {
    item.label = "Split V";
  } else if (action === "zoomPane") {
    item.label = "Zoom";
  } else if (action === "closePane") {
    item.label = "Close Pane";
    item.tone = "danger";
  } else if (action === "start") {
    item.label = "Start";
  } else if (action === "stop") {
    item.label = "Stop";
    item.tone = "danger";
  } else if (action === "restart") {
    item.label = "Restart";
    item.tone = "warning";
  } else if (action === "clear") {
    item.label = "Clear";
    item.tone = "muted";
  } else if (action === "raw") {
    item.label = "Raw";
  } else if (action === "copy") {
    item.label = "Copy";
  } else if (action === "search") {
    item.label = "Search";
  } else if (action === "previousMatch") {
    item.label = "Prev Hit";
  } else if (action === "nextMatch") {
    item.label = "Next Hit";
  } else if (action === "top") {
    item.label = "Top";
  } else {
    item.label = "Bottom";
  }
  return item;
}
