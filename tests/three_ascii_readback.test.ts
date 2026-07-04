import { assertEquals, assertThrows } from "./deps.ts";
import {
  createThreeAsciiReadbackCopyPlan,
  createThreeAsciiReadbackLayout,
  createThreeAsciiReadbackViews,
  executeThreeAsciiReadbackCopyPlan,
  ThreeAsciiReadbackCopyPlanCache,
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

Deno.test("three ascii readback copy plan follows packed layout offsets", () => {
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: true,
  });

  const plan = createThreeAsciiReadbackCopyPlan({
    fill: { label: "fill", byteLength: 8 },
    edge: { label: "edge", byteLength: 16 },
    color: { label: "color", byteLength: 32 },
    includeEdges: true,
    layout,
  });

  assertEquals(plan.layout, layout);
  assertEquals(plan.commands, [
    { label: "fill", byteLength: 8, targetOffset: 0 },
    { label: "edge", byteLength: 16, targetOffset: 8 },
    { label: "color", byteLength: 32, targetOffset: 24 },
  ]);
});

Deno.test("three ascii readback copy plan omits edge copy when edge output is unused", () => {
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: false,
  });

  const plan = createThreeAsciiReadbackCopyPlan({
    fill: { label: "fill", byteLength: 8 },
    color: { label: "color", byteLength: 32 },
    includeEdges: false,
    layout,
  });

  assertEquals(plan.commands, [
    { label: "fill", byteLength: 8, targetOffset: 0 },
    { label: "color", byteLength: 32, targetOffset: 8 },
  ]);
});

Deno.test("three ascii readback copy plan rejects missing requested edge output", () => {
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: true,
  });

  assertThrows(
    () =>
      createThreeAsciiReadbackCopyPlan({
        fill: { label: "fill", byteLength: 8 },
        color: { label: "color", byteLength: 32 },
        includeEdges: true,
        layout,
      }),
    Error,
    "without an edge output",
  );
});

Deno.test("executeThreeAsciiReadbackCopyPlan emits packed GPU copy commands", () => {
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: true,
  });
  const plan = createThreeAsciiReadbackCopyPlan({
    fill: { label: "fill", byteLength: 8 },
    edge: { label: "edge", byteLength: 16 },
    color: { label: "color", byteLength: 32 },
    includeEdges: true,
    layout,
  });
  const copies: unknown[][] = [];

  executeThreeAsciiReadbackCopyPlan(
    {
      copyBufferToBuffer(source, sourceOffset, target, targetOffset, byteLength) {
        copies.push([source, sourceOffset, target, targetOffset, byteLength]);
      },
    },
    plan,
    { fill: "fill-buffer", edge: "edge-buffer", color: "color-buffer" },
    { gpu: "target-buffer" },
  );

  assertEquals(copies, [
    ["fill-buffer", 0, "target-buffer", 0, 8],
    ["edge-buffer", 0, "target-buffer", 8, 16],
    ["color-buffer", 0, "target-buffer", 24, 32],
  ]);
});

Deno.test("executeThreeAsciiReadbackCopyPlan rejects missing target buffer", () => {
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 0,
    colorByteLength: 32,
    includeEdges: false,
  });
  const plan = createThreeAsciiReadbackCopyPlan({
    fill: { label: "fill", byteLength: 8 },
    color: { label: "color", byteLength: 32 },
    includeEdges: false,
    layout,
  });

  assertThrows(
    () =>
      executeThreeAsciiReadbackCopyPlan(
        { copyBufferToBuffer() {} },
        plan,
        { fill: "fill-buffer", color: "color-buffer" },
        undefined,
      ),
    Error,
    "readback buffer has not been initialized",
  );
});

Deno.test("executeThreeAsciiReadbackCopyPlan rejects missing requested source buffer", () => {
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: true,
  });
  const plan = createThreeAsciiReadbackCopyPlan({
    fill: { label: "fill", byteLength: 8 },
    edge: { label: "edge", byteLength: 16 },
    color: { label: "color", byteLength: 32 },
    includeEdges: true,
    layout,
  });

  assertThrows(
    () =>
      executeThreeAsciiReadbackCopyPlan(
        { copyBufferToBuffer() {} },
        plan,
        { fill: "fill-buffer", color: "color-buffer" },
        { gpu: "target-buffer" },
      ),
    Error,
    "missing edge output buffer",
  );
});

Deno.test("three ascii readback copy plan cache reuses unchanged command arrays", () => {
  const cache = new ThreeAsciiReadbackCopyPlanCache();
  const layout = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: true,
  });

  const first = cache.resolve({
    fill: { label: "fill", byteLength: 8 },
    edge: { label: "edge", byteLength: 16 },
    color: { label: "color", byteLength: 32 },
    includeEdges: true,
    layout,
  });
  const second = cache.resolve({
    fill: { label: "fill", byteLength: 8 },
    edge: { label: "edge", byteLength: 16 },
    color: { label: "color", byteLength: 32 },
    includeEdges: true,
    layout,
  });

  assertEquals(second, first);
  assertEquals(second.commands, first.commands);

  cache.clear();
  const afterClear = cache.resolve({
    fill: { label: "fill", byteLength: 8 },
    edge: { label: "edge", byteLength: 16 },
    color: { label: "color", byteLength: 32 },
    includeEdges: true,
    layout,
  });
  assertEquals(afterClear === first, false);
});

Deno.test("three ascii readback copy plan cache invalidates on edge mode changes", () => {
  const cache = new ThreeAsciiReadbackCopyPlanCache();
  const withEdges = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: true,
  });
  const withoutEdges = createThreeAsciiReadbackLayout({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: false,
  });

  const first = cache.resolve({
    fill: { label: "fill", byteLength: 8 },
    edge: { label: "edge", byteLength: 16 },
    color: { label: "color", byteLength: 32 },
    includeEdges: true,
    layout: withEdges,
  });
  const second = cache.resolve({
    fill: { label: "fill", byteLength: 8 },
    color: { label: "color", byteLength: 32 },
    includeEdges: false,
    layout: withoutEdges,
  });

  assertEquals(second === first, false);
  assertEquals(second.commands, [
    { label: "fill", byteLength: 8, targetOffset: 0 },
    { label: "color", byteLength: 32, targetOffset: 8 },
  ]);
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

Deno.test("three ascii readback layout cache ignores unused edge bytes when edges are disabled", () => {
  const cache = new ThreeAsciiReadbackLayoutCache();
  const first = cache.resolve({
    fillByteLength: 8,
    edgeByteLength: 16,
    colorByteLength: 32,
    includeEdges: false,
  });
  const second = cache.resolve({
    fillByteLength: 8,
    edgeByteLength: 64,
    colorByteLength: 32,
    includeEdges: false,
  });

  assertEquals(second === first, true);
  assertEquals(second.edgeOffset, undefined);
});

Deno.test("three ascii readback view cache reuses views by source and equivalent layout", () => {
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
  assertEquals(differentLayout === first, true);

  cache.clear();
  assertEquals(cache.resolve(source, equivalentLayout) === differentLayout, false);
});
