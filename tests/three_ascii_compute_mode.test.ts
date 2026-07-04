import { assertEquals } from "./deps.ts";
import { resolveThreeAsciiComputeMode } from "../src/three_ascii/compute_mode.ts";

Deno.test("resolveThreeAsciiComputeMode disables terminal edges for block rendering", () => {
  assertEquals(resolveThreeAsciiComputeMode({ edges: true, depthFalloff: 0 }, "blocks"), {
    includeFill: false,
    includeEdges: false,
    includeDepthColor: false,
    includeFillReadback: false,
  });
});

Deno.test("resolveThreeAsciiComputeMode enables terminal edges for glyph and mixed rendering", () => {
  assertEquals(resolveThreeAsciiComputeMode({ edges: true, depthFalloff: 0 }, "glyphs").includeEdges, true);
  assertEquals(resolveThreeAsciiComputeMode({ edges: true, depthFalloff: 0 }, "mixed").includeEdges, true);
  assertEquals(resolveThreeAsciiComputeMode({ edges: true, depthFalloff: 0 }, "glyphs").includeFillReadback, true);
  assertEquals(resolveThreeAsciiComputeMode({ edges: true, depthFalloff: 0 }, "mixed").includeFillReadback, true);
});

Deno.test("resolveThreeAsciiComputeMode honors disabled edge effect", () => {
  assertEquals(resolveThreeAsciiComputeMode({ edges: false, depthFalloff: 0 }, "glyphs"), {
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    includeFillReadback: true,
  });
});

Deno.test("resolveThreeAsciiComputeMode enables depth color only when falloff is active", () => {
  assertEquals(resolveThreeAsciiComputeMode({ edges: false, depthFalloff: 0.1 }, "blocks"), {
    includeFill: false,
    includeEdges: false,
    includeDepthColor: true,
    includeFillReadback: false,
  });
});
