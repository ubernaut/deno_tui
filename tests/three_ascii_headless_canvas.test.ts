import { assertEquals } from "./deps.ts";
import { compactMappedRgbaRows } from "../src/three_ascii/headless_canvas.ts";

Deno.test("compactMappedRgbaRows copies tightly packed mapped rows in one span", () => {
  const source = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const target = new Uint8Array(8);
  const result = compactMappedRgbaRows(source, 1, 2, 4, target);

  assertEquals(result === target, true);
  assertEquals(Array.from(result), [1, 2, 3, 4, 5, 6, 7, 8]);
});

Deno.test("compactMappedRgbaRows strips padded WebGPU row pitch", () => {
  const source = new Uint8Array([
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    99,
    99,
    99,
    99,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    88,
    88,
    88,
    88,
  ]);
  const result = compactMappedRgbaRows(source, 2, 2, 12);

  assertEquals(Array.from(result), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
});

Deno.test("compactMappedRgbaRows handles empty dimensions without touching target", () => {
  const target = new Uint8Array([7, 8]);
  const result = compactMappedRgbaRows(new Uint8Array([1, 2, 3, 4]), 0, 2, 4, target);

  assertEquals(result === target, true);
  assertEquals(Array.from(result), [7, 8]);
});
