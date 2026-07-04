import { assertEquals } from "./deps.ts";
import { threePanelFrameUpdate } from "../src/app/three_panel_frame_update.ts";

Deno.test("threePanelFrameUpdate describes empty unpublished grids", () => {
  assertEquals(threePanelFrameUpdate(undefined, false), {
    rendererBacked: false,
    rows: 0,
    columns: 0,
  });
  assertEquals(threePanelFrameUpdate([], true), {
    rendererBacked: true,
    rows: 0,
    columns: 0,
  });
});

Deno.test("threePanelFrameUpdate counts rows and first row columns", () => {
  assertEquals(threePanelFrameUpdate([["A", "B"], ["C"]], true), {
    rendererBacked: true,
    rows: 2,
    columns: 2,
  });
});

Deno.test("threePanelFrameUpdate tolerates sparse first rows", () => {
  assertEquals(threePanelFrameUpdate([undefined, ["A", "B", "C"]], false), {
    rendererBacked: false,
    rows: 2,
    columns: 0,
  });
});
