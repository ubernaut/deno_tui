import { assertEquals } from "./deps.ts";
import { resolveWorkbenchThreeGridProjection, writeWorkbenchThreeGrid } from "../src/app/workbench_three_grid.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";

Deno.test("workbench three grid writes ANSI cells into a frame rectangle", () => {
  const frame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: 2, row: 1, width: 3, height: 2 },
    [["A", "B", "C"], ["D", "E", "F"]],
    ".",
  );

  assertEquals(frame[0], undefined);
  assertEquals(frame[1]?.[0], undefined);
  assertEquals(frame[1]?.[1], undefined);
  assertEquals(frame[1]?.slice(2, 5), ["A", "B", "C"]);
  assertEquals(frame[2]?.[0], undefined);
  assertEquals(frame[2]?.[1], undefined);
  assertEquals(frame[2]?.slice(2, 5), ["D", "E", "F"]);
});

Deno.test("workbench three grid clips negative columns through the safe writer", () => {
  const frame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: -2, row: 0, width: 4, height: 1 },
    [["A", "B", "C", "D"]],
    ".",
  );

  assertEquals(frame[0]?.slice(0, 2), ["C", "D"]);
  assertEquals(Object.hasOwn(frame[0]!, "-1"), false);
});

Deno.test("workbench three grid uses caller-provided fallback cells", () => {
  const frame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 4, height: 2 },
    [["A"], undefined],
    "\x1b[48;2;1;2;3m \x1b[0m",
  );

  assertEquals(frame[0], ["A", "\x1b[48;2;1;2;3m \x1b[0m", "\x1b[48;2;1;2;3m \x1b[0m", "\x1b[48;2;1;2;3m \x1b[0m"]);
  assertEquals(frame[1], [
    "\x1b[48;2;1;2;3m \x1b[0m",
    "\x1b[48;2;1;2;3m \x1b[0m",
    "\x1b[48;2;1;2;3m \x1b[0m",
    "\x1b[48;2;1;2;3m \x1b[0m",
  ]);
});

Deno.test("workbench three grid reuses prepared fallback rows for consecutive empty source rows", () => {
  const frame: WorkbenchFrame = [];
  const rowBuffer: string[] = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 3, height: 3 },
    [],
    ".",
    { rowBuffer },
  );

  assertEquals(frame, [
    [".", ".", "."],
    [".", ".", "."],
    [".", ".", "."],
  ]);
  assertEquals(rowBuffer, [".", ".", "."]);
});

Deno.test("workbench three grid can scale lower-resolution source cells", () => {
  const frame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 4, height: 4 },
    [["A", "B"], ["C", "D"]],
    ".",
    { scale: true },
  );

  assertEquals(frame, [
    ["A", "A", "B", "B"],
    ["A", "A", "B", "B"],
    ["C", "C", "D", "D"],
    ["C", "C", "D", "D"],
  ]);
});

Deno.test("workbench three grid reuses caller-owned row buffers while scaling", () => {
  const frame: WorkbenchFrame = [];
  const rowBuffer = ["stale", "value"];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 4, height: 2 },
    [["A", "B"]],
    ".",
    { scale: true, rowBuffer },
  );

  assertEquals(frame, [
    ["A", "A", "B", "B"],
    ["A", "A", "B", "B"],
  ]);
  assertEquals(rowBuffer, ["A", "A", "B", "B"]);
});

Deno.test("workbench three grid direct-copies rows for vertical-only scaling", () => {
  const frame: WorkbenchFrame = [];
  const rowBuffer = ["stale", "value"];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 3, height: 4 },
    [["A", "B", "C"], ["D", "E", "F"]],
    ".",
    { scale: true, rowBuffer },
  );

  assertEquals(frame, [
    ["A", "B", "C"],
    ["A", "B", "C"],
    ["D", "E", "F"],
    ["D", "E", "F"],
  ]);
  assertEquals(rowBuffer, ["stale", "value"]);
});

Deno.test("workbench three grid reuses caller-owned scale index buffers", () => {
  const frame: WorkbenchFrame = [];
  const sourceRowIndexes: number[] = [];
  const sourceColumnIndexes: number[] = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 4, height: 4 },
    [["A", "B"], ["C", "D"]],
    ".",
    { scale: true, sourceColumns: 2, sourceRowIndexes, sourceColumnIndexes },
  );

  assertEquals(frame, [
    ["A", "A", "B", "B"],
    ["A", "A", "B", "B"],
    ["C", "C", "D", "D"],
    ["C", "C", "D", "D"],
  ]);
  assertEquals(sourceRowIndexes, [0, 0, 1, 1]);
  assertEquals(sourceColumnIndexes, [0, 0, 1, 1]);
});

Deno.test("workbench three grid refreshes retained scale indexes after dimension changes", () => {
  const sourceRowIndexes: number[] = [];
  const sourceColumnIndexes: number[] = [];
  const firstFrame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    firstFrame,
    { column: 0, row: 0, width: 4, height: 4 },
    [["A", "B"], ["C", "D"]],
    ".",
    { scale: true, sourceColumns: 2, sourceRowIndexes, sourceColumnIndexes },
  );
  assertEquals(sourceRowIndexes, [0, 0, 1, 1]);
  assertEquals(sourceColumnIndexes, [0, 0, 1, 1]);

  const secondFrame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    secondFrame,
    { column: 0, row: 0, width: 3, height: 3 },
    [["A", "B", "C"], ["D", "E", "F"], ["G", "H", "I"]],
    ".",
    { scale: true, sourceColumns: 3, sourceRowIndexes, sourceColumnIndexes },
  );

  assertEquals(secondFrame, [
    ["A", "B", "C"],
    ["D", "E", "F"],
    ["G", "H", "I"],
  ]);
  assertEquals(sourceRowIndexes, [0, 1, 2]);
  assertEquals(sourceColumnIndexes, [0, 1, 2]);
});

Deno.test("workbench three grid direct-copies scaled rows when source-column hints match target width", () => {
  const frame: WorkbenchFrame = [];
  const rowBuffer = ["unused"];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 2, height: 4 },
    [["A", "B", "hidden"], ["C", "D", "hidden"]],
    ".",
    { scale: true, sourceColumns: 2, rowBuffer },
  );

  assertEquals(frame, [
    ["A", "B"],
    ["A", "B"],
    ["C", "D"],
    ["C", "D"],
  ]);
  assertEquals(rowBuffer, ["unused"]);
});

Deno.test("workbench three grid source column hints avoid scanning wider hidden rows", () => {
  const frame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 4, height: 4 },
    [["A", "B"], ["C", "D", "E", "F", "G", "H"]],
    ".",
    { scale: "down", sourceColumns: 2 },
  );

  assertEquals(frame[0], undefined);
  assertEquals(frame[1]?.slice(1, 3), ["A", "B"]);
  assertEquals(frame[2]?.slice(1, 3), ["C", "D"]);
  assertEquals(frame[3], undefined);
});

Deno.test("workbench three grid scales ragged rows by each row width without source hints", () => {
  const frame: WorkbenchFrame = [];
  writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 4, height: 2 },
    [["A", "B"], ["C", "D", "E", "F"]],
    ".",
    { scale: true },
  );

  assertEquals(frame, [
    ["A", "A", "B", "B"],
    ["C", "D", "E", "F"],
  ]);
});

Deno.test("workbench three grid scale-down mode centers capped grids instead of scaling up", () => {
  const frame: WorkbenchFrame = [];
  const projection = writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 4, height: 4 },
    [["A", "B"], ["C", "D"]],
    ".",
    { scale: "down" },
  );

  assertEquals(frame[0], undefined);
  assertEquals(frame[1]?.[0], undefined);
  assertEquals(frame[1]?.slice(1, 3), ["A", "B"]);
  assertEquals(frame[2]?.[0], undefined);
  assertEquals(frame[2]?.slice(1, 3), ["C", "D"]);
  assertEquals(frame[3], undefined);
  assertEquals(projection, {
    sourceRows: 2,
    sourceColumns: 2,
    targetHeight: 2,
    targetWidth: 2,
    rowOffset: 1,
    columnOffset: 1,
    scaled: false,
    capped: true,
  });
});

Deno.test("workbench three grid scale-down mode still scales oversized grids into the target", () => {
  const frame: WorkbenchFrame = [];
  const projection = writeWorkbenchThreeGrid(
    frame,
    { column: 0, row: 0, width: 2, height: 2 },
    [
      ["A", "B", "C", "D"],
      ["E", "F", "G", "H"],
      ["I", "J", "K", "L"],
      ["M", "N", "O", "P"],
    ],
    ".",
    { scale: "down" },
  );

  assertEquals(frame, [
    ["A", "C"],
    ["I", "K"],
  ]);
  assertEquals(projection, {
    sourceRows: 4,
    sourceColumns: 4,
    targetHeight: 2,
    targetWidth: 2,
    rowOffset: 0,
    columnOffset: 0,
    scaled: true,
    capped: false,
  });
});

Deno.test("workbench three grid ignores empty rectangles", () => {
  const frame: WorkbenchFrame = [["keep"]];
  assertEquals(writeWorkbenchThreeGrid(frame, { column: 0, row: 0, width: 0, height: 2 }, [["A"]], "."), undefined);
  assertEquals(writeWorkbenchThreeGrid(frame, { column: 0, row: 0, width: 2, height: 0 }, [["B"]], "."), undefined);

  assertEquals(frame, [["keep"]]);
});

Deno.test("workbench three grid projection honors source column hints", () => {
  assertEquals(
    resolveWorkbenchThreeGridProjection(
      { width: 4, height: 4 },
      [["A", "B"], ["C", "D", "E", "F", "G"]],
      { scale: "down", sourceColumns: 2 },
    ),
    {
      sourceRows: 2,
      sourceColumns: 2,
      targetHeight: 2,
      targetWidth: 2,
      rowOffset: 1,
      columnOffset: 1,
      scaled: false,
      capped: true,
    },
  );
});
