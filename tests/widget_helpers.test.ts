import { assertEquals } from "./deps.ts";
import { formatKeyBinding, KeymapRegistry } from "../src/keymap.ts";
import { renderBreadcrumbs } from "../src/components/breadcrumbs.ts";
import { renderKeyHelp } from "../src/components/key_help.ts";
import { virtualRows, visibleListRows } from "../src/components/list.ts";
import { renderMenuBar, shiftMenuIndex } from "../src/components/menu_bar.ts";
import {
  clampRadioIndex,
  optionForValue,
  renderRadioGroupRows,
  shiftRadioIndex,
  visibleRadioOptions,
} from "../src/components/radio_group.ts";
import {
  clampScrollOffset,
  maxScrollOffset,
  scrollbarGlyph,
  scrollbarThumb,
  scrollOffsetBy,
} from "../src/components/scroll_area.ts";
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

Deno.test("renderBreadcrumbs truncates from the left", () => {
  const items = [
    { id: "app", label: "App" },
    { id: "settings", label: "Settings" },
    { id: "runtime", label: "Runtime" },
  ];

  assertEquals(renderBreadcrumbs(items, "/"), "App / Settings / Runtime");
  assertEquals(renderBreadcrumbs(items, "/", 12), "… / Runtime");
  assertEquals(renderBreadcrumbs(items, "/", 6), "… / R…");
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

Deno.test("radio group renders selected state and skips disabled options", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta", disabled: true },
    { value: "c", label: "Gamma" },
  ];

  assertEquals(renderRadioGroupRows(options, "c", 0, 3), [
    "> ○ Alpha",
    "  ○ (Beta)",
    "  ● Gamma",
  ]);
  assertEquals(shiftRadioIndex(options, 0, 1), 2);
  assertEquals(shiftRadioIndex(options, 2, -1), 0);
  assertEquals(clampRadioIndex(options, 1), 2);
  assertEquals(optionForValue(options, "c")?.label, "Gamma");
  assertEquals(visibleRadioOptions(options, 2, 2).map((row) => row.index), [1, 2]);
});

Deno.test("scroll helpers clamp offsets and expose scrollbar thumb state", () => {
  const max = maxScrollOffset(80, 40, 20, 10);
  assertEquals(max, { columns: 60, rows: 30 });
  assertEquals(clampScrollOffset({ columns: 70, rows: -4 }, max), { columns: 60, rows: 0 });
  assertEquals(scrollOffsetBy({ columns: 10, rows: 10 }, max, -2, 25), { columns: 8, rows: 30 });

  const thumb = scrollbarThumb(40, 10, 15);
  assertEquals(thumb, { start: 4, size: 3, visible: true });
  assertEquals(scrollbarGlyph(3, thumb), "│");
  assertEquals(scrollbarGlyph(4, thumb), "█");
  assertEquals(scrollbarThumb(8, 10, 0).visible, false);
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
