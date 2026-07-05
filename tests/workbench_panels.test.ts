import { assert, assertEquals } from "./deps.ts";
import {
  workbenchExplorerRowsInto,
  type WorkbenchExplorerTheme,
  type WorkbenchInspectorBuffers,
  workbenchInspectorRowsInto,
  type WorkbenchInspectorTheme,
  workbenchLogRowsFromSourcesInto,
  workbenchLogRowsInto,
} from "../app/workbench_panels.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";
import type { FileExplorerNode } from "../src/components/file_explorer.ts";
import type { TreeRow } from "../src/components/tree.ts";

const explorerTheme: WorkbenchExplorerTheme = {
  background: "#000000",
  good: "#44dd66",
  surface: "#050510",
  text: "#eeeeee",
  warn: "#ffaa00",
};

const inspectorTheme: WorkbenchInspectorTheme = {
  background: "#000000",
  accent: "#aaff00",
  border: "#663399",
  good: "#44dd66",
  panelSoft: "#111122",
  surface: "#050510",
  text: "#eeeeee",
  warn: "#ffaa00",
};

const directoryNode: FileExplorerNode = { id: "src", label: "src", kind: "directory", path: "src" };
const fileNode: FileExplorerNode = { id: "src/mod.ts", label: "mod.ts", kind: "file", path: "src/mod.ts" };
const fit = (value: string, width: number) => value.slice(0, Math.max(0, width));

const treeRows: TreeRow[] = [
  {
    id: "src",
    label: "src",
    depth: 0,
    index: 0,
    hasChildren: true,
    expanded: true,
    node: directoryNode,
    text: "▾ src",
  },
  {
    id: "src/mod.ts",
    label: "mod.ts",
    depth: 1,
    index: 1,
    hasChildren: false,
    expanded: false,
    node: fileNode,
    text: "  mod.ts",
  },
];

Deno.test("workbench explorer projects tree rows into themed labels", () => {
  const projected = workbenchExplorerRowsInto([], {
    rows: treeRows,
    selectedIndex: 1,
    theme: explorerTheme,
    contrast: () => "#000000",
  });

  assertEquals(projected, [
    { text: "▾ src", fg: "#44dd66", bg: "#050510", bold: true },
    { text: "  · mod.ts", fg: "#000000", bg: "#ffaa00", bold: true },
  ]);
});

Deno.test("workbench explorer distinguishes collapsed directories and plain rows", () => {
  const projected = workbenchExplorerRowsInto([], {
    rows: [
      {
        ...treeRows[0]!,
        expanded: false,
      },
      {
        ...treeRows[1]!,
        node: { id: "unknown", label: "unknown" },
        label: "unknown",
      },
    ],
    selectedIndex: -1,
    theme: explorerTheme,
    contrast: () => "#000000",
  });

  assertEquals(projected[0], { text: "▸ src", fg: "#44dd66", bg: "#050510", bold: true });
  assertEquals(projected[1], { text: "    unknown", fg: "#eeeeee", bg: "#050510", bold: false });
});

Deno.test("workbench explorer rows reuse caller-owned row objects", () => {
  const target: RowStyle[] = [{ text: "stale", fg: "x", bg: "y", bold: true }, { text: "old" }];
  const firstRow = target[0];
  const projected = workbenchExplorerRowsInto(target, {
    rows: treeRows.slice(0, 1),
    selectedIndex: -1,
    theme: explorerTheme,
    contrast: () => "#000000",
  });

  assertEquals(projected === target, true);
  assertEquals(projected.length, 1);
  assertEquals(projected[0] === firstRow, true);
  assertEquals(projected[0], { text: "▾ src", fg: "#44dd66", bg: "#050510", bold: true });
});

Deno.test("workbench inspector projects API surface rows and theme label", () => {
  const rows = workbenchInspectorRowsInto([], {
    width: 80,
    height: 11,
    themeLabel: "Unit-01 Signal",
    logs: [],
    theme: inspectorTheme,
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
    theme: inspectorTheme,
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
    theme: inspectorTheme,
    fit,
    buffers,
  });
  const firstHeader = first[0];
  const second = workbenchInspectorRowsInto(target, {
    width: 32,
    height: 12,
    themeLabel: "B",
    logs: ["two"],
    theme: inspectorTheme,
    fit,
    buffers,
  });

  assertEquals(second === target, true);
  assertEquals(second[0] === firstHeader, false);
  assertEquals(second[8]?.text, "theme     B");
  assertEquals(buffers.actionTextRows.some((row) => row.includes("stale")), false);
});

Deno.test("workbench log rows project docs into themed rows", () => {
  const rows = workbenchLogRowsInto([], ["one", "two"], { text: "#eee", surface: "#111" });

  assertEquals(rows, [
    { text: "one", fg: "#eee", bg: "#111", bold: undefined },
    { text: "two", fg: "#eee", bg: "#111", bold: undefined },
  ]);
});

Deno.test("workbench log rows reuse caller-owned row objects", () => {
  const target: RowStyle[] = [{ text: "stale", fg: "x", bg: "y", bold: true }];
  const firstRow = target[0];
  const rows = workbenchLogRowsInto(target, ["fresh"], { text: "#fff", surface: "#000" });

  assertEquals(rows === target, true);
  assertEquals(rows[0] === firstRow, true);
  assertEquals(rows[0], { text: "fresh", fg: "#fff", bg: "#000", bold: undefined });
});

Deno.test("workbench log rows project multiple sources without cloning source arrays", () => {
  const target: RowStyle[] = [{ text: "stale", fg: "x", bg: "y", bold: true }, { text: "old" }];
  const firstRow = target[0];
  const rows = workbenchLogRowsFromSourcesInto(target, [["docs"], ["event one", "event two"]], {
    text: "#fff",
    surface: "#000",
  });

  assertEquals(rows === target, true);
  assertEquals(rows[0] === firstRow, true);
  assertEquals(rows, [
    { text: "docs", fg: "#fff", bg: "#000", bold: undefined },
    { text: "event one", fg: "#fff", bg: "#000", bold: undefined },
    { text: "event two", fg: "#fff", bg: "#000", bold: undefined },
  ]);
});

Deno.test("workbench log rows trims stale retained rows", () => {
  const target: RowStyle[] = [{ text: "a" }, { text: "b" }];
  const rows = workbenchLogRowsInto(target, [], { text: "#fff", surface: "#000" });

  assertEquals(rows.length, 0);
});
