import { assertEquals, assertStrictEquals, assertStringIncludes } from "./deps.ts";
import {
  type ApiWorkbenchThreePressureChange,
  ApiWorkbenchThreeRuntimeController,
  resolveApiWorkbenchThreePressureChange,
  resolveApiWorkbenchThreePressureChangeInto,
  shouldUpdateApiWorkbenchThreePressure,
} from "../src/app/workbench_three_runtime.ts";
import {
  apiWorkbenchThreeFrameIntervalForCells,
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
  controller.liveMaxCells.value = 240;

  const stats = { changed: 18, bytes: 120_000, durationMs: 0.1 };
  const sample = { renderedThreeGrids: 1, renderedThreeRows: 17 };

  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 240);
  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 240);
  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 120);
  controller.updatePressure(stats, sample);
  controller.updatePressure(stats, sample);
  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 60);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(logs.length, 2);
  assertStringIncludes(logs[0]!, "three pressure down 120 cells");
  assertStringIncludes(logs[1]!, "three pressure down 60 cells");

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

  assertEquals(controller.liveMaxCells.peek(), 960);
  controller.updatePressure(stats, sample, { observedFps: 3, targetFps: 24, observedFrameCount: 19 });
  assertEquals(controller.liveMaxCells.peek(), 960);
  controller.updatePressure(stats, sample, { observedFps: 3, targetFps: 24, observedFrameCount: 20 });
  assertEquals(controller.liveMaxCells.peek(), 480);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(logs.length, 1);
  assertStringIncludes(logs[0]!, "three pressure down 480 cells");

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController preserves default Three budget during startup ramp", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });
  const stats = { changed: 18, bytes: 9_500, durationMs: 0.08 };
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
    pressure: { currentCells: 120, highFrames: 0, lowFrames: 0 },
    currentCells: 120,
    frameIntervalMs: 1000 / 30,
    stats: { changed: 1, bytes: 45, durationMs: 0.1 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 6 },
  });

  assertEquals(change.pressure, { currentCells: 120, highFrames: 0, lowFrames: 1 });
  assertEquals(change.changed, false);
  assertEquals(change.nextCells, 120);
  assertEquals(change.scoped, true);
  assertEquals(change.logMessage, undefined);
});

Deno.test("resolveApiWorkbenchThreePressureChange projects downshift and log message", () => {
  const change = resolveApiWorkbenchThreePressureChange({
    pressure: { currentCells: 240, highFrames: 3, lowFrames: 0 },
    currentCells: 240,
    frameIntervalMs: 1000 / 30,
    stats: { changed: 12, bytes: 120_000, durationMs: 0.2 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 8 },
  });

  assertEquals(change.pressure, { currentCells: 120, highFrames: 0, lowFrames: 0 });
  assertEquals(change.changed, true);
  assertEquals(change.nextCells, 120);
  assertEquals(change.scoped, true);
  assertStringIncludes(change.logMessage ?? "", "three pressure down 120 cells");
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
    pressure: { currentCells: 240, highFrames: 3, lowFrames: 0 },
    currentCells: 240,
    frameIntervalMs: 1000 / 30,
    stats: { changed: 12, bytes: 120_000, durationMs: 0.2 },
    sample: { renderedThreeGrids: 1, renderedThreeRows: 8 },
  });

  assertStrictEquals(changed, target);
  assertStrictEquals(changed.pressure, pressure);
  assertEquals(changed.pressure, { currentCells: 120, highFrames: 0, lowFrames: 0 });
  assertEquals(changed.changed, true);
  assertStringIncludes(changed.logMessage ?? "", "three pressure down 120 cells");

  const steady = resolveApiWorkbenchThreePressureChangeInto(target, {
    pressure: target.pressure,
    currentCells: 120,
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
