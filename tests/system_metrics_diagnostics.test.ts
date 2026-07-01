import { assertEquals } from "./deps.ts";
import { compactDiagnostics, processDiagnostics } from "../app/system_metrics_diagnostics.ts";

Deno.test("compactDiagnostics sorts severe diagnostics before ok entries", () => {
  assertEquals(
    compactDiagnostics([
      { source: "gpu", status: "ok", detail: "sampled", sampledAt: 1 },
      undefined,
      { source: "cpu", status: "unavailable", detail: "missing", sampledAt: 1 },
      { source: "process", status: "limited", detail: "capped", sampledAt: 1 },
      { source: "disk", status: "degraded", detail: "partial", sampledAt: 1 },
    ]).map((diagnostic) => [diagnostic.source, diagnostic.status]),
    [
      ["cpu", "unavailable"],
      ["disk", "degraded"],
      ["process", "limited"],
      ["gpu", "ok"],
    ],
  );
});

Deno.test("processDiagnostics reports scan error limited degraded and ok states", () => {
  assertEquals(
    processDiagnostics({ scanned: 0, failedReads: 0, limited: false, durationMs: 2, scanError: "EACCES" }, 5),
    {
      source: "process",
      status: "unavailable",
      detail: "/proc scan failed: EACCES",
      durationMs: 2,
      sampledAt: 5,
    },
  );
  assertEquals(processDiagnostics({ scanned: 100, failedReads: 0, limited: true, durationMs: 3 }, 5).status, "limited");
  assertEquals(
    processDiagnostics({ scanned: 100, failedReads: 2, limited: false, durationMs: 4 }, 5).status,
    "degraded",
  );
  assertEquals(processDiagnostics({ scanned: 100, failedReads: 0, limited: false, durationMs: 5 }, 5).status, "ok");
});
