import { assertEquals } from "./deps.ts";
import { ThreeAsciiAnsiColorKeyCache } from "../src/three_ascii/ansi_color_cache.ts";

Deno.test("ThreeAsciiAnsiColorKeyCache converts linear RGB values to byte keys", () => {
  const cache = new ThreeAsciiAnsiColorKeyCache();
  cache.prepare(2);

  assertEquals(cache.keyForIndex(0, 1, 0, 0), 0xff0000);
  assertEquals(cache.keyForIndex(1, 0, 1, 0), 0x00ff00);
  assertEquals(cache.keyForIndex(0, 0, 0, 1), 0x0000ff);
});

Deno.test("ThreeAsciiAnsiColorKeyCache preserves keys across repeated input and clear", () => {
  const cache = new ThreeAsciiAnsiColorKeyCache();
  cache.prepare(1);

  const first = cache.keyForIndex(0, 0.25, 0.5, 1);
  assertEquals(cache.keyForIndex(0, 0.25, 0.5, 1), first);

  cache.clear();
  cache.prepare(1);
  assertEquals(cache.keyForIndex(0, 0.25, 0.5, 1), first);
});

Deno.test("ThreeAsciiAnsiColorKeyCache resizes indexed frame cache", () => {
  const cache = new ThreeAsciiAnsiColorKeyCache();
  cache.prepare(2);
  cache.keyForIndex(1, 0, 1, 0);

  cache.prepare(1);
  assertEquals(cache.keyForIndex(0, 1, 0, 0), 0xff0000);
});
