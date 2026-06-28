import { assertEquals } from "./deps.ts";
import {
  adaptiveGrid,
  adaptiveGridItemRect,
  adaptiveGridPage,
  dockRect,
  insetRect,
  resolveBreakpoint,
  splitRect,
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
