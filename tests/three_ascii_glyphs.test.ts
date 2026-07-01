import { assertEquals, assertMatch } from "./deps.ts";
import { formatThreeAsciiFallbackDetail } from "../src/canvas/three_ascii.ts";
import { blockFillGlyphForBucket, bucketAsciiLuminance, glyphForTile } from "../src/three_ascii/glyphs.ts";

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

Deno.test("three ascii fallback detail hides raw GPU validation text", () => {
  assertEquals(
    formatThreeAsciiFallbackDetail(new Error("Buffer with '' label is invalid.")),
    "GPU BACKEND UNAVAILABLE",
  );
  assertEquals(formatThreeAsciiFallbackDetail(new Error("custom renderer failure")), "custom renderer failure");
});
