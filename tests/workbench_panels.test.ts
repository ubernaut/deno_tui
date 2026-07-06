import { assert, assertEquals } from "./deps.ts";
import { HTML_CSS_LAYOUT_OPTION_ID, HTML_CSS_LAYOUT_WINDOW_ID } from "../src/markup/demo_fixtures.ts";
import {
  apiWorkbenchColumns,
  apiWorkbenchDocs,
  apiWorkbenchLiveRowsInto,
  apiWorkbenchPanelTitle,
  apiWorkbenchRows,
  apiWorkbenchShortPanelTitle,
  apiWorkbenchTerminalCellStyle,
  apiWorkbenchTerminalOutputLineStyle,
  apiWorkbenchTerminalStatusToneColor,
  apiWorkbenchVisualizationSupportsThree,
  apiWorkbenchWindowTitle,
  createApiWorkbenchThemes,
  createApiWorkbenchWindowCatalog,
  nextApiWorkbenchTerminalSessionDraft,
  TERMINAL_OUTPUT_WINDOW_ID,
  TERMINAL_SHELL_WINDOW_ID,
} from "../app/api_workbench_catalog.ts";
import {
  explorerTextRowsInto,
  workbenchDataTablePageSize,
  workbenchDataTableRowsInto,
  workbenchExplorerRowsInto,
  workbenchInspectorRowsInto,
  workbenchLogRowsFromSourcesInto,
  workbenchWindowContentSize,
} from "../app/workbench_panels.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";
import type { DataColumn, DataTableView } from "../src/components/data_table.ts";
import type { FileExplorerNode } from "../src/components/file_explorer.ts";
import type { TreeRow } from "../src/components/tree.ts";

interface DataRow extends Record<string, unknown> {
  id: string;
  name: string;
  state: string;
}

const explorerTheme = {
  background: "#000000",
  good: "#44dd66",
  surface: "#050510",
  text: "#eeeeee",
  warn: "#ffaa00",
};

const inspectorTheme = {
  background: "#000000",
  accent: "#aaff00",
  border: "#663399",
  good: "#44dd66",
  panelSoft: "#111122",
  surface: "#050510",
  text: "#eeeeee",
  warn: "#ffaa00",
};
const dataTableTheme = {
  accentDeep: "#552288",
  background: "#000000",
  buttonActiveBg: "#aaff00",
  buttonActiveText: "#000000",
  muted: "#bbaadd",
  panelSoft: "#221133",
  soft: "#9988aa",
  surface: "#050510",
  text: "#eeeeee",
  warn: "#ffaa00",
};
const dataColumns: DataColumn<DataRow>[] = [
  { id: "name", label: "Name", width: 8, sortable: true },
  { id: "state", label: "State", width: 6, sortable: true },
];
const dataView: DataTableView<DataRow> = {
  rows: [
    { id: "one", name: "Data", state: "ready" },
    { id: "two", name: "Logs", state: "warm" },
  ],
  totalRows: 2,
  page: 0,
  pageSize: 2,
  pageCount: 1,
  selectedIndex: 1,
  selectedKey: "two",
  selectedRow: { id: "two", name: "Logs", state: "warm" },
};

const directoryNode: FileExplorerNode = { id: "src", label: "src", kind: "directory", path: "src" };
const fileNode: FileExplorerNode = { id: "src/mod.ts", label: "mod.ts", kind: "file", path: "src/mod.ts" };
const fit = (value: string, width: number) => value.slice(0, Math.max(0, width));

const contentSizeBase = {
  id: "inspector",
  viewport: { column: 4, row: 2, width: 20, height: 10 },
  docs: ["short", "a much longer log row"],
  explorerRows: ["src", "  mod.ts"],
  dataColumns: [{ width: 4 }, { width: 8 }],
  dataRowCount: 30,
  terminalOutputLines: ["stdout one", "stderr line"],
  terminalOutputWindowId: "terminalOutput",
  terminalShellWindowId: "terminalShell",
  isVisualizationWindow: (id: string) => id.startsWith("viz:"),
  visualizationContentSize: (_id: string, _viewport: unknown, baseWidth: number, baseHeight: number) => ({
    width: baseWidth + 3,
    height: baseHeight + 4,
  }),
};

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
  const buffers = { actionTextRows: [], wrappedTextRows: [] };
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
  const buffers = {
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
  const rows = workbenchLogRowsFromSourcesInto(target, [], { text: "#fff", surface: "#000" });

  assertEquals(rows.length, 0);
});

Deno.test("workbench data table projects header body spacer and footer rows", () => {
  const rows = workbenchDataTableRowsInto([], {
    view: dataView,
    columns: dataColumns,
    sort: { columnId: "state", direction: "desc" },
    width: 80,
    theme: dataTableTheme,
    fit,
    contrast: () => "#000000",
    buffers: { textRows: [], bodyRows: [] },
  });

  assertEquals(rows[0], { text: "Name     State↓", fg: "#000000", bg: "#552288", bold: true });
  assertEquals(rows[1], { text: "  Data     ready ", fg: "#eeeeee", bg: "#050510", bold: false });
  assertEquals(rows[2], { text: "> Logs     warm  ", fg: "#000000", bg: "#ffaa00", bold: true });
  assertEquals(rows[3], { text: "", bg: "#050510" });
  assertEquals(rows[4], {
    text: "page 1/1 selected two arrows/page keys S sort",
    fg: "#bbaadd",
    bg: "#221133",
  });
});

Deno.test("workbench data table rows reuse caller-owned body buffers", () => {
  const target: RowStyle[] = [];
  const bodyRow: RowStyle = { text: "stale", fg: "x", bg: "y", bold: true };
  const buffers = { textRows: ["stale"], bodyRows: [bodyRow] };
  const rows = workbenchDataTableRowsInto(target, {
    view: { ...dataView, rows: dataView.rows.slice(0, 1), selectedIndex: 0 },
    columns: dataColumns,
    width: 80,
    theme: dataTableTheme,
    fit,
    contrast: () => "#000000",
    buffers,
  });

  assertEquals(rows === target, true);
  assertEquals(buffers.bodyRows.length, 1);
  assertEquals(buffers.bodyRows[0] === bodyRow, true);
  assertEquals(rows[1] === bodyRow, true);
  assertEquals(rows[1]?.text, "> Data     ready ");
});

Deno.test("workbench data table page size accounts for wrapped footer rows", () => {
  assertEquals(
    workbenchDataTablePageSize({
      height: 8,
      width: 80,
      page: 1,
      pageCount: 3,
      selectedKey: "data",
      theme: dataTableTheme,
      fit,
    }),
    5,
  );
  assertEquals(
    workbenchDataTablePageSize({
      height: 8,
      width: 10,
      page: 1,
      pageCount: 3,
      selectedKey: "data",
      theme: dataTableTheme,
      fit,
    }),
    1,
  );
});

Deno.test("workbenchWindowContentSize estimates built-in window content", () => {
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "explorer" }), { width: 20, height: 10 });
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "controls" }), { width: 20, height: 44 });
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "inspector" }), { width: 20, height: 18 });
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "logs" }), { width: 23, height: 10 });
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "data" }), { width: 24, height: 34 });
  assertEquals(
    workbenchWindowContentSize({
      ...contentSizeBase,
      id: "data",
      dataColumns: [{ width: 4 }, {}, { width: 6 }],
    }),
    { width: 36, height: 34 },
  );
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "three" }), { width: 20, height: 10 });
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "htmlLayout" }), { width: 20, height: 20 });
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "unknown" }), { width: 20, height: 16 });
});

Deno.test("workbenchWindowContentSize clamps terminal content dimensions", () => {
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "terminalShell" }), { width: 72, height: 24 });
  assertEquals(
    workbenchWindowContentSize({
      ...contentSizeBase,
      id: "terminalOutput",
      terminalOutputLines: ["x".repeat(300), "ok"],
    }),
    { width: 120, height: 16 },
  );
  assertEquals(
    workbenchWindowContentSize({
      ...contentSizeBase,
      id: "terminalOutput",
      viewport: { column: 0, row: 0, width: 140, height: 30 },
      terminalOutputLines: Array.from({ length: 40 }, (_, index) => `line ${index}`),
    }),
    { width: 140, height: 44 },
  );
});

Deno.test("workbenchWindowContentSize delegates visualization windows", () => {
  assertEquals(workbenchWindowContentSize({ ...contentSizeBase, id: "viz:cpu" }), { width: 23, height: 14 });
});

Deno.test("workbench content-size helper reuses text rows", () => {
  const target = ["stale"];
  const rows = explorerTextRowsInto(target, [{ text: "alpha" }, { text: "beta gamma" }], (entry) => entry.text);

  assertEquals(rows, target);
  assertEquals(rows, ["alpha", "beta gamma"]);
});

Deno.test("api workbench catalog projects rich selectable themes", () => {
  const themes = createApiWorkbenchThemes();
  const defaultTheme = themes[0]!;

  assert(themes.length >= 6);
  assertEquals(defaultTheme.id.length > 0, true);
  assertEquals(defaultTheme.label.length > 0, true);
  assertEquals(defaultTheme.buttonBg, defaultTheme.accentDeep);
  assertEquals(defaultTheme.buttonActiveBg, defaultTheme.accent);
  assert(defaultTheme.buttonText.length > 0);
  assert(defaultTheme.buttonActiveText.length > 0);
});

Deno.test("api workbench catalog exposes table and docs fixtures", () => {
  assertEquals(apiWorkbenchColumns.map((column) => column.id), ["surface", "api", "state", "latency"]);
  assert(apiWorkbenchRows.some((row) => row.id === "data" && row.api === "data"));
  assert(apiWorkbenchRows.every((row) => typeof row.latency === "number"));
  assert(apiWorkbenchDocs.some((line) => line.includes("WindowManagerController")));
  assert(apiWorkbenchDocs.some((line) => line.includes("ThreePanelFrameView")));
});

Deno.test("api workbench live rows reuse caller buffers", () => {
  const target = [{ id: "stale", surface: "Stale", api: "stale", state: "old", latency: 99 }];
  const rows = apiWorkbenchLiveRowsInto(target, apiWorkbenchRows.slice(0, 2), 3, 17);

  assertEquals(rows, target);
  assertEquals(rows.length, 2);
  assertEquals(rows[0]?.id, apiWorkbenchRows[0]?.id);
  assertEquals(rows[0]?.latency, ((apiWorkbenchRows[0]!.latency + 3) % 17) + 1);
  assertEquals(rows[1]?.latency, ((apiWorkbenchRows[1]!.latency + 1 + 3) % 17) + 1);
});

Deno.test("api workbench catalog exposes shared panel display titles", () => {
  assertEquals(apiWorkbenchPanelTitle("data"), "Data Table");
  assertEquals(apiWorkbenchPanelTitle("terminal"), "Terminal");
  assertEquals(apiWorkbenchPanelTitle("unknown", "Fallback"), "Fallback");
  assertEquals(apiWorkbenchShortPanelTitle("htmlLayout"), "Layout");
  assertEquals(apiWorkbenchShortPanelTitle("data"), "Data Table");
});

Deno.test("api workbench catalog composes shared window titles", () => {
  assertEquals(apiWorkbenchWindowTitle({ id: "data" }), "Data Table");
  assertEquals(apiWorkbenchWindowTitle({ id: "unknown", fallback: "Fallback" }), "Fallback");
  assertEquals(apiWorkbenchWindowTitle({ id: "viz:cpu", visualizationLabel: "CPU Hex Grid" }), "CPU Hex Grid");
  assertEquals(apiWorkbenchWindowTitle({ id: "viz:missing", visualizationLabel: "" }), "Visualization");
  assertEquals(
    apiWorkbenchWindowTitle({
      id: "terminal",
      terminalOutputId: "terminal",
      terminalOutputTitle: "Terminal RAW running",
    }),
    "Terminal RAW running",
  );
  assertEquals(
    apiWorkbenchWindowTitle({
      id: "shell",
      terminalShellId: "shell",
      terminalShellTitle: "Shell WB bash",
    }),
    "Shell WB bash",
  );
});

Deno.test("api workbench catalog maps terminal status tones through active theme colors", () => {
  const theme = createApiWorkbenchThemes()[0]!;

  assertEquals(apiWorkbenchTerminalStatusToneColor("running", theme), theme.good);
  assertEquals(apiWorkbenchTerminalStatusToneColor("failed", theme), theme.danger);
  assertEquals(apiWorkbenchTerminalStatusToneColor("cancelled", theme), theme.warn);
  assertEquals(apiWorkbenchTerminalStatusToneColor("starting", theme), theme.accent);
  assertEquals(apiWorkbenchTerminalStatusToneColor("idle", theme), theme.borderStrong);
  assertEquals(apiWorkbenchTerminalStatusToneColor(undefined, theme), theme.borderStrong);
});

Deno.test("api workbench catalog maps terminal output line styles through active theme colors", () => {
  const theme = createApiWorkbenchThemes()[0]!;

  assertEquals(apiWorkbenchTerminalOutputLineStyle("stdout", theme), {
    fg: theme.text,
    bg: theme.surface,
  });
  assertEquals(apiWorkbenchTerminalOutputLineStyle("stderr", theme), {
    fg: theme.danger,
    bg: theme.surface,
    bold: true,
  });
  assertEquals(apiWorkbenchTerminalOutputLineStyle("system", theme), {
    fg: theme.warn,
    bg: theme.panelSoft,
    bold: true,
  });
});

Deno.test("api workbench catalog creates terminal session drafts", () => {
  assertEquals(
    nextApiWorkbenchTerminalSessionDraft([{ id: "pages-shell-1" }], {
      prefix: "pages-shell",
      label: "Pages Shell",
    }),
    { id: "pages-shell-2", title: "Pages Shell 2" },
  );
});

Deno.test("api workbench catalog projects terminal cell style defaults and cursor state", () => {
  const theme = createApiWorkbenchThemes()[0]!;

  assertEquals(apiWorkbenchTerminalCellStyle({ foreground: 32, background: 41, bold: true }, theme, false), {
    fg: theme.good,
    bg: theme.danger,
    bold: true,
  });
  assertEquals(apiWorkbenchTerminalCellStyle({}, theme, false), {
    fg: theme.text,
    bg: theme.surface,
    bold: undefined,
  });
  assertEquals(apiWorkbenchTerminalCellStyle({ foreground: 35, background: 47 }, theme, false), {
    fg: theme.borderStrong,
    bg: theme.text,
    bold: undefined,
  });
  assertEquals(apiWorkbenchTerminalCellStyle({ foreground: 99, background: 99 }, theme, false), {
    fg: theme.text,
    bg: theme.surface,
    bold: undefined,
  });
  assertEquals(apiWorkbenchTerminalCellStyle({ foreground: 32, background: 41, bold: false }, theme, true), {
    fg: theme.background,
    bg: theme.accent,
    bold: true,
  });
});

Deno.test("api workbench catalog exposes built-in window order", () => {
  const catalog = createApiWorkbenchWindowCatalog([]);

  assertEquals(catalog.builtInWindowOrder, [
    "explorer",
    "inspector",
    "data",
    "controls",
    "logs",
    "three",
    HTML_CSS_LAYOUT_WINDOW_ID,
    TERMINAL_OUTPUT_WINDOW_ID,
    TERMINAL_SHELL_WINDOW_ID,
  ]);
});

Deno.test("api workbench catalog places terminal and layout options before visualizations", () => {
  const catalog = createApiWorkbenchWindowCatalog([
    { id: "cpu-monitor", name: "CPU", description: "CPU usage", family: "monitor" },
    { id: "three-lattice", name: "Lattice", description: "3D lattice", family: "neon3d" },
  ]);

  assertEquals(catalog.newWindowOptions.map((option) => option.id), [
    "terminal-shell",
    "terminal-output",
    HTML_CSS_LAYOUT_OPTION_ID,
    "cpu-monitor",
    "three-lattice",
  ]);
  assertEquals(catalog.newWindowOptions[0]!.windowId, TERMINAL_SHELL_WINDOW_ID);
  assertEquals(catalog.newWindowOptions[1]!.windowId, TERMINAL_OUTPUT_WINDOW_ID);
  assertEquals(catalog.newWindowOptions[2]!.windowId, HTML_CSS_LAYOUT_WINDOW_ID);
  assertEquals(catalog.visualizationWindowOptionIds, ["cpu-monitor", "three-lattice"]);
  assertEquals(catalog.visualizationWindowOptionById.get("three-lattice")?.group, "Neon 3D");
});

Deno.test("api workbench catalog caches visualization Three support probes", () => {
  const cache = new Map<string, boolean>();
  let probes = 0;
  const probe = (id: string) => {
    probes += 1;
    return { three: id === "three-lattice" ? {} : undefined };
  };

  assertEquals(apiWorkbenchVisualizationSupportsThree(cache, "three-lattice", probe), true);
  assertEquals(apiWorkbenchVisualizationSupportsThree(cache, "cpu-monitor", probe), false);
  assertEquals(apiWorkbenchVisualizationSupportsThree(cache, "three-lattice", probe), true);
  assertEquals(apiWorkbenchVisualizationSupportsThree(cache, "cpu-monitor", probe), false);
  assertEquals(probes, 2);
});
