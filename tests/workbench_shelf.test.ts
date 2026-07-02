import { assertEquals } from "./deps.ts";
import {
  createWorkbenchShelfLayoutBuffers,
  layoutWorkbenchShelf,
  layoutWorkbenchShelfInto,
  layoutWorkbenchTabs,
  layoutWorkbenchTabsInto,
  workbenchShelfEntriesInto,
  workbenchShelfRenderCommandsInto,
  type WorkbenchShelfSource,
  workbenchTabEntriesInto,
  type WorkbenchTabSource,
} from "../src/app/workbench_shelf.ts";

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

Deno.test("workbench shelf and tab layouts can reuse caller-owned buffers", () => {
  const shelfBuffers = createWorkbenchShelfLayoutBuffers<"logs" | "three">();
  const first = layoutWorkbenchShelfInto(shelfBuffers, {
    row: 8,
    column: 1,
    width: 60,
    entries: [
      { id: "logs", title: "Logs" },
      { id: "three", title: "Three ASCII" },
    ],
  });
  const firstButtons = first.buttons;
  const firstItems = shelfBuffers.items;
  const firstPlacements = shelfBuffers.placements;

  const second = layoutWorkbenchShelfInto(shelfBuffers, {
    row: 9,
    column: 2,
    width: 24,
    entries: [{ id: "three", title: "Three ASCII" }],
  });

  assertEquals(second.buttons === firstButtons, true);
  assertEquals(shelfBuffers.items === firstItems, true);
  assertEquals(shelfBuffers.placements === firstPlacements, true);
  assertEquals(second.buttons.map((button) => [button.id, button.rect]), [
    ["three", { column: 12, row: 9, width: 14, height: 1 }],
  ]);

  const tabBuffers = createWorkbenchShelfLayoutBuffers<"logs">();
  const tabs = layoutWorkbenchTabsInto(tabBuffers, {
    row: 4,
    column: 0,
    width: 30,
    tabs: [{ id: "logs", title: "Logs", selected: true }],
  });
  assertEquals(tabs.buttons, [
    {
      id: "logs",
      label: "● Logs",
      rect: { column: 8, row: 4, width: 10, height: 1 },
      selected: true,
      hidden: false,
    },
  ]);
});

Deno.test("workbench shelf projections reuse buffers for minimized windows and tabs", () => {
  const shelf: WorkbenchShelfSource<"one" | "two" | "three">[] = [{ id: "one", title: "stale" }];
  const tabs: WorkbenchTabSource<"one" | "two" | "three">[] = [];
  const windows = [
    { id: "one", minimized: true },
    { id: "two", minimized: false },
    { id: "three", minimized: true, closed: true },
  ];

  assertEquals(workbenchShelfEntriesInto(shelf, windows, (id) => `Window ${id}`), [
    { id: "one", title: "Window one" },
  ]);
  assertEquals(shelf.length, 1);

  assertEquals(
    workbenchTabEntriesInto(tabs, [
      { id: "one", fullscreen: true },
      { id: "two", minimized: true },
    ], (id) => `Window ${id}`),
    [
      { id: "one", title: "Window one", selected: true, hidden: false },
      { id: "two", title: "Window two", selected: false, hidden: true },
    ],
  );
});

Deno.test("workbench shelf render commands project prefix buttons and hit rectangles", () => {
  const layout = layoutWorkbenchShelf({
    row: 3,
    column: 1,
    width: 32,
    entries: [{ id: "logs", title: "Logs" }],
  });
  const commands = workbenchShelfRenderCommandsInto([], layout);

  assertEquals(commands, [
    {
      kind: "prefix",
      text: "minimized ",
      rect: { column: 1, row: 3, width: 10, height: 1 },
    },
    {
      kind: "button",
      id: "logs",
      label: "Logs",
      text: "[ Logs ]",
      rect: { column: 11, row: 3, width: 8, height: 1 },
      hitRect: { column: 11, row: 3, width: 8, height: 1 },
      selected: false,
      hidden: true,
      state: "base",
      tone: "muted",
    },
  ]);
});

Deno.test("workbench tab render commands map selected and hidden state", () => {
  const layout = layoutWorkbenchTabs({
    row: 5,
    column: 0,
    width: 40,
    tabs: [
      { id: "data", title: "Data", selected: true },
      { id: "logs", title: "Logs", hidden: true },
    ],
  });
  const target = workbenchShelfRenderCommandsInto([], layout);
  const firstButton = target[1];
  const secondButton = target[2];

  assertEquals(firstButton?.kind, "button");
  if (firstButton?.kind === "button") {
    assertEquals([firstButton.id, firstButton.state, firstButton.tone, firstButton.selected, firstButton.hidden], [
      "data",
      "active",
      "default",
      true,
      false,
    ]);
  }
  assertEquals(secondButton?.kind, "button");
  if (secondButton?.kind === "button") {
    assertEquals([secondButton.id, secondButton.state, secondButton.tone, secondButton.selected, secondButton.hidden], [
      "logs",
      "base",
      "muted",
      false,
      true,
    ]);
  }
});

Deno.test("workbench shelf render commands clip and reuse caller buffers", () => {
  const layout = layoutWorkbenchShelf({
    row: 2,
    column: 0,
    width: 17,
    entries: [{ id: "long", title: "Very Long Window" }],
  });
  const target = workbenchShelfRenderCommandsInto([], layout);
  const prefix = target[0];
  const button = target[1];

  assertEquals(button?.kind, "button");
  if (button?.kind === "button") {
    assertEquals(button.text, "[ Very…");
    assertEquals(button.rect, { column: 10, row: 2, width: 7, height: 1 });
    assertEquals(button.hitRect, button.rect);
  }

  const reusedPrefix = prefix;
  const reusedButton = button;
  const next = workbenchShelfRenderCommandsInto(
    target,
    layoutWorkbenchShelf({
      row: 4,
      column: 1,
      width: 20,
      entries: [{ id: "long", title: "Short" }],
    }),
  );

  assertEquals(next[0] === reusedPrefix, true);
  assertEquals(next[1] === reusedButton, true);
  assertEquals(next.length, 2);
});
