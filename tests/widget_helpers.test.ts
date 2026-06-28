import { assertEquals } from "./deps.ts";
import { formatKeyBinding, KeymapRegistry } from "../src/keymap.ts";
import { renderKeyHelp } from "../src/components/key_help.ts";
import { visibleListRows } from "../src/components/list.ts";
import { renderStatusBar } from "../src/components/statusbar.ts";
import { renderTabs } from "../src/components/tabs.ts";

Deno.test("visibleListRows centers the selected item when space allows", () => {
  assertEquals(visibleListRows(["alpha", "beta", "gamma", "delta"], 2, 3), [
    "  beta",
    "> gamma",
    "  delta",
  ]);
});

Deno.test("renderTabs marks the active tab", () => {
  assertEquals(
    renderTabs([
      { id: "one", label: "One" },
      { id: "two", label: "Two" },
    ], 1),
    " One  [Two]",
  );
});

Deno.test("renderStatusBar keeps left and right content inside width", () => {
  assertEquals(renderStatusBar("READY", "12:00", 12), "READY  12:00");
  assertEquals(renderStatusBar("LONG LEFT", "RIGHT", 8), "LONG LEF");
});

Deno.test("keymap registry formats sorted bindings", () => {
  const registry = new KeymapRegistry();
  registry.register({ key: "p", description: "palette", ctrl: true, group: "global" });
  registry.register({ key: "q", description: "quit", group: "global" });

  assertEquals(formatKeyBinding({ key: "p", description: "palette", ctrl: true }), "C-p palette");
  assertEquals(renderKeyHelp(registry.list("global"), 40), "C-p palette  q quit");
});
