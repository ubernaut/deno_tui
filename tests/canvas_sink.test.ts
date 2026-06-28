import { assertEquals, assertStringIncludes } from "./deps.ts";
import { BoxObject } from "../src/canvas/box.ts";
import { AnsiCanvasSink, Canvas, MemoryCanvasSink } from "../src/canvas/mod.ts";

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
    intersectionsDirty: false,
    flushedCells: 3,
  });

  const output = new TextDecoder().decode(chunks[0]);
  assertStringIncludes(output, "\x1b[1;1HAB");
  assertStringIncludes(output, "\x1b[2;1HC");
});
