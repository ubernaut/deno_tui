import { assertEquals } from "./deps.ts";
import { DirtyRegion } from "../src/canvas/mod.ts";

Deno.test("DirtyRegion merges overlapping and adjacent row segments", () => {
  const region = new DirtyRegion();
  region.addSegment(2, 8, 12);
  region.addSegment(2, 4, 9);
  region.addSegment(2, 12, 14);
  region.addSegment(1, 0, 2);

  assertEquals(region.inspect(), [
    { row: 1, startColumn: 0, endColumn: 2 },
    { row: 2, startColumn: 4, endColumn: 14 },
  ]);
});

Deno.test("DirtyRegion expands rectangles into clipped row intersections", () => {
  const region = DirtyRegion.fromRectangles([
    { row: 1, column: 3, width: 5, height: 3 },
    { row: 3, column: 6, width: 4, height: 1 },
  ]);

  assertEquals(region.intersects({ row: 0, column: 0, width: 2, height: 2 }), false);
  assertEquals(region.intersects({ row: 2, column: 7, width: 2, height: 1 }), true);
  assertEquals(region.intersections({ row: 2, column: 5, width: 4, height: 3 }), [
    { row: 2, startColumn: 5, endColumn: 8 },
    { row: 3, startColumn: 5, endColumn: 9 },
  ]);
});

Deno.test("DirtyRegion ignores empty dimensions and supports clearing", () => {
  const region = DirtyRegion.fromRectangles([
    { row: 0, column: 0, width: 0, height: 10 },
    { row: 2, column: 4, width: 3, height: 0 },
  ]);

  assertEquals(region.isEmpty(), true);
  region.addSegment(0, 3, 1);
  assertEquals(region.inspect(), [{ row: 0, startColumn: 1, endColumn: 3 }]);
  region.clear();
  assertEquals(region.isEmpty(), true);
});
