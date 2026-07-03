// Copyright 2023 Im-Beast. MIT license.
import { createProcessTerminalBackend, type TerminalBackend } from "../runtime/terminal_backend.ts";
import { createSigmaPtyTerminalBackend } from "../runtime/pty_backend.ts";
import { TerminalShellController, type TerminalShellControllerOptions } from "../runtime/terminal_shell.ts";
import {
  type TerminalWorkspaceLayoutState,
  type TerminalWorkspacePaneRect,
  type TerminalWorkspacePaneRectOptions,
  terminalWorkspacePaneRects,
} from "../runtime/terminal_workspace.ts";
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

/** Minimal session id metadata used when creating the next workbench terminal session. */
export interface WorkbenchTerminalSessionIdSource {
  id: string;
}

/** Options for creating stable sequential terminal session ids. */
export interface WorkbenchTerminalSessionIdOptions {
  prefix?: string;
  maxIndex?: number;
  fallbackNow?: () => number;
}

/** Options for deriving a display title from a generated terminal session id. */
export interface WorkbenchTerminalSessionTitleOptions {
  prefix?: string;
  label?: string;
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

/** Renderer-neutral command for painting terminal session tab rows. */
export interface WorkbenchTerminalSessionTabRenderCommand {
  kind: "gap" | "tab";
  text: string;
  rect: Rectangle;
  id?: string;
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

/** Legacy process-output terminal toolbar actions used by the API Workbench command output pane. */
export type WorkbenchTerminalOutputToolbarAction = "run" | "stop" | "restart" | "clear" | "follow" | "copy" | "raw";

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

/** State snapshot used to project the process-output toolbar without knowing the renderer. */
export interface WorkbenchTerminalOutputToolbarState {
  running: boolean;
  outputLineCount: number;
  follow: boolean;
  inputMode?: "raw" | "workbench";
}

/** Options for projecting a terminal toolbar action list. */
export interface WorkbenchTerminalToolbarItemOptions {
  actions?: readonly WorkbenchTerminalToolbarAction[];
}

/** Options for projecting process-output terminal toolbar actions. */
export interface WorkbenchTerminalOutputToolbarItemOptions {
  actions?: readonly WorkbenchTerminalOutputToolbarAction[];
}

/** Projected pane frame metadata shared by terminal and browser workbench shell renderers. */
export interface WorkbenchTerminalPaneProjection {
  pane?: TerminalWorkspacePaneRect;
  paneId?: string;
  sessionId?: string;
  rect: Rectangle;
  contentRect: Rectangle;
  active: boolean;
  zoomed: boolean;
  titleVisible: boolean;
  title: string;
}

/** Options for projecting terminal workspace panes into render-ready frame metadata. */
export interface WorkbenchTerminalPaneProjectionOptions extends TerminalWorkspacePaneRectOptions {
  fallbackSessionId?: string;
  titleForSession?: (sessionId: string) => string | undefined;
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

/** Default action ordering for the API Workbench process-output toolbar. */
export const WORKBENCH_TERMINAL_OUTPUT_TOOLBAR_ACTIONS: readonly WorkbenchTerminalOutputToolbarAction[] = [
  "run",
  "stop",
  "restart",
  "clear",
  "follow",
  "raw",
  "copy",
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

/** Returns the first unused sequential workbench terminal session id without allocating an intermediate id set. */
export function nextWorkbenchTerminalSessionId(
  sessions: readonly WorkbenchTerminalSessionIdSource[],
  options: WorkbenchTerminalSessionIdOptions = {},
): string {
  const prefix = options.prefix ?? "shell";
  const maxIndex = Math.max(1, Math.floor(options.maxIndex ?? 9999));
  for (let index = 1; index <= maxIndex; index += 1) {
    const id = `${prefix}-${index}`;
    let exists = false;
    for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
      if (sessions[sessionIndex]?.id === id) {
        exists = true;
        break;
      }
    }
    if (!exists) return id;
  }
  return `${prefix}-${options.fallbackNow?.() ?? Date.now()}`;
}

/** Creates a compact title for a generated workbench terminal session id. */
export function workbenchTerminalSessionTitleFromId(
  id: string,
  options: WorkbenchTerminalSessionTitleOptions = {},
): string {
  const prefix = options.prefix ?? "shell";
  const label = options.label ?? "Shell";
  const expectedPrefix = `${prefix}-`;
  if (!id.startsWith(expectedPrefix)) return label;
  const suffix = id.slice(expectedPrefix.length);
  return /^\d+$/.test(suffix) ? `${label} ${suffix}` : label;
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

/** Projects session tab placements into a complete row of tab and gap paint commands. */
export function workbenchTerminalSessionTabRenderCommandsInto(
  target: WorkbenchTerminalSessionTabRenderCommand[],
  placements: readonly WorkbenchTerminalSessionTabPlacement[],
  rect: Rectangle,
): WorkbenchTerminalSessionTabRenderCommand[] {
  let written = 0;
  if (rect.width <= 0 || rect.height <= 0) {
    target.length = 0;
    return target;
  }
  const row = rect.row;
  const maxColumn = rect.column + rect.width;
  let column = rect.column;
  for (let index = 0; index < placements.length; index += 1) {
    const tab = placements[index]!;
    if (tab.row !== row) continue;
    const tabColumn = Math.max(rect.column, Math.min(maxColumn, tab.column));
    if (tabColumn > column) {
      writeSessionTabRenderCommand(target, written, "gap", undefined, false, column, row, tabColumn - column);
      written += 1;
    }
    const width = Math.max(0, Math.min(tab.width, maxColumn - tabColumn));
    if (width > 0) {
      const text = fitCellText(tab.label, width);
      writeSessionTabRenderCommand(target, written, "tab", tab.id, tab.active, tabColumn, row, width, text);
      written += 1;
      column = tabColumn + width;
    }
  }
  if (column < maxColumn) {
    writeSessionTabRenderCommand(target, written, "gap", undefined, false, column, row, maxColumn - column);
    written += 1;
  }
  target.length = written;
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

/** Projects process-output toolbar button descriptors into caller-owned storage. */
export function workbenchTerminalOutputToolbarItemsInto(
  target: WorkbenchButtonRowItem<WorkbenchTerminalOutputToolbarAction>[],
  state: WorkbenchTerminalOutputToolbarState,
  options: WorkbenchTerminalOutputToolbarItemOptions = {},
): WorkbenchButtonRowItem<WorkbenchTerminalOutputToolbarAction>[] {
  const actions = options.actions ?? WORKBENCH_TERMINAL_OUTPUT_TOOLBAR_ACTIONS;
  let written = 0;
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]!;
    const item = workbenchTerminalOutputToolbarItemForAction(target[written], action);
    if (action === "run") {
      item.disabled = state.running;
    } else if (action === "stop") {
      item.disabled = !state.running;
    } else if (action === "clear") {
      item.disabled = state.outputLineCount <= 0;
    } else if (action === "follow") {
      item.active = state.follow;
    } else if (action === "raw") {
      item.active = state.inputMode === "raw";
      item.disabled = !state.running;
    }
    target[written] = item;
    written += 1;
  }
  target.length = written;
  return target;
}

/** Projects a terminal workspace layout into pane frames with content rectangles and optional title rows. */
export function workbenchTerminalPaneProjectionsInto(
  target: WorkbenchTerminalPaneProjection[],
  layout: TerminalWorkspaceLayoutState,
  bounds: Rectangle,
  options: WorkbenchTerminalPaneProjectionOptions = {},
): WorkbenchTerminalPaneProjection[] {
  const entries = terminalWorkspacePaneRects(layout, bounds, {
    gap: options.gap,
    respectZoom: options.respectZoom,
  });
  let written = 0;
  if (entries.length === 0) {
    if (bounds.width > 0 && bounds.height > 0) {
      writeTerminalPaneProjection(target, written, undefined, bounds, true, options.fallbackSessionId, undefined);
      written += 1;
    }
  } else {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      const sessionId = entry.pane.sessionId;
      writeTerminalPaneProjection(
        target,
        written,
        entry,
        entry.rect,
        entry.active,
        sessionId,
        entry.pane.title ?? options.titleForSession?.(sessionId) ?? sessionId,
      );
      written += 1;
    }
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

function workbenchTerminalOutputToolbarItemForAction(
  target: WorkbenchButtonRowItem<WorkbenchTerminalOutputToolbarAction> | undefined,
  action: WorkbenchTerminalOutputToolbarAction,
): WorkbenchButtonRowItem<WorkbenchTerminalOutputToolbarAction> {
  const item = target ?? { label: "", action };
  item.action = action;
  item.disabled = false;
  item.active = false;
  item.tone = undefined;
  if (action === "run") {
    item.label = "Run";
    item.tone = "success";
  } else if (action === "stop") {
    item.label = "Stop";
    item.tone = "danger";
  } else if (action === "restart") {
    item.label = "Restart";
    item.tone = "warning";
  } else if (action === "clear") {
    item.label = "Clear";
    item.tone = "muted";
  } else if (action === "follow") {
    item.label = "Follow";
  } else if (action === "raw") {
    item.label = "Raw";
  } else {
    item.label = "Copy Cmd";
    item.tone = "muted";
  }
  return item;
}

function writeTerminalPaneProjection(
  target: WorkbenchTerminalPaneProjection[],
  index: number,
  pane: TerminalWorkspacePaneRect | undefined,
  rect: Rectangle,
  active: boolean,
  sessionId: string | undefined,
  title: string | undefined,
): void {
  const projection = target[index] ?? {
    rect: { column: 0, row: 0, width: 0, height: 0 },
    contentRect: { column: 0, row: 0, width: 0, height: 0 },
    active: false,
    zoomed: false,
    titleVisible: false,
    title: "",
  };
  projection.pane = pane;
  projection.paneId = pane?.pane.id;
  projection.sessionId = sessionId;
  projection.active = active;
  projection.zoomed = pane?.zoomed ?? false;
  projection.titleVisible = pane !== undefined && rect.height > 2;
  projection.title = projection.titleVisible ? `${active ? ">" : " "} ${title ?? sessionId ?? ""}` : "";
  setRect(projection.rect, rect);
  if (projection.titleVisible) {
    setRect(projection.contentRect, {
      column: rect.column,
      row: rect.row + 1,
      width: rect.width,
      height: rect.height - 1,
    });
  } else {
    setRect(projection.contentRect, rect);
  }
  target[index] = projection;
}

function setRect(target: Rectangle, source: Rectangle): void {
  target.column = source.column;
  target.row = source.row;
  target.width = source.width;
  target.height = source.height;
}

function writeSessionTabRenderCommand(
  target: WorkbenchTerminalSessionTabRenderCommand[],
  index: number,
  kind: WorkbenchTerminalSessionTabRenderCommand["kind"],
  id: string | undefined,
  active: boolean,
  column: number,
  row: number,
  width: number,
  text = " ".repeat(width),
): void {
  const command = target[index] ?? {
    kind,
    text: "",
    rect: { column: 0, row: 0, width: 0, height: 1 },
    active: false,
  };
  command.kind = kind;
  command.id = id;
  command.active = active;
  command.text = text;
  command.rect.column = column;
  command.rect.row = row;
  command.rect.width = width;
  command.rect.height = 1;
  target[index] = command;
}
