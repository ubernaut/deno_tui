import { assert, assertEquals } from "./deps.ts";
import {
  apiWorkbenchColumns,
  apiWorkbenchDocs,
  apiWorkbenchPanelTitle,
  apiWorkbenchRows,
  apiWorkbenchShortPanelTitle,
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

Deno.test("api workbench catalog exposes shared panel display titles", () => {
  assertEquals(apiWorkbenchPanelTitle("data"), "Data Table");
  assertEquals(apiWorkbenchPanelTitle("terminal"), "Terminal");
  assertEquals(apiWorkbenchPanelTitle("unknown", "Fallback"), "Fallback");
  assertEquals(apiWorkbenchShortPanelTitle("htmlLayout"), "Layout");
  assertEquals(apiWorkbenchShortPanelTitle("data"), "Data Table");
});
