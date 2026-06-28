import { assertEquals, assertMatch } from "./deps.ts";
import { bucketAsciiLuminance, glyphForTile } from "../src/three_ascii/glyphs.ts";

Deno.test("ascii luminance keeps empty tiles blank but promotes low non-zero fill to block glyphs", () => {
  assertEquals(bucketAsciiLuminance(0), 0);
  assertEquals(bucketAsciiLuminance(0.01), 0);
  assertEquals(bucketAsciiLuminance(0.02), 1);
  assertEquals(bucketAsciiLuminance(1), 9);
});

Deno.test("fill glyphs use chunky block characters", () => {
  assertEquals(glyphForTile(-1, 0, false, true), " ");
  assertMatch(glyphForTile(-1, 1, false, true), /[▁▂▃▄▅▆▇█]/u);
  assertEquals(glyphForTile(-1, 9, false, true), "█");
});
