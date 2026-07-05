import { assertEquals } from "./deps.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import {
  formatWorkbenchDiagnosticLogEntry,
  formatWorkbenchDiagnosticStatus,
  initialWorkbenchDiagnosticLogRows,
  subscribeWorkbenchDiagnosticLog,
  workbenchCompactStatusDiagnostics,
  workbenchEmptyWorkspaceMessage,
  workbenchHeaderHelp,
  workbenchStatusLeft,
  workbenchStatusLine,
  workbenchStatusShortcuts,
  workbenchStatusSnapshotLine,
  workbenchTileDensityLabel,
} from "../src/app/workbench/mod.ts";

Deno.test("workbench status helpers bucket tile density", () => {
  assertEquals(workbenchTileDensityLabel(-2), "wide");
  assertEquals(workbenchTileDensityLabel(0), "balanced");
  assertEquals(workbenchTileDensityLabel(Number.NaN), "balanced");
  assertEquals(workbenchTileDensityLabel(3), "dense");
});

Deno.test("workbench status helper composes optional diagnostics", () => {
  assertEquals(
    workbenchStatusLeft({ focus: "Inspector", theme: "Unit-01", tileDensity: 0 }),
    "focus Inspector | Unit-01 | tiles balanced",
  );
  assertEquals(
    workbenchStatusLeft({ focus: "Data", theme: "Unit-01", tileDensity: 1, diagnostics: "diag 1 warning" }),
    "focus Data | Unit-01 | tiles dense | diag 1 warning",
  );
});

Deno.test("workbench status helper compacts redundant diagnostics for tight rows", () => {
  assertEquals(workbenchCompactStatusDiagnostics(undefined), undefined);
  assertEquals(workbenchCompactStatusDiagnostics("diag 1 warning (1 warning)"), "diag 1 warning");
  assertEquals(
    workbenchStatusLine({
      focus: "Three ASCII",
      theme: "Unit-01 Signal",
      tileDensity: 0,
      diagnostics: "diag 1 warning (1 warning)",
      width: 118,
    }),
    "focus Three ASCII | Unit-01 Signal | tiles balanced | diag 1 warning          F10 menu  N new  G config  M/F/R  Q quit",
  );
});

Deno.test("workbench status helper exposes terminal and web shortcut profiles", () => {
  assertEquals(
    workbenchStatusShortcuts(),
    "F10 menu  N new  Shift+T themes  G config  0 restore minimized",
  );
  assertEquals(
    workbenchStatusShortcuts("web"),
    "1-8 focus  T theme  H help  Q quit  click controls",
  );
  assertEquals(
    workbenchStatusShortcuts("terminal", 118),
    "F10 menu  N new  G config  M/F/R  Q quit",
  );
  assertEquals(
    workbenchStatusShortcuts("web", 64),
    "T theme  H help  Q quit",
  );
});

Deno.test("workbench status helper composes aligned full status lines", () => {
  assertEquals(
    workbenchStatusLine({
      focus: "Inspector",
      theme: "Unit-01",
      tileDensity: 0,
      width: 24,
    }),
    "focus Inspector | Unit-0",
  );
  assertEquals(
    workbenchStatusLine({
      focus: "data",
      theme: "Unit-01",
      tileDensity: 1,
      diagnostics: "diag ok",
      shortcutProfile: "web",
      width: 72,
    }),
    "focus data | Unit-01 | tiles dense |  1-8 focus  T theme  H help  Q quit",
  );
});

Deno.test("workbench status snapshot helper composes aligned status lines", () => {
  assertEquals(
    workbenchStatusSnapshotLine({
      snapshot: {
        focus: "Logs",
        theme: "Ghost Shell",
        tileDensity: -1,
        diagnostics: "slow frame",
      },
      width: 64,
      shortcutProfile: "web",
    }),
    "focus Logs | Ghost Shell | tiles wide |  T theme  H help  Q quit",
  );
});

Deno.test("workbench empty workspace messages classify closed minimized and hidden states", () => {
  assertEquals(
    workbenchEmptyWorkspaceMessage({ windows: [{ closed: true }, { closed: true }] }),
    "All windows closed. Use New to add a widget window.",
  );
  assertEquals(
    workbenchEmptyWorkspaceMessage({ windows: [{ minimized: true }, { minimized: true }] }),
    "All open windows minimized. Press R or use the shelf to restore.",
  );
  assertEquals(
    workbenchEmptyWorkspaceMessage({ windows: [{}, { closed: true }] }),
    "No visible windows. Use New to add a widget window.",
  );
  assertEquals(
    workbenchEmptyWorkspaceMessage({
      windows: [{ minimized: true }],
      labels: { minimized: "All panels minimized. Press R or click restore." },
    }),
    "All panels minimized. Press R or click restore.",
  );
});

Deno.test("workbench header help adapts to available width", () => {
  assertEquals(workbenchHeaderHelp({ width: 20 }), "");
  assertEquals(workbenchHeaderHelp({ width: 40 }), "F10 menu  Q quit");
  assertEquals(workbenchHeaderHelp({ width: 56 }), "F10 menu  N new  Tab focus  Q quit");
  assertEquals(workbenchHeaderHelp({ width: 96 }), "F10 menu  N new  G config  Tab  M/F/R  Q quit");
  assertEquals(
    workbenchHeaderHelp({ width: 132 }),
    "F10 menu  N new  T theme  G config  C close  Tab focus  M/F/R  Q quit",
  );
  assertEquals(workbenchHeaderHelp({ width: 20, minVisibleWidth: 12 }), "F10 menu  Q quit");
});

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
