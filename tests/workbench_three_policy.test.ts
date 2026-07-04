import { assertEquals } from "./deps.ts";
import {
  API_WORKBENCH_THREE_PRESSURE_POLICY,
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_DRAW_INTERVAL_MS,
  WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS,
  WORKBENCH_THREE_INITIAL_CELLS,
  WORKBENCH_THREE_PRESSURE_LEVELS,
  WORKBENCH_THREE_READBACK_STRATEGY,
  WORKBENCH_THREE_RESCUE_CELLS,
  WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS,
} from "../app/workbench_three_policy.ts";
import {
  createWorkbenchThreeTerminalPressureState,
  resolveWorkbenchThreeTerminalPressureBudget,
} from "../src/app/workbench_three_terminal_pressure.ts";

Deno.test("API workbench Three policy exposes ordered pressure levels", () => {
  assertEquals(Array.from(new Set(WORKBENCH_THREE_PRESSURE_LEVELS)).sort((left, right) => left - right), [
    30,
    60,
    120,
    240,
    480,
    960,
  ]);
  assertEquals(WORKBENCH_THREE_INITIAL_CELLS, 60);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytes, 240_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytesPerGrid, 96_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytesPerSecond, 35_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowBytesPerGrid, 1_500);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowBytesPerSecond, 7_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold, 1);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold, 45);
  assertEquals(WORKBENCH_THREE_READBACK_STRATEGY, "deferred");
});

Deno.test("API workbench Three policy keeps live panes faster than idle panes", () => {
  assertEquals(
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_RESCUE_CELLS, { live: true }),
    WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS,
  );
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(60, { live: true }), WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(120, { live: true }), WORKBENCH_THREE_DRAW_INTERVAL_MS);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(240, { live: true }), WORKBENCH_THREE_DRAW_INTERVAL_MS);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(480, { live: true }), 1000 / 24);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(960, { live: true }), 1000 / 20);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(1_920, { live: true }), 1000 / 14);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: true }), 1000 / 10);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(240, { live: false }), 1000 / 8);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: false }), 1000 / 5);
});

Deno.test("API workbench Three policy starts above rescue but keeps rescue available", () => {
  assertEquals(WORKBENCH_THREE_INITIAL_CELLS, 60);
  assertEquals(
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
    WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS,
  );
  assertEquals(
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_RESCUE_CELLS, { live: true }),
    WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS,
  );
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(60, { live: true }), 1000 / 20);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(960, { live: true }), 1000 / 20);
});

Deno.test("API workbench Three policy recovers startup tier after sustained quiet output", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 300,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 120);
  assertEquals(state.lowFrames, 0);
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

Deno.test("API workbench Three policy does not recover from moderate animated output", () => {
  const state = createWorkbenchThreeTerminalPressureState(60);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 1_000,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(60, { live: true }),
  };

  const frames = (API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold ?? 1) + 5;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 60);
  assertEquals(state.lowFrames, 0);
});

Deno.test("API workbench Three policy downshifts sustained 240-cell terminal byte rate", () => {
  const state = createWorkbenchThreeTerminalPressureState(240);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 1_600,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(240, { live: true }),
  };

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));

  assertEquals(state.currentCells, 120);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy reaches a 30-cell rescue tier under terminal pressure", () => {
  const state = createWorkbenchThreeTerminalPressureState(120);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 1_600,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(120, { live: true }),
  };

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));

  assertEquals(state.currentCells, 60);
  assertEquals(state.highFrames, 0);

  Object.assign(
    state,
    resolveWorkbenchThreeTerminalPressureBudget(state, {
      ...sample,
      bytes: 2_000,
      sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(60, { live: true }),
    }),
  );

  assertEquals(state.currentCells, WORKBENCH_THREE_RESCUE_CELLS);
  assertEquals(state.highFrames, 0);
});
