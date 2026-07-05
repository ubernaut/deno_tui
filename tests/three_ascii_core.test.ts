// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

import { assertEquals, assertNotStrictEquals, assertStrictEquals, assertStringIncludes } from "./deps.ts";
import {
  fillGlyphKeyForIndex,
  GLYPH_MODE_BLOCKS,
  glyphForKey,
  isSolidBlockFillGlyphKey,
  terminalFillGlyphKeysForMode,
  terminalGlyphForCell,
  terminalGlyphModeForStyle,
} from "../src/three_ascii/ansi_glyph_keys.ts";
import {
  colorToBytes,
  colorValue,
  createLinearByteCache,
  linearUnitToByte,
  rgbToAnsiBackground,
  rgbToAnsiForeground,
} from "../src/three_ascii/colors.ts";
import { loadAsciiLutTextures } from "../src/three_ascii/loadAsciiLuts.ts";
import {
  THREE_ASCII_COLOR_SHADER,
  THREE_ASCII_EDGE_SHADER,
  THREE_ASCII_FILL_SHADER,
  THREE_ASCII_FLAT_COLOR_SHADER,
  THREE_ASCII_TERMINAL_EDGE_THRESHOLD_SCALE,
  THREE_ASCII_TILE_SIZE,
  THREE_ASCII_WORKGROUP_SIZE,
} from "../src/three_ascii/shaders.ts";

Deno.test("three ascii shader constants preserve renderer dimensions", () => {
  assertEquals(THREE_ASCII_TILE_SIZE, 8);
  assertEquals(THREE_ASCII_WORKGROUP_SIZE, 8);
  assertEquals(THREE_ASCII_TERMINAL_EDGE_THRESHOLD_SCALE, 2);
});

Deno.test("three ascii WGSL shaders include expected bindings and workgroup size", () => {
  assertStringIncludes(THREE_ASCII_FILL_SHADER, "@binding(2) var<storage, read_write> glyphs: array<f32>;");
  assertStringIncludes(
    THREE_ASCII_EDGE_SHADER,
    `@workgroup_size(${THREE_ASCII_WORKGROUP_SIZE}, ${THREE_ASCII_WORKGROUP_SIZE}, 1)`,
  );
  assertStringIncludes(THREE_ASCII_EDGE_SHADER, `for (var row = 0; row < ${THREE_ASCII_TILE_SIZE}; row += 1)`);
  assertStringIncludes(THREE_ASCII_COLOR_SHADER, "@binding(3) var<storage, read_write> colors: array<vec4<f32>>;");
  assertStringIncludes(THREE_ASCII_FLAT_COLOR_SHADER, "@binding(2) var<storage, read_write> colors: array<vec4<f32>>;");
  assertEquals(THREE_ASCII_FLAT_COLOR_SHADER.includes("normalsTex"), false);
});

Deno.test("loadAsciiLutTextures caches decoded bitmaps while returning fresh textures", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  let bitmapCount = 0;
  const bitmaps: ImageBitmap[] = [];
  globalThis.createImageBitmap = (() => {
    const bitmap = { id: bitmapCount++ } as unknown as ImageBitmap;
    bitmaps.push(bitmap);
    return Promise.resolve(bitmap);
  }) as typeof createImageBitmap;

  try {
    const edges = "data:image/png;base64,ZWQ=";
    const fill = "data:image/png;base64,ZmlsbA==";
    const first = await loadAsciiLutTextures(edges, fill);
    const second = await loadAsciiLutTextures(edges, fill);

    assertEquals(bitmapCount, 2);
    assertNotStrictEquals(first.edgesTexture, second.edgesTexture);
    assertNotStrictEquals(first.fillTexture, second.fillTexture);
    assertStrictEquals(first.edgesTexture.image, bitmaps[0]);
    assertStrictEquals(second.edgesTexture.image, bitmaps[0]);
    assertStrictEquals(first.fillTexture.image, bitmaps[1]);
    assertStrictEquals(second.fillTexture.image, bitmaps[1]);
  } finally {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  }
});

Deno.test("three ascii color helpers preserve Color inputs and resolve fallbacks", () => {
  const color = new Color("#112233");

  assertStrictEquals(colorValue(color, 0), color);
  assertEquals(colorValue(undefined, 0xff0000).getHex(), 0xff0000);
  assertEquals(colorValue("#00ff00", 0).getHex(), 0x00ff00);
});

Deno.test("three ascii color helpers convert linear channels to srgb bytes", () => {
  assertEquals(linearUnitToByte(-1), 0);
  assertEquals(linearUnitToByte(0), 0);
  assertEquals(linearUnitToByte(1), 255);
  assertEquals(colorToBytes(new Color(0.25, 0.5, 1)), [137, 188, 255]);
});

Deno.test("three ascii color helpers format terminal truecolor sequences", () => {
  assertEquals(rgbToAnsiForeground(1, 2, 3), "\x1b[38;2;1;2;3m");
  assertEquals(rgbToAnsiBackground(4, 5, 6), "\x1b[48;2;4;5;6m");
});

Deno.test("three ascii linear byte cache preserves conversion through clear and prune", () => {
  const cache = createLinearByteCache();
  const expected = linearUnitToByte(0.5);

  assertEquals(cache(0.5), expected);
  assertEquals(cache(0.5), expected);
  cache.clear();
  assertEquals(cache(0.5), expected);
  cache.prune();
  assertEquals(cache(0.5), expected);
});

Deno.test("three ascii glyph keys map block mode to full-cell block fills", () => {
  const mode = terminalGlyphModeForStyle("blocks");
  const keys = terminalFillGlyphKeysForMode(mode);

  assertEquals(mode, GLYPH_MODE_BLOCKS);
  assertEquals(glyphForKey(fillGlyphKeyForIndex(keys, 0)), " ");
  assertEquals(glyphForKey(fillGlyphKeyForIndex(keys, 14)), "█");
  assertEquals(isSolidBlockFillGlyphKey(fillGlyphKeyForIndex(keys, 14)), true);
});

Deno.test("three ascii glyph and mixed modes keep distinct fill glyph tables", () => {
  const glyphKeys = terminalFillGlyphKeysForMode(terminalGlyphModeForStyle("glyphs"));
  const mixedKeys = terminalFillGlyphKeysForMode(terminalGlyphModeForStyle("mixed"));
  const glyphKey = fillGlyphKeyForIndex(glyphKeys, 14);
  const mixedKey = fillGlyphKeyForIndex(mixedKeys, 14);

  assertEquals(glyphForKey(glyphKey), "=");
  assertEquals(glyphForKey(mixedKey).length > 0, true);
  assertEquals(isSolidBlockFillGlyphKey(glyphKey), false);
  assertEquals(isSolidBlockFillGlyphKey(mixedKey), false);
});

Deno.test("three ascii glyph keys promote strong edges in edge-capable modes", () => {
  const glyphKeys = terminalFillGlyphKeysForMode(terminalGlyphModeForStyle("glyphs"));

  const edgeKey = terminalGlyphForCell(glyphKeys, 1, 64, 64, 0, 14, 1);
  const weakKey = terminalGlyphForCell(glyphKeys, 1, 1, 64, 0, 14, 1);

  assertEquals(glyphForKey(edgeKey), "|");
  assertEquals(glyphForKey(weakKey), "=");
});
