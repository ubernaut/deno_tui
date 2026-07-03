import { assert, assertEquals } from "./deps.ts";
import {
  type WorkbenchInspectorBuffers,
  workbenchInspectorRowsInto,
  type WorkbenchInspectorTheme,
} from "../app/workbench_inspector.ts";
import type { RowStyle } from "../app/workbench_rows.ts";

const theme: WorkbenchInspectorTheme = {
  background: "#000000",
  accent: "#aaff00",
  border: "#663399",
  good: "#44dd66",
  panelSoft: "#111122",
  surface: "#050510",
  text: "#eeeeee",
  warn: "#ffaa00",
};

const fit = (value: string, width: number) => value.slice(0, Math.max(0, width));

Deno.test("workbench inspector projects API surface rows and theme label", () => {
  const rows = workbenchInspectorRowsInto([], {
    width: 80,
    height: 11,
    themeLabel: "Unit-01 Signal",
    logs: [],
    theme,
    fit,
    buffers: { actionTextRows: [], wrappedTextRows: [] },
  });

  assertEquals(rows.length, 11);
  assertEquals(rows[0], { text: " Composable API surfaces ", fg: "#000000", bg: "#aaff00", bold: true });
  assertEquals(rows[8], { text: "theme     Unit-01 Signal", fg: "#ffaa00", bg: "#050510", bold: true });
  assertEquals(rows[10], { text: " Recent actions ", fg: "#000000", bg: "#663399", bold: true });
});

Deno.test("workbench inspector wraps and clips recent action rows", () => {
  const buffers: WorkbenchInspectorBuffers = { actionTextRows: [], wrappedTextRows: [] };
  const rows = workbenchInspectorRowsInto([], {
    width: 18,
    height: 14,
    themeLabel: "Unit-01 Signal",
    logs: ["ready: API workbench mounted", "renderer cells updated", "workspace saved successfully"],
    theme,
    fit,
    buffers,
  });

  assertEquals(rows.length, 14);
  assertEquals(rows.slice(11).map((row) => row.text), ["updated", "• workspace saved", "successfully"]);
  assert(rows.slice(11).every((row) => row.fg === "#eeeeee" && row.bg === "#111122"));
  assert(buffers.actionTextRows.length >= 3);
  assert(buffers.wrappedTextRows.length > 0);
});

Deno.test("workbench inspector reuses caller-owned row storage", () => {
  const target: RowStyle[] = [{ text: "stale" }];
  const buffers: WorkbenchInspectorBuffers = {
    actionTextRows: ["stale action"],
    wrappedTextRows: ["stale wrapped"],
  };
  const first = workbenchInspectorRowsInto(target, {
    width: 32,
    height: 12,
    themeLabel: "A",
    logs: ["one"],
    theme,
    fit,
    buffers,
  });
  const firstHeader = first[0];
  const second = workbenchInspectorRowsInto(target, {
    width: 32,
    height: 12,
    themeLabel: "B",
    logs: ["two"],
    theme,
    fit,
    buffers,
  });

  assertEquals(second === target, true);
  assertEquals(second[0] === firstHeader, false);
  assertEquals(second[8]?.text, "theme     B");
  assertEquals(buffers.actionTextRows.some((row) => row.includes("stale")), false);
});
