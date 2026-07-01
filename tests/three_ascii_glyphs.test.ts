import { assertEquals, assertMatch } from "./deps.ts";
import { formatThreeAsciiFallbackDetail } from "../src/canvas/three_ascii.ts";
import { blockFillGlyphForBucket, bucketAsciiLuminance, glyphForTile } from "../src/three_ascii/glyphs.ts";
import { buildThreeAsciiAnsiGrid } from "../src/three_ascii/renderer.ts";

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

Deno.test("three ascii fallback detail hides raw GPU validation text", () => {
  assertEquals(
    formatThreeAsciiFallbackDetail(new Error("Buffer with '' label is invalid.")),
    "GPU BACKEND UNAVAILABLE",
  );
  assertEquals(formatThreeAsciiFallbackDetail(new Error("custom renderer failure")), "custom renderer failure");
});
