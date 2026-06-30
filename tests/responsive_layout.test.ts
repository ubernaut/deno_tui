import { assertEquals } from "./deps.ts";
import {
  adaptiveGrid,
  adaptiveGridItemRect,
  adaptiveGridPage,
  dockRect,
  insetRect,
  resolveBreakpoint,
  splitRect,
  tileRects,
  WindowManagerController,
} from "../src/layout/mod.ts";

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
