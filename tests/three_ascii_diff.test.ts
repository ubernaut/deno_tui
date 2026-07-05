import { assertEquals } from "./deps.ts";
import {
  clearThreeAsciiGridDiffState,
  createThreeAsciiGridDiffState,
  queueChangedThreeAsciiGridCells,
} from "../src/canvas/three_ascii_diff.ts";
import { applyThreeAsciiRerenderCells, applyThreeAsciiRerenderRanges } from "../src/canvas/three_ascii_ranges.ts";

Deno.test("three ascii grid diff queues initial visible cells and suppresses unchanged frames", () => {
  const previous = createThreeAsciiGridDiffState();
  const rerenderCells: Array<Set<number> | undefined> = [];
  const grid = [["A", "B"], ["C", "D"]];
  const changed = queueChangedThreeAsciiGridCells(
    grid,
    { column: 1, row: 2, width: 2, height: 2 },
    { columns: 8, rows: 8 },
    rerenderCells,
    previous,
  );

  assertEquals(changed, true);
  assertEquals([...rerenderCells[2]!], [1, 2]);
  assertEquals([...rerenderCells[3]!], [1, 2]);

  rerenderCells.length = 0;
  assertEquals(
    queueChangedThreeAsciiGridCells(
      grid,
      { column: 1, row: 2, width: 2, height: 2 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
    ),
    false,
  );
  assertEquals(rerenderCells.length, 0);
});

Deno.test("three ascii grid diff clips changed cells to the active view", () => {
  const previous = createThreeAsciiGridDiffState();
  const rerenderCells: Array<Set<number> | undefined> = [];

  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A", "B", "C"], ["D", "E", "F"]],
      { column: 0, row: 0, width: 3, height: 2 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
      { column: 1, row: 0, width: 1, height: 1 },
    ),
    true,
  );

  assertEquals([...rerenderCells[0]!], [1]);
  assertEquals(rerenderCells[1], undefined);
});

Deno.test("three ascii grid diff queues fully visible ranges without cell expansion", () => {
  const previous = createThreeAsciiGridDiffState();
  const rerenderCells: Array<Set<number> | undefined> = [];
  const rerenderRanges: Array<Array<{ row: number; startColumn: number; endColumn: number }> | undefined> = [];

  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A", "B", "C"], ["D", "E", "F"]],
      { column: 2, row: 1, width: 3, height: 2 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
      undefined,
      rerenderRanges,
    ),
    true,
  );

  assertEquals(rerenderCells.length, 0);
  assertEquals(rerenderRanges[1], [{ row: 1, startColumn: 2, endColumn: 5 }]);
  assertEquals(rerenderRanges[2], [{ row: 2, startColumn: 2, endColumn: 5 }]);

  rerenderRanges.length = 0;
  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A", "B", "C"], ["D", "Z", "F"]],
      { column: 2, row: 1, width: 3, height: 2 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
      undefined,
      rerenderRanges,
    ),
    true,
  );
  assertEquals(rerenderRanges[2], [{ row: 2, startColumn: 3, endColumn: 4 }]);
});

Deno.test("three ascii grid diff queues full visible ranges after cache invalidation", () => {
  const previous = createThreeAsciiGridDiffState();
  const rerenderCells: Array<Set<number> | undefined> = [];
  const rerenderRanges: Array<Array<{ row: number; startColumn: number; endColumn: number }> | undefined> = [];

  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A", "B"], ["C", "D"]],
      { column: 1, row: 1, width: 2, height: 2 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
      undefined,
      rerenderRanges,
    ),
    true,
  );
  assertEquals(rerenderRanges[1], [{ row: 1, startColumn: 1, endColumn: 3 }]);
  assertEquals(rerenderRanges[2], [{ row: 2, startColumn: 1, endColumn: 3 }]);

  rerenderRanges.length = 0;
  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A", "B", "E"], ["C", "D", "F"]],
      { column: 1, row: 1, width: 3, height: 2 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
      undefined,
      rerenderRanges,
    ),
    true,
  );
  assertEquals(rerenderRanges[1], [{ row: 1, startColumn: 1, endColumn: 4 }]);
  assertEquals(rerenderRanges[2], [{ row: 2, startColumn: 1, endColumn: 4 }]);

  rerenderRanges.length = 0;
  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A", "B", "E"], ["C", "D", "F"]],
      { column: 1, row: 1, width: 3, height: 2 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
      undefined,
      rerenderRanges,
    ),
    false,
  );
  assertEquals(rerenderRanges.length, 0);
});

Deno.test("three ascii grid diff keeps sparse row fallback cells stable", () => {
  const previous = createThreeAsciiGridDiffState();
  const rerenderCells: Array<Set<number> | undefined> = [];

  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A"], undefined, ["B", "C"]],
      { column: 0, row: 0, width: 3, height: 3 },
      { columns: 4, rows: 4 },
      rerenderCells,
      previous,
    ),
    true,
  );
  assertEquals([...rerenderCells[0]!], [0, 1, 2]);
  assertEquals([...rerenderCells[1]!], [0, 1, 2]);
  assertEquals([...rerenderCells[2]!], [0, 1, 2]);

  rerenderCells.length = 0;
  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A", " ", " "], [" ", " ", " "], ["B", "C", " "]],
      { column: 0, row: 0, width: 3, height: 3 },
      { columns: 4, rows: 4 },
      rerenderCells,
      previous,
    ),
    false,
  );
  assertEquals(rerenderCells.length, 0);
});

Deno.test("three ascii grid diff clears retained state and supports fractional fallback queuing", () => {
  const previous = createThreeAsciiGridDiffState();
  const rerenderCells: Array<Set<number> | undefined> = [];

  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A"]],
      { column: 1.5, row: 2.25, width: 1, height: 1 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
    ),
    true,
  );
  assertEquals([...rerenderCells[2]!], [1]);
  rerenderCells.length = 0;
  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A"]],
      { column: 1.5, row: 2.25, width: 1, height: 1 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
    ),
    false,
  );

  clearThreeAsciiGridDiffState(previous);
  assertEquals(
    queueChangedThreeAsciiGridCells(
      [["A"]],
      { column: 1.5, row: 2.25, width: 1, height: 1 },
      { columns: 8, rows: 8 },
      rerenderCells,
      previous,
    ),
    true,
  );
});

Deno.test("applyThreeAsciiRerenderRanges copies clipped ranges and queues direct spans", () => {
  const frameRow: string[] = [];
  const directRanges: Array<{ row: number; startColumn: number; endColumn: number }> = [];

  applyThreeAsciiRerenderRanges({
    frameRow,
    outputRow: ["A", "B", "C", "D"],
    ranges: [{ row: 2, startColumn: 1, endColumn: 6 }],
    row: 2,
    rectangleColumn: 2,
    columnLimit: 5,
    directRanges,
  });

  assertEquals([frameRow[0], frameRow[1], frameRow[2], frameRow[3], frameRow[4], frameRow[5]], [
    undefined,
    undefined,
    "A",
    "B",
    "C",
    undefined,
  ]);
  assertEquals(directRanges, [{ row: 2, startColumn: 2, endColumn: 5 }]);
});

Deno.test("applyThreeAsciiRerenderRanges falls back to cells when omissions are present", () => {
  const frameRow: string[] = [];
  const directRanges: Array<{ row: number; startColumn: number; endColumn: number }> = [];
  const fallbackCells = new Set<number>();

  applyThreeAsciiRerenderRanges({
    frameRow,
    outputRow: ["A", "B", "C", "D"],
    ranges: [{ row: 3, startColumn: 2, endColumn: 6 }],
    row: 3,
    rectangleColumn: 2,
    columnLimit: 6,
    omitColumns: new Set([3]),
    directRanges,
    fallbackCells,
  });

  assertEquals([frameRow[0], frameRow[1], frameRow[2], frameRow[3], frameRow[4], frameRow[5]], [
    undefined,
    undefined,
    "A",
    undefined,
    "C",
    "D",
  ]);
  assertEquals(directRanges, []);
  assertEquals([...fallbackCells], [2, 4, 5]);
});

Deno.test("applyThreeAsciiRerenderRanges uses blank fallback for sparse output rows", () => {
  const frameRow: string[] = [];
  const directRanges: Array<{ row: number; startColumn: number; endColumn: number }> = [];

  applyThreeAsciiRerenderRanges({
    frameRow,
    outputRow: ["A"],
    ranges: [{ row: 0, startColumn: 0, endColumn: 3 }],
    row: 0,
    rectangleColumn: 0,
    columnLimit: 3,
    directRanges,
  });

  assertEquals(frameRow.slice(0, 3), ["A", " ", " "]);
  assertEquals(directRanges, [{ row: 0, startColumn: 0, endColumn: 3 }]);
});

Deno.test("applyThreeAsciiRerenderCells copies clipped cells and records queued columns", () => {
  const frameRow: string[] = [];
  const queueCells = new Set<number>();

  applyThreeAsciiRerenderCells({
    frameRow,
    outputRow: ["A", "B", "C", "D"],
    columns: new Set([1, 2, 3, 4, 5]),
    rectangleColumn: 2,
    columnLimit: 5,
    queueCells,
  });

  assertEquals([frameRow[1], frameRow[2], frameRow[3], frameRow[4], frameRow[5]], [
    undefined,
    "A",
    "B",
    "C",
    undefined,
  ]);
  assertEquals([...queueCells], [2, 3, 4]);
});

Deno.test("applyThreeAsciiRerenderCells respects omissions and sparse output fallback", () => {
  const frameRow: string[] = [];
  const queueCells = new Set<number>();

  applyThreeAsciiRerenderCells({
    frameRow,
    outputRow: ["A"],
    columns: new Set([0, 1, 2]),
    rectangleColumn: 0,
    columnLimit: 3,
    omitColumns: new Set([1]),
    queueCells,
  });

  assertEquals([frameRow[0], frameRow[1], frameRow[2]], ["A", undefined, " "]);
  assertEquals([...queueCells], [0, 2]);
});
