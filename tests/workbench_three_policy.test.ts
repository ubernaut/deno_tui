import { assertEquals } from "./deps.ts";
import {
  API_WORKBENCH_THREE_PRESSURE_POLICY,
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_DRAW_INTERVAL_MS,
  WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS,
  WORKBENCH_THREE_INITIAL_CELLS,
  WORKBENCH_THREE_PRESSURE_LEVELS,
  WORKBENCH_THREE_PRESSURE_LOW_FPS_RATIO,
  WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  WORKBENCH_THREE_READBACK_STRATEGY,
  WORKBENCH_THREE_RESCUE_CELLS,
  WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS,
} from "../src/app/workbench_three_policy.ts";
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
  assertEquals(WORKBENCH_THREE_INITIAL_CELLS, 240);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytes, 240_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytesPerGrid, 160_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytesPerSecond, 750_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowBytesPerGrid, 12_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowBytesPerSecond, 180_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowFpsRatio, WORKBENCH_THREE_PRESSURE_LOW_FPS_RATIO);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.minObservedFpsFrames, WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold, 1);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold, 30);
  assertEquals(WORKBENCH_THREE_READBACK_STRATEGY, "blocking");
});

Deno.test("API workbench Three policy keeps live panes faster than idle panes", () => {
  assertEquals(
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_RESCUE_CELLS, { live: true }),
    WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS,
  );
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(60, { live: true }), WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(120, { live: true }), 1000 / 15);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(240, { live: true }), 1000 / 20);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(480, { live: true }), 1000 / 20);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(960, { live: true }), 1000 / 18);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(1_920, { live: true }), 1000 / 14);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: true }), 1000 / 10);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(240, { live: false }), 1000 / 8);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: false }), 1000 / 5);
});

Deno.test("API workbench Three policy starts at a remote-terminal friendly live tier but keeps rescue available", () => {
  assertEquals(WORKBENCH_THREE_INITIAL_CELLS, 240);
  assertEquals(
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
    1000 / 20,
  );
  assertEquals(
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_RESCUE_CELLS, { live: true }),
    WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS,
  );
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(60, { live: true }), 1000 / 12);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(960, { live: true }), 1000 / 18);
});

Deno.test("API workbench Three policy recovers one tier after sustained quiet output", () => {
  const state = createWorkbenchThreeTerminalPressureState(60);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 300,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(60, { live: true }),
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 120);
  assertEquals(state.lowFrames, 0);
});

Deno.test("API workbench Three policy backs off after sustained high-pressure terminal frames", () => {
  const state = createWorkbenchThreeTerminalPressureState(480);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 180_000,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(480, { live: true }),
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }
  assertEquals(state.currentCells, 240);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy keeps ordinary startup block frames at the initial tier", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 1_600,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy backs off when observed FPS collapses", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 1_200,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
    observedFps: 4,
    targetFps: 24,
    observedFrameCount: WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 120);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy ignores early startup-skewed cadence samples", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 1_200,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
    observedFps: 3,
    targetFps: 24,
    observedFrameCount: WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES - 1,
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy recovers from moderate animated output under the byte-rate floor", () => {
  const state = createWorkbenchThreeTerminalPressureState(60);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 1_100,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(60, { live: true }),
  };

  const frames = (API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold ?? 1) + 5;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 120);
  assertEquals(state.lowFrames, 5);
});

Deno.test("API workbench Three policy downshifts sustained 240-cell terminal byte rate", () => {
  const state = createWorkbenchThreeTerminalPressureState(240);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 40_000,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(240, { live: true }),
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 120);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy reaches a 30-cell rescue tier under terminal pressure", () => {
  const state = createWorkbenchThreeTerminalPressureState(120);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 50_000,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(120, { live: true }),
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 60);
  assertEquals(state.highFrames, 0);

  for (let index = 0; index < frames; index += 1) {
    Object.assign(
      state,
      resolveWorkbenchThreeTerminalPressureBudget(state, {
        ...sample,
        bytes: 80_000,
        sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(60, { live: true }),
      }),
    );
  }

  assertEquals(state.currentCells, WORKBENCH_THREE_RESCUE_CELLS);
  assertEquals(state.highFrames, 0);
});
