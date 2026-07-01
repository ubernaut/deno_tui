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
