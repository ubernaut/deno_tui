import { assertEquals } from "./deps.ts";
import { flexRects } from "../src/layout/mod.ts";
import type { Rectangle } from "../src/types.ts";

const bounds: Rectangle = {
  column: 2,
  row: 4,
  width: 40,
  height: 12,
};

Deno.test("public flexRects distributes extra space by grow weight", () => {
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

Deno.test("public flexRects maps columns into vertical slices", () => {
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
