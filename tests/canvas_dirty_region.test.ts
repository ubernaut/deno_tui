import { assertEquals } from "./deps.ts";
import { DirtyRegion, mergeDirtyRowSegmentsInPlace } from "../src/canvas/mod.ts";
import {
  queueRerenderCellInto,
  queueRerenderRangeInto,
  queueRerenderRangeOnlyInto,
} from "../src/canvas/rerender_queue.ts";

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

Deno.test("mergeDirtyRowSegmentsInPlace sorts and compacts retained row queues", () => {
  const ranges = [
    { row: 2, startColumn: 8, endColumn: 12 },
    { row: 2, startColumn: 1, endColumn: 3 },
    { row: 2, startColumn: 3, endColumn: 6 },
    { row: 2, startColumn: 7, endColumn: 8 },
  ];

  mergeDirtyRowSegmentsInPlace(ranges);

  assertEquals(ranges, [
    { row: 2, startColumn: 1, endColumn: 6 },
    { row: 2, startColumn: 7, endColumn: 12 },
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
  const visited: unknown[] = [];
  region.forEachIntersection({ row: 2, column: 5, width: 4, height: 3 }, (segment) => {
    visited.push({ ...segment });
  });
  assertEquals(visited, [
    { row: 2, startColumn: 5, endColumn: 8 },
    { row: 3, startColumn: 5, endColumn: 9 },
  ]);

  const visitedValues: unknown[] = [];
  region.forEachIntersectionValue({ row: 2, column: 5, width: 4, height: 3 }, (row, startColumn, endColumn) => {
    visitedValues.push({ row, startColumn, endColumn });
  });
  assertEquals(visitedValues, [
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

Deno.test("DirtyRegion can reset from rectangle batches", () => {
  const region = DirtyRegion.fromRectangles([{ row: 0, column: 0, width: 10, height: 1 }]);
  assertEquals(region.inspect(), [{ row: 0, startColumn: 0, endColumn: 10 }]);

  region.resetFromRectangles([
    { row: 2, column: 5, width: 3, height: 1 },
    { row: 2, column: 7, width: 4, height: 1 },
  ]);

  assertEquals(region.inspect(), [{ row: 2, startColumn: 5, endColumn: 11 }]);
});

Deno.test("DirtyRegion reset can reuse storage while reporting empty batches", () => {
  const region = DirtyRegion.fromRectangles([
    { row: 0, column: 0, width: 10, height: 2 },
    { row: 4, column: 3, width: 2, height: 1 },
  ]);

  region.resetFromRectangles([]);

  assertEquals(region.isEmpty(), true);
  assertEquals(region.inspect(), []);

  region.resetFromRectangles([{ row: 4, column: 6, width: 3, height: 1 }]);

  assertEquals(region.isEmpty(), false);
  assertEquals(region.inspect(), [{ row: 4, startColumn: 6, endColumn: 9 }]);
});

Deno.test("queueRerenderRangeInto clips ranges to canvas bounds", () => {
  const queue: Array<Set<number> | undefined> = [];
  const result = queueRerenderRangeInto(queue, 1, -2, 4.2, { columns: 4, rows: 3 });

  assertEquals(result, { row: 1, startColumn: 0, endColumn: 4, queuedCells: 4 });
  assertEquals([...queue[1]!], [0, 1, 2, 3]);
});

Deno.test("queueRerenderRangeInto applies optional view clipping", () => {
  const queue: Array<Set<number> | undefined> = [];
  const result = queueRerenderRangeInto(
    queue,
    2,
    0,
    8,
    { columns: 10, rows: 5 },
    { column: 3, row: 1, width: 4, height: 2 },
  );

  assertEquals(result, { row: 2, startColumn: 3, endColumn: 7, queuedCells: 4 });
  assertEquals([...queue[2]!], [3, 4, 5, 6]);
  assertEquals(
    queueRerenderRangeInto(queue, 3, 0, 8, { columns: 10, rows: 5 }, { column: 3, row: 1, width: 4, height: 2 }),
    { row: 3, startColumn: 0, endColumn: 0, queuedCells: 0 },
  );
  assertEquals(queue[3], undefined);
});

Deno.test("queueRerenderRangeInto reports only newly queued cells", () => {
  const queue: Array<Set<number> | undefined> = [];

  assertEquals(queueRerenderRangeInto(queue, 0, 1, 4, { columns: 8, rows: 2 }).queuedCells, 3);
  assertEquals(queueRerenderRangeInto(queue, 0, 2, 6, { columns: 8, rows: 2 }), {
    row: 0,
    startColumn: 2,
    endColumn: 6,
    queuedCells: 2,
  });
  assertEquals([...queue[0]!], [1, 2, 3, 4, 5]);
});

Deno.test("queueRerenderRangeOnlyInto queues clipped ranges without cell expansion", () => {
  const ranges: Array<Array<{ row: number; startColumn: number; endColumn: number }> | undefined> = [];

  assertEquals(
    queueRerenderRangeOnlyInto(ranges, 1, -2, 5.2, { columns: 10, rows: 3 }, {
      column: 2,
      row: 0,
      width: 4,
      height: 2,
    }),
    { row: 1, startColumn: 2, endColumn: 6, queuedCells: 4 },
  );
  assertEquals(ranges[1], [{ row: 1, startColumn: 2, endColumn: 6 }]);
});

Deno.test("queueRerenderCellInto queues one floored fractional cell", () => {
  const queue: Array<Set<number> | undefined> = [];

  assertEquals(queueRerenderCellInto(queue, 2, 1.75, { columns: 8, rows: 4 }), {
    row: 2,
    startColumn: 1,
    endColumn: 2,
    queuedCells: 1,
  });
  assertEquals([...queue[2]!], [1]);
});

Deno.test("queueRerenderRangeInto ignores empty and out-of-bounds ranges", () => {
  const queue: Array<Set<number> | undefined> = [];

  assertEquals(queueRerenderRangeInto(queue, -1, 0, 2, { columns: 4, rows: 2 }).queuedCells, 0);
  assertEquals(queueRerenderRangeInto(queue, 2, 0, 2, { columns: 4, rows: 2 }).queuedCells, 0);
  assertEquals(queueRerenderRangeInto(queue, 0, 3, 3, { columns: 4, rows: 2 }).queuedCells, 0);
  assertEquals(queue, []);
});
