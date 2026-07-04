import { assertEquals } from "./deps.ts";
import { HTML_CSS_LAYOUT_OPTION_ID, HTML_CSS_LAYOUT_WINDOW_ID } from "../src/markup/demo_fixtures.ts";
import {
  apiWorkbenchBuiltInWindowOrder,
  createApiWorkbenchWindowCatalog,
  TERMINAL_OUTPUT_OPTION_ID,
  TERMINAL_OUTPUT_WINDOW_ID,
  TERMINAL_SHELL_OPTION_ID,
  TERMINAL_SHELL_WINDOW_ID,
} from "../app/api_workbench_windows.ts";

Deno.test("API workbench built-in window order includes terminal and layout windows", () => {
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

Deno.test("API workbench window catalog places terminal and layout options before visualizations", () => {
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
