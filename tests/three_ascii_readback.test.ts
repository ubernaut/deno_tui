import { assertEquals, assertThrows } from "./deps.ts";
import {
  createThreeAsciiReadbackLayout,
  createThreeAsciiReadbackViews,
  ThreeAsciiReadbackLayoutCache,
  ThreeAsciiReadbackViewCache,
} from "../src/three_ascii/readback.ts";

Deno.test("three ascii readback layout packs fill edge and color buffers", () => {
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 32,
    colorByteLength: 32,
    includeEdges: true,
  });

  assertEquals(layout.fillOffset, 0);
  assertEquals(layout.edgeOffset, 8);
  assertEquals(layout.colorOffset, 40);
  assertEquals(layout.byteLength, 72);
  assertEquals(layout.fillFloatLength, 2);
  assertEquals(layout.edgeFloatLength, 8);
  assertEquals(layout.colorFloatLength, 8);
});

Deno.test("three ascii readback layout omits edge payload when edges are disabled", () => {
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 32,
    colorByteLength: 32,
    includeEdges: false,
  });

  assertEquals(layout.edgeOffset, undefined);
  assertEquals(layout.colorOffset, 8);
  assertEquals(layout.byteLength, 40);
});

Deno.test("three ascii readback views point at packed source ranges", () => {
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 16,
    includeEdges: true,
  });
  const floats = new Float32Array(layout.byteLength / Float32Array.BYTES_PER_ELEMENT);
  for (let index = 0; index < floats.length; index += 1) {
    floats[index] = index + 1;
  }

  const views = createThreeAsciiReadbackViews(floats.buffer, layout);

  assertEquals(Array.from(views.fillGlyphs), [1, 2]);
  assertEquals(Array.from(views.edgeGlyphs ?? []), [3, 4, 5, 6]);
  assertEquals(Array.from(views.colors), [7, 8, 9, 10]);
});

Deno.test("three ascii readback layout rejects unaligned byte lengths", () => {
  assertThrows(
    () =>
      createThreeAsciiReadbackLayout({
        fillByteLength: 6,
        edgeByteLength: 16,
        colorByteLength: 16,
        includeEdges: true,
      }),
    RangeError,
    "Float32-aligned",
  );
});

Deno.test("three ascii readback layout cache reuses unchanged layouts", () => {
  const cache = new ThreeAsciiReadbackLayoutCache();
  const first = cache.resolve({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: true,
  });
  const second = cache.resolve({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: true,
  });

  assertEquals(second === first, true);
});

Deno.test("three ascii readback layout cache invalidates on shape changes and clear", () => {
  const cache = new ThreeAsciiReadbackLayoutCache();
  const first = cache.resolve({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: true,
  });
  const withoutEdges = cache.resolve({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: false,
  });
  cache.clear();
  const afterClear = cache.resolve({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: false,
  });

  assertEquals(withoutEdges === first, false);
  assertEquals(withoutEdges.edgeOffset, undefined);
  assertEquals(afterClear === withoutEdges, false);
});

Deno.test("three ascii readback view cache reuses views by source and layout identity", () => {
  const cache = new ThreeAsciiReadbackViewCache();
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 16,
    includeEdges: true,
  });
  const source = new ArrayBuffer(layout.byteLength);

  const first = cache.resolve(source, layout);
  const second = cache.resolve(source, layout);
  const equivalentLayout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 16,
    includeEdges: true,
  });
  const differentLayout = cache.resolve(source, equivalentLayout);

  assertEquals(second === first, true);
  assertEquals(differentLayout === first, false);

  cache.clear();
  assertEquals(cache.resolve(source, equivalentLayout) === differentLayout, false);
});
