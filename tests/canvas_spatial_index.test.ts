import { assertEquals } from "./deps.ts";
import { BoxObject, DrawObjectSpatialIndex } from "../src/canvas/mod.ts";
import { createTestCanvas } from "../src/testing/mod.ts";

Deno.test("DrawObjectSpatialIndex returns unique row-overlap candidates", () => {
  const canvas = createTestCanvas({ size: { columns: 80, rows: 20 } });
  const top = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 0, width: 8, height: 3 },
    style: (text: string) => text,
    zIndex: 1,
  });
  const middle = new BoxObject({
    canvas,
    rectangle: { column: 10, row: 2, width: 8, height: 4 },
    style: (text: string) => text,
    zIndex: 2,
  });
  const bottom = new BoxObject({
    canvas,
    rectangle: { column: 30, row: 12, width: 8, height: 3 },
    style: (text: string) => text,
    zIndex: 3,
  });

  const index = DrawObjectSpatialIndex.fromObjects([top, middle, bottom]);

  assertEquals(index.query({ column: 0, row: 2, width: 80, height: 1 }), [top, middle]);
  assertEquals(index.query({ column: 0, row: 10, width: 80, height: 2 }), []);
  assertEquals(index.query({ column: 0, row: 12, width: 80, height: 6 }), [bottom]);
  assertEquals(index.inspect(), { objects: 3, rows: 9, rowEntries: 10 });
});

Deno.test("DrawObjectSpatialIndex ignores empty and out-of-bounds objects", () => {
  const canvas = createTestCanvas({ size: { columns: 12, rows: 4 } });
  const visible = new BoxObject({
    canvas,
    rectangle: { column: 0, row: 1, width: 4, height: 2 },
    style: (text: string) => text,
    zIndex: 1,
  });
  const empty = new BoxObject({
    canvas,
    rectangle: { column: 3, row: 1, width: 0, height: 2 },
    style: (text: string) => text,
    zIndex: 2,
  });
  const hidden = new BoxObject({
    canvas,
    rectangle: { column: 30, row: 30, width: 4, height: 2 },
    style: (text: string) => text,
    zIndex: 3,
  });
  hidden.outOfBounds = true;

  const index = DrawObjectSpatialIndex.fromObjects([visible, empty, hidden]);

  assertEquals(index.query({ column: 0, row: 0, width: 12, height: 4 }), [visible]);
  assertEquals(index.inspect(), { objects: 1, rows: 2, rowEntries: 2 });
});
