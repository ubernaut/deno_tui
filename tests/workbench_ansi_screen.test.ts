import { assertEquals, assertStringIncludes } from "./deps.ts";
import { WorkbenchAnsiScreenPainter } from "../src/app/workbench_ansi_screen.ts";
import { renderFrameRow, renderFrameSlice, type WorkbenchFrame, writeFrame } from "../src/app/workbench_frame.ts";

Deno.test("WorkbenchAnsiScreenPainter writes only changed ANSI rows", () => {
  const chunks: Uint8Array[] = [];
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      chunks.push(data);
      return data.byteLength;
    },
  });
  const renderRow = (cells: string[], width: number) => {
    const text = cells.join("");
    return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
  };

  assertFlushStats(painter.flush([["A"], ["\x1b[31mB\x1b[0m"]], 4, 2, renderRow), {
    rows: 2,
    changed: 2,
    cleared: 0,
    bytes: chunks[0]!.byteLength,
  });
  assertStringIncludes(new TextDecoder().decode(chunks[0]), "\x1b[1;1HA   \x1b[2;1H\x1b[3");

  chunks.length = 0;
  assertFlushStats(painter.flush([["A"], ["\x1b[31mB\x1b[0m"]], 4, 2, renderRow), {
    rows: 2,
    changed: 0,
    cleared: 0,
    bytes: 0,
  });
  assertEquals(chunks.length, 0);

  assertFlushStats(painter.flush([["A"], ["C"]], 4, 2, renderRow), {
    rows: 2,
    changed: 1,
    cleared: 0,
    bytes: chunks[0]!.byteLength,
  });
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[2;1HC   ");
});

Deno.test("WorkbenchAnsiScreenPainter clears stale rows after shrink", () => {
  const chunks: Uint8Array[] = [];
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      chunks.push(data);
      return data.byteLength;
    },
  });
  const renderRow = (cells: string[], width: number) => cells.join("").padEnd(width, " ");

  painter.flush([["one"], ["two"], ["three"]], 5, 3, renderRow);
  chunks.length = 0;

  assertFlushStats(painter.flush([["one"]], 5, 1, renderRow), {
    rows: 1,
    changed: 0,
    cleared: 2,
    bytes: chunks[0]!.byteLength,
  });
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[2;1H     \x1b[3;1H     ");
});

Deno.test("WorkbenchAnsiScreenPainter clears stale rows with the current width after resize", () => {
  const chunks: Uint8Array[] = [];
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      chunks.push(data);
      return data.byteLength;
    },
  });
  const renderRow = (cells: string[], width: number) => cells.join("").padEnd(width, " ");

  painter.flush([["one"], ["two"]], 5, 2, renderRow);
  painter.flush([["one"]], 5, 1, renderRow);
  chunks.length = 0;

  painter.flush([["wide"], ["row"]], 8, 2, renderRow);
  chunks.length = 0;
  painter.reset();
  painter.flush([["wide"], ["row"]], 8, 2, renderRow);
  chunks.length = 0;

  const stats = painter.flush([["wide"]], 8, 1, renderRow);
  assertEquals(stats.cleared, 1);
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[2;1H        ");
});

Deno.test("WorkbenchAnsiScreenPainter reuses rendered rows when frame cells are unchanged", () => {
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      return data.byteLength;
    },
  });
  const frame: WorkbenchFrame = [[]];
  const row = frame[0]!;
  writeFrame(frame, 3, 0, 0, "AB");
  let renderCalls = 0;
  const renderRow = (cells: string[], width: number) => {
    renderCalls += 1;
    return cells.join("").padEnd(width, " ");
  };

  painter.flush(frame, 3, 1, renderRow);
  painter.flush(frame, 3, 1, renderRow);
  assertEquals(renderCalls, 1);

  writeFrame(frame, 3, 0, 1, "C");
  painter.flush(frame, 3, 1, renderRow);
  assertEquals(renderCalls, 2);
});

Deno.test("WorkbenchAnsiScreenPainter can flush only changed row spans", () => {
  const chunks: Uint8Array[] = [];
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      chunks.push(data);
      return data.byteLength;
    },
  });
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 12, 0, 0, "hello world!");

  painter.flush(frame, 12, 1, renderFrameRow, renderFrameSlice);
  chunks.length = 0;

  writeFrame(frame, 12, 0, 6, "W");
  const stats = painter.flush(frame, 12, 1, renderFrameRow, renderFrameSlice);
  assertEquals(stats.changed, 1);
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[1;7HW");
  assertEquals(stats.bytes < "\x1b[1;1Hhello World!".length, true);
});

Deno.test("WorkbenchAnsiScreenPainter skips span detection for clean unchanged rows", () => {
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      return data.byteLength;
    },
  });
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 12, 0, 0, "hello world!");
  let sliceCalls = 0;
  const renderSliceWithCount = (cells: string[], start: number, width: number) => {
    sliceCalls += 1;
    return renderFrameSlice(cells, start, width);
  };

  painter.flush(frame, 12, 1, renderFrameRow, renderSliceWithCount);
  assertEquals(sliceCalls, 0);

  writeFrame(frame, 12, 0, 6, "W");
  painter.flush(frame, 12, 1, renderFrameRow, renderSliceWithCount);
  assertEquals(sliceCalls, 1);

  const stats = painter.flush(frame, 12, 1, renderFrameRow, renderSliceWithCount);
  assertEquals(stats.changed, 0);
  assertEquals(stats.bytes, 0);
  assertEquals(sliceCalls, 1);
});

Deno.test("WorkbenchAnsiScreenPainter redraws safely after switching from span to full-row mode", () => {
  const chunks: Uint8Array[] = [];
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      chunks.push(data);
      return data.byteLength;
    },
  });
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 8, 0, 0, "abcdefgh");
  painter.flush(frame, 8, 1, renderFrameRow, renderFrameSlice);
  chunks.length = 0;

  writeFrame(frame, 8, 0, 3, "Z");
  painter.flush(frame, 8, 1, renderFrameRow, renderFrameSlice);
  chunks.length = 0;

  const stats = painter.flush(frame, 8, 1, renderFrameRow);
  assertEquals(stats.changed, 1);
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[1;1HabcZefgh");
});

Deno.test("WorkbenchAnsiScreenPainter keeps retained span snapshots valid across disjoint edits", () => {
  const chunks: Uint8Array[] = [];
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      chunks.push(data);
      return data.byteLength;
    },
  });
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 10, 0, 0, "0123456789");
  painter.flush(frame, 10, 1, renderFrameRow, renderFrameSlice);
  chunks.length = 0;

  writeFrame(frame, 10, 0, 2, "A");
  painter.flush(frame, 10, 1, renderFrameRow, renderFrameSlice);
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[1;3HA");
  chunks.length = 0;

  writeFrame(frame, 10, 0, 7, "B");
  const stats = painter.flush(frame, 10, 1, renderFrameRow, renderFrameSlice);
  assertEquals(stats.changed, 1);
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[1;8HB");
});

Deno.test("WorkbenchAnsiScreenPainter emits separate spans for sparse same-row edits", () => {
  const chunks: Uint8Array[] = [];
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      chunks.push(data);
      return data.byteLength;
    },
  });
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 16, 0, 0, "0123456789abcdef");
  painter.flush(frame, 16, 1, renderFrameRow, renderFrameSlice);
  chunks.length = 0;

  writeFrame(frame, 16, 0, 1, "A");
  writeFrame(frame, 16, 0, 12, "B");
  const stats = painter.flush(frame, 16, 1, renderFrameRow, renderFrameSlice);

  assertEquals(stats.changed, 1);
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[1;2HA\x1b[1;13HB");
  assertEquals(stats.bytes < "\x1b[1;2HA23456789abB".length, true);
});

Deno.test("WorkbenchAnsiScreenPainter resets retained span state safely", () => {
  const chunks: Uint8Array[] = [];
  const painter = new WorkbenchAnsiScreenPainter({
    writeSync(data) {
      chunks.push(data);
      return data.byteLength;
    },
  });
  const frame: WorkbenchFrame = [[]];
  writeFrame(frame, 12, 0, 0, "abcdefghijkl");
  painter.flush(frame, 12, 1, renderFrameRow, renderFrameSlice);

  chunks.length = 0;
  painter.reset();
  const stats = painter.flush(frame, 12, 1, renderFrameRow, renderFrameSlice);

  assertEquals(stats.changed, 1);
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[1;1Habcdefghijkl");
});

function assertFlushStats(
  actual: { rows: number; changed: number; cleared: number; bytes: number; durationMs: number },
  expected: { rows: number; changed: number; cleared: number; bytes: number },
): void {
  assertEquals({
    rows: actual.rows,
    changed: actual.changed,
    cleared: actual.cleared,
    bytes: actual.bytes,
  }, expected);
  assertEquals(actual.durationMs >= 0, true);
}
