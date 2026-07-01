import { assertEquals, assertMatch } from "./deps.ts";
import { formatThreeAsciiFallbackDetail } from "../src/canvas/three_ascii.ts";
import { blockFillGlyphForBucket, bucketAsciiLuminance, glyphForTile } from "../src/three_ascii/glyphs.ts";
import { buildThreeAsciiAnsiGrid, ThreeAsciiAnsiGridAssembler } from "../src/three_ascii/renderer.ts";

Deno.test("ascii luminance keeps empty tiles blank but promotes low non-zero fill to block glyphs", () => {
  assertEquals(bucketAsciiLuminance(0), 0);
  assertEquals(bucketAsciiLuminance(0.01), 0);
  assertEquals(bucketAsciiLuminance(0.02), 1);
  assertEquals(bucketAsciiLuminance(1), 9);
});

Deno.test("block fill glyphs use full-height cells without lower-block banding", () => {
  assertEquals(glyphForTile(-1, 0, false, true), " ");
  assertEquals(glyphForTile(-1, 1, false, true), "█");
  assertEquals(glyphForTile(-1, 9, false, true), "█");

  for (let bucket = 1; bucket <= 9; bucket += 1) {
    assertEquals(/[▁▂▃▄▅▆▇]/u.test(blockFillGlyphForBucket(bucket)), false);
    assertEquals(blockFillGlyphForBucket(bucket), "█");
  }
});

Deno.test("three ascii ANSI grid assembly defaults to block glyphs", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 2,
    rows: 1,
    fillGlyphs: new Float32Array([14, 0]),
    colors: new Float32Array([1, 0, 0, 1, 0, 0, 0, 1]),
    backgroundColor: 0x000000,
  });

  assertEquals(grid.length, 1);
  assertEquals(grid[0].length, 2);
  assertEquals(grid[0][0], "\x1b[48;2;0;0;0m\x1b[38;2;255;0;0m█\x1b[0m");
  assertEquals(grid[0][1], "\x1b[48;2;0;0;0m\x1b[38;2;0;0;0m \x1b[0m");
});

Deno.test("three ascii ANSI grid assembly skips color work for proven blank cells", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 1,
    rows: 1,
    fillGlyphs: new Float32Array([0]),
    edgeGlyphs: new Float32Array([0, 0, 0, 0]),
    colors: new Float32Array([1, 0, 1, 1]),
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], "\x1b[48;2;0;0;0m\x1b[38;2;0;0;0m \x1b[0m");
});

Deno.test("three ascii block grid assembly only blends partial block buckets", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 2,
    rows: 1,
    fillGlyphs: new Float32Array([13, 14]),
    colors: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1]),
    terminalGlyphStyle: "blocks",
    backgroundColor: 0x0000ff,
  });

  assertMatch(grid[0][0], /^\x1b\[48;2;0;0;255m\x1b\[38;2;227;0;28m█\x1b\[0m$/);
  assertEquals(grid[0][1], "\x1b[48;2;0;0;255m\x1b[38;2;255;0;0m█\x1b[0m");
});

Deno.test("three ascii ANSI grid assembly reuses repeated non-adjacent block cells", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 4,
    rows: 1,
    fillGlyphs: new Float32Array([14, 14, 14, 14]),
    colors: new Float32Array([
      1,
      0,
      0,
      1,
      0,
      1,
      0,
      1,
      1,
      0,
      0,
      1,
      0,
      1,
      0,
      1,
    ]),
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], "\x1b[48;2;0;0;0m\x1b[38;2;255;0;0m█\x1b[0m");
  assertEquals(grid[0][1], "\x1b[48;2;0;0;0m\x1b[38;2;0;255;0m█\x1b[0m");
  assertEquals(grid[0][2], grid[0][0]);
  assertEquals(grid[0][3], grid[0][1]);
});

Deno.test("three ascii ANSI grid assembler matches stateless output across frames", () => {
  const input = {
    columns: 3,
    rows: 1,
    fillGlyphs: new Float32Array([14, 10, 0]),
    edgeGlyphs: new Float32Array([0, 0, 0, 0, 1, 16, 24, 0, 0, 0, 0, 0]),
    colors: new Float32Array([
      1,
      0,
      0,
      1,
      0,
      1,
      0,
      1,
      0,
      0,
      1,
      1,
    ]),
    backgroundColor: 0x050607,
  };
  const assembler = new ThreeAsciiAnsiGridAssembler();

  assertEquals(assembler.build(input), buildThreeAsciiAnsiGrid(input));
  assertEquals(assembler.build(input), buildThreeAsciiAnsiGrid(input));
});

Deno.test("three ascii ANSI grid assembler returns fresh grids by default", () => {
  const assembler = new ThreeAsciiAnsiGridAssembler();
  const base = {
    columns: 1,
    rows: 1,
    fillGlyphs: new Float32Array([14]),
    colors: new Float32Array([1, 0, 0, 1]),
    backgroundColor: 0x000000,
  };

  const first = assembler.build(base);
  const second = assembler.build({
    ...base,
    colors: new Float32Array([0, 1, 0, 1]),
  });

  assertEquals(first === second, false);
  assertEquals(first[0] === second[0], false);
  assertEquals(first[0][0], "\x1b[48;2;0;0;0m\x1b[38;2;255;0;0m█\x1b[0m");
  assertEquals(second[0][0], "\x1b[48;2;0;0;0m\x1b[38;2;0;255;0m█\x1b[0m");
});

Deno.test("three ascii ANSI grid assembler can reuse grid storage for renderer-owned frames", () => {
  const assembler = new ThreeAsciiAnsiGridAssembler({ reuseGrid: true });
  const base = {
    columns: 2,
    rows: 1,
    fillGlyphs: new Float32Array([14, 14]),
    colors: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1]),
    backgroundColor: 0x000000,
  };

  const first = assembler.build(base);
  const firstRow = first[0];
  const second = assembler.build({
    ...base,
    columns: 1,
    colors: new Float32Array([0, 1, 0, 1]),
  });

  assertEquals(first === second, true);
  assertEquals(second[0] === firstRow, true);
  assertEquals(second[0].length, 1);
  assertEquals(second[0][0], "\x1b[48;2;0;0;0m\x1b[38;2;0;255;0m█\x1b[0m");
});

Deno.test("three ascii ANSI grid assembler invalidates cached cells when background changes", () => {
  const assembler = new ThreeAsciiAnsiGridAssembler();
  const base = {
    columns: 1,
    rows: 1,
    fillGlyphs: new Float32Array([14]),
    colors: new Float32Array([1, 0, 0, 1]),
  };

  const dark = assembler.build({ ...base, backgroundColor: 0x000000 })[0][0];
  const tinted = assembler.build({ ...base, backgroundColor: 0x010203 })[0][0];

  assertEquals(dark, buildThreeAsciiAnsiGrid({ ...base, backgroundColor: 0x000000 })[0][0]);
  assertEquals(tinted, buildThreeAsciiAnsiGrid({ ...base, backgroundColor: 0x010203 })[0][0]);
  assertEquals(tinted !== dark, true);
});

Deno.test("three ascii fallback detail hides raw GPU validation text", () => {
  assertEquals(
    formatThreeAsciiFallbackDetail(new Error("Buffer with '' label is invalid.")),
    "GPU BACKEND UNAVAILABLE",
  );
  assertEquals(formatThreeAsciiFallbackDetail(new Error("custom renderer failure")), "custom renderer failure");
});
