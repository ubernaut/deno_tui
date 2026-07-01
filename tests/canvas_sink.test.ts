import { assertEquals, assertStringIncludes } from "./deps.ts";
import { BoxObject } from "../src/canvas/box.ts";
import {
  AnsiCanvasSink,
  Canvas,
  type CanvasCellUpdate,
  type CanvasRenderStats,
  coalesceCanvasRowRanges,
  MemoryCanvasSink,
} from "../src/canvas/mod.ts";

Deno.test("canvas flushes dirty cells through a pluggable sink", () => {
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({
    sink,
    size: { columns: 4, rows: 2 },
  });
  const box = new BoxObject({
    canvas,
    rectangle: { column: 1, row: 0, width: 2, height: 2 },
    filler: "x",
    style: (text) => text,
    zIndex: 1,
  });

  box.draw();
  canvas.render();

  assertEquals(sink.updates, [
    { row: 0, column: 1, value: "x" },
    { row: 0, column: 2, value: "x" },
    { row: 1, column: 1, value: "x" },
    { row: 1, column: 2, value: "x" },
  ]);
  assertEquals(sink.lastStats?.flushedCells, 4);
  assertEquals(sink.lastStats?.dirtyRowRanges, 2);
  assertEquals(sink.rowRanges, [
    { row: 0, startColumn: 1, values: ["x", "x"] },
    { row: 1, startColumn: 1, values: ["x", "x"] },
  ]);
});

Deno.test("canvas can flush contiguous row ranges through optional sinks", () => {
  const sink = new RangeOnlySink();
  const canvas = new Canvas({
    sink,
    size: { columns: 5, rows: 2 },
  });
  const box = new BoxObject({
    canvas,
    rectangle: { column: 1, row: 0, width: 3, height: 1 },
    filler: "z",
    style: (text) => text,
    zIndex: 1,
  });

  box.draw();
  canvas.render();

  assertEquals(sink.flushCalls, 0);
  assertEquals(sink.ranges, [{ row: 0, startColumn: 1, values: ["z", "z", "z"] }]);
  assertEquals(sink.updates.length, 3);
  assertEquals(sink.stats?.dirtyRowRanges, 1);
});

Deno.test("canvas notifies sinks when size changes", () => {
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({
    sink,
    size: { columns: 4, rows: 2 },
  });

  assertEquals({ columns: sink.columns, rows: sink.rows }, { columns: 4, rows: 2 });

  const size = canvas.size.peek();
  size.columns = 7;
  size.rows = 5;

  assertEquals({ columns: sink.columns, rows: sink.rows }, { columns: 7, rows: 5 });
});

Deno.test("ansi canvas sink preserves stdout terminal output path", () => {
  const chunks: Uint8Array[] = [];
  const sink = new AnsiCanvasSink({
    stdout: {
      writeSync(data) {
        chunks.push(data);
        return data.length;
      },
    },
  });

  sink.flush([
    { row: 0, column: 0, value: "A" },
    { row: 0, column: 1, value: "B" },
    { row: 1, column: 0, value: "C" },
  ], {
    updatedObjects: 0,
    renderedObjects: 0,
    rerenderedObjects: 0,
    intersectionUpdates: 0,
    intersectionCandidateChecks: 0,
    intersectionsDirty: false,
    dirtyRectangles: 0,
    dirtyRowRanges: 2,
    dirtyRows: 0,
    dirtyCells: 3,
    fullRedraws: 0,
    flushedCells: 3,
  });

  const output = new TextDecoder().decode(chunks[0]);
  assertStringIncludes(output, "\x1b[1;1HAB");
  assertStringIncludes(output, "\x1b[2;1HC");
});

Deno.test("coalesceCanvasRowRanges groups sorted adjacent cells only", () => {
  assertEquals(
    coalesceCanvasRowRanges([
      { row: 0, column: 0, value: "A" },
      { row: 0, column: 1, value: "B" },
      { row: 0, column: 3, value: "C" },
      { row: 1, column: 0, value: "D" },
    ]),
    [
      { row: 0, startColumn: 0, values: ["A", "B"] },
      { row: 0, startColumn: 3, values: ["C"] },
      { row: 1, startColumn: 0, values: ["D"] },
    ],
  );
});

class RangeOnlySink {
  readonly ranges: Array<{ row: number; startColumn: number; values: readonly (string | Uint8Array)[] }> = [];
  readonly updates: CanvasCellUpdate[] = [];
  stats?: CanvasRenderStats;
  flushCalls = 0;

  flush(updates: readonly CanvasCellUpdate[], stats: CanvasRenderStats): void {
    this.flushCalls += 1;
    this.updates.push(...updates.map((update) => ({ ...update })));
    this.stats = { ...stats };
  }

  flushRanges(
    ranges: readonly { row: number; startColumn: number; values: readonly (string | Uint8Array)[] }[],
    stats: CanvasRenderStats,
    updates: readonly CanvasCellUpdate[],
  ): void {
    this.ranges.push(...ranges.map((range) => ({ ...range, values: [...range.values] })));
    this.updates.push(...updates.map((update) => ({ ...update })));
    this.stats = { ...stats };
  }
}
