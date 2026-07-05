import { assert, assertEquals } from "./deps.ts";
import { createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import {
  resolveThreePanelAdaptiveRenderBudget,
  resolveThreePanelFrameInterval,
  resolveThreePanelRenderPolicy,
  resolveThreePanelRenderSize,
  resolveThreePanelRequestedMaxCells,
  resolveThreePanelRuntimeBudget,
  ThreePanelAdaptiveRenderBudgetController,
} from "../src/app/three_panel_policy.ts";

Deno.test("resolveThreePanelRenderPolicy selects ASCII-only rendering by default", () => {
  const ascii = createDefaultAsciiOptions("sharp");
  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii,
      graphicsAvailable: true,
      graphicsRectangle: { width: 8, height: 4 },
      rendererSupportsImage: true,
    }),
    {
      kittyActive: false,
      renderAscii: true,
      renderImage: false,
      frameOptions: { ansi: true, image: false },
    },
  );
});

Deno.test("resolveThreePanelRenderPolicy supports dual and kitty-only graphics modes", () => {
  const ascii = createDefaultAsciiOptions("sharp");
  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii: { ...ascii, kittyGraphics: true, kittyDisableAscii: false },
      graphicsAvailable: true,
      graphicsRectangle: { width: 8, height: 4 },
      rendererSupportsImage: true,
    }),
    {
      kittyActive: true,
      renderAscii: true,
      renderImage: true,
      frameOptions: { ansi: true, image: true },
    },
  );

  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii: { ...ascii, kittyGraphics: true, kittyDisableAscii: true },
      graphicsAvailable: true,
      graphicsRectangle: { width: 8, height: 4 },
      rendererSupportsImage: true,
    }),
    {
      kittyActive: true,
      renderAscii: false,
      renderImage: true,
      frameOptions: { ansi: false, image: true },
    },
  );
});

Deno.test("resolveThreePanelRenderPolicy disables kitty graphics without a usable surface", () => {
  const ascii = { ...createDefaultAsciiOptions("sharp"), kittyGraphics: true, kittyDisableAscii: true };
  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii,
      graphicsAvailable: true,
      graphicsRectangle: { width: 0, height: 4 },
      rendererSupportsImage: true,
    }).kittyActive,
    false,
  );
});

Deno.test("resolveThreePanelRenderSize preserves small panes and caps large panes by area", () => {
  assertEquals(resolveThreePanelRenderSize({ width: 80, height: 24 }, 3_840), { columns: 80, rows: 24 });

  const capped = resolveThreePanelRenderSize({ width: 160, height: 60 }, 3_840);
  assert(capped.columns < 160);
  assert(capped.rows < 60);
  assert(capped.columns * capped.rows <= 3_840);
  assert(capped.columns / capped.rows > 160 / 60 - 0.2);
});

Deno.test("resolveThreePanelRequestedMaxCells clamps user settings under pressure caps", () => {
  assertEquals(resolveThreePanelRequestedMaxCells({ userMaxCells: 1_920 }), 1_920);
  assertEquals(resolveThreePanelRequestedMaxCells({ userMaxCells: 1_920, pressureMaxCells: 240 }), 240);
  assertEquals(resolveThreePanelRequestedMaxCells({ userMaxCells: 240, pressureMaxCells: 1_920 }), 240);
  assertEquals(resolveThreePanelRequestedMaxCells({ userMaxCells: 240.9, pressureMaxCells: 60.9 }), 60);
  assertEquals(resolveThreePanelRequestedMaxCells({ userMaxCells: 0, pressureMaxCells: 0 }), 1);
});

Deno.test("resolveThreePanelFrameInterval floors frame cadence to a positive delay", () => {
  assertEquals(resolveThreePanelFrameInterval(33.33), 33.33);
  assertEquals(resolveThreePanelFrameInterval(0), 1);
  assertEquals(resolveThreePanelFrameInterval(-10), 1);
});

Deno.test("resolveThreePanelRuntimeBudget uses live cadence and pressure caps while interactive", () => {
  assertEquals(
    resolveThreePanelRuntimeBudget({
      interactive: true,
      userMaxCells: 1_920,
      maxRenderCells: 960,
      idleMaxRenderCells: 60,
      frameInterval: 50,
      idleFrameInterval: 125,
    }),
    { requestedMaxCells: 960, frameInterval: 50 },
  );
});

Deno.test("resolveThreePanelRuntimeBudget uses idle cadence and caps when not interactive", () => {
  assertEquals(
    resolveThreePanelRuntimeBudget({
      interactive: false,
      userMaxCells: 1_920,
      maxRenderCells: 960,
      idleMaxRenderCells: 60,
      frameInterval: 50,
      idleFrameInterval: 125,
    }),
    { requestedMaxCells: 60, frameInterval: 125 },
  );
});

Deno.test("resolveThreePanelRuntimeBudget falls back to live values without idle overrides", () => {
  assertEquals(
    resolveThreePanelRuntimeBudget({
      interactive: false,
      userMaxCells: 240,
      maxRenderCells: 960,
      frameInterval: 0,
    }),
    { requestedMaxCells: 240, frameInterval: 1 },
  );
});

Deno.test("ThreePanelAdaptiveRenderBudgetController owns warmup and requested-size state", () => {
  const controller = new ThreePanelAdaptiveRenderBudgetController();

  const initial = controller.renderSize({ width: 160, height: 60 }, 3_840);
  assert(initial.columns * initial.rows <= 3_840);
  assertEquals(
    controller.update({ requestedMaxCells: 3_840, frameMs: 1_000, targetMs: 1000 / 18 }),
    { maxCells: undefined, slowFrames: 0, fastFrames: 0, direction: "steady", changed: false },
  );
  assertEquals(
    controller.update({ requestedMaxCells: 3_840, frameMs: 220, targetMs: 1000 / 18 }).direction,
    "steady",
  );
  const reduced = controller.update({ requestedMaxCells: 3_840, frameMs: 220, targetMs: 1000 / 18 });
  assertEquals(reduced.direction, "down");
  assertEquals(reduced.maxCells, 1_920);
  assertEquals(reduced.changed, true);
  const reducedSize = controller.renderSize({ width: 160, height: 60 }, 3_840);
  assert(reducedSize.columns * reducedSize.rows <= 1_920);

  const resetSize = controller.renderSize({ width: 160, height: 60 }, 7_680);
  assert(resetSize.columns * resetSize.rows > reducedSize.columns * reducedSize.rows);
  assert(resetSize.columns * resetSize.rows <= 7_680);
  assertEquals(
    controller.update({ requestedMaxCells: 7_680, frameMs: 1_000, targetMs: 1000 / 18 }).direction,
    "steady",
  );
});

Deno.test("ThreePanelAdaptiveRenderBudgetController resets reduced caps when the viewport expands", () => {
  const controller = new ThreePanelAdaptiveRenderBudgetController();
  const smallRect = { width: 96, height: 32 };
  const largeRect = { width: 180, height: 50 };

  controller.renderSize(smallRect, 7_680);
  controller.update({ requestedMaxCells: 7_680, frameMs: 1_000, targetMs: 1000 / 18 });
  controller.update({ requestedMaxCells: 7_680, frameMs: 220, targetMs: 1000 / 18 });
  const reduced = controller.update({ requestedMaxCells: 7_680, frameMs: 220, targetMs: 1000 / 18 });
  assertEquals(reduced.direction, "down");

  const reducedSize = controller.renderSize(smallRect, 7_680);
  assert(reducedSize.columns * reducedSize.rows <= reduced.maxCells!);

  const expandedSize = controller.renderSize(largeRect, 7_680);
  assert(expandedSize.columns * expandedSize.rows > reducedSize.columns * reducedSize.rows);
  assert(expandedSize.columns * expandedSize.rows <= 7_680);
});

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

Deno.test("resolveThreePanelAdaptiveRenderBudget responds to sub-100ms slow frames", () => {
  const next = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 120,
    frameMs: 80,
    targetMs: 1000 / 24,
    slowFrames: 1,
    fastFrames: 0,
    sampleFrames: 2,
  });

  assertEquals(next.direction, "down");
  assertEquals(next.maxCells, 60);
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
