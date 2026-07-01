// Copyright 2023 Im-Beast. MIT license.

/** Diagnostic severity for degraded runtime and backend states. */
export type DiagnosticSeverity = "debug" | "info" | "warning" | "error";

/** Structured diagnostic emitted by optional runtime backends and demos. */
export interface DiagnosticEntry {
  id: number;
  time: number;
  source: string;
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  detail?: string;
  context?: Record<string, unknown>;
}

/** Input accepted by DiagnosticsCollector.report. */
export type DiagnosticInput = Omit<DiagnosticEntry, "id" | "time"> & {
  time?: number;
};

/** Inspection snapshot for a DiagnosticsCollector. */
export interface DiagnosticsInspection {
  count: number;
  bySeverity: Record<DiagnosticSeverity, number>;
  entries: DiagnosticEntry[];
}

/** Compact aggregate for status bars and degraded-backend reports. */
export interface DiagnosticStatusSummary {
  count: number;
  ok: boolean;
  highestSeverity?: DiagnosticSeverity;
  bySeverity: Record<DiagnosticSeverity, number>;
  latest?: DiagnosticEntry;
}

/** Options for formatting one-line diagnostic status output. */
export interface DiagnosticStatusFormatOptions {
  label?: string;
  includeLatest?: boolean;
}

/** Listener called when diagnostics are reported or cleared. */
export type DiagnosticListener = (entry: DiagnosticEntry | undefined) => void;

/** Small injectable collector for structured fallback and degradation diagnostics. */
export class DiagnosticsCollector {
  #entries: DiagnosticEntry[] = [];
  #listeners = new Set<DiagnosticListener>();
  #nextId = 1;

  constructor(private readonly maxEntries = 200) {}

  report(input: DiagnosticInput): DiagnosticEntry {
    const entry: DiagnosticEntry = {
      id: this.#nextId++,
      time: Math.max(0, Math.floor(input.time ?? Date.now())),
      source: input.source,
      code: input.code,
      severity: input.severity,
      message: input.message,
      detail: input.detail,
      context: input.context ? { ...input.context } : undefined,
    };
    this.#entries.push(entry);
    while (this.#entries.length > Math.max(1, this.maxEntries)) this.#entries.shift();
    this.#emit(entry);
    return { ...entry, context: entry.context ? { ...entry.context } : undefined };
  }

  clear(): void {
    if (this.#entries.length === 0) return;
    this.#entries = [];
    this.#emit(undefined);
  }

  entries(): DiagnosticEntry[] {
    return this.#entries.map((entry) => ({ ...entry, context: entry.context ? { ...entry.context } : undefined }));
  }

  inspect(): DiagnosticsInspection {
    const bySeverity: Record<DiagnosticSeverity, number> = {
      debug: 0,
      info: 0,
      warning: 0,
      error: 0,
    };
    for (const entry of this.#entries) bySeverity[entry.severity] += 1;
    return {
      count: this.#entries.length,
      bySeverity,
      entries: this.entries(),
    };
  }

  subscribe(listener: DiagnosticListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(entry: DiagnosticEntry | undefined): void {
    for (const listener of this.#listeners) listener(entry);
  }
}

/** Formats diagnostics for status panels and text reports without noisy stack output. */
export function formatDiagnostics(entries: readonly DiagnosticEntry[]): string {
  if (entries.length === 0) return "Diagnostics: none";
  return entries
    .map((entry) =>
      `${entry.severity.toUpperCase()} ${entry.source}/${entry.code}: ${entry.message}${
        entry.detail ? ` (${entry.detail})` : ""
      }`
    )
    .join("\n");
}

/** Summarizes diagnostics for status bars without exposing raw log volume. */
export function summarizeDiagnostics(entries: readonly DiagnosticEntry[]): DiagnosticStatusSummary {
  const bySeverity: Record<DiagnosticSeverity, number> = {
    debug: 0,
    info: 0,
    warning: 0,
    error: 0,
  };
  let highestSeverity: DiagnosticSeverity | undefined;
  for (const entry of entries) {
    bySeverity[entry.severity] += 1;
    if (!highestSeverity || severityWeight(entry.severity) > severityWeight(highestSeverity)) {
      highestSeverity = entry.severity;
    }
  }
  return {
    count: entries.length,
    ok: entries.length === 0,
    highestSeverity,
    bySeverity,
    latest: cloneDiagnosticEntry(entries.at(-1)),
  };
}

/** Formats a compact status-bar segment for degraded optional backends. */
export function formatDiagnosticStatus(
  entries: readonly DiagnosticEntry[],
  options: DiagnosticStatusFormatOptions = {},
): string {
  const label = options.label ?? "diagnostics";
  const summary = summarizeDiagnostics(entries);
  if (summary.ok) return `${label} ok`;

  const counts = (["error", "warning", "info", "debug"] as const)
    .filter((severity) => summary.bySeverity[severity] > 0)
    .map((severity) => `${summary.bySeverity[severity]} ${severity}`)
    .join(", ");
  const latest = options.includeLatest !== false && summary.latest
    ? ` latest ${summary.latest.source}/${summary.latest.code}`
    : "";
  return `${label} ${summary.count} ${summary.highestSeverity}${counts ? ` (${counts})` : ""}${latest}`;
}

/** Formats a markdown diagnostics report suitable for logs, docs, and modal details. */
export function formatDiagnosticsMarkdown(
  entries: readonly DiagnosticEntry[],
  title = "Diagnostics",
): string {
  const summary = summarizeDiagnostics(entries);
  const lines = [
    `# ${title}`,
    "",
    summary.ok
      ? "No diagnostics recorded."
      : `${summary.count} diagnostic(s), highest severity: ${summary.highestSeverity}.`,
  ];
  if (summary.ok) return lines.join("\n");

  lines.push("", "| Severity | Source | Code | Message | Detail |", "| --- | --- | --- | --- | --- |");
  for (const entry of entries) {
    lines.push(
      `| ${entry.severity} | ${entry.source} | ${entry.code} | ${escapeMarkdownTableCell(entry.message)} | ${
        escapeMarkdownTableCell(entry.detail ?? "")
      } |`,
    );
  }
  return lines.join("\n");
}

function cloneDiagnosticEntry(entry: DiagnosticEntry | undefined): DiagnosticEntry | undefined {
  return entry ? { ...entry, context: entry.context ? { ...entry.context } : undefined } : undefined;
}

function severityWeight(severity: DiagnosticSeverity): number {
  switch (severity) {
    case "error":
      return 4;
    case "warning":
      return 3;
    case "info":
      return 2;
    case "debug":
      return 1;
  }
}

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
