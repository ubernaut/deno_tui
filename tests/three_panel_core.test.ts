import { assert, assertEquals, assertNotEquals, assertNotStrictEquals, assertStrictEquals } from "./deps.ts";
import { assertRejects } from "./deps.ts";
import { createNeonThreeScene } from "../app/neon_three.ts";
import { nextFrameDelay } from "../src/runtime/render_loop.ts";
import {
  resolveThreePanelAdaptiveRenderBudget,
  resolveThreePanelFrameInterval,
  resolveThreePanelRenderPolicy,
  resolveThreePanelRenderSize,
  resolveThreePanelRequestedMaxCells,
  resolveThreePanelRuntimeBudget,
  ThreePanelAdaptiveRenderBudgetController,
} from "../src/app/three_panel_policy.ts";
import { threePanelFrameUpdate } from "../src/app/three_panel_core.ts";
import {
  isCurrentThreePanelFrame,
  ownsThreePanelFrame,
  resolveThreePanelLifecycleState,
} from "../src/app/three_panel_core.ts";
import {
  resolveOptionalThreePanelValue,
  resolveThreePanelLiveValue,
  resolveThreePanelValue,
  ThreePanelRenderQueue,
} from "../src/app/three_panel_core.ts";
import {
  defaultThreePanelInteractionState,
  emptyThreePanelRendererState,
  fingerprintThreePanelGrid,
  hasThreePanelGridCells,
  resolveThreePanelRendererStateUpdate,
  scaleThreePanelGridToSize,
  scaleThreePanelGridToSizeInto,
  threePanelAdaptiveRenderCellsDiagnostic,
  threePanelAsciiEffectOptionsEqual,
  threePanelBlankGrid,
  threePanelGraphicsFallbackDiagnostic,
  threePanelGraphicsFallbackReason,
  ThreePanelGraphicsImageController,
  ThreePanelGridPublicationCache,
  ThreePanelGridPublisher,
  ThreePanelGridScaleCache,
  ThreePanelInteractionController,
  threePanelRendererStateMatches,
  threePanelSlowFrameDiagnostic,
} from "../src/app/three_panel_core.ts";
import { WorkbenchThreeCadenceMeter } from "../src/app/workbench_three_runtime.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import type {
  GraphicsDeleteMode,
  GraphicsHandle,
  GraphicsImage,
  GraphicsPlacement,
  GraphicsSurface,
  GraphicsSurfaceInspection,
} from "../src/runtime/graphics_surface.ts";
import { Signal } from "../src/signals/mod.ts";
import { asciiEffectOptions, createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import type { ThreeAsciiImageFrame } from "../src/three_ascii/renderer.ts";

Deno.test("nextFrameDelay compensates for current frame render time", () => {
  assertEquals(nextFrameDelay(100, 1_000, 1_025), 75);
  assertEquals(nextFrameDelay(100, 1_000, 1_125), 0);
  assertEquals(nextFrameDelay(100, 1_000, 950), 100);
  assertEquals(nextFrameDelay(-1, 1_000, 1_025), 0);
});

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

Deno.test("ThreePanelAdaptiveRenderBudgetController resets reduced caps when viewport shape changes", () => {
  const controller = new ThreePanelAdaptiveRenderBudgetController();
  const tallRect = { width: 80, height: 48 };
  const wideRect = { width: 120, height: 32 };

  controller.renderSize(tallRect, 3_840);
  controller.update({ requestedMaxCells: 3_840, frameMs: 1_000, targetMs: 1000 / 18 });
  controller.update({ requestedMaxCells: 3_840, frameMs: 220, targetMs: 1000 / 18 });
  const reduced = controller.update({ requestedMaxCells: 3_840, frameMs: 220, targetMs: 1000 / 18 });
  assertEquals(reduced.direction, "down");

  const reducedSize = controller.renderSize(tallRect, 3_840);
  assert(reducedSize.columns * reducedSize.rows <= reduced.maxCells!);

  const reshapedSize = controller.renderSize(wideRect, 3_840);
  assertEquals(wideRect.width * wideRect.height, tallRect.width * tallRect.height);
  assert(reshapedSize.columns > reducedSize.columns);
  assertEquals(reshapedSize, { columns: wideRect.width, rows: wideRect.height });
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

Deno.test("ThreePanelInteractionController tracks bounded rotation zoom and reset state", () => {
  const interaction = new ThreePanelInteractionController();

  assertEquals(defaultThreePanelInteractionState(), { rotationX: 0, rotationY: 0, zoom: 1 });
  assertEquals(interaction.inspect(), { rotationX: 0, rotationY: 0, zoom: 1 });
  assertEquals(interaction.rotateBy(0, 0), { rotationX: 0, rotationY: 0, zoom: 1 });
  assertEquals(interaction.zoomBy(0), { rotationX: 0, rotationY: 0, zoom: 1 });

  const rotated = interaction.rotateBy(1000, 1000);
  assert(rotated.rotationY >= -Math.PI && rotated.rotationY <= Math.PI);
  assertEquals(rotated.rotationX, Math.PI);

  const zoomedIn = interaction.zoomBy(-200);
  assertEquals(zoomedIn.zoom, 3.25);
  const zoomedOut = interaction.zoomBy(400);
  assertEquals(zoomedOut.zoom, 0.35);

  assertEquals(interaction.reset(), { rotationX: 0, rotationY: 0, zoom: 1 });
});

Deno.test("ThreePanelInteractionController applies captured three scene transforms", () => {
  const bundle = createNeonThreeScene("studio", { wireframeThickness: 8 });
  const interaction = new ThreePanelInteractionController();
  try {
    const baseDistance = bundle.camera.position.length();
    const baseRotationX = bundle.scene.rotation.x;
    const baseRotationY = bundle.scene.rotation.y;

    interaction.captureBaseTransform(bundle);
    interaction.zoomBy(-1);
    interaction.rotateBy(4, -2);
    interaction.apply(bundle);

    assert(bundle.camera.position.length() < baseDistance);
    assert(bundle.scene.rotation.x < baseRotationX);
    assert(bundle.scene.rotation.y > baseRotationY);

    const appliedDistance = bundle.camera.position.length();
    interaction.clearBaseTransform();
    interaction.zoomBy(-1);
    interaction.rotateBy(4, -2);
    interaction.apply(bundle);
    assertEquals(bundle.camera.position.length(), appliedDistance);
  } finally {
    bundle.dispose();
  }
});

Deno.test("three panel value resolver reads literals and signal-like values", () => {
  const signal = new Signal(42);

  assertEquals(resolveThreePanelValue(7), 7);
  assertEquals(resolveThreePanelValue(signal), 42);

  signal.value = 64;
  assertEquals(resolveThreePanelValue(signal), 64);

  signal.dispose();
});

Deno.test("three panel optional value resolver preserves undefined", () => {
  const signal = new Signal(12);

  assertEquals(resolveOptionalThreePanelValue<number>(undefined), undefined);
  assertEquals(resolveOptionalThreePanelValue(5), 5);
  assertEquals(resolveOptionalThreePanelValue(signal), 12);

  signal.dispose();
});

Deno.test("three panel live value resolver defaults true and supports callbacks", () => {
  let active = false;
  const signal = new Signal(false);

  assertEquals(resolveThreePanelLiveValue(undefined), true);
  assertEquals(resolveThreePanelLiveValue(true), true);
  assertEquals(resolveThreePanelLiveValue(signal), false);
  signal.value = true;
  assertEquals(resolveThreePanelLiveValue(signal), true);
  assertEquals(resolveThreePanelLiveValue(() => active), false);
  active = true;
  assertEquals(resolveThreePanelLiveValue(() => active), true);

  signal.dispose();
});

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

Deno.test("resolveThreePanelLifecycleState reports explicit transition phases", () => {
  const base = {
    disposed: false,
    failed: false,
    destroyPending: false,
    rebuildPending: false,
    syncPending: false,
    rendering: false,
    hasRenderer: false,
    visible: false,
    gridRows: 0,
  };

  assertEquals(resolveThreePanelLifecycleState(base), "idle");
  assertEquals(resolveThreePanelLifecycleState({ ...base, hasRenderer: true, visible: true }), "initializing");
  assertEquals(resolveThreePanelLifecycleState({ ...base, rendering: true }), "rendering");
  assertEquals(resolveThreePanelLifecycleState({ ...base, syncPending: true, rendering: true }), "resizing");
  assertEquals(resolveThreePanelLifecycleState({ ...base, rebuildPending: true, syncPending: true }), "reconfiguring");
  assertEquals(resolveThreePanelLifecycleState({ ...base, destroyPending: true }), "stopping");
  assertEquals(resolveThreePanelLifecycleState({ ...base, failed: true }), "failed");
  assertEquals(resolveThreePanelLifecycleState({ ...base, disposed: true, failed: true }), "disposed");
});

Deno.test("ownsThreePanelFrame requires live generation and renderer bundle identity", () => {
  const renderer = {};
  const bundle = {};
  const base = {
    disposed: false,
    currentGeneration: 3,
    frameGeneration: 3,
    currentRenderer: renderer,
    frameRenderer: renderer,
    currentBundle: bundle,
    frameBundle: bundle,
  };

  assertEquals(ownsThreePanelFrame(base), true);
  assertEquals(ownsThreePanelFrame({ ...base, disposed: true }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentGeneration: 4 }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentRenderer: {} }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentBundle: {} }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentRenderer: undefined }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentBundle: undefined }), false);
});

Deno.test("isCurrentThreePanelFrame also requires the render loop to be running", () => {
  const renderer = {};
  const bundle = {};
  const base = {
    disposed: false,
    running: true,
    currentGeneration: 2,
    frameGeneration: 2,
    currentRenderer: renderer,
    frameRenderer: renderer,
    currentBundle: bundle,
    frameBundle: bundle,
  };

  assertEquals(isCurrentThreePanelFrame(base), true);
  assertEquals(isCurrentThreePanelFrame({ ...base, running: false }), false);
  assertEquals(isCurrentThreePanelFrame({ ...base, currentGeneration: 3 }), false);
});

Deno.test("WorkbenchThreeCadenceMeter reports observed frame cadence after repeated updates", () => {
  const meter = new WorkbenchThreeCadenceMeter({ alpha: 0.5 });

  assertEquals(meter.inspect(), { updates: 0, averageFrameMs: undefined, measuredFps: undefined });
  assertEquals(meter.record(100), { updates: 1, averageFrameMs: undefined, measuredFps: undefined });
  assertEquals(meter.record(150), { updates: 2, averageFrameMs: 50, measuredFps: 20 });
  assertEquals(meter.record(250), { updates: 3, averageFrameMs: 75, measuredFps: 1000 / 75 });
});

Deno.test("WorkbenchThreeCadenceMeter resets stale gaps without retaining old cadence", () => {
  const meter = new WorkbenchThreeCadenceMeter({ resetAfterMs: 100 });

  meter.record(0);
  meter.record(50);
  assertEquals(meter.inspectAt(50).averageFrameMs, 50);

  meter.record(500);
  assertEquals(meter.inspectAt(500).averageFrameMs, 450);

  meter.reset();
  assertEquals(meter.inspect(), { updates: 0, averageFrameMs: undefined, measuredFps: undefined });
});

Deno.test("WorkbenchThreeCadenceMeter hides stale measured fps before the next update", () => {
  const meter = new WorkbenchThreeCadenceMeter({ resetAfterMs: 100 });

  meter.record(0);
  meter.record(50);

  assertEquals(meter.inspectAt(75), { updates: 2, averageFrameMs: 50, measuredFps: 20 });
  assertEquals(meter.measuredFps(151), undefined);
  assertEquals(meter.inspectAt(151), { updates: 2, averageFrameMs: undefined, measuredFps: undefined });
});

Deno.test("ThreePanelRenderQueue serializes queued frame work", async () => {
  const queue = new ThreePanelRenderQueue();
  const order: string[] = [];
  const releaseFirst = deferred<void>();

  const first = queue.run(async () => {
    order.push("first:start");
    await releaseFirst.promise;
    order.push("first:end");
    return "first";
  });
  const second = queue.run(() => {
    order.push("second");
    return "second";
  });

  await waitFor(() => order.length === 1);
  assertEquals(order, ["first:start"]);
  assertEquals(queue.inspect().running, 1);
  assertEquals(queue.inspect().pending, 1);

  releaseFirst.resolve();
  assertEquals(await Promise.all([first, second]), ["first", "second"]);
  assertEquals(order, ["first:start", "first:end", "second"]);
  assertEquals(queue.inspect(), {
    running: 0,
    pending: 0,
    scheduled: 2,
    completed: 2,
    failed: 0,
  });
});

Deno.test("ThreePanelRenderQueue continues after a failed frame", async () => {
  const queue = new ThreePanelRenderQueue();
  const error = new Error("frame failed");

  await assertRejects(
    () =>
      queue.run(() => {
        throw error;
      }),
    Error,
    "frame failed",
  );

  assertEquals(await queue.run(() => "next"), "next");
  assertEquals(queue.inspect(), {
    running: 0,
    pending: 0,
    scheduled: 2,
    completed: 1,
    failed: 1,
  });
});

Deno.test("threePanelAsciiEffectOptionsEqual rejects missing previous state", () => {
  const next = asciiEffectOptions(createDefaultAsciiOptions("sharp"));
  assertEquals(threePanelAsciiEffectOptionsEqual(undefined, next), false);
});

Deno.test("threePanelAsciiEffectOptionsEqual accepts matching effect state", () => {
  const options = createDefaultAsciiOptions("sharp");
  assertEquals(threePanelAsciiEffectOptionsEqual(asciiEffectOptions(options), asciiEffectOptions(options)), true);
});

Deno.test("threePanelAsciiEffectOptionsEqual detects changed renderer effect fields", () => {
  const base = createDefaultAsciiOptions("sharp");
  const changed = { ...base, edgeThreshold: base.edgeThreshold + 1 };
  assertEquals(threePanelAsciiEffectOptionsEqual(asciiEffectOptions(base), asciiEffectOptions(changed)), false);
});

Deno.test("threePanelRendererStateMatches ignores scene signal churn and detects renderer changes", () => {
  const base = createDefaultAsciiOptions("sharp");
  const effectOptions = asciiEffectOptions(base);
  const current = {
    columns: 40,
    rows: 12,
    effectOptions,
    terminalEdgeBias: base.terminalEdgeBias,
    terminalGlyphStyle: base.terminalGlyphStyle,
  };

  assertEquals(threePanelRendererStateMatches(current, { ...current, effectOptions }), true);
  assertEquals(threePanelRendererStateMatches(current, { ...current, columns: 41, effectOptions }), false);
  assertEquals(
    threePanelRendererStateMatches(current, {
      ...current,
      effectOptions: asciiEffectOptions({ ...base, edgeThreshold: base.edgeThreshold + 1 }),
    }),
    false,
  );
  assertEquals(
    threePanelRendererStateMatches(current, {
      ...current,
      terminalGlyphStyle: "glyphs",
      effectOptions,
    }),
    false,
  );
});

Deno.test("resolveThreePanelRendererStateUpdate reports setter-specific changes", () => {
  const base = createDefaultAsciiOptions("sharp");
  const effectOptions = asciiEffectOptions(base);
  const current = {
    columns: 40,
    rows: 12,
    effectOptions,
    terminalEdgeBias: base.terminalEdgeBias,
    terminalGlyphStyle: base.terminalGlyphStyle,
  };

  assertEquals(resolveThreePanelRendererStateUpdate(current, { ...current, effectOptions }).changed, false);

  assertEquals(resolveThreePanelRendererStateUpdate(current, { ...current, columns: 41, effectOptions }), {
    next: { ...current, columns: 41, effectOptions },
    resize: true,
    effect: false,
    terminalEdgeBias: false,
    terminalGlyphStyle: false,
    changed: true,
  });

  assertEquals(
    resolveThreePanelRendererStateUpdate(current, {
      ...current,
      effectOptions: asciiEffectOptions({ ...base, exposure: base.exposure + 0.1 }),
    }).effect,
    true,
  );
  assertEquals(
    resolveThreePanelRendererStateUpdate(current, { ...current, terminalEdgeBias: base.terminalEdgeBias + 0.1 })
      .terminalEdgeBias,
    true,
  );
  assertEquals(
    resolveThreePanelRendererStateUpdate(current, { ...current, terminalGlyphStyle: "glyphs" }).terminalGlyphStyle,
    true,
  );
});

Deno.test("emptyThreePanelRendererState forces initial renderer configuration", () => {
  const base = createDefaultAsciiOptions("sharp");
  const next = {
    columns: 80,
    rows: 24,
    effectOptions: asciiEffectOptions(base),
    terminalEdgeBias: base.terminalEdgeBias,
    terminalGlyphStyle: base.terminalGlyphStyle,
  };

  assertEquals(resolveThreePanelRendererStateUpdate(emptyThreePanelRendererState(), next), {
    next,
    resize: true,
    effect: true,
    terminalEdgeBias: true,
    terminalGlyphStyle: true,
    changed: true,
  });
});

Deno.test("threePanelBlankGrid creates stable space-filled rows", () => {
  assertEquals(threePanelBlankGrid(-1, 2), [[], []]);
  assertEquals(threePanelBlankGrid(3, 2), [
    [" ", " ", " "],
    [" ", " ", " "],
  ]);
});

Deno.test("scaleThreePanelGridToSize fills display bounds from capped renderer grids", () => {
  assertEquals(scaleThreePanelGridToSize([["A", "B"], ["C", "D"]], 4, 4), [
    ["A", "A", "B", "B"],
    ["A", "A", "B", "B"],
    ["C", "C", "D", "D"],
    ["C", "C", "D", "D"],
  ]);
  assertEquals(scaleThreePanelGridToSize([["A", "B"], ["C", "D"]], 1, 1), [["A"]]);
  assertEquals(scaleThreePanelGridToSize([], 3, 2), [
    [" ", " ", " "],
    [" ", " ", " "],
  ]);
});

Deno.test("scaleThreePanelGridToSizeInto reuses target rows and clears stale cells", () => {
  const target = [["stale", "stale", "stale"], ["old", "old", "old"]] as string[][];
  const result = scaleThreePanelGridToSizeInto(target, [["A", "B"], ["C", "D"]], 4, 4);
  const firstRow = result[0];
  const secondRow = result[1];

  assertEquals(result, [
    ["A", "A", "B", "B"],
    ["A", "A", "B", "B"],
    ["C", "C", "D", "D"],
    ["C", "C", "D", "D"],
  ]);
  assertStrictEquals(result, target);
  assertStrictEquals(result[0], firstRow);
  assertStrictEquals(result[1], secondRow);

  scaleThreePanelGridToSizeInto(target, [["Z"]], 1, 1);
  assertEquals(target, [["Z"]]);
  assertStrictEquals(target[0], firstRow);
  assertEquals(target[1], undefined);
  assertEquals(firstRow.length, 1);
});

Deno.test("ThreePanelGridScaleCache reuses target and source indexes across stable frame sizes", () => {
  const cache = new ThreePanelGridScaleCache();
  const result = cache.scale([["A", "B"], ["C", "D"]], 4, 4);
  const firstRow = result[0];
  const rowIndexes = cache.sourceRowIndexes;
  const columnIndexes = cache.sourceColumnIndexes;

  assertEquals(result, [
    ["A", "A", "B", "B"],
    ["A", "A", "B", "B"],
    ["C", "C", "D", "D"],
    ["C", "C", "D", "D"],
  ]);
  assertEquals(rowIndexes, [0, 0, 1, 1]);
  assertEquals(columnIndexes, [0, 0, 1, 1]);

  const updated = cache.scale([["E", "F"], ["G", "H"]], 4, 4);
  assertStrictEquals(updated, result);
  assertStrictEquals(updated[0], firstRow);
  assertStrictEquals(cache.sourceRowIndexes, rowIndexes);
  assertStrictEquals(cache.sourceColumnIndexes, columnIndexes);
  assertEquals(updated[0], ["E", "E", "F", "F"]);

  cache.reset();
  assertEquals(cache.target, []);
  assertEquals(cache.sourceRowIndexes, []);
  assertEquals(cache.sourceColumnIndexes, []);
});

Deno.test("fingerprintThreePanelGrid distinguishes content shape and text", () => {
  const base = fingerprintThreePanelGrid([
    ["A", "B"],
    ["C", "D"],
  ]);

  assertEquals(fingerprintThreePanelGrid([["A", "B"], ["C", "D"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["A", "B"], ["C", "E"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["A", "B", "C"], ["D"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["AB"], ["CD"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["A", "B"], undefined, ["C", "D"]]), base);
});

Deno.test("ThreePanelGridPublicationCache treats renderer revisions as authoritative", () => {
  const cache = new ThreePanelGridPublicationCache();
  const grid = [["A"]];

  assertEquals(cache.shouldPublish({ grid, revision: 1 }), true);
  assertEquals(cache.shouldPublish({ grid, revision: 1 }), false);
  assertEquals(cache.shouldPublish({ grid: [["A"]], revision: 2 }), false);
  assertEquals(cache.shouldPublish({ grid: [["B"]], revision: 2 }), false);
  assertEquals(cache.shouldPublish({ grid: [["B"]], revision: 3 }), true);
  assertEquals(cache.shouldPublish({ grid: [["B"]] }), false);
  assertEquals(cache.shouldPublish({ grid: [["B"]] }), false);
  assertEquals(cache.shouldPublish({ grid: [["C"]] }), true);
});

Deno.test("ThreePanelGridPublicationCache publishes same renderer revision at a new output size", () => {
  const cache = new ThreePanelGridPublicationCache();

  assertEquals(cache.shouldPublish({ grid: [["A"]], revision: 1 }), true);
  assertEquals(cache.shouldPublish({ grid: [["A"]], revision: 1 }), false);
  assertEquals(cache.shouldPublish({ grid: [["A", "A"]], revision: 1 }), true);
  assertEquals(cache.shouldPublish({ grid: [["A", "A"]], revision: 1 }), false);
  assertEquals(cache.shouldPublish({ grid: [["A"], ["A"]], revision: 1 }), true);
});

Deno.test("ThreePanelGridPublicationCache preserves unrevisioned identity and fingerprint behavior", () => {
  const cache = new ThreePanelGridPublicationCache();
  const grid = [["A"]];

  assertEquals(cache.shouldPublish({ grid, currentGrid: [] }), true);
  assertEquals(cache.shouldPublish({ grid, currentGrid: grid }), false);
  assertEquals(cache.shouldPublish({ grid: [["A"]], currentGrid: grid, forceUpdate: true }), false);
  assertEquals(cache.shouldPublish({ grid: [["B"]], currentGrid: grid }), true);
});

Deno.test("ThreePanelGridPublicationCache reset allows a matching grid to publish again", () => {
  const cache = new ThreePanelGridPublicationCache();
  const grid = [["A"]];

  assertEquals(cache.shouldPublish({ grid }), true);
  assertEquals(cache.shouldPublish({ grid: [["A"]] }), false);
  cache.reset();
  assertEquals(cache.shouldPublish({ grid: [["A"]] }), true);
});

Deno.test("ThreePanelGridPublisher reuses blank grids and resets buffers", () => {
  const publisher = new ThreePanelGridPublisher();
  const first = publisher.blankGridFor(3, 2);

  assertEquals(first, [
    [" ", " ", " "],
    [" ", " ", " "],
  ]);
  assertEquals(publisher.blankGridFor(3, 2), first);

  const resized = publisher.blankGridFor(2, 1);
  assertEquals(resized, [[" ", " "]]);
  assertNotEquals(resized, first);

  publisher.reset();
  assertNotStrictEquals(publisher.blankGridFor(2, 1), resized);
});

Deno.test("ThreePanelGridPublisher projects publication decisions with renderer-backed state", () => {
  const publisher = new ThreePanelGridPublisher();
  const grid = [["A"]];

  assertEquals(publisher.shouldPublish({ grid, currentGrid: [], rendererBacked: true }), {
    publish: true,
    grid,
    rendererBacked: true,
  });
  assertEquals(publisher.shouldPublish({ grid: [["A"]], currentGrid: grid, rendererBacked: true }), {
    publish: false,
    grid: [["A"]],
    rendererBacked: true,
  });
  assertEquals(publisher.shouldPublish({ grid: [["B"]], currentGrid: grid }), {
    publish: true,
    grid: [["B"]],
    rendererBacked: false,
  });
});

Deno.test("hasThreePanelGridCells reports visible grid dimensions", () => {
  assertEquals(hasThreePanelGridCells([]), false);
  assertEquals(hasThreePanelGridCells([[]]), false);
  assertEquals(hasThreePanelGridCells([undefined]), false);
  assertEquals(hasThreePanelGridCells([[" "]]), true);
});

Deno.test("ThreePanelGraphicsImageController replaces and clears image handles", async () => {
  const surface = new FakeGraphicsSurface();
  const generation = 1;
  let disposed = false;
  const controller = new ThreePanelGraphicsImageController({
    currentGeneration: () => generation,
    disposed: () => disposed,
  });

  await controller.put(surface, imageFrame(), { column: 2, row: 3, width: 8, height: 4 }, generation);
  assertEquals(controller.hasHandle, true);
  assertEquals(surface.puts.length, 1);
  assertEquals(surface.puts[0]?.placement, { column: 2, row: 3, width: 8, height: 4, zIndex: 1 });

  await controller.put(surface, imageFrame(), { column: 4, row: 5, width: 6, height: 3 }, generation);
  assertEquals(surface.deleted.map((entry) => entry.mode), ["image"]);
  assertEquals(surface.puts.length, 2);
  assertEquals(controller.hasHandle, true);

  disposed = true;
  await controller.clear(surface);
  assertEquals(surface.deleted.length, 2);
  assertEquals(controller.hasHandle, false);
});

Deno.test("ThreePanelGraphicsImageController deletes stale frame handles and preserves current state", async () => {
  const surface = new FakeGraphicsSurface();
  let generation = 1;
  const controller = new ThreePanelGraphicsImageController({
    currentGeneration: () => generation,
    disposed: () => false,
  });

  generation = 2;
  await controller.put(surface, imageFrame(), { column: 0, row: 0, width: 4, height: 2 }, 1);

  assertEquals(surface.puts.length, 1);
  assertEquals(surface.deleted.length, 1);
  assertEquals(controller.hasHandle, false);
});

Deno.test("ThreePanelGraphicsImageController forgets handles even when no surface can clear them", async () => {
  const surface = new FakeGraphicsSurface();
  const controller = new ThreePanelGraphicsImageController({
    currentGeneration: () => 1,
    disposed: () => false,
  });

  await controller.put(surface, imageFrame(), { column: 0, row: 0, width: 4, height: 2 }, 1);
  await controller.clear(undefined);

  assertEquals(controller.hasHandle, false);
  assertEquals(surface.deleted.length, 0);
});

Deno.test("ThreePanelGraphicsImageController reports cleanup failures", async () => {
  const surface = new FakeGraphicsSurface();
  const diagnostics = new DiagnosticsCollector();
  const controller = new ThreePanelGraphicsImageController({
    diagnostics,
    currentGeneration: () => 1,
    disposed: () => false,
  });

  await controller.put(surface, imageFrame(), { column: 0, row: 0, width: 4, height: 2 }, 1);
  surface.failDeletes = true;
  await controller.clear(surface);

  assertEquals(diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity, entry.detail]), [
    ["three-panel", "graphics-delete-failed", "debug", "delete unavailable"],
  ]);
});

Deno.test("three panel slow-frame diagnostics format renderer timings and readback queue state", () => {
  const diagnostic = threePanelSlowFrameDiagnostic({
    columns: 24,
    rows: 10,
    cells: 240,
    terminalGlyphStyle: "blocks",
    totalMs: 123.45,
    initMs: 15.12,
    sceneMs: 70.12,
    sceneUpdateMs: 12.34,
    sceneRenderMs: 57.78,
    ansiMs: 30.34,
    readbackMs: 20.56,
    assemblyMs: 9.87,
    deferredReadbackSlots: 6,
    deferredReadbackPending: 4,
    deferredReadbackUnresolved: 2,
    deferredReadbackSaturated: false,
  });

  assertEquals(diagnostic.source, "three-panel");
  assertEquals(diagnostic.code, "three-ascii-slow-frame");
  assertEquals(diagnostic.message, "Three ASCII frame 123.5ms at 24x10");
  assertEquals(
    diagnostic.detail,
    "init 15.1ms, scene 70.1ms, update 12.3ms, render 57.8ms, ansi 30.3ms, readback 20.6ms, assembly 9.9ms, queue 2/6",
  );
  assertEquals(diagnostic.context, {
    columns: 24,
    rows: 10,
    cells: 240,
    glyphStyle: "blocks",
    totalMs: 123.5,
    initMs: 15.1,
    sceneMs: 70.1,
    sceneUpdateMs: 12.3,
    sceneRenderMs: 57.8,
    ansiMs: 30.3,
    readbackMs: 20.6,
    assemblyMs: 9.9,
    deferredReadbackSlots: 6,
    deferredReadbackPending: 4,
    deferredReadbackUnresolved: 2,
    deferredReadbackSaturated: false,
  });
});

Deno.test("three panel adaptive render-cell diagnostics format direction and rounded frame timing", () => {
  assertEquals(
    threePanelAdaptiveRenderCellsDiagnostic({
      direction: "down",
      maxCells: 480,
      requestedMaxCells: 960,
      frameMs: 81.26,
      targetMs: 55.55,
    }),
    {
      source: "three-panel",
      code: "three-ascii-adaptive-render-cells",
      severity: "debug",
      message: "Three ASCII render budget reduced to 480 cells.",
      detail: "frame 81.3ms, target 55.5ms",
      context: {
        direction: "down",
        maxCells: 480,
        requestedMaxCells: 960,
        frameMs: 81.3,
        targetMs: 55.6,
      },
    },
  );
});

Deno.test("three panel graphics fallback reason classifies unavailable image surfaces", () => {
  assertEquals(
    threePanelGraphicsFallbackReason({
      rect: { width: 4, height: 2 },
      rendererSupportsImage: true,
    }),
    "missing-surface",
  );
  assertEquals(
    threePanelGraphicsFallbackReason({
      inspection: {
        kind: "kitty",
        available: false,
        reason: "tmux passthrough disabled",
        handles: [],
        commandCount: 0,
      },
      rect: { width: 4, height: 2 },
      rendererSupportsImage: true,
    }),
    "tmux passthrough disabled",
  );
  assertEquals(
    threePanelGraphicsFallbackReason({
      inspection: { kind: "kitty", available: true, handles: [], commandCount: 0 },
      rect: { width: 0, height: 2 },
      rendererSupportsImage: true,
    }),
    "empty-graphics-rectangle",
  );
  assertEquals(
    threePanelGraphicsFallbackReason({
      inspection: { kind: "kitty", available: true, handles: [], commandCount: 0 },
      rect: { width: 4, height: 2 },
      rendererSupportsImage: false,
    }),
    "renderer-image-frame-unsupported",
  );
});

Deno.test("three panel graphics fallback diagnostics include ascii fallback context", () => {
  assertEquals(
    threePanelGraphicsFallbackDiagnostic({
      inspection: {
        kind: "kitty",
        available: false,
        reason: "raster graphics surface is unavailable",
        handles: [],
        commandCount: 0,
      },
      rect: { width: 8, height: 4 },
      rendererSupportsImage: true,
      kittyDisableAscii: true,
    }),
    {
      source: "three-panel",
      code: "kitty-graphics-fallback",
      severity: "warning",
      message: "Kitty graphics requested but unavailable; rendering ASCII fallback.",
      detail: "raster graphics surface is unavailable",
      context: {
        reason: "raster graphics surface is unavailable",
        surface: "kitty",
        available: false,
        asciiFallback: true,
        kittyDisableAscii: true,
      },
    },
  );
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function imageFrame(): ThreeAsciiImageFrame {
  return {
    data: new Uint8Array([1, 2, 3, 4]),
    encoding: "bytes",
    format: 32,
    pixelWidth: 1,
    pixelHeight: 1,
  };
}

class FakeGraphicsSurface implements GraphicsSurface {
  readonly kind = "kitty" as const;
  readonly puts: Array<{ image: GraphicsImage; placement: GraphicsPlacement }> = [];
  readonly deleted: Array<{ handle: GraphicsHandle; mode?: GraphicsDeleteMode }> = [];
  failDeletes = false;
  private nextId = 1;

  async putImage(image: GraphicsImage, placement: GraphicsPlacement): Promise<GraphicsHandle> {
    this.puts.push({ image, placement });
    return {
      id: `kitty:${this.nextId}:1`,
      kind: this.kind,
      imageId: this.nextId++,
      placementId: 1,
      placement,
    };
  }

  async moveImage(): Promise<void> {}

  async deleteImage(handle: GraphicsHandle, mode?: GraphicsDeleteMode): Promise<void> {
    this.deleted.push({ handle, mode });
    if (this.failDeletes) throw new Error("delete unavailable");
  }

  async clear(): Promise<void> {}

  inspect(): GraphicsSurfaceInspection {
    return {
      kind: this.kind,
      available: true,
      handles: [],
      commandCount: this.puts.length + this.deleted.length,
      mode: "direct",
    };
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 200): Promise<void> {
  const startedAt = performance.now();
  while (!predicate()) {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error("timed out waiting for render queue state");
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}
