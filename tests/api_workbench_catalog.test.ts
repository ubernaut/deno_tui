import { assert, assertEquals } from "./deps.ts";
import {
  apiWorkbenchColumns,
  apiWorkbenchDocs,
  apiWorkbenchLiveRowsInto,
  apiWorkbenchPanelTitle,
  apiWorkbenchRows,
  apiWorkbenchShortPanelTitle,
  apiWorkbenchWindowTitle,
  createApiWorkbenchThemes,
} from "../app/api_workbench_catalog.ts";

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
