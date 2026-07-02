// Copyright 2023 Im-Beast. MIT license.
import type { ProcessSessionInspection, ProcessSessionStatus } from "./process_session.ts";
import type { TerminalSessionHandleInspection } from "./terminal_backend.ts";
import type { TerminalSessionDescriptor } from "./terminal_templates.ts";

/** Source shapes that can be summarized for terminal status bars. */
export type TerminalStatusSource =
  | ProcessSessionInspection
  | TerminalSessionHandleInspection
  | TerminalSessionDescriptor;

/** Options for terminal status summaries. */
export interface TerminalStatusSummaryOptions {
  title?: string;
  cwd?: string;
  backendId?: string;
  pty?: boolean;
  detached?: boolean;
  reconnectable?: boolean;
  width?: number;
  includeCommand?: boolean;
}

/** Renderer-neutral terminal status summary. */
export interface TerminalStatusSummary {
  title?: string;
  status: ProcessSessionStatus;
  running: boolean;
  backendId?: string;
  pty?: boolean;
  backendKind?: "pty" | "process";
  commandLine?: string;
  cwd?: string;
  columns?: number;
  rows?: number;
  exitCode?: number;
  exitSignal?: string;
  detached: boolean;
  reconnectable: boolean;
  fields: string[];
  text: string;
}

/** Options for formatting a managed shell window title. */
export interface TerminalShellWindowTitleOptions {
  mode?: string;
  prefix?: string;
}

/** Options for formatting a live shell status line. */
export interface TerminalShellStatusLineOptions {
  mode: string;
  status: ProcessSessionStatus | "starting";
  pty: boolean;
  backendLabel?: string;
  commandLine: string;
  scrollbackOffset: number;
  scrollbackViewportRows: number;
  scrollbackTotalRows: number;
}

/** Options for formatting a live shell keyboard hint. */
export interface TerminalShellHintOptions {
  copyMode?: boolean;
  inputMode: "raw" | "workbench";
}

/** Semantic tone categories for terminal status presentation. */
export type TerminalStatusTone = "good" | "accent" | "warning" | "danger" | "muted";

/** Creates a compact, serializable terminal status summary from process, backend, or workspace metadata. */
export function summarizeTerminalStatus(
  source: TerminalStatusSource,
  options: TerminalStatusSummaryOptions = {},
): TerminalStatusSummary {
  const status = source.status ?? "idle";
  const running = ("running" in source ? source.running : undefined) ?? status === "running";
  const title = options.title ?? ("title" in source ? source.title : undefined);
  const commandLine = "commandLine" in source ? source.commandLine : undefined;
  const cwd = options.cwd ?? sourceCwd(source);
  const backendId = options.backendId ?? ("backendId" in source ? source.backendId : undefined);
  const pty = options.pty ?? ("pty" in source ? source.pty : undefined) ?? inferPtyFromBackendId(backendId);
  const backendKind = pty === undefined ? undefined : pty ? "pty" : "process";
  const columns = "columns" in source ? source.columns : undefined;
  const rows = "rows" in source ? source.rows : undefined;
  const exit = "exit" in source ? source.exit : undefined;
  const detached = options.detached ?? ("detached" in source ? source.detached ?? false : false);
  const reconnectable = options.reconnectable ?? ("reconnectable" in source ? source.reconnectable ?? false : false);
  const fields = terminalStatusFields({
    title,
    status,
    running,
    backendId,
    pty,
    commandLine,
    cwd,
    columns,
    rows,
    exitCode: exit?.code,
    exitSignal: exit?.signal,
    detached,
    reconnectable,
    includeCommand: options.includeCommand ?? true,
  });
  const text = fitTerminalStatusText(fields.join("  "), options.width);
  return {
    title,
    status,
    running,
    backendId,
    pty,
    backendKind,
    commandLine,
    cwd,
    columns,
    rows,
    exitCode: exit?.code,
    exitSignal: exit?.signal,
    detached,
    reconnectable,
    fields,
    text,
  };
}

/** Builds the ordered status fields used by summarizeTerminalStatus(). */
export function terminalStatusFields(options: {
  title?: string;
  status: ProcessSessionStatus;
  running: boolean;
  backendId?: string;
  pty?: boolean;
  commandLine?: string;
  cwd?: string;
  columns?: number;
  rows?: number;
  exitCode?: number;
  exitSignal?: string;
  detached?: boolean;
  reconnectable?: boolean;
  includeCommand?: boolean;
}): string[] {
  const fields: string[] = [];
  if (options.title) fields.push(options.title);
  fields.push(options.status.toUpperCase());
  if (options.pty !== undefined) fields.push(terminalBackendKindLabel(options.pty));
  if (options.backendId) fields.push(`backend:${options.backendId}`);
  if (Number.isFinite(options.columns) && Number.isFinite(options.rows)) {
    fields.push(`${options.columns}x${options.rows}`);
  }
  if (options.exitCode !== undefined) {
    fields.push(options.exitSignal ? `exit:${options.exitCode}/${options.exitSignal}` : `exit:${options.exitCode}`);
  }
  if (options.cwd) fields.push(`cwd:${options.cwd}`);
  if (options.detached) fields.push("detached");
  if (options.reconnectable) fields.push("reconnectable");
  if (options.includeCommand ?? true) {
    if (options.commandLine) fields.push(`cmd:${options.commandLine}`);
  }
  return fields;
}

/** Returns the user-facing backend kind label for terminal shell/session status. */
export function terminalBackendKindLabel(pty: boolean): string {
  return pty ? "PTY" : "PROCESS FALLBACK";
}

/** Returns the semantic status tone used by terminal/workbench presenters. */
export function terminalStatusTone(
  status: ProcessSessionStatus | "starting" | undefined,
): TerminalStatusTone {
  if (status === "running") return "good";
  if (status === "failed") return "danger";
  if (status === "cancelled") return "warning";
  if (status === "starting") return "accent";
  return "muted";
}

/** Formats terminal input mode labels consistently across renderer adapters. */
export function terminalInputModeDisplayLabel(
  mode: "raw" | "workbench",
  options: { rawLabel?: string; workbenchLabel?: string } = {},
): string {
  return mode === "raw" ? options.rawLabel ?? "RAW INPUT" : options.workbenchLabel ?? "WORKBENCH";
}

/** Formats the compact status line for a live shell pane/workspace. */
export function formatTerminalShellStatusLine(options: TerminalShellStatusLineOptions): string {
  const totalRows = Math.max(0, Math.floor(options.scrollbackTotalRows));
  const offset = Math.max(0, Math.floor(options.scrollbackOffset));
  const viewportRows = Math.max(0, Math.floor(options.scrollbackViewportRows));
  const firstRow = totalRows === 0 ? 0 : Math.min(offset + 1, totalRows);
  const lastRow = totalRows === 0 ? 0 : Math.min(offset + viewportRows, totalRows);
  return compactTerminalStatusSpaces(
    `${options.mode} ${options.status.toUpperCase()} ${terminalBackendKindLabel(options.pty)} ${
      options.backendLabel ?? "pending"
    } · ${options.commandLine} · rows ${firstRow}-${lastRow}/${totalRows}`,
  );
}

/** Formats keyboard hints for process-output panes with optional raw child-process input. */
export function formatTerminalOutputHint(mode: "raw" | "workbench"): string {
  return mode === "raw"
    ? "raw input: printable keys go to child process  Esc workbench mode  Ctrl+C reserved"
    : "keys: P run  S stop  U restart  K clear  V follow  Y copy  I raw input";
}

/** Formats keyboard hints for live shell panes and copy-mode scrollback. */
export function formatTerminalShellHint(options: TerminalShellHintOptions): string {
  if (options.copyMode) {
    return "copy mode: PageUp/PageDown scroll  Space select  Shift+Up/Down extend  C copy  Esc live input";
  }
  return options.inputMode === "raw"
    ? "raw shell input: keys go to shell  Ctrl+C interrupts shell  Esc returns to Workbench"
    : "keys: P start  S stop  U restart  K clear  I raw input  PageUp copy scroll";
}

/** Formats a shell window title with mode, status, and optional OSC/runtime title. */
export function formatTerminalShellWindowTitle(
  source: { title?: string; status: ProcessSessionStatus | "starting" },
  options: TerminalShellWindowTitleOptions = {},
): string {
  const prefix = options.prefix ?? "Shell";
  const mode = options.mode ? ` ${options.mode.toUpperCase()}` : "";
  const status = source.status.toUpperCase();
  const title = source.title?.replace(/\s+/g, " ").trim();
  return title ? `${prefix}${mode} ${status} · ${title}` : `${prefix}${mode} ${status}`;
}

function sourceCwd(source: TerminalStatusSource): string | undefined {
  if ("command" in source) return source.command.cwd;
  if ("template" in source && "cwd" in source.template) return source.template.cwd;
  return undefined;
}

function inferPtyFromBackendId(backendId: string | undefined): boolean | undefined {
  if (!backendId) return undefined;
  if (backendId === "process" || backendId.includes("process")) return false;
  if (backendId.includes("pty") || backendId.includes("tmux")) return true;
  return undefined;
}

function fitTerminalStatusText(text: string, width: number | undefined): string {
  if (!Number.isFinite(width) || width! < 1 || text.length <= width!) return text;
  if (width! <= 3) return ".".repeat(width!);
  return `${text.slice(0, width! - 3)}...`;
}

function compactTerminalStatusSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
