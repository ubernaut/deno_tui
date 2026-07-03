import { assertEquals } from "./deps.ts";
import {
  queueRerenderCellInto,
  queueRerenderRangeInto,
  queueRerenderRangeOnlyInto,
} from "../src/canvas/rerender_queue.ts";

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
