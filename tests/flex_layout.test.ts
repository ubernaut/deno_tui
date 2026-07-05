import { assertEquals } from "./deps.ts";
import { flexRects } from "../src/layout/flex_layout.ts";
import type { Rect } from "../app/types.ts";

const bounds: Rect = {
  column: 2,
  row: 4,
  width: 40,
  height: 12,
};

Deno.test("flexRects distributes extra space by grow weight", () => {
  const rects = flexRects(bounds, "row", [
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
  const rects = flexRects(bounds, "column", [
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
