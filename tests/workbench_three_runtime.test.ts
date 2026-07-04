import { assertEquals, assertStringIncludes } from "./deps.ts";
import { ApiWorkbenchThreeRuntimeController } from "../app/workbench_three_runtime.ts";
import { WORKBENCH_THREE_INITIAL_CELLS } from "../app/workbench_three_policy.ts";

Deno.test("ApiWorkbenchThreeRuntimeController owns live cadence signals", () => {
  let live = true;
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => live,
  });

  assertEquals(controller.liveMaxCells.peek(), WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(controller.frameInterval.peek(), 1000 / 30);

  live = false;
  controller.syncFrameInterval();
  assertEquals(controller.frameInterval.peek(), 1000 / 8);

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

Deno.test("ApiWorkbenchThreeRuntimeController applies sustained pressure and logs changes", () => {
  const logs: string[] = [];
  const controller = new ApiWorkbenchThreeRuntimeController({
    hasLiveThreeWindow: () => true,
    onPressureChange: (message) => logs.push(message),
  });

  const stats = { changed: 18, bytes: 120_000, durationMs: 0.1 };
  const sample = { renderedThreeGrids: 1, renderedThreeRows: 17 };

  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 240);
  assertEquals(controller.inspectPressure().highFrames, 1);
  controller.updatePressure(stats, sample);
  assertEquals(controller.liveMaxCells.peek(), 240);
  assertEquals(controller.inspectPressure().highFrames, 2);
  controller.updatePressure(stats, sample);

  assertEquals(controller.liveMaxCells.peek(), 120);
  assertEquals(controller.inspectPressure().highFrames, 0);
  assertEquals(logs.length, 1);
  assertStringIncludes(logs[0]!, "three pressure down 120 cells");

  controller.dispose();
});
