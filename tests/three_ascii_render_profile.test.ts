import { assertEquals } from "./deps.ts";
import { resolveThreeAsciiRenderProfile } from "../src/three_ascii/render_profile.ts";

Deno.test("resolveThreeAsciiRenderProfile enables full Acerola targets for image output", () => {
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: false, renderImage: true },
      terminalGlyphStyle: "blocks",
    }),
    { image: true, terminalEdges: true, terminalDepthColor: true },
  );
});

Deno.test("resolveThreeAsciiRenderProfile does not require effect state for image frames", () => {
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: true, renderImage: true },
      terminalGlyphStyle: "glyphs",
    }),
    { image: true, terminalEdges: true, terminalDepthColor: true },
  );
});

Deno.test("resolveThreeAsciiRenderProfile disables terminal edge targets for block output", () => {
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: true, renderImage: false },
      effectState: { edges: true, depthFalloff: 0 },
      terminalGlyphStyle: "blocks",
    }),
    { image: false, terminalEdges: false, terminalDepthColor: false },
  );
});

Deno.test("resolveThreeAsciiRenderProfile follows glyph edge and depth requirements", () => {
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: true, renderImage: false },
      effectState: { edges: true, depthFalloff: 0.25 },
      terminalGlyphStyle: "glyphs",
    }),
    { image: false, terminalEdges: true, terminalDepthColor: true },
  );
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: true, renderImage: false },
      effectState: { edges: false, depthFalloff: 0.25 },
      terminalGlyphStyle: "mixed",
    }),
    { image: false, terminalEdges: false, terminalDepthColor: true },
  );
});

Deno.test("resolveThreeAsciiRenderProfile suppresses terminal targets when ANSI output is disabled", () => {
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: false, renderImage: false },
      terminalGlyphStyle: "glyphs",
    }),
    { image: false, terminalEdges: false, terminalDepthColor: false },
  );
});
