import { assertEquals } from "./deps.ts";
import {
  fillGlyphKeyForIndex,
  GLYPH_MODE_BLOCKS,
  glyphForKey,
  isSolidBlockFillGlyphKey,
  terminalFillGlyphKeysForMode,
  terminalGlyphForCell,
  terminalGlyphModeForStyle,
} from "../src/three_ascii/ansi_glyph_keys.ts";

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
