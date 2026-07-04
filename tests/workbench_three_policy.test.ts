import { assertEquals } from "./deps.ts";
import {
  API_WORKBENCH_THREE_PRESSURE_POLICY,
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_DRAW_INTERVAL_MS,
  WORKBENCH_THREE_INITIAL_CELLS,
  WORKBENCH_THREE_PRESSURE_LEVELS,
  WORKBENCH_THREE_READBACK_STRATEGY,
} from "../app/workbench_three_policy.ts";
import {
  createWorkbenchThreeTerminalPressureState,
  resolveWorkbenchThreeTerminalPressureBudget,
} from "../src/app/workbench_three_terminal_pressure.ts";

Deno.test("API workbench Three policy exposes ordered pressure levels", () => {
  assertEquals(Array.from(new Set(WORKBENCH_THREE_PRESSURE_LEVELS)).sort((left, right) => left - right), [
    120,
    240,
    480,
    960,
  ]);
  assertEquals(WORKBENCH_THREE_INITIAL_CELLS, 240);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytes, 240_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytesPerGrid, 96_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytesPerSecond, 180_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowBytesPerGrid, 18_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold, 1);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold, 60);
  assertEquals(WORKBENCH_THREE_READBACK_STRATEGY, "blocking");
});

Deno.test("API workbench Three policy keeps live panes faster than idle panes", () => {
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(120, { live: true }), WORKBENCH_THREE_DRAW_INTERVAL_MS);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(240, { live: true }), WORKBENCH_THREE_DRAW_INTERVAL_MS);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(480, { live: true }), 1000 / 24);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(960, { live: true }), 1000 / 20);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(1_920, { live: true }), 1000 / 14);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: true }), 1000 / 10);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(240, { live: false }), 1000 / 8);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: false }), 1000 / 5);
});

Deno.test("API workbench Three policy starts at the responsive live budget", () => {
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }), 1000 / 30);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(960, { live: true }), 1000 / 20);
});

Deno.test("API workbench Three policy backs off on the first high-pressure terminal frame", () => {
  const state = createWorkbenchThreeTerminalPressureState(480);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 120_000,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(480, { live: true }),
  };

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  assertEquals(state.currentCells, 240);
  assertEquals(state.highFrames, 0);
});
