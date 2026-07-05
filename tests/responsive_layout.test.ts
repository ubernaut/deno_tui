import { assertEquals } from "./deps.ts";
import {
  adaptiveGrid,
  adaptiveGridItemRect,
  adaptiveGridPage,
  dockRect,
  flexRects,
  insetRect,
  resizeSplitPane,
  resizeSplitPaneRatio,
  resolveBreakpoint,
  SplitPaneController,
  splitPaneRects,
  splitRect,
  tileRects,
  WindowManagerController,
} from "../src/layout/mod.ts";
import type { Rectangle } from "../src/types.ts";

const flexBounds: Rectangle = {
  column: 2,
  row: 4,
  width: 40,
  height: 12,
};

Deno.test("resolveBreakpoint picks the largest matching breakpoint", () => {
  const bounds = { column: 0, row: 0, width: 100, height: 30 };
  assertEquals(
    resolveBreakpoint(bounds, [
      { id: "mobile" },
      { id: "wide", minWidth: 90 },
      { id: "huge", minWidth: 120 },
    ]),
    "wide",
  );
  assertEquals(
    resolveBreakpoint(bounds, [
      { id: "first", minWidth: 80, minHeight: 20 },
      { id: "second", minWidth: 80, minHeight: 20 },
    ]),
    "first",
  );
});

Deno.test("insetRect clamps dimensions", () => {
  assertEquals(insetRect({ column: 1, row: 2, width: 5, height: 4 }, 2), {
    column: 3,
    row: 4,
    width: 1,
    height: 0,
  });
});

Deno.test("splitRect returns stable row slices", () => {
  assertEquals(splitRect({ column: 0, row: 0, width: 10, height: 4 }, "row", 3, 1), {
    first: { column: 0, row: 0, width: 3, height: 4 },
    second: { column: 4, row: 0, width: 6, height: 4 },
  });
});

Deno.test("dockRect returns dock and remaining body", () => {
  assertEquals(dockRect({ column: 0, row: 0, width: 10, height: 4 }, "bottom", 1, 1), {
    first: { column: 0, row: 3, width: 10, height: 1 },
    second: { column: 0, row: 0, width: 10, height: 2 },
  });
});

Deno.test("splitPaneRects returns horizontal panes and separator", () => {
  assertEquals(splitPaneRects(flexBounds, { direction: "row", firstSize: 14, gap: 2 }), {
    first: { column: 2, row: 4, width: 14, height: 12 },
    separator: { column: 16, row: 4, width: 2, height: 12 },
    second: { column: 18, row: 4, width: 24, height: 12 },
    firstSize: 14,
    ratio: 14 / 38,
  });
});

Deno.test("splitPaneRects returns vertical panes from ratio", () => {
  assertEquals(splitPaneRects(flexBounds, { direction: "column", ratio: 0.25, gap: 1 }), {
    first: { column: 2, row: 4, width: 40, height: 2 },
    separator: { column: 2, row: 6, width: 40, height: 1 },
    second: { column: 2, row: 7, width: 40, height: 9 },
    firstSize: 2,
    ratio: 2 / 11,
  });
});

Deno.test("splitPaneRects clamps first pane by minimum second pane", () => {
  const result = splitPaneRects(flexBounds, {
    direction: "row",
    firstSize: 38,
    minFirst: 8,
    minSecond: 12,
    gap: 1,
  });

  assertEquals(result.first.width, 27);
  assertEquals(result.second.width, 12);
});

Deno.test("resizeSplitPane returns constrained options for the next solve", () => {
  const resized = resizeSplitPane(flexBounds, {
    direction: "row",
    firstSize: 12,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
  }, 30);

  assertEquals(resized.firstSize, 29);
  assertEquals(splitPaneRects(flexBounds, resized).first.width, 29);
});

Deno.test("resizeSplitPaneRatio persists a responsive ratio", () => {
  const resized = resizeSplitPaneRatio(flexBounds, {
    direction: "row",
    ratio: 0.5,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
  }, 4);

  assertEquals(resized.firstSize, undefined);
  assertEquals(resized.ratio, 23 / 39);
  assertEquals(splitPaneRects({ ...flexBounds, width: 80 }, resized).first.width, 46);
});

Deno.test("SplitPaneController resizes and snapshots size-based panes", () => {
  const controller = new SplitPaneController({
    direction: "row",
    firstSize: 12,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
  });
  const snapshots: number[] = [];
  controller.options.subscribe((options) => snapshots.push(options.firstSize ?? -1));

  const rects = controller.resize(flexBounds, 4);

  assertEquals(rects.first.width, 16);
  assertEquals(controller.snapshot(), {
    direction: "row",
    firstSize: 16,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
    resizeMode: "size",
  });
  assertEquals(snapshots, [16]);
  controller.dispose();
});

Deno.test("SplitPaneController can preserve ratios across resizes", () => {
  const controller = new SplitPaneController({
    direction: "row",
    ratio: 0.5,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
    resizeMode: "ratio",
  });

  controller.resize(flexBounds, 4);
  assertEquals(controller.snapshot().firstSize, undefined);
  assertEquals(controller.snapshot().ratio, 23 / 39);
  assertEquals(controller.rects({ ...flexBounds, width: 80 }).first.width, 46);

  controller.setRatio(2);
  assertEquals(controller.snapshot().ratio, 1);
  controller.setFirstSize(10);
  controller.setDirection("column");
  controller.update({ gap: 2, resizeMode: "size" });
  assertEquals(controller.snapshot(), {
    direction: "column",
    ratio: 1,
    firstSize: 10,
    minFirst: 8,
    minSecond: 10,
    gap: 2,
    resizeMode: "size",
  });
  controller.dispose();
});

Deno.test("flexRects distributes extra space by grow weight", () => {
  const rects = flexRects(flexBounds, "row", [
    { id: "left", basis: 10, grow: 1 },
    { id: "right", basis: 10, grow: 3 },
  ], 2);

  assertEquals(rects.left.column, 2);
  assertEquals(rects.left.row, 4);
  assertEquals(rects.left.height, 12);
  assertEquals(rects.right.height, 12);
  assertEquals(rects.left.width + rects.right.width + 2, 40);
  assertEquals(rects.left.width < rects.right.width, true);
});

Deno.test("flexRects shrinks items toward their minimums before overflowing", () => {
  const rects = flexRects({ column: 0, row: 0, width: 18, height: 8 }, "row", [
    { id: "a", basis: 12, min: 6, shrink: 1 },
    { id: "b", basis: 12, min: 4, shrink: 2 },
  ], 1);

  assertEquals(rects.a.width + rects.b.width + 1, 18);
  assertEquals(rects.a.width >= 6, true);
  assertEquals(rects.b.width >= 4, true);
});

Deno.test("flexRects maps columns into vertical slices", () => {
  const rects = flexRects(flexBounds, "column", [
    { id: "top", basis: 3, grow: 1 },
    { id: "bottom", basis: 3, grow: 1 },
  ], 1);

  assertEquals(rects.top, {
    column: 2,
    row: 4,
    width: 40,
    height: 6,
  });
  assertEquals(rects.bottom, {
    column: 2,
    row: 11,
    width: 40,
    height: 5,
  });
});

Deno.test("adaptiveGrid chooses columns and rows from available space", () => {
  assertEquals(
    adaptiveGrid({ column: 0, row: 0, width: 100, height: 20 }, {
      itemCount: 10,
      minColumnWidth: 30,
      minRowHeight: 8,
      maxColumns: 4,
      gap: 1,
    }),
    {
      columns: 3,
      rows: 2,
      itemWidth: 32,
      itemHeight: 9,
      pageSize: 6,
    },
  );

  assertEquals(
    adaptiveGrid({ column: 0, row: 0, width: 50, height: 8 }, {
      itemCount: 10,
      minColumnWidth: 30,
      minRowHeight: 8,
      maxColumns: 4,
      gap: 1,
    }).columns,
    1,
  );
});

Deno.test("adaptiveGridPage and item rects keep pages inside bounds", () => {
  const bounds = { column: 2, row: 3, width: 65, height: 19 };
  const page = adaptiveGridPage(bounds, 7, {
    itemCount: 12,
    minColumnWidth: 20,
    minRowHeight: 8,
    maxColumns: 3,
    gap: 1,
  });

  assertEquals(page.pageIndex, 1);
  assertEquals(page.pageStart, 6);
  assertEquals(page.pageCount, 2);
  assertEquals(adaptiveGridItemRect(bounds, page.grid, 0, 1), {
    column: 2,
    row: 3,
    width: 21,
    height: 9,
  });
  assertEquals(adaptiveGridItemRect(bounds, page.grid, 2, 1), {
    column: 46,
    row: 3,
    width: 21,
    height: 9,
  });
});

Deno.test("tileRects chooses wider grids instead of only one or two columns", () => {
  const mediumWide = tileRects({ column: 2, row: 3, width: 120, height: 30 }, {
    itemCount: 4,
    minTileWidth: 36,
    minTileHeight: 10,
    maxColumns: 4,
    targetAspectRatio: 2.3,
    gap: 1,
  });

  assertEquals(mediumWide.columns, 3);
  assertEquals(mediumWide.rows, 2);
  assertEquals(mediumWide.rects[0], { column: 2, row: 3, width: 39, height: 14 });
  assertEquals(mediumWide.rects[1], { column: 42, row: 3, width: 39, height: 30 });
  assertEquals(mediumWide.rects[2], { column: 82, row: 3, width: 40, height: 30 });
  assertEquals(mediumWide.rects[3], { column: 2, row: 18, width: 39, height: 15 });

  const extraWide = tileRects({ column: 2, row: 3, width: 150, height: 30 }, {
    itemCount: 4,
    minTileWidth: 36,
    minTileHeight: 10,
    maxColumns: 4,
    targetAspectRatio: 2.3,
    gap: 1,
  });

  assertEquals(extraWide.columns, 4);
  assertEquals(extraWide.rows, 1);
  assertEquals(extraWide.rects[3], { column: 113, row: 3, width: 39, height: 30 });
});

Deno.test("tileRects can overflow vertically for scrollable tiled panes", () => {
  const layout = tileRects({ column: 0, row: 0, width: 80, height: 12 }, {
    itemCount: 4,
    minTileWidth: 34,
    minTileHeight: 8,
    maxColumns: 2,
    gap: 1,
    allowVerticalOverflow: true,
  });

  assertEquals(layout.columns, 2);
  assertEquals(layout.rows, 2);
  assertEquals(layout.contentHeight, 17);
  assertEquals(layout.rects[1], { column: 40, row: 0, width: 40, height: 8 });
  assertEquals(layout.rects[2], { column: 0, row: 9, width: 39, height: 8 });
});

Deno.test("WindowManagerController manages fullscreen tabs and tiled layout", () => {
  const manager = new WindowManagerController({
    windows: [
      { id: "explorer", title: "Explorer", minWidth: 24 },
      { id: "editor", title: "Editor", minWidth: 36 },
      { id: "logs", title: "Logs", minWidth: 24 },
    ],
    activeId: "editor",
  });

  const tiled = manager.layout({ bounds: { column: 0, row: 0, width: 100, height: 24 } });
  assertEquals(tiled.visible.length, 3);
  assertEquals(tiled.activeId, "editor");
  assertEquals(tiled.tabs.map((entry) => entry.id), ["explorer", "editor", "logs"]);

  manager.fullscreen("editor");
  const fullscreen = manager.layout({ bounds: { column: 0, row: 0, width: 100, height: 24 } });
  assertEquals(fullscreen.fullscreenId, "editor");
  assertEquals(fullscreen.visible.map((entry) => entry.id), ["editor"]);
  assertEquals(fullscreen.visible[0]?.rect, { column: 0, row: 0, width: 100, height: 24 });

  manager.selectTab("logs");
  assertEquals(manager.inspect().fullscreenId, "logs");
  assertEquals(manager.inspect().activeId, "logs");

  manager.minimize("logs");
  assertEquals(manager.inspect().fullscreenId, undefined);
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "logs")?.minimized, true);
  manager.dispose();
});
