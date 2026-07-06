// Copyright 2023 Im-Beast. MIT license.
import { createProcessTerminalBackend, type TerminalBackend } from "../runtime/terminal_backend.ts";
import { formatTerminalOutputLine, type TerminalOutputLine } from "../components/terminal_output.ts";
import { createSigmaPtyTerminalBackend } from "../runtime/pty_backend.ts";
import { TerminalShellController, type TerminalShellControllerOptions } from "../runtime/terminal_shell.ts";
import {
  formatTerminalShellHint,
  formatTerminalShellStatusLine,
  type TerminalShellHintOptions,
  type TerminalShellStatusLineOptions,
} from "../runtime/terminal_status.ts";
import {
  type TerminalWorkspaceLayoutState,
  type TerminalWorkspacePaneRect,
  type TerminalWorkspacePaneRectOptions,
  terminalWorkspacePaneRects,
} from "../runtime/terminal_workspace.ts";
import type { Rectangle } from "../types.ts";
import { textWidth } from "../utils/strings.ts";
import type { TerminalInputMode } from "./terminal_input.ts";
import { buttonText, fitCellText } from "./workbench_frame.ts";
import type { WorkbenchButtonRowItem } from "./workbench_control_layout.ts";
import {
  applyWorkbenchTextPromptInput,
  type WorkbenchTextPromptInputEvent,
  type WorkbenchTextPromptInputResult,
} from "./workbench_text.ts";

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

/** Session-like source accepted by the shared terminal session-tab projector. */
export interface WorkbenchTerminalSessionTabSource {
  id: string;
  title: string;
  running?: boolean;
  status?: string;
  shell?: {
    running?: boolean;
    status?: string;
  };
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

/** Options for creating a terminal session id and title together. */
export interface WorkbenchTerminalSessionDraftOptions
  extends WorkbenchTerminalSessionIdOptions, WorkbenchTerminalSessionTitleOptions {}

/** Generated id/title pair for a new workbench terminal session. */
export interface WorkbenchTerminalSessionDraft {
  id: string;
  title: string;
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

/** Minimal keyboard event used by shared terminal key resolvers. */
export interface WorkbenchTerminalKey {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

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

/** Scrollback-like source accepted by the shared terminal toolbar state projector. */
export interface WorkbenchTerminalToolbarScrollbackSource {
  totalRows?: number;
  viewportRows?: number;
  query?: string;
  matches?: readonly unknown[];
  matchCount?: number;
}

/** Input for normalizing terminal toolbar state before item projection. */
export interface WorkbenchTerminalToolbarStateSnapshot {
  sessionCount: number;
  activeId?: string;
  paneCount?: number;
  zoomedPaneId?: string;
  shellRunning?: boolean;
  shellStarting?: boolean;
  inputMode?: "raw" | "workbench";
  copyMode?: boolean;
  scrollback?: WorkbenchTerminalToolbarScrollbackSource;
}

/** State snapshot used to project the process-output toolbar without knowing the renderer. */
export interface WorkbenchTerminalOutputToolbarState {
  running: boolean;
  outputLineCount: number;
  follow: boolean;
  inputMode?: "raw" | "workbench";
}

/** Minimal state needed to project the browser/remote terminal protocol header. */
export interface WorkbenchTerminalProtocolHeaderOptions {
  activeTitle?: string;
  columns: number;
  rows: number;
  cursorColumn: number;
  cursorRow: number;
  sessionCount: number;
  paneCount: number;
  title?: string;
}

/** Options for resolving a Workbench terminal input-mode toggle. */
export interface WorkbenchTerminalInputModeToggleOptions {
  mode: TerminalInputMode;
  canEnterRaw: boolean;
  enterRawMessage: string;
  enterWorkbenchMessage: string;
  rawUnavailableMessage: string;
}

/** Resolved Workbench terminal input-mode toggle decision. */
export interface WorkbenchTerminalInputModeToggleResult {
  mode: TerminalInputMode;
  changed: boolean;
  message: string;
}

/** Options for projecting a terminal toolbar action list. */
export interface WorkbenchTerminalToolbarItemOptions {
  actions?: readonly WorkbenchTerminalToolbarAction[];
}

/** Options for projecting process-output terminal toolbar actions. */
export interface WorkbenchTerminalOutputToolbarItemOptions {
  actions?: readonly WorkbenchTerminalOutputToolbarAction[];
}

/** Options for projecting process output rows into renderer-neutral text. */
export interface WorkbenchTerminalOutputRowsOptions {
  sourcePrefix?: boolean;
}

/** One renderer-neutral row in a process-output terminal window. */
export interface WorkbenchTerminalOutputWindowRow {
  kind: "status" | "hint" | "empty" | "output";
  text: string;
  source?: TerminalOutputLine["source"];
}

/** Inputs for projecting the process-output terminal window body below its toolbar. */
export interface WorkbenchTerminalOutputWindowRowsOptions extends WorkbenchTerminalOutputRowsOptions {
  statusText: string;
  hintText: string;
  lines: readonly TerminalOutputLine[];
  emptyText?: string;
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

/** Minimal theme tokens needed to paint terminal workspace pane title rows. */
export interface WorkbenchTerminalPaneTitleTheme {
  background: string;
  text: string;
  soft: string;
  panelSoft: string;
  accentDeep: string;
}

/** Renderer-neutral title-row command for terminal workspace panes. */
export interface WorkbenchTerminalPaneTitleRenderCommand {
  text: string;
  rect: Rectangle;
  hitRect: Rectangle;
  paneId?: string;
  active: boolean;
  style: {
    fg: string;
    bg: string;
    bold: boolean;
  };
}

/** Contrast resolver used by pane title render-command projection. */
export type WorkbenchTerminalPaneTitleContrast = (color: string, dark: string, light: string) => string;

/** Renderer-neutral shell header row projected before the live pane content. */
export interface WorkbenchTerminalShellHeaderRow {
  kind: "status" | "hint";
  text: string;
}

/** Options for projecting the shell status and hint rows. */
export interface WorkbenchTerminalShellHeaderRowsOptions {
  status: TerminalShellStatusLineOptions;
  hint: TerminalShellHintOptions;
}

/** Options for projecting terminal workspace panes into render-ready frame metadata. */
export interface WorkbenchTerminalPaneProjectionOptions extends TerminalWorkspacePaneRectOptions {
  fallbackSessionId?: string;
  titleForSession?: (sessionId: string) => string | undefined;
}

/** Scrollback selection range used to project terminal copy-mode rows. */
export interface WorkbenchTerminalCopySelection {
  anchor: number;
  focus: number;
}

/** Options for projecting terminal copy-mode rows into renderer-neutral metadata. */
export interface WorkbenchTerminalCopyRowsOptions {
  visibleRows: readonly string[];
  offset: number;
  height: number;
  selection?: WorkbenchTerminalCopySelection;
  prefixWidth?: number;
}

/** Projects the terminal shell status and hint rows into caller-owned storage. */
export function workbenchTerminalShellHeaderRowsInto(
  target: WorkbenchTerminalShellHeaderRow[],
  options: WorkbenchTerminalShellHeaderRowsOptions,
): WorkbenchTerminalShellHeaderRow[] {
  target.length = 2;
  target[0] = writeWorkbenchTerminalShellHeaderRow(target[0], "status", formatTerminalShellStatusLine(options.status));
  target[1] = writeWorkbenchTerminalShellHeaderRow(target[1], "hint", formatTerminalShellHint(options.hint));
  return target;
}

function writeWorkbenchTerminalShellHeaderRow(
  target: WorkbenchTerminalShellHeaderRow | undefined,
  kind: WorkbenchTerminalShellHeaderRow["kind"],
  text: string,
): WorkbenchTerminalShellHeaderRow {
  if (target) {
    target.kind = kind;
    target.text = text;
    return target;
  }
  return { kind, text };
}

/** Minimal terminal scrollback search state needed to project a search modal body. */
export interface WorkbenchTerminalSearchModalScrollbackState {
  matches?: readonly unknown[];
  activeMatch?: number;
}

/** Options for projecting the terminal search modal body. */
export interface WorkbenchTerminalSearchModalBodyOptions {
  query: string;
  scrollback?: WorkbenchTerminalSearchModalScrollbackState;
  cursor?: string;
}

/** Options for applying one terminal search prompt key event. */
export interface WorkbenchTerminalSearchPromptInputOptions {
  event: WorkbenchTextPromptInputEvent;
  value: string;
  maxLength?: number;
}

/** Projected terminal copy-mode row metadata shared by console and browser renderers. */
export interface WorkbenchTerminalCopyRowProjection {
  screenRow: number;
  rowIndex: number;
  lineNumber: number;
  prefix: string;
  text: string;
  selected: boolean;
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

/** Resolves process-output terminal workbench-mode shortcuts into toolbar actions. */
export function resolveWorkbenchTerminalOutputKeyAction(
  event: WorkbenchTerminalKey,
): WorkbenchTerminalOutputToolbarAction | undefined {
  if (event.ctrl || event.meta) return undefined;
  switch (event.key.toLowerCase()) {
    case "p":
      return "run";
    case "s":
      return "stop";
    case "u":
      return "restart";
    case "k":
      return "clear";
    case "v":
      return "follow";
    case "y":
      return "copy";
    case "i":
      return "raw";
    default:
      return undefined;
  }
}

/** Resolves shell terminal workbench-mode shortcuts into toolbar actions. */
export function resolveWorkbenchTerminalShellKeyAction(
  event: WorkbenchTerminalKey,
): WorkbenchTerminalToolbarAction | "copyPageUp" | "copyPageDown" | undefined {
  if (event.ctrl || event.meta) return undefined;
  if (event.key === "pageup") return "copyPageUp";
  if (event.key === "pagedown") return "copyPageDown";
  if (event.key === "/") return "search";
  if (event.key === "home") return "top";
  if (event.key === "end") return "bottom";
  const key = event.key.toLowerCase();
  switch (key) {
    case "p":
      return "start";
    case "s":
      return "stop";
    case "u":
      return "restart";
    case "k":
      return "clear";
    case "n":
      return "new";
    case "-":
      return "splitRow";
    case "\\":
      return "splitColumn";
    case "z":
      return "zoomPane";
    case ",":
      return "previous";
    case ".":
      return "next";
    case "i":
      return "raw";
    default:
      return undefined;
  }
}

/** Resolves the next terminal input mode without mutating UI state. */
export function resolveWorkbenchTerminalInputModeToggle(
  options: WorkbenchTerminalInputModeToggleOptions,
): WorkbenchTerminalInputModeToggleResult {
  if (options.mode === "raw") {
    return {
      mode: "workbench",
      changed: true,
      message: options.enterWorkbenchMessage,
    };
  }

  if (!options.canEnterRaw) {
    return {
      mode: options.mode,
      changed: false,
      message: options.rawUnavailableMessage,
    };
  }

  return {
    mode: "raw",
    changed: true,
    message: options.enterRawMessage,
  };
}

/** Resolves the API Workbench process-output terminal input-mode toggle. */
export function resolveWorkbenchTerminalProcessInputModeToggle(
  options: { mode: TerminalInputMode; running: boolean },
): WorkbenchTerminalInputModeToggleResult {
  return resolveWorkbenchTerminalInputModeToggle({
    mode: options.mode,
    canEnterRaw: options.running,
    enterRawMessage: "terminal input raw mode",
    enterWorkbenchMessage: "terminal input workbench mode",
    rawUnavailableMessage: "terminal raw input requires running process",
  });
}

/** Resolves the API Workbench shell terminal input-mode toggle. */
export function resolveWorkbenchTerminalShellInputModeToggle(
  options: { mode: TerminalInputMode; running: boolean },
): WorkbenchTerminalInputModeToggleResult {
  return resolveWorkbenchTerminalInputModeToggle({
    mode: options.mode,
    canEnterRaw: options.running,
    enterRawMessage: "shell input raw mode",
    enterWorkbenchMessage: "shell input workbench mode",
    rawUnavailableMessage: "shell raw input requires a running shell",
  });
}

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

/** Creates the next terminal session id and matching display title from the same prefix policy. */
export function nextWorkbenchTerminalSessionDraft(
  sessions: readonly WorkbenchTerminalSessionIdSource[],
  options: WorkbenchTerminalSessionDraftOptions = {},
): WorkbenchTerminalSessionDraft {
  const id = nextWorkbenchTerminalSessionId(sessions, options);
  return { id, title: workbenchTerminalSessionTitleFromId(id, options) };
}

/** Projects terminal session-like controller state into caller-owned tab sources. */
export function workbenchTerminalSessionTabSourcesInto(
  target: WorkbenchTerminalSessionTab[],
  sessions: readonly WorkbenchTerminalSessionTabSource[],
): WorkbenchTerminalSessionTab[] {
  target.length = sessions.length;
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index]!;
    const row = target[index] ?? { id: session.id, title: session.title };
    row.id = session.id;
    row.title = session.title;
    row.running = session.running ?? session.shell?.running;
    row.status = session.status ?? session.shell?.status;
    target[index] = row;
  }
  return target;
}

/** Normalizes terminal toolbar state from controller snapshots for console and browser renderers. */
export function workbenchTerminalToolbarStateFromSnapshot(
  snapshot: WorkbenchTerminalToolbarStateSnapshot,
): WorkbenchTerminalToolbarState {
  const scrollback = snapshot.scrollback;
  return {
    activeId: snapshot.activeId,
    sessionCount: snapshot.sessionCount,
    paneCount: snapshot.paneCount,
    zoomedPaneId: snapshot.zoomedPaneId,
    shellRunning: snapshot.shellRunning,
    shellStarting: snapshot.shellStarting,
    inputMode: snapshot.inputMode,
    copyMode: snapshot.copyMode,
    scrollbackTotalRows: scrollback?.totalRows,
    scrollbackViewportRows: scrollback?.viewportRows,
    searchQuery: scrollback?.query,
    searchMatchCount: scrollback?.matchCount ?? scrollback?.matches?.length,
  };
}

/** Builds the shared terminal scrollback search prompt body. */
export function workbenchTerminalSearchModalBody(options: WorkbenchTerminalSearchModalBodyOptions): string[] {
  const cursor = options.cursor ?? "▌";
  const matches = options.scrollback?.matches?.length ?? 0;
  const active = options.scrollback?.activeMatch === undefined
    ? ""
    : ` hit ${options.scrollback.activeMatch + 1}/${matches}`;
  return [
    `Query  ${options.query}${cursor}`,
    matches > 0 ? `Matches ${matches}${active}` : "Matches none yet",
    "Enter searches, Escape cancels, N/Shift+N move between matches in copy mode.",
  ];
}

/** Applies common terminal search prompt editing keys with the workbench's default query length. */
export function applyWorkbenchTerminalSearchPromptInput(
  options: WorkbenchTerminalSearchPromptInputOptions,
): WorkbenchTextPromptInputResult {
  return applyWorkbenchTextPromptInput({
    event: options.event,
    value: options.value,
    maxLength: options.maxLength ?? 80,
    measureText: textWidth,
  });
}

/** Projects browser-safe terminal protocol header rows into caller-owned storage. */
export function workbenchTerminalProtocolHeaderRowsInto(
  target: string[],
  options: WorkbenchTerminalProtocolHeaderOptions,
): string[] {
  target.length = 2;
  target[0] = options.title ?? "REMOTE TERMINAL / BROWSER SHELL MODEL";
  target[1] = `active ${
    options.activeTitle ?? "none"
  }  screen ${options.columns}x${options.rows}  cursor ${options.cursorColumn},${options.cursorRow}  sessions ${options.sessionCount}  panes ${options.paneCount}`;
  return target;
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
  return projectToolbarItemsInto(
    target,
    actions,
    workbenchTerminalToolbarItemForAction,
    (item, action) => {
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
    },
  );
}

/** Projects process-output toolbar button descriptors into caller-owned storage. */
export function workbenchTerminalOutputToolbarItemsInto(
  target: WorkbenchButtonRowItem<WorkbenchTerminalOutputToolbarAction>[],
  state: WorkbenchTerminalOutputToolbarState,
  options: WorkbenchTerminalOutputToolbarItemOptions = {},
): WorkbenchButtonRowItem<WorkbenchTerminalOutputToolbarAction>[] {
  const actions = options.actions ?? WORKBENCH_TERMINAL_OUTPUT_TOOLBAR_ACTIONS;
  return projectToolbarItemsInto(
    target,
    actions,
    workbenchTerminalOutputToolbarItemForAction,
    (item, action) => {
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
    },
  );
}

/** Formats process terminal output lines into a caller-owned text row buffer. */
export function workbenchTerminalOutputRowsInto(
  target: string[],
  lines: readonly TerminalOutputLine[],
  options: WorkbenchTerminalOutputRowsOptions = {},
): string[] {
  target.length = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    target[index] = formatTerminalOutputLine(lines[index]!, options);
  }
  return target;
}

/** Projects status, hint, and visible process output into reusable renderer-neutral rows. */
export function workbenchTerminalOutputWindowRowsInto(
  target: WorkbenchTerminalOutputWindowRow[],
  options: WorkbenchTerminalOutputWindowRowsOptions,
): WorkbenchTerminalOutputWindowRow[] {
  let written = 0;
  written = writeTerminalOutputWindowRow(target, written, "status", options.statusText);
  written = writeTerminalOutputWindowRow(target, written, "hint", options.hintText);
  if (options.lines.length === 0) {
    written = writeTerminalOutputWindowRow(
      target,
      written,
      "empty",
      options.emptyText ?? "No output yet. Press [Run] to start the demo command.",
    );
  } else {
    for (let index = 0; index < options.lines.length; index += 1) {
      const line = options.lines[index]!;
      written = writeTerminalOutputWindowRow(
        target,
        written,
        "output",
        formatTerminalOutputLine(line, options),
        line.source,
      );
    }
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

/** Projects visible terminal pane title rows into renderer-neutral paint and hit commands. */
export function workbenchTerminalPaneTitleRenderCommandsInto(
  target: WorkbenchTerminalPaneTitleRenderCommand[],
  panes: readonly WorkbenchTerminalPaneProjection[],
  theme: WorkbenchTerminalPaneTitleTheme,
  contrast: WorkbenchTerminalPaneTitleContrast,
): WorkbenchTerminalPaneTitleRenderCommand[] {
  let written = 0;
  for (let index = 0; index < panes.length; index += 1) {
    const pane = panes[index]!;
    if (!pane.titleVisible || pane.rect.width <= 0 || pane.rect.height <= 0) continue;
    const bg = pane.active ? theme.accentDeep : theme.panelSoft;
    const command = target[written] ?? {
      text: "",
      rect: { column: 0, row: 0, width: 0, height: 1 },
      hitRect: { column: 0, row: 0, width: 0, height: 1 },
      active: false,
      style: { fg: "", bg: "", bold: false },
    };
    command.text = fitCellText(pane.title, pane.rect.width);
    setRect(command.rect, { column: pane.rect.column, row: pane.rect.row, width: pane.rect.width, height: 1 });
    setRect(command.hitRect, command.rect);
    command.paneId = pane.paneId;
    command.active = pane.active;
    command.style.fg = pane.active ? contrast(bg, theme.background, theme.text) : theme.soft;
    command.style.bg = bg;
    command.style.bold = pane.active;
    target[written] = command;
    written += 1;
  }
  target.length = written;
  return target;
}

/** Projects copy-mode terminal rows with line-number prefixes and selected-row state. */
export function workbenchTerminalCopyRowsInto(
  target: WorkbenchTerminalCopyRowProjection[],
  options: WorkbenchTerminalCopyRowsOptions,
): WorkbenchTerminalCopyRowProjection[] {
  const height = Math.max(0, Math.floor(options.height));
  const offset = Math.max(0, Math.floor(options.offset));
  const prefixWidth = Math.max(1, Math.floor(options.prefixWidth ?? 5));
  const selectionStart = options.selection ? Math.min(options.selection.anchor, options.selection.focus) : -1;
  const selectionEnd = options.selection ? Math.max(options.selection.anchor, options.selection.focus) : -1;
  target.length = height;
  for (let screenRow = 0; screenRow < height; screenRow += 1) {
    const rowIndex = offset + screenRow;
    const lineNumber = rowIndex + 1;
    const selected = rowIndex >= selectionStart && rowIndex <= selectionEnd;
    const current = target[screenRow] ?? {
      screenRow,
      rowIndex,
      lineNumber,
      prefix: "",
      text: "",
      selected,
    };
    current.screenRow = screenRow;
    current.rowIndex = rowIndex;
    current.lineNumber = lineNumber;
    current.prefix = `${lineNumber.toString().padStart(Math.max(1, prefixWidth - 1), " ")} `;
    current.text = options.visibleRows[screenRow] ?? "";
    current.selected = selected;
    target[screenRow] = current;
  }
  return target;
}

function projectToolbarItemsInto<Action extends string>(
  target: WorkbenchButtonRowItem<Action>[],
  actions: readonly Action[],
  prepare: (target: WorkbenchButtonRowItem<Action> | undefined, action: Action) => WorkbenchButtonRowItem<Action>,
  applyState: (item: WorkbenchButtonRowItem<Action>, action: Action) => void,
): WorkbenchButtonRowItem<Action>[] {
  let written = 0;
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]!;
    const item = prepare(target[written], action);
    applyState(item, action);
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

function writeTerminalOutputWindowRow(
  target: WorkbenchTerminalOutputWindowRow[],
  index: number,
  kind: WorkbenchTerminalOutputWindowRow["kind"],
  text: string,
  source?: TerminalOutputLine["source"],
): number {
  const row = target[index] ?? { kind, text: "" };
  row.kind = kind;
  row.text = text;
  row.source = source;
  target[index] = row;
  return index + 1;
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
