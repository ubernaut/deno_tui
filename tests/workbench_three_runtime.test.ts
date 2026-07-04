import { assertEquals, assertStrictEquals, assertStringIncludes } from "./deps.ts";
import {
  ApiWorkbenchThreeRuntimeController,
  resolveApiWorkbenchThreePressureChange,
} from "../app/workbench_three_runtime.ts";
import {
  WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS,
  WORKBENCH_THREE_INITIAL_CELLS,
} from "../app/workbench_three_policy.ts";

Deno.test("ApiWorkbenchThreeRuntimeController owns live cadence signals", () => {
  let live = true;
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => live,
  });

  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(controller.frameInterval.peek(), WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS);

  live = false;
  controller.syncFrameInterval();
  assertEquals(controller.frameInterval.peek(), 1000 / 8);

  controller.dispose();
});

Deno.test("ApiWorkbenchThreeRuntimeController recovers startup cells under quiet scoped output", () => {
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
  });
  const stats = { changed: 5, bytes: 300, durationMs: 0.05 };
  const sample = { renderedThreeGrids: 1, renderedThreeRows: 4 };

  for (let index = 0; index < 45; index += 1) {
    controller.updatePressure(stats, sample);
  }

  assertEquals(controller.liveMaxCells.peek(), 120);
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
  assertEquals(controller.liveMaxCells.peek(), 120);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(logs.length, 1);
  assertStringIncludes(logs[0]!, "three pressure down 120 cells");

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

  assertEquals(change, {
    pressure: { currentCells: 120, highFrames: 0, lowFrames: 1 },
    changed: false,
    nextCells: 120,
    scoped: true,
  });
});

Deno.test("resolveApiWorkbenchThreePressureChange projects downshift and log message", () => {
  const change = resolveApiWorkbenchThreePressureChange({
    pressure: { currentCells: 240, highFrames: 0, lowFrames: 0 },
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
    { changed: 4, bytes: 2_000, durationMs: 0.1 },
    { renderedThreeGrids: 1, renderedThreeRows: 4 },
  );

  assertEquals(controller.inspectPressureDetails(), {
    currentCells: 30,
    highFrames: 0,
    lowFrames: 0,
    lastBytes: 2_000,
    lastByteRate: 40_000,
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
    { changed: 4, bytes: 2_000, durationMs: 0.1 },
    { renderedThreeGrids: 1, renderedThreeRows: 4 },
  );

  const result = controller.inspectPressureDetailsInto(target);

  assertStrictEquals(result, target);
  assertEquals(target, {
    currentCells: 30,
    highFrames: 0,
    lowFrames: 0,
    lastBytes: 2_000,
    lastByteRate: 40_000,
    lastChangedRows: 4,
    lastRenderedGrids: 1,
    lastRenderedRows: 4,
    lastScoped: true,
  });

  controller.dispose();
});
