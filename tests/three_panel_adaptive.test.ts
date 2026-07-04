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

Deno.test("resolveThreePanelAdaptiveRenderBudget adapts within pressure render tiers", () => {
  const next = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 240,
    frameMs: 300,
    targetMs: 1000 / 18,
    slowFrames: 1,
    fastFrames: 0,
  });
  assertEquals(next.direction, "down");
  assertEquals(next.maxCells, 120);
});

Deno.test("resolveThreePanelAdaptiveRenderBudget holds the rescue minimum render tier", () => {
  const next = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 30,
    frameMs: 300,
    targetMs: 1000 / 18,
    slowFrames: 1,
    fastFrames: 0,
  });
  assertEquals(next.direction, "steady");
  assertEquals(next.maxCells, undefined);
});

Deno.test("resolveThreePanelAdaptiveRenderBudget can step down from emergency to rescue tier", () => {
  const next = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 60,
    frameMs: 300,
    targetMs: 1000 / 18,
    slowFrames: 1,
    fastFrames: 0,
  });
  assertEquals(next.direction, "down");
  assertEquals(next.maxCells, 30);
});
