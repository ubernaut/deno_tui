import { assertEquals } from "./deps.ts";
import { resolveThreePanelAdaptiveRenderBudget } from "../app/three_panel_adaptive.ts";

Deno.test("resolveThreePanelAdaptiveRenderBudget waits for sustained slow frames before stepping down", () => {
  const first = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 3_840,
    frameMs: 220,
    targetMs: 1000 / 18,
    slowFrames: 0,
    fastFrames: 0,
  });
  assertEquals(first, { maxCells: undefined, slowFrames: 1, fastFrames: 0, direction: "steady" });

  const second = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 3_840,
    frameMs: 220,
    targetMs: 1000 / 18,
    slowFrames: first.slowFrames,
    fastFrames: first.fastFrames,
  });
  assertEquals(second, { maxCells: 1_920, slowFrames: 0, fastFrames: 0, direction: "down" });
});

Deno.test("resolveThreePanelAdaptiveRenderBudget recovers to saved request after sustained fast frames", () => {
  const recovered = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 3_840,
    currentMaxCells: 1_920,
    frameMs: 20,
    targetMs: 1000 / 18,
    slowFrames: 0,
    fastFrames: 119,
  });
  assertEquals(recovered, { maxCells: undefined, slowFrames: 0, fastFrames: 0, direction: "up" });
});

Deno.test("resolveThreePanelAdaptiveRenderBudget floors tiny requests to the minimum render budget", () => {
  const next = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 120,
    frameMs: 300,
    targetMs: 1000 / 18,
    slowFrames: 1,
    fastFrames: 0,
  });
  assertEquals(next.direction, "steady");
  assertEquals(next.maxCells, undefined);
});
