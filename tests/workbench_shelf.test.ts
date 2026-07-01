import { assertEquals } from "./deps.ts";
import { layoutWorkbenchShelf, layoutWorkbenchTabs } from "../src/app/workbench_shelf.ts";

Deno.test("workbench shelf layout places minimized buttons after the prefix", () => {
  const layout = layoutWorkbenchShelf({
    row: 8,
    column: 1,
    width: 60,
    entries: [
      { id: "logs", title: "Logs" },
      { id: "three", title: "Three ASCII" },
    ],
  });

  assertEquals(layout.prefixRect, { column: 1, row: 8, width: 10, height: 1 });
  assertEquals(layout.buttons.map((button) => [button.id, button.label, button.rect, button.hidden]), [
    ["logs", "Logs", { column: 11, row: 8, width: 8, height: 1 }, true],
    ["three", "Three ASCII", { column: 20, row: 8, width: 15, height: 1 }, true],
  ]);
});

Deno.test("workbench tab layout adds fullscreen and hidden markers", () => {
  const layout = layoutWorkbenchTabs({
    row: 12,
    column: 2,
    width: 72,
    tabs: [
      { id: "data", title: "Data", selected: true },
      { id: "logs", title: "Logs", hidden: true },
      { id: "three", title: "Three" },
    ],
  });

  assertEquals(layout.prefixRect, { column: 2, row: 12, width: 8, height: 1 });
  assertEquals(layout.buttons.map((button) => [button.id, button.label, button.selected, button.hidden]), [
    ["data", "● Data", true, false],
    ["logs", "○ Logs", false, true],
    ["three", "  Three", false, false],
  ]);
});

Deno.test("workbench shelf and tab layout clip buttons to the available row width", () => {
  const shelf = layoutWorkbenchShelf({
    row: 0,
    column: 0,
    width: 17,
    entries: [{ id: "long", title: "Very Long Window" }],
  });
  const tabs = layoutWorkbenchTabs({
    row: 0,
    column: 0,
    width: 18,
    tabs: [{ id: "long", title: "Very Long Window", selected: true }],
  });

  assertEquals(shelf.buttons[0]?.rect, { column: 10, row: 0, width: 7, height: 1 });
  assertEquals(tabs.buttons[0]?.rect, { column: 8, row: 0, width: 10, height: 1 });
});
