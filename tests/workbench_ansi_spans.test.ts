import { assertEquals } from "./deps.ts";
import {
  type ChangedSpan,
  changedSpansInto,
  snapshotChangedSpans,
  snapshotFrameRow,
} from "../src/app/workbench_ansi_spans.ts";

Deno.test("changedSpansInto emits sparse spans and reuses span objects", () => {
  const spans: ChangedSpan[] = [];
  const pool: ChangedSpan[] = [];
  const first = changedSpansInto(spans, pool, ["A", "B", "C", "D", "E"], ["A", "x", "C", "y", "E"], 5, {
    mergeGap: 0,
  });

  assertEquals(first.map(({ start, end, width }) => ({ start, end, width })), [
    { start: 1, end: 1, width: 1 },
    { start: 3, end: 3, width: 1 },
  ]);
  const firstObject = first[0];

  const second = changedSpansInto(spans, pool, ["A", "B", "C"], ["z", "B", "C"], 3);
  assertEquals(second.map(({ start, end, width }) => ({ start, end, width })), [
    { start: 0, end: 0, width: 1 },
  ]);
  assertEquals(second[0], firstObject);
});

Deno.test("changedSpansInto merges nearby gaps and caps excessive spans", () => {
  const spans: ChangedSpan[] = [];
  const pool: ChangedSpan[] = [];
  const previous = new Array<string>(12).fill(".");
  const next = previous.slice();
  for (const index of [0, 2, 5, 8, 11]) {
    next[index] = "#";
  }

  assertEquals(
    changedSpansInto(spans, pool, previous, next, 12, { mergeGap: 1, maxSpans: 3 }).map((
      { start, end, width },
    ) => ({ start, end, width })),
    [
      { start: 0, end: 2, width: 3 },
      { start: 5, end: 5, width: 1 },
      { start: 8, end: 11, width: 4 },
    ],
  );
});

Deno.test("snapshot helpers preserve row width and update changed spans only", () => {
  const snapshot = snapshotFrameRow(["A", "B"], 4);
  assertEquals(snapshot, ["A", "B", " ", " "]);

  snapshotChangedSpans(["A", "x", "C", "y"], snapshot, [
    { start: 1, end: 1, width: 1 },
    { start: 3, end: 3, width: 1 },
  ]);
  assertEquals(snapshot, ["A", "x", " ", "y"]);

  const reused = snapshotFrameRow(["Q"], 2, snapshot);
  assertEquals(reused, snapshot);
  assertEquals(reused, ["Q", " "]);
});
