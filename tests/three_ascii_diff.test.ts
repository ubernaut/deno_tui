import { assertEquals } from "./deps.ts";
import {
  clearThreeAsciiGridDiffState,
  createThreeAsciiGridDiffState,
  queueChangedThreeAsciiGridCells,
} from "../src/canvas/three_ascii_diff.ts";

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
