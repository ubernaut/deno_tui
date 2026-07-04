import { assertEquals, assertStringIncludes } from "./deps.ts";
import { WorkbenchAnsiScreenPainter } from "../src/app/workbench_ansi_screen.ts";

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

  assertEquals(painter.flush([["A"], ["\x1b[31mB\x1b[0m"]], 4, 2, renderRow), {
    rows: 2,
    changed: 2,
    cleared: 0,
    bytes: chunks[0]!.byteLength,
  });
  assertStringIncludes(new TextDecoder().decode(chunks[0]), "\x1b[1;1HA   \x1b[2;1H\x1b[3");

  chunks.length = 0;
  assertEquals(painter.flush([["A"], ["\x1b[31mB\x1b[0m"]], 4, 2, renderRow), {
    rows: 2,
    changed: 0,
    cleared: 0,
    bytes: 0,
  });
  assertEquals(chunks.length, 0);

  assertEquals(painter.flush([["A"], ["C"]], 4, 2, renderRow), {
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

  assertEquals(painter.flush([["one"]], 5, 1, renderRow), {
    rows: 1,
    changed: 0,
    cleared: 2,
    bytes: chunks[0]!.byteLength,
  });
  assertEquals(new TextDecoder().decode(chunks[0]), "\x1b[2;1H     \x1b[3;1H     ");
});
