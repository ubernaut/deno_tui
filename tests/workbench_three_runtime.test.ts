import { assertEquals, assertStrictEquals, assertStringIncludes } from "./deps.ts";
import {
  type ApiWorkbenchThreePressureChange,
  ApiWorkbenchThreeRuntimeController,
  resolveApiWorkbenchThreePressureChange,
  resolveApiWorkbenchThreePressureChangeInto,
  shouldUpdateApiWorkbenchThreePressure,
  WorkbenchThreeOverlayPressureGate,
} from "../src/app/workbench_three_runtime.ts";
import {
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_FULLSCREEN_MAX_CELLS,
  WORKBENCH_THREE_FULLSCREEN_MIN_CELLS,
  WORKBENCH_THREE_INITIAL_CELLS,
} from "../src/app/workbench_three_policy.ts";

Deno.test("ApiWorkbenchThreeRuntimeController owns live cadence signals", () => {
  let live = true;
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => live,
  });

  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(
    controller.frameInterval.peek(),
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
  );

  live = false;
  controller.syncFrameInterval();
  assertEquals(controller.frameInterval.peek(), 1000 / 8);

  controller.dispose();
});

Deno.test("workbench Three pressure gate skips overlay frames", () => {
  assertEquals(shouldUpdateApiWorkbenchThreePressure({}), true);
  assertEquals(shouldUpdateApiWorkbenchThreePressure({ modalOpen: true }), false);
  assertEquals(shouldUpdateApiWorkbenchThreePressure({ dropdownOpen: true }), false);
  assertEquals(shouldUpdateApiWorkbenchThreePressure({ configOpen: true }), false);
  assertEquals(
    shouldUpdateApiWorkbenchThreePressure({ modalOpen: false, dropdownOpen: false, configOpen: false }),
    true,
  );
});

Deno.test("WorkbenchThreeOverlayPressureGate allows steady frames to update pressure", () => {
  const gate = new WorkbenchThreeOverlayPressureGate(2);

  assertEquals(gate.resolve(false), {
    resetCadence: false,
    resetPressureCounters: false,
    updatePressure: true,
  });
  assertEquals(gate.inspect(), { wasOpen: false, cooldownFrames: 0 });
});

Deno.test("WorkbenchThreeOverlayPressureGate suppresses pressure while overlay is open", () => {
  const gate = new WorkbenchThreeOverlayPressureGate(2);

  assertEquals(gate.resolve(true), {
    resetCadence: true,
    resetPressureCounters: true,
    updatePressure: false,
  });
  assertEquals(gate.inspect(), { wasOpen: true, cooldownFrames: 2 });

  assertEquals(gate.resolve(true), {
    resetCadence: true,
    resetPressureCounters: true,
    updatePressure: false,
  });
  assertEquals(gate.inspect(), { wasOpen: true, cooldownFrames: 2 });
});

Deno.test("WorkbenchThreeOverlayPressureGate suppresses pressure during close cooldown", () => {
  const gate = new WorkbenchThreeOverlayPressureGate(2);

  gate.resolve(true);

  assertEquals(gate.resolve(false), {
    resetCadence: true,
    resetPressureCounters: true,
    updatePressure: false,
  });
  assertEquals(gate.inspect(), { wasOpen: false, cooldownFrames: 1 });

  assertEquals(gate.resolve(false), {
    resetCadence: false,
    resetPressureCounters: false,
    updatePressure: false,
  });
  assertEquals(gate.inspect(), { wasOpen: false, cooldownFrames: 0 });

  assertEquals(gate.resolve(false), {
    resetCadence: false,
    resetPressureCounters: false,
    updatePressure: true,
  });
});

Deno.test("WorkbenchThreeOverlayPressureGate clamps invalid cooldowns and resets state", () => {
  const gate = new WorkbenchThreeOverlayPressureGate(-3);

  gate.resolve(true);
  assertEquals(gate.inspect(), { wasOpen: true, cooldownFrames: 0 });

  assertEquals(gate.resolve(false), {
    resetCadence: true,
    resetPressureCounters: true,
    updatePressure: true,
  });

  gate.resolve(true);
  gate.reset();
  assertEquals(gate.inspect(), { wasOpen: false, cooldownFrames: 0 });
  assertEquals(gate.resolve(false).updatePressure, true);
});

Deno.test("ApiWorkbenchThreeRuntimeController recovers toward live max under quiet scoped output", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });
  const stats = { changed: 5, bytes: 300, durationMs: 0.05 };
  const sample = { renderedThreeGrids: 1, renderedThreeRows: 4 };

  for (let index = 0; index < 90; index += 1) {
    controller.updatePressure(stats, sample);
  }

  assertEquals(controller.liveMaxCells.peek(), 960);
  assertEquals(controller.inspectPressure().lowFrames, 0);

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController keeps fullscreen pressure separate from normal live pressure", () => {
  let fullscreen = false;
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    hasFullscreenThreeWindow: () => fullscreen,
  });

  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(controller.fullscreenMaxCells.peek(), WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);

  fullscreen = true;
  controller.syncFrameInterval();
  assertEquals(
    controller.frameInterval.peek(),
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_FULLSCREEN_MIN_CELLS, { live: true }),
  );

  const heavyFullscreen = { changed: 26, bytes: 150_000, durationMs: 0.2 };
  const fullscreenSample = { renderedThreeGrids: 1, renderedThreeRows: 26 };
  controller.updatePressure(heavyFullscreen, fullscreenSample);
  controller.updatePressure(heavyFullscreen, fullscreenSample);
  controller.updatePressure(heavyFullscreen, fullscreenSample);

  assertEquals(controller.fullscreenMaxCells.peek(), WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);
  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);

  fullscreen = false;
  controller.syncFrameInterval();
  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(
    controller.frameInterval.peek(),
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
  );

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController promotes fullscreen budget on entry and viewport growth", () => {
  let fullscreen = false;
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    hasFullscreenThreeWindow: () => fullscreen,
  });

  assertEquals(controller.syncFullscreenTargetCells(6_200, fullscreen), WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);

  fullscreen = true;
  assertEquals(controller.syncFullscreenTargetCells(6_200, fullscreen), 6_200);
  assertEquals(controller.fullscreenMaxCells.peek(), 6_200);
  assertEquals(controller.inspectPressure().currentCells, 6_200);
  assertEquals(controller.inspectPressureDetails().currentCells, 6_200);
  assertEquals(
    controller.frameInterval.peek(),
    apiWorkbenchThreeFrameIntervalForCells(6_200, { live: true }),
  );

  assertEquals(controller.syncFullscreenTargetCells(8_800, fullscreen), 8_800);
  assertEquals(controller.fullscreenMaxCells.peek(), 8_800);

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController promotes live budget on pane growth", () => {
  let live = true;
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => live,
  });

  assertEquals(controller.syncLiveTargetCells(1_900, live, 2_000), 1_900);
  controller.liveMaxCells.value = 480;

  assertEquals(controller.syncLiveTargetCells(1_900, live, 2_000), 480);
  assertEquals(controller.syncLiveTargetCells(2_800, live, 3_200), 2_800);
  assertEquals(controller.inspectPressure().currentCells, 2_800);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(controller.inspectPressure().lowFrames, 0);

  live = false;
  assertEquals(controller.syncLiveTargetCells(3_200, live, 4_000), 2_800);
  live = true;
  assertEquals(controller.syncLiveTargetCells(3_200, live, 4_000), 3_200);

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController clamps live budget when pane shrinks", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });

  controller.syncLiveTargetCells(1_900, true, 2_000);
  assertEquals(controller.syncLiveTargetCells(900, true, 1_000), 900);
  assertEquals(controller.liveMaxCells.peek(), 900);
  assertEquals(controller.inspectPressure().currentCells, 900);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(controller.inspectPressure().lowFrames, 0);
  assertEquals(
    controller.frameInterval.peek(),
    apiWorkbenchThreeFrameIntervalForCells(900, { live: true }),
  );

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController does not undo fullscreen pressure downshift for the same target", () => {
  let fullscreen = true;
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    hasFullscreenThreeWindow: () => fullscreen,
  });

  controller.syncFullscreenTargetCells(6_200, fullscreen);
  controller.fullscreenMaxCells.value = 1_920;

  assertEquals(controller.syncFullscreenTargetCells(6_200, fullscreen), 1_920);

  fullscreen = false;
  controller.syncFullscreenTargetCells(6_200, fullscreen);
  fullscreen = true;
  assertEquals(controller.syncFullscreenTargetCells(6_200, fullscreen), 6_200);

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController promotes downshifted fullscreen budget when viewport grows", () => {
  const fullscreen = true;
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    hasFullscreenThreeWindow: () => fullscreen,
  });

  controller.syncFullscreenTargetCells(WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, fullscreen, 8_000);
  controller.fullscreenMaxCells.value = 1_920;

  assertEquals(controller.syncFullscreenTargetCells(WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, fullscreen, 8_000), 1_920);
  assertEquals(
    controller.syncFullscreenTargetCells(WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, fullscreen, 10_000),
    WORKBENCH_THREE_FULLSCREEN_MAX_CELLS,
  );
  assertEquals(controller.inspectPressure().currentCells, WORKBENCH_THREE_FULLSCREEN_MAX_CELLS);

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController clamps fullscreen budget when viewport shrinks", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    hasFullscreenThreeWindow: () => true,
  });

  controller.syncFullscreenTargetCells(8_800, true, 9_200);
  assertEquals(controller.syncFullscreenTargetCells(4_386, true, 4_515), 4_386);
  assertEquals(controller.fullscreenMaxCells.peek(), 4_386);
  assertEquals(controller.inspectPressure().currentCells, 4_386);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(controller.inspectPressure().lowFrames, 0);
  assertEquals(
    controller.frameInterval.peek(),
    apiWorkbenchThreeFrameIntervalForCells(4_386, { live: true }),
  );

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController lets small fullscreen panes shrink below the old floor", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    hasFullscreenThreeWindow: () => true,
  });

  controller.syncFullscreenTargetCells(6_346, true, 6_346);
  assertEquals(controller.syncFullscreenTargetCells(1_940, true, 1_940), 1_940);
  assertEquals(controller.fullscreenMaxCells.peek(), 1_940);
  assertEquals(controller.inspectPressure().currentCells, 1_940);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(controller.inspectPressure().lowFrames, 0);
  assertEquals(
    controller.frameInterval.peek(),
    apiWorkbenchThreeFrameIntervalForCells(1_940, { live: true }),
  );

  controller.dispose();
});

Deno.test("resolveApiWorkbenchThreePressureChange uses fullscreen pressure tiers when requested", () => {
  const change = resolveApiWorkbenchThreePressureChange({
    pressure: { currentCells: WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, highFrames: 2, lowFrames: 0 },
    currentCells: WORKBENCH_THREE_FULLSCREEN_MAX_CELLS,
    fullscreenThree: true,
    frameIntervalMs: 1000 / 10,
    stats: { changed: 26, bytes: 150_000, durationMs: 0.2 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 26 },
    observedFps: 4,
    targetFps: 15,
    observedFrameCount: 999,
  });

  assertEquals(change.pressure, { currentCells: 15_400, highFrames: 0, lowFrames: 0 });
  assertEquals(change.changed, true);
  assertEquals(change.nextCells, 15_400);
});

Deno.test("ApiWorkbenchThreeRuntimeController records and resets rendered grid pressure samples", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });

  controller.recordRenderedGridForPressure(17.9);
  controller.recordRenderedGridForPressure(-4);

  assertEquals(controller.inspectPressureSample(), {
    renderedThreeGrids: 2,
    renderedThreeRows: 17,
  });

  controller.resetPressureSample();

  assertEquals(controller.inspectPressureSample(), {
    renderedThreeGrids: 0,
    renderedThreeRows: 0,
  });

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController can reuse pressure sample targets", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });
  const target = { renderedThreeGrids: -1, renderedThreeRows: -1 };

  controller.recordRenderedGridForPressure(12);
  const result = controller.inspectPressureSampleInto(target);

  assertStrictEquals(result, target);
  assertEquals(target, { renderedThreeGrids: 1, renderedThreeRows: 12 });

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController resets pressure counters without changing cell budget", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });

  controller.updatePressure(
    { changed: 12, bytes: 120_000, durationMs: 0.1 },
    { renderedThreeGrids: 1, renderedThreeRows: 12 },
  );

  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(controller.inspectPressure().highFrames, 1);

  controller.resetPressureCounters();

  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(controller.inspectPressure().lowFrames, 0);
  assertEquals(controller.inspectPressureDetails().highFrames, 0);
  assertEquals(controller.inspectPressureDetails().lowFrames, 0);

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController can reuse pressure state targets", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });
  const target = { currentCells: -1, highFrames: -1, lowFrames: -1 };

  controller.updatePressure(
    { changed: 12, bytes: 120_000, durationMs: 0.1 },
    { renderedThreeGrids: 1, renderedThreeRows: 12 },
  );
  const result = controller.inspectPressureInto(target);

  assertStrictEquals(result, target);
  assertEquals(target, { currentCells: WORKBENCH_THREE_INITIAL_CELLS, highFrames: 1, lowFrames: 0 });

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController backs off on scoped pressure and logs changes", () => {
  const logs: string[] = [];
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    onPressureChange: (message) => logs.push(message),
  });
  controller.liveMaxCells.value = 960;

  const stats = { changed: 18, bytes: 120_000, durationMs: 0.1 };
  const sample = { renderedThreeGrids: 1, renderedThreeRows: 17 };

  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 960);
  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 960);
  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 480);
  controller.updatePressure(stats, sample);
  controller.updatePressure(stats, sample);
  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 480);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(logs.length, 1);
  assertStringIncludes(logs[0]!, "three pressure down 480 cells");

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController backs off when observed cadence is too low", () => {
  const logs: string[] = [];
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    onPressureChange: (message) => logs.push(message),
  });

  const stats = { changed: 6, bytes: 1_200, durationMs: 0.05 };
  const sample = { renderedThreeGrids: 1, renderedThreeRows: 6 };

  controller.updatePressure(stats, sample, { observedFps: 3, targetFps: 24, observedFrameCount: 18 });

  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  controller.updatePressure(stats, sample, { observedFps: 3, targetFps: 24, observedFrameCount: 19 });
  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  controller.updatePressure(stats, sample, { observedFps: 3, targetFps: 24, observedFrameCount: 20 });
  assertEquals(controller.liveMaxCells.peek(), 480);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(logs.length, 1);
  assertStringIncludes(logs[0]!, "three pressure down 480 cells");

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController keeps ordinary startup output within byte-rate budget", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });
  const stats = { changed: 18, bytes: 4_600, durationMs: 0.08 };
  const sample = { renderedThreeGrids: 1, renderedThreeRows: 18 };

  for (let update = 2; update <= 17; update += 1) {
    controller.updatePressure(stats, sample, {
      observedFps: Math.min(20, update * 1.2),
      targetFps: 20,
      observedFrameCount: update,
    });
  }

  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(controller.inspectPressure().highFrames, 0);

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController derives pressure telemetry from cadence inspection", () => {
  const logs: string[] = [];
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    onPressureChange: (message) => logs.push(message),
  });

  controller.updatePressureFromCadence(
    { changed: 40, bytes: 1_200, durationMs: 0.05 },
    { measuredFps: 10, updates: 18 },
    { renderedThreeGrids: 1, renderedThreeRows: 8 },
  );
  controller.updatePressureFromCadence(
    { changed: 40, bytes: 1_200, durationMs: 0.05 },
    { measuredFps: 10, updates: 19 },
    { renderedThreeGrids: 1, renderedThreeRows: 8 },
  );
  controller.updatePressureFromCadence(
    { changed: 40, bytes: 1_200, durationMs: 0.05 },
    { measuredFps: 10, updates: 20 },
    { renderedThreeGrids: 1, renderedThreeRows: 8 },
  );

  assertEquals(controller.liveMaxCells.peek(), 480);
  assertEquals(controller.inspectPressureDetails().lastScoped, true);
  assertEquals(logs.length, 1);
  assertStringIncludes(logs[0]!, "three pressure down 480 cells");

  controller.dispose();
});

Deno.test("resolveApiWorkbenchThreePressureChange reports steady pressure without log text", () => {
  const change = resolveApiWorkbenchThreePressureChange({
    pressure: { currentCells: 480, highFrames: 0, lowFrames: 0 },
    currentCells: 480,
    frameIntervalMs: 1000 / 30,
    stats: { changed: 1, bytes: 45, durationMs: 0.1 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 6 },
  });

  assertEquals(change.pressure, { currentCells: 480, highFrames: 0, lowFrames: 1 });
  assertEquals(change.changed, false);
  assertEquals(change.nextCells, 480);
  assertEquals(change.scoped, true);
  assertEquals(change.logMessage, undefined);
});

Deno.test("resolveApiWorkbenchThreePressureChange preserves viewport-promoted live cell budgets", () => {
  const change = resolveApiWorkbenchThreePressureChange({
    pressure: { currentCells: 1_140, highFrames: 0, lowFrames: 0 },
    currentCells: 1_140,
    frameIntervalMs: 1000 / 20,
    stats: { changed: 8, bytes: 600, durationMs: 0.1 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 18 },
  });

  assertEquals(change.pressure, { currentCells: 1_140, highFrames: 0, lowFrames: 0 });
  assertEquals(change.changed, false);
  assertEquals(change.nextCells, 1_140);
  assertEquals(change.scoped, true);
});

Deno.test("resolveApiWorkbenchThreePressureChange preserves viewport-promoted fullscreen budgets on broad redraws", () => {
  const change = resolveApiWorkbenchThreePressureChange({
    pressure: { currentCells: 5_624, highFrames: 2, lowFrames: 3 },
    currentCells: 5_624,
    fullscreenThree: true,
    frameIntervalMs: 1000 / 20,
    stats: { changed: 47, bytes: 900_000, durationMs: 8 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 38 },
  });

  assertEquals(change.pressure, { currentCells: 5_624, highFrames: 0, lowFrames: 0 });
  assertEquals(change.changed, false);
  assertEquals(change.nextCells, 5_624);
  assertEquals(change.scoped, false);
});

Deno.test("resolveApiWorkbenchThreePressureChange projects downshift and log message", () => {
  const change = resolveApiWorkbenchThreePressureChange({
    pressure: { currentCells: 960, highFrames: 3, lowFrames: 0 },
    currentCells: 960,
    frameIntervalMs: 1000 / 30,
    stats: { changed: 12, bytes: 120_000, durationMs: 0.2 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 8 },
  });

  assertEquals(change.pressure, { currentCells: 480, highFrames: 0, lowFrames: 0 });
  assertEquals(change.changed, true);
  assertEquals(change.nextCells, 480);
  assertEquals(change.scoped, true);
  assertStringIncludes(change.logMessage ?? "", "three pressure down 480 cells");
});

Deno.test("resolveApiWorkbenchThreePressureChangeInto reuses target state", () => {
  const target: ApiWorkbenchThreePressureChange = {
    pressure: { currentCells: -1, highFrames: -1, lowFrames: -1 },
    changed: true,
    nextCells: -1,
    scoped: true,
    logMessage: "stale",
  };
  const pressure = target.pressure;

  const changed = resolveApiWorkbenchThreePressureChangeInto(target, {
    pressure: { currentCells: 960, highFrames: 3, lowFrames: 0 },
    currentCells: 960,
    frameIntervalMs: 1000 / 30,
    stats: { changed: 12, bytes: 120_000, durationMs: 0.2 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 8 },
  });

  assertStrictEquals(changed, target);
  assertStrictEquals(changed.pressure, pressure);
  assertEquals(changed.pressure, { currentCells: 480, highFrames: 0, lowFrames: 0 });
  assertEquals(changed.changed, true);
  assertStringIncludes(changed.logMessage ?? "", "three pressure down 480 cells");

  const steady = resolveApiWorkbenchThreePressureChangeInto(target, {
    pressure: target.pressure,
    currentCells: 480,
    frameIntervalMs: 1000 / 30,
    stats: { changed: 1, bytes: 45, durationMs: 0.1 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 6 },
  });

  assertStrictEquals(steady, target);
  assertStrictEquals(steady.pressure, pressure);
  assertEquals(steady.logMessage, undefined);
  assertEquals(steady.changed, false);
});

Deno.test("ApiWorkbenchThreeRuntimeController exposes last pressure diagnostics", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });

  assertEquals(controller.inspectPressureDetails(), {
    currentCells: WORKBENCH_THREE_INITIAL_CELLS,
    highFrames: 0,
    lowFrames: 0,
    lastBytes: 0,
    lastByteRate: 0,
    lastChangedRows: 0,
    lastRenderedGrids: 0,
    lastRenderedRows: 0,
    lastScoped: false,
  });

  controller.updatePressure(
    { changed: 4, bytes: 300, durationMs: 0.1 },
    { renderedThreeGrids: 1, renderedThreeRows: 4 },
  );

  assertEquals(controller.inspectPressureDetails(), {
    currentCells: WORKBENCH_THREE_INITIAL_CELLS,
    highFrames: 0,
    lowFrames: 0,
    lastBytes: 300,
    lastByteRate: 6_000,
    lastChangedRows: 4,
    lastRenderedGrids: 1,
    lastRenderedRows: 4,
    lastScoped: true,
  });

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController can reuse pressure inspection targets", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });
  const target = controller.inspectPressureDetails();

  controller.updatePressure(
    { changed: 4, bytes: 300, durationMs: 0.1 },
    { renderedThreeGrids: 1, renderedThreeRows: 4 },
  );

  const result = controller.inspectPressureDetailsInto(target);

  assertStrictEquals(result, target);
  assertEquals(target, {
    currentCells: WORKBENCH_THREE_INITIAL_CELLS,
    highFrames: 0,
    lowFrames: 0,
    lastBytes: 300,
    lastByteRate: 6_000,
    lastChangedRows: 4,
    lastRenderedGrids: 1,
    lastRenderedRows: 4,
    lastScoped: true,
  });

  controller.dispose();
});
