import { assertEquals } from "./deps.ts";
import { formatKeyBinding, KeymapRegistry } from "../src/keymap.ts";
import { renderKeyHelp } from "../src/components/key_help.ts";
import { virtualRows, visibleListRows } from "../src/components/list.ts";
import { renderMenuBar, shiftMenuIndex } from "../src/components/menu_bar.ts";
import { renderStatusBar } from "../src/components/statusbar.ts";
import { renderTabs } from "../src/components/tabs.ts";

Deno.test("visibleListRows centers the selected item when space allows", () => {
  assertEquals(visibleListRows(["alpha", "beta", "gamma", "delta"], 2, 3), [
    "  beta",
    "> gamma",
    "  delta",
  ]);
});

Deno.test("virtualRows exposes source indices for large lists", () => {
  assertEquals(virtualRows(["a", "b", "c", "d", "e"], 3, 3), [
    { item: "c", index: 2, selected: false },
    { item: "d", index: 3, selected: true },
    { item: "e", index: 4, selected: false },
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

Deno.test("menu bar renders active item and skips disabled entries", () => {
  const items = [
    { id: "file", label: "File" },
    { id: "edit", label: "Edit", disabled: true },
    { id: "view", label: "View" },
  ];

  assertEquals(renderMenuBar(items, 0), "[File] (Edit) View");
  assertEquals(shiftMenuIndex(items, 0, 1), 2);
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
