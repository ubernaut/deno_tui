import { assertEquals } from "./deps.ts";
import { Color } from "three";
import {
  layoutThreeAsciiDemoWindow,
  THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_TEXT,
  THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT,
  threeAsciiDemoBodyRect,
  threeAsciiDemoControlRect,
  threeAsciiDemoControlText,
  threeAsciiDemoSidePanelVisible,
  threeAsciiDemoTitlebarControlAt,
  threeAsciiDemoTitleRect,
} from "../app/types.ts";
import { buildFallbackGrid, formatThreeAsciiFallbackDetail } from "../src/canvas/three_ascii.ts";
import { blockFillGlyphForBucket, bucketAsciiLuminance, glyphForTile } from "../src/three_ascii/glyphs.ts";
import { buildThreeAsciiAnsiGrid, ThreeAsciiAnsiGridAssembler } from "../src/three_ascii/renderer.ts";
import { stripAnsi } from "../src/utils/ansi_text.ts";

const blockCell = (red: number, green: number, blue: number) =>
  `\x1b[48;2;${red};${green};${blue}m\x1b[38;2;${red};${green};${blue}m█\x1b[0m`;
const blankCell = (red: number, green: number, blue: number) => `\x1b[48;2;${red};${green};${blue}m \x1b[0m`;

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
  assertEquals(grid[0][0], blockCell(255, 0, 0));
  assertEquals(grid[0][1], blankCell(0, 0, 0));
});

Deno.test("three ascii ANSI grid assembly keeps sparse fill-only fallback", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 2,
    rows: 1,
    fillGlyphs: { length: 1, 0: 14 } as ArrayLike<number>,
    colors: { length: 4, 0: 1, 1: 0, 2: 0, 3: 1 } as ArrayLike<number>,
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], blockCell(255, 0, 0));
  assertEquals(grid[0][1], blankCell(0, 0, 0));
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

  assertEquals(grid[0][0], blankCell(0, 0, 0));
});

Deno.test("three ascii block grid assembly paints full cells with source truecolor", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 2,
    rows: 1,
    fillGlyphs: new Float32Array([13, 14]),
    colors: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1]),
    terminalGlyphStyle: "blocks",
    backgroundColor: 0x0000ff,
  });

  assertEquals(grid[0][0], blockCell(255, 0, 0));
  assertEquals(grid[0][1], blockCell(255, 0, 0));
});

Deno.test("three ascii dense block grid assembly fills same-color visible runs", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 5,
    rows: 1,
    fillGlyphs: new Float32Array([14, 13, 5, 14, 14]),
    colors: new Float32Array([
      0.5,
      0.25,
      1,
      1,
      0.5,
      0.25,
      1,
      1,
      1,
      0,
      0,
      1,
      0,
      1,
      0,
      1,
      0,
      1,
      0,
      1,
    ]),
    terminalGlyphStyle: "blocks",
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], blockCell(188, 137, 255));
  assertEquals(grid[0][1], grid[0][0]);
  assertEquals(grid[0][2], blankCell(0, 0, 0));
  assertEquals(grid[0][3], blockCell(0, 255, 0));
  assertEquals(grid[0][4], grid[0][3]);
});

Deno.test("three ascii block mode preserves truecolor backgrounds for low visible fill buckets", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 2,
    rows: 1,
    fillGlyphs: new Float32Array([6, 5]),
    colors: new Float32Array([0.25, 0.5, 1, 1, 1, 0.2, 0, 1]),
    terminalGlyphStyle: "blocks",
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], blockCell(137, 188, 255));
  assertEquals(grid[0][0].includes("\x1b[38;2;"), true);
  assertEquals(grid[0][1], blankCell(0, 0, 0));
  assertEquals(grid[0][1].includes("\x1b[38;2;"), false);
});

Deno.test("three ascii block mode preserves rounded visibility threshold", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 4,
    rows: 1,
    fillGlyphs: new Float32Array([5.49, 5.5, 5.51, Number.NaN]),
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
      1,
      1,
      0,
      1,
    ]),
    terminalGlyphStyle: "blocks",
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], blankCell(0, 0, 0));
  assertEquals(grid[0][1], blockCell(0, 255, 0));
  assertEquals(grid[0][2], blockCell(0, 0, 255));
  assertEquals(grid[0][3], blockCell(255, 255, 0));
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

  assertEquals(grid[0][0], blockCell(255, 0, 0));
  assertEquals(grid[0][1], blockCell(0, 255, 0));
  assertEquals(grid[0][2], grid[0][0]);
  assertEquals(grid[0][3], grid[0][1]);
});

Deno.test("three ascii block mode keeps full-cell backgrounds without quantizing truecolor", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 4,
    rows: 1,
    fillGlyphs: new Float32Array([6, 7, 11, 14]),
    colors: new Float32Array([
      0,
      1,
      0,
      1,
      0,
      1,
      0,
      1,
      0,
      1,
      0,
      1,
      0,
      1,
      0,
      1,
    ]),
    terminalGlyphStyle: "blocks",
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], blockCell(0, 255, 0));
  assertEquals(grid[0][1], blockCell(0, 255, 0));
  assertEquals(grid[0][2], blockCell(0, 255, 0));
  assertEquals(grid[0][3], blockCell(0, 255, 0));
});

Deno.test("three ascii block mode treats visible fill buckets as the same full-cell block", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 3,
    rows: 1,
    fillGlyphs: new Float32Array([6, 10, 14]),
    colors: new Float32Array([
      0.1,
      0.2,
      0.3,
      1,
      0.1,
      0.2,
      0.3,
      1,
      0.1,
      0.2,
      0.3,
      1,
    ]),
    terminalGlyphStyle: "blocks",
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], blockCell(89, 124, 149));
  assertEquals(grid[0][1], grid[0][0]);
  assertEquals(grid[0][2], grid[0][0]);
});

Deno.test("three ascii block mode ignores edge glyph promotion for solid color fidelity", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 1,
    rows: 1,
    fillGlyphs: new Float32Array([14]),
    edgeGlyphs: new Float32Array([1, 64, 64, 0]),
    colors: new Float32Array([0.25, 0.75, 1, 1]),
    terminalGlyphStyle: "blocks",
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], blockCell(137, 225, 255));
});

Deno.test("three ascii glyph mode can still promote strong edge glyphs", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 1,
    rows: 1,
    fillGlyphs: new Float32Array([14]),
    edgeGlyphs: new Float32Array([1, 64, 64, 0]),
    colors: new Float32Array([1, 1, 1, 1]),
    terminalGlyphStyle: "glyphs",
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], "\x1b[48;2;0;0;0m\x1b[38;2;255;255;255m|\x1b[0m");
});

Deno.test("three ascii ANSI grid assembly clamps saturated color channels on the fast path", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 2,
    rows: 1,
    fillGlyphs: new Float32Array([14, 14]),
    colors: new Float32Array([
      -1,
      2,
      0.5,
      1,
      1,
      0,
      2,
      1,
    ]),
    backgroundColor: 0x000000,
  });

  assertEquals(grid[0][0], blockCell(0, 255, 188));
  assertEquals(grid[0][1], blockCell(255, 0, 255));
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
  assertEquals(first[0][0], blockCell(255, 0, 0));
  assertEquals(second[0][0], blockCell(0, 255, 0));
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
  assertEquals(second[0][0], blockCell(0, 255, 0));
});

Deno.test("three ascii ANSI grid assembler keeps solid block cells stable across background changes", () => {
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
  assertEquals(tinted, dark);

  const blankDark = assembler.build({ ...base, fillGlyphs: new Float32Array([0]), backgroundColor: 0x000000 })[0][0];
  const blankTinted = assembler.build({ ...base, fillGlyphs: new Float32Array([0]), backgroundColor: 0x010203 })[0][0];
  assertEquals(blankTinted !== blankDark, true);
});

Deno.test("three ascii ANSI grid assembler keeps partial block truecolor independent of background", () => {
  const assembler = new ThreeAsciiAnsiGridAssembler();
  const base = {
    columns: 1,
    rows: 1,
    fillGlyphs: new Float32Array([13]),
    colors: new Float32Array([1, 0, 0, 1]),
    terminalGlyphStyle: "blocks" as const,
  };

  const dark = assembler.build({ ...base, backgroundColor: 0x000000 })[0][0];
  const blue = assembler.build({ ...base, backgroundColor: 0x0000ff })[0][0];
  const blueAgain = assembler.build({ ...base, backgroundColor: 0x0000ff })[0][0];

  assertEquals(dark, blockCell(255, 0, 0));
  assertEquals(blue, blockCell(255, 0, 0));
  assertEquals(blueAgain, blue);
});

Deno.test("three ascii ANSI grid assembler observes reused Color background mutations", () => {
  const assembler = new ThreeAsciiAnsiGridAssembler();
  const background = new Color(0x000000);
  const base = {
    columns: 1,
    rows: 1,
    fillGlyphs: new Float32Array([14]),
    colors: new Float32Array([1, 0, 0, 1]),
    backgroundColor: background,
  };

  const dark = assembler.build(base)[0][0];
  const darkAgain = assembler.build(base)[0][0];
  background.set(0x0000ff);
  const blue = assembler.build(base)[0][0];

  assertEquals(darkAgain, dark);
  assertEquals(blue, blockCell(255, 0, 0));
});

Deno.test("three ascii ANSI grid assembler observes reused color buffer mutations", () => {
  const assembler = new ThreeAsciiAnsiGridAssembler();
  const colors = new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]);
  const base = {
    columns: 2,
    rows: 1,
    fillGlyphs: new Float32Array([14, 14]),
    colors,
    backgroundColor: 0x000000,
  };

  const first = assembler.build(base);
  colors[0] = 0;
  colors[2] = 1;
  const second = assembler.build(base);

  assertEquals(first[0][0], blockCell(255, 0, 0));
  assertEquals(second[0][0], blockCell(0, 0, 255));
  assertEquals(second[0][1], blockCell(0, 255, 0));
});

Deno.test("three ascii ANSI grid assembler keeps glyph style cache keys distinct", () => {
  const assembler = new ThreeAsciiAnsiGridAssembler();
  const base = {
    columns: 1,
    rows: 1,
    fillGlyphs: new Float32Array([14]),
    colors: new Float32Array([1, 1, 1, 1]),
    backgroundColor: 0x000000,
  };

  const blocks = assembler.build({ ...base, terminalGlyphStyle: "blocks" })[0][0];
  const glyphs = assembler.build({ ...base, terminalGlyphStyle: "glyphs" })[0][0];
  const mixed = assembler.build({ ...base, terminalGlyphStyle: "mixed" })[0][0];

  assertEquals(blocks, buildThreeAsciiAnsiGrid({ ...base, terminalGlyphStyle: "blocks" })[0][0]);
  assertEquals(glyphs, buildThreeAsciiAnsiGrid({ ...base, terminalGlyphStyle: "glyphs" })[0][0]);
  assertEquals(mixed, buildThreeAsciiAnsiGrid({ ...base, terminalGlyphStyle: "mixed" })[0][0]);
  assertEquals(blocks, blockCell(255, 255, 255));
  assertEquals(blocks.includes("\x1b[38;2;255;255;255m"), true);
  assertEquals(glyphs.includes("="), true);
  assertEquals(blocks !== glyphs, true);
});

Deno.test("three ascii ANSI grid assembler can use color alpha for block visibility", () => {
  const grid = buildThreeAsciiAnsiGrid({
    columns: 6,
    rows: 1,
    fillGlyphs: new Float32Array(0),
    colors: new Float32Array([
      1,
      0,
      0,
      1,
      1,
      0,
      0,
      1,
      0,
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      1,
      0,
      0,
      1,
      1,
    ]),
    terminalGlyphStyle: "blocks",
    backgroundColor: 0x000000,
    blockVisibilityFromColorAlpha: true,
  });

  assertEquals(grid[0][0], blockCell(255, 0, 0));
  assertEquals(grid[0][1], blockCell(255, 0, 0));
  assertEquals(grid[0][2], blankCell(0, 0, 0));
  assertEquals(grid[0][3], blankCell(0, 0, 0));
  assertEquals(grid[0][4], blockCell(0, 0, 255));
  assertEquals(grid[0][5], blockCell(0, 0, 255));
});

Deno.test("three ascii fallback detail hides raw GPU validation text", () => {
  assertEquals(
    formatThreeAsciiFallbackDetail(new Error("Buffer with '' label is invalid.")),
    "GPU BACKEND UNAVAILABLE",
  );
  assertEquals(formatThreeAsciiFallbackDetail(new Error("custom renderer failure")), "custom renderer failure");
});

Deno.test("three ascii fallback grid omits duplicate or empty detail lines", () => {
  const blank = buildFallbackGrid(24, 3, "");
  assertEquals(fallbackTextRows(blank), ["ASCII RENDERER OFFLINE"]);

  const duplicate = buildFallbackGrid(24, 3, "ASCII RENDERER OFFLINE");
  assertEquals(fallbackTextRows(duplicate), ["ASCII RENDERER OFFLINE"]);

  const detailed = buildFallbackGrid(24, 4, "custom renderer failure");
  assertEquals(fallbackTextRows(detailed), [
    "ASCII RENDERER OFFLINE",
    "CUSTOM RENDERER FAILURE",
  ]);

  const oneRow = buildFallbackGrid(12, 1, "custom renderer failure");
  assertEquals(oneRow.length, 1);
  assertEquals(oneRow[0]!.length, 12);
  assertEquals(fallbackTextRows(oneRow), ["ASCII RENDER"]);
});

Deno.test("three ascii fallback grid paints every cell with truecolor backgrounds", () => {
  const grid = buildFallbackGrid(18, 5, "custom renderer failure");

  assertEquals(grid.length, 5);
  assertEquals(grid.every((row) => row.length === 18), true);
  assertEquals(grid.every((row) => row.every((cell) => cell.includes("\x1b[48;2;"))), true);
});

function fallbackTextRows(grid: readonly (readonly string[])[]): string[] {
  return grid.map((row) => stripAnsi(row.join("")).trim()).filter(Boolean);
}

Deno.test("three ascii demo window reserves side panel only when useful", () => {
  assertEquals(threeAsciiDemoSidePanelVisible({ menuVisible: true, minimized: false, maximized: false }), true);
  assertEquals(threeAsciiDemoSidePanelVisible({ menuVisible: true, minimized: true, maximized: false }), false);
  assertEquals(threeAsciiDemoSidePanelVisible({ menuVisible: true, minimized: false, maximized: true }), false);
  assertEquals(threeAsciiDemoSidePanelVisible({ menuVisible: false, minimized: false, maximized: false }), false);

  assertEquals(
    layoutThreeAsciiDemoWindow({
      terminalWidth: 120,
      terminalHeight: 40,
      menuVisible: true,
      minimized: false,
      maximized: false,
    }),
    { column: 2, row: 2, width: 78, height: 36 },
  );

  assertEquals(
    layoutThreeAsciiDemoWindow({
      terminalWidth: 60,
      terminalHeight: 20,
      menuVisible: true,
      minimized: false,
      maximized: false,
    }),
    { column: 2, row: 2, width: 56, height: 16 },
  );

  assertEquals(
    layoutThreeAsciiDemoWindow({
      terminalWidth: 80,
      terminalHeight: 24,
      menuVisible: true,
      minimized: false,
      maximized: false,
    }),
    { column: 2, row: 2, width: 76, height: 20 },
  );
});

Deno.test("three ascii demo window derives body title and control rectangles", () => {
  const rect = { column: 2, row: 2, width: 78, height: 36 };
  assertEquals(threeAsciiDemoBodyRect(rect), { column: 3, row: 3, width: 76, height: 34 });
  assertEquals(threeAsciiDemoTitleRect(rect), { column: 4, row: 2, width: 59, height: 1 });
  assertEquals(threeAsciiDemoControlRect(rect), { column: 64, row: 2, width: 15, height: 1 });

  assertEquals(
    layoutThreeAsciiDemoWindow({
      terminalWidth: 120,
      terminalHeight: 40,
      menuVisible: true,
      minimized: true,
      maximized: false,
    }).height,
    3,
  );
  assertEquals(threeAsciiDemoControlRect({ column: 2, row: 2, width: 18, height: 10 }), {
    column: 4,
    row: 2,
    width: 15,
    height: 1,
  });
  assertEquals(
    threeAsciiDemoControlText({ column: 2, row: 2, width: 18, height: 10 }),
    THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT,
  );
  assertEquals(threeAsciiDemoControlRect({ column: 2, row: 2, width: 16, height: 10 }), {
    column: 5,
    row: 2,
    width: 12,
    height: 1,
  });
  assertEquals(
    threeAsciiDemoControlText({ column: 2, row: 2, width: 16, height: 10 }),
    THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_TEXT,
  );
  assertEquals(threeAsciiDemoControlRect({ column: 2, row: 2, width: 13, height: 10 }).width, 0);
});

Deno.test("three ascii demo titlebar hit testing maps compact controls", () => {
  const rect = { column: 2, row: 2, width: 78, height: 36 };
  assertEquals(/^[\x20-\x7e]+$/.test(THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT), true);
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 64, 2), "minimize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 68, 2), "maximize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 72, 2), "restore");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 76, 2), "close");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 67, 2), undefined);
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 64, 3), undefined);
});

Deno.test("three ascii demo titlebar keeps compact controls addressable in narrow windows", () => {
  const rect = { column: 2, row: 2, width: 16, height: 10 };
  assertEquals(threeAsciiDemoControlText(rect), "[-][M][R][x]");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 5, 2), "minimize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 8, 2), "maximize");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 11, 2), "restore");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 14, 2), "close");
  assertEquals(threeAsciiDemoTitlebarControlAt(rect, 4, 2), undefined);
});
