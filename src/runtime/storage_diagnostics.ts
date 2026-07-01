// Copyright 2023 Im-Beast. MIT license.

import type { DiagnosticEntry, DiagnosticInput, DiagnosticsCollector } from "./diagnostics.ts";

/** Input for reporting recoverable storage degradation without noisy logs. */
export interface StorageFallbackDiagnosticInput {
  source: string;
  storage: string;
  operation: string;
  error?: unknown;
  severity?: DiagnosticInput["severity"];
  message?: string;
  context?: Record<string, unknown>;
}

/** Options for bounded, deduplicated storage fallback reporting. */
export interface StorageFallbackDiagnosticsOptions {
  dedupe?: boolean;
}

/** Converts storage failures into structured diagnostics and suppresses duplicate chatter. */
export class StorageFallbackDiagnostics {
  #seen = new Set<string>();
  readonly #dedupe: boolean;

  constructor(
    private readonly diagnostics: DiagnosticsCollector,
    options: StorageFallbackDiagnosticsOptions = {},
  ) {
    this.#dedupe = options.dedupe ?? true;
  }

  report(input: StorageFallbackDiagnosticInput): DiagnosticEntry | undefined {
    const diagnostic = createStorageFallbackDiagnostic(input);
    const key = `${diagnostic.source}/${diagnostic.code}/${diagnostic.detail ?? ""}`;
    if (this.#dedupe && this.#seen.has(key)) return undefined;
    this.#seen.add(key);
    return this.diagnostics.report(diagnostic);
  }

  clearDedupe(): void {
    this.#seen.clear();
  }
}

/** Creates a structured diagnostic for an unavailable or failed storage operation. */
export function createStorageFallbackDiagnostic(input: StorageFallbackDiagnosticInput): DiagnosticInput {
  return {
    source: input.source,
    code: `${sanitizeDiagnosticCode(input.storage)}-${sanitizeDiagnosticCode(input.operation)}-failed`,
    severity: input.severity ?? "warning",
    message: input.message ?? `${input.storage} ${input.operation} failed; continuing with in-memory state.`,
    detail: formatStorageErrorDetail(input.error),
    context: { storage: input.storage, operation: input.operation, ...input.context },
  };
}

/** Formats unknown storage exceptions into compact one-line diagnostic detail. */
export function formatStorageErrorDetail(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function sanitizeDiagnosticCode(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "unknown";
}
