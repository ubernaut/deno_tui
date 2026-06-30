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

function sourceCwd(source: TerminalStatusSource): string | undefined {
  if ("command" in source) return source.command.cwd;
  if ("template" in source && "cwd" in source.template) return source.template.cwd;
  return undefined;
}

function fitTerminalStatusText(text: string, width: number | undefined): string {
  if (!Number.isFinite(width) || width! < 1 || text.length <= width!) return text;
  if (width! <= 3) return ".".repeat(width!);
  return `${text.slice(0, width! - 3)}...`;
}
