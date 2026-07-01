// Copyright 2023 Im-Beast. MIT license.
import { type DiagnosticEntry, type DiagnosticsCollector, formatDiagnosticStatus } from "../runtime/diagnostics.ts";

/** Options for formatting diagnostics in workbench status bars and log panels. */
export interface WorkbenchDiagnosticFormatOptions {
  logLabel?: string;
  statusLabel?: string;
  maxLogEntries?: number;
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
  return formatDiagnosticStatus(diagnostics.entries(), {
    label: options.statusLabel ?? "diag",
    includeLatest: false,
  });
}

/** Creates initial log rows that include diagnostics reported before the renderer subscribed. */
export function initialWorkbenchDiagnosticLogRows(
  diagnostics: DiagnosticsCollector,
  rows: readonly string[],
  options: WorkbenchDiagnosticFormatOptions = {},
): string[] {
  const maxLogEntries = Math.max(1, Math.floor(options.maxLogEntries ?? 40));
  return [
    ...rows,
    ...diagnostics.entries().map((entry) => formatWorkbenchDiagnosticLogEntry(entry, options)),
  ].slice(-maxLogEntries);
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
