import { assertEquals } from "./deps.ts";
import { applyThreeAsciiRerenderCells, applyThreeAsciiRerenderRanges } from "../src/canvas/three_ascii_ranges.ts";

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
