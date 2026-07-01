import { assertEquals } from "./deps.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import {
  formatWorkbenchDiagnosticLogEntry,
  formatWorkbenchDiagnosticStatus,
  initialWorkbenchDiagnosticLogRows,
  subscribeWorkbenchDiagnosticLog,
} from "../src/app/workbench/mod.ts";

Deno.test("workbench diagnostics helpers format initial logs and compact status", () => {
  const diagnostics = new DiagnosticsCollector();
  const entry = diagnostics.report({
    source: "three-panel",
    code: "kitty-graphics-fallback",
    severity: "warning",
    message: "Kitty graphics requested but unavailable.",
    detail: "raster graphics surface is unavailable",
  });

  assertEquals(
    formatWorkbenchDiagnosticLogEntry(entry),
    "diagnostic 1 warning (1 warning) latest three-panel/kitty-graphics-fallback",
  );
  assertEquals(
    initialWorkbenchDiagnosticLogRows(diagnostics, ["ready"], { maxLogEntries: 2 }),
    [
      "ready",
      "diagnostic 1 warning (1 warning) latest three-panel/kitty-graphics-fallback",
    ],
  );
  assertEquals(formatWorkbenchDiagnosticStatus(diagnostics), "diag 1 warning (1 warning)");
});

Deno.test("workbench diagnostics subscription forwards future entries only", () => {
  const diagnostics = new DiagnosticsCollector();
  diagnostics.report({
    source: "storage",
    code: "early",
    severity: "debug",
    message: "early",
  });

  const logs: string[] = [];
  const unsubscribe = subscribeWorkbenchDiagnosticLog(diagnostics, (message) => logs.push(message), {
    logLabel: "runtime",
  });
  diagnostics.report({
    source: "storage",
    code: "persist-failed",
    severity: "warning",
    message: "Workspace persist failed.",
  });
  unsubscribe();
  diagnostics.report({
    source: "storage",
    code: "late",
    severity: "warning",
    message: "late",
  });

  assertEquals(logs, [
    "runtime 1 warning (1 warning) latest storage/persist-failed",
  ]);
});
