import type { SystemMetricDiagnostic } from "./types.ts";

export interface ProcessDiagnosticsInput {
  scanned: number;
  failedReads: number;
  limited: boolean;
  durationMs: number;
  scanError?: string;
}

export function compactDiagnostics(
  diagnostics: Array<SystemMetricDiagnostic | undefined>,
): SystemMetricDiagnostic[] {
  const compacted: SystemMetricDiagnostic[] = [];
  for (let index = 0; index < diagnostics.length; index += 1) {
    const diagnostic = diagnostics[index];
    if (diagnostic) insertDiagnostic(compacted, diagnostic);
  }
  return compacted;
}

export function processDiagnostics(sample: ProcessDiagnosticsInput, sampledAt: number): SystemMetricDiagnostic {
  if (sample.scanError) {
    return {
      source: "process",
      status: "unavailable",
      detail: `/proc scan failed: ${sample.scanError}`,
      durationMs: sample.durationMs,
      sampledAt,
    };
  }
  if (sample.limited) {
    return {
      source: "process",
      status: "limited",
      detail: `process scan capped at ${sample.scanned} entries`,
      durationMs: sample.durationMs,
      sampledAt,
    };
  }
  if (sample.failedReads > 0) {
    return {
      source: "process",
      status: "degraded",
      detail: `${sample.failedReads} process stat read(s) failed`,
      durationMs: sample.durationMs,
      sampledAt,
    };
  }
  return {
    source: "process",
    status: "ok",
    detail: `sampled ${sample.scanned} process entries`,
    durationMs: sample.durationMs,
    sampledAt,
  };
}

function diagnosticWeight(status: SystemMetricDiagnostic["status"]): number {
  switch (status) {
    case "unavailable":
      return 4;
    case "degraded":
      return 3;
    case "limited":
      return 2;
    case "stale":
      return 2;
    case "ok":
      return 1;
  }
}

function insertDiagnostic(target: SystemMetricDiagnostic[], diagnostic: SystemMetricDiagnostic): void {
  let index = 0;
  while (index < target.length && compareDiagnostics(diagnostic, target[index]!) >= 0) {
    index += 1;
  }
  target.splice(index, 0, diagnostic);
}

function compareDiagnostics(left: SystemMetricDiagnostic, right: SystemMetricDiagnostic): number {
  const weight = diagnosticWeight(right.status) - diagnosticWeight(left.status);
  return weight || left.source.localeCompare(right.source);
}
