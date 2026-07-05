import { assert, assertEquals } from "./deps.ts";
import { HTML_CSS_LAYOUT_OPTION_ID, HTML_CSS_LAYOUT_WINDOW_ID } from "../src/markup/demo_fixtures.ts";
import {
  apiWorkbenchBuiltInWindowOrder,
  apiWorkbenchColumns,
  apiWorkbenchDocs,
  apiWorkbenchLiveRowsInto,
  apiWorkbenchPanelTitle,
  apiWorkbenchRows,
  apiWorkbenchShortPanelTitle,
  apiWorkbenchTerminalOutputLineStyle,
  apiWorkbenchTerminalStatusToneColor,
  apiWorkbenchVisualizationSupportsThree,
  apiWorkbenchWindowTitle,
  createApiWorkbenchThemes,
  createApiWorkbenchWindowCatalog,
  TERMINAL_OUTPUT_OPTION_ID,
  TERMINAL_OUTPUT_WINDOW_ID,
  TERMINAL_SHELL_OPTION_ID,
  TERMINAL_SHELL_WINDOW_ID,
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

Deno.test("api workbench catalog exposes built-in window order", () => {
  assertEquals(apiWorkbenchBuiltInWindowOrder, [
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
    TERMINAL_SHELL_OPTION_ID,
    TERMINAL_OUTPUT_OPTION_ID,
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
