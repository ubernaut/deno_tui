import { assertEquals } from "./deps.ts";
import { emptyThreeAsciiRenderFrame, resolveThreeAsciiRenderFrameSelection } from "../src/three_ascii/frame_options.ts";

Deno.test("resolveThreeAsciiRenderFrameSelection defaults to ANSI output only", () => {
  assertEquals(resolveThreeAsciiRenderFrameSelection(), { renderAnsi: true, renderImage: false });
  assertEquals(resolveThreeAsciiRenderFrameSelection({}), { renderAnsi: true, renderImage: false });
});

Deno.test("resolveThreeAsciiRenderFrameSelection preserves explicit output choices", () => {
  assertEquals(resolveThreeAsciiRenderFrameSelection({ ansi: false, image: true }), {
    renderAnsi: false,
    renderImage: true,
  });
  assertEquals(resolveThreeAsciiRenderFrameSelection({ ansi: true, image: true }), {
    renderAnsi: true,
    renderImage: true,
  });
});

Deno.test("emptyThreeAsciiRenderFrame mirrors ANSI selection", () => {
  assertEquals(emptyThreeAsciiRenderFrame({ renderAnsi: true, renderImage: false }), { grid: [] });
  assertEquals(emptyThreeAsciiRenderFrame({ renderAnsi: false, renderImage: true }), { grid: undefined });
});
