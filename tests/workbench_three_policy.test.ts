import { assertEquals, assertStrictEquals } from "./deps.ts";
import { createDefaultWorkbenchAsciiOptions } from "../src/app/workbench_ascii.ts";
import {
  API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY,
  API_WORKBENCH_THREE_PRESSURE_POLICY,
  apiWorkbenchThreeEffectiveMaxCells,
  apiWorkbenchThreeFrameIntervalForCells,
  createWorkbenchThreeWindowState,
  resolveWorkbenchThreeFullscreenAsciiOptions,
  resolveWorkbenchThreeLiveAsciiOptions,
  resolveWorkbenchThreeRuntimeBudgetSnapshot,
  resolveWorkbenchThreeRuntimeBudgetSourceId,
  resolveWorkbenchThreeTiledAsciiOptions,
  resolveWorkbenchThreeWindowState,
  resolveWorkbenchThreeWindowStateInto,
  sameWorkbenchThreeAsciiOptions,
  WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS,
  WORKBENCH_THREE_FULLSCREEN_MAX_CELLS,
  WORKBENCH_THREE_FULLSCREEN_MIN_CELLS,
  WORKBENCH_THREE_FULLSCREEN_PRESSURE_FLOOR_CELLS,
  WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_SECOND,
  WORKBENCH_THREE_FULLSCREEN_PRESSURE_LEVELS,
  WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_SECOND,
  WORKBENCH_THREE_INITIAL_CELLS,
  WORKBENCH_THREE_LIVE_MAX_CELLS,
  WORKBENCH_THREE_PRESSURE_LEVELS,
  WORKBENCH_THREE_PRESSURE_LOW_FPS_RATIO,
  WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  WORKBENCH_THREE_READBACK_STRATEGY,
  WORKBENCH_THREE_RESCUE_CELLS,
  WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS,
  workbenchThreeFullscreenRenderCells,
  workbenchThreeLiveRenderCells,
  workbenchThreeWindowStateIsInteractive,
} from "../src/app/workbench_three_policy.ts";
import {
  createWorkbenchThreeTerminalPressureState,
  resolveWorkbenchThreeTerminalPressureBudget,
  resolveWorkbenchThreeTerminalPressureUpdate,
} from "../src/app/workbench_three_terminal_pressure.ts";

Deno.test("API workbench Three policy exposes ordered pressure levels", () => {
  assertEquals(Array.from(new Set(WORKBENCH_THREE_PRESSURE_LEVELS)).sort((left, right) => left - right), [
    480,
    960,
  ]);
  assertEquals(Array.from(WORKBENCH_THREE_FULLSCREEN_PRESSURE_LEVELS), [
    3840,
    7680,
    15400,
    30720,
  ]);
  assertEquals(WORKBENCH_THREE_INITIAL_CELLS, 960);
  assertEquals(WORKBENCH_THREE_FULLSCREEN_MIN_CELLS, 3_840);
  assertEquals(WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, 30_720);
  assertEquals(WORKBENCH_THREE_FULLSCREEN_PRESSURE_FLOOR_CELLS, WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytes, 480_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytesPerGrid, 24_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytesPerSecond, 600_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowBytesPerGrid, 2_500);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowBytesPerSecond, 90_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowFpsRatio, WORKBENCH_THREE_PRESSURE_LOW_FPS_RATIO);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.minObservedFpsFrames, WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold, 3);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold, 30);
  assertEquals(API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY.levels, WORKBENCH_THREE_FULLSCREEN_PRESSURE_LEVELS);
  assertEquals(
    API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY.highBytesPerSecond,
    WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_SECOND,
  );
  assertEquals(
    API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY.lowBytesPerSecond,
    WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_SECOND,
  );
  assertEquals(WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_SECOND, Number.POSITIVE_INFINITY);
  assertEquals(WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_SECOND, 170_000);
  assertEquals(WORKBENCH_THREE_READBACK_STRATEGY, "deferred");
});

Deno.test("API workbench Three policy keeps effective caps pressure-controlled in fullscreen", () => {
  assertEquals(apiWorkbenchThreeEffectiveMaxCells(120), 120);
  assertEquals(apiWorkbenchThreeEffectiveMaxCells(120, { fullscreenThree: false }), 120);
  assertEquals(apiWorkbenchThreeEffectiveMaxCells(120, { fullscreenThree: true }), 120);
  assertEquals(apiWorkbenchThreeEffectiveMaxCells(WORKBENCH_THREE_LIVE_MAX_CELLS, { fullscreenThree: true }), 960);
  assertEquals(apiWorkbenchThreeEffectiveMaxCells(120, { fullscreenThree: true, fullscreenMinCells: 240 }), 120);
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
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(960, { live: true }), 1000 / 20);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(1_140, { live: true }), 1000 / 20);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(1_920, { live: true }), 1000 / 20);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: true }), 1000 / 20);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(7_680, { live: true }), 1000 / 15);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(15_400, { live: true }), 1000 / 15);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(30_720, { live: true }), 1000 / 12);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(240, { live: false }), 1000 / 8);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: false }), 1000 / 5);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(7_680, { live: false }), 1000 / 4);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(15_400, { live: false }), 1000 / 4);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(30_720, { live: false }), 1000 / 4);
});

Deno.test("API workbench Three fullscreen render target matches viewport area by default", () => {
  assertEquals(workbenchThreeFullscreenRenderCells({ width: 20, height: 10 }), 200);
  assertEquals(workbenchThreeFullscreenRenderCells({ width: 100, height: 50 }), 5_000);
  assertEquals(workbenchThreeFullscreenRenderCells({ width: 240, height: 90 }), 21_600);
  assertEquals(workbenchThreeFullscreenRenderCells({ width: 360, height: 120 }), 43_200);
  assertEquals(
    workbenchThreeFullscreenRenderCells(
      { width: 100, height: 50 },
      { minCells: 120, maxCells: 960 },
    ),
    960,
  );
});

Deno.test("API workbench Three live render target follows tiled pane size", () => {
  assertEquals(workbenchThreeLiveRenderCells({ width: 20, height: 10 }), 200);
  assertEquals(workbenchThreeLiveRenderCells({ width: 51, height: 17 }), 867);
  assertEquals(workbenchThreeLiveRenderCells({ width: 100, height: 40 }), 4_000);
  assertEquals(workbenchThreeLiveRenderCells({ width: 100, height: 40 }, { maxCells: 3_840 }), 3_840);
});

Deno.test("API workbench Three policy leaves non-fullscreen ASCII options unchanged", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const resolved = resolveWorkbenchThreeFullscreenAsciiOptions({
    id: "three",
    fullscreenId: "logs",
    ascii,
    fullscreenMinCells: 3_840,
  });

  assertStrictEquals(resolved, ascii);
});

Deno.test("API workbench Three policy raises only runtime render cells for fullscreen", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const resolved = resolveWorkbenchThreeFullscreenAsciiOptions({
    id: "three",
    fullscreenId: "three",
    ascii,
    fullscreenMinCells: 3_840,
  });

  assertEquals(resolved.renderMaxCells, 3_840);
  assertEquals(ascii.renderMaxCells, 960);
  assertEquals(resolved.terminalGlyphStyle, ascii.terminalGlyphStyle);
});

Deno.test("API workbench Three policy preserves higher explicit render caps", () => {
  const ascii = { ...createDefaultWorkbenchAsciiOptions(), renderMaxCells: 7_680 };
  const resolved = resolveWorkbenchThreeFullscreenAsciiOptions({
    id: "three",
    fullscreenId: "three",
    ascii,
    fullscreenMinCells: 3_840,
  });

  assertStrictEquals(resolved, ascii);
});

Deno.test("API workbench Three policy raises to viewport-derived fullscreen caps", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const resolved = resolveWorkbenchThreeFullscreenAsciiOptions({
    id: "three",
    fullscreenId: "three",
    ascii,
    fullscreenMinCells: 6_600,
  });

  assertEquals(resolved.renderMaxCells, 6_600);
  assertEquals(ascii.renderMaxCells, 960);
});

Deno.test("API workbench Three policy projects viewport target cap and runtime ASCII", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    fullscreenId: "three",
    ascii,
    liveMaxCells: 480,
    fullscreenMaxCells: 1_920,
    viewport: { width: 120, height: 50 },
    fullscreenViewportPadding: { columns: 6, rows: 10 },
  });

  assertEquals(snapshot.fullscreenTargetCells, 4_560);
  assertEquals(snapshot.fullscreenViewportCells, 4_560);
  assertEquals(snapshot.effectiveMaxCells, 1_920);
  assertEquals(snapshot.runtimeAscii.renderMaxCells, 4_560);
  assertEquals(ascii.renderMaxCells, 960);
});

Deno.test("API workbench Three policy uses measured body size for active fullscreen panes", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    fullscreenId: "three",
    ascii,
    liveMaxCells: 960,
    liveViewport: { width: 177, height: 45 },
    fullscreenMaxCells: 30_720,
    viewport: { width: 180, height: 54 },
    fullscreenViewportPadding: { columns: 6, rows: 10 },
  });

  assertEquals(snapshot.fullscreenViewportCells, 7_965);
  assertEquals(snapshot.fullscreenTargetCells, 7_965);
  assertEquals(snapshot.effectiveMaxCells, 30_720);
  assertEquals(snapshot.runtimeAscii.renderMaxCells, 7_965);
});

Deno.test("API workbench Three policy allows large fullscreen panes to use the exposed top render tier", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    fullscreenId: "three",
    ascii,
    liveMaxCells: 960,
    liveViewport: { width: 240, height: 95 },
    fullscreenMaxCells: WORKBENCH_THREE_FULLSCREEN_MAX_CELLS,
    viewport: { width: 246, height: 105 },
    fullscreenViewportPadding: { columns: 6, rows: 10 },
  });

  assertEquals(snapshot.fullscreenViewportCells, 22_800);
  assertEquals(snapshot.fullscreenTargetCells, 22_800);
  assertEquals(snapshot.effectiveMaxCells, WORKBENCH_THREE_FULLSCREEN_MAX_CELLS);
  assertEquals(snapshot.runtimeAscii.renderMaxCells, 22_800);
});

Deno.test("API workbench Three policy keeps live cap outside fullscreen Three panes", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    fullscreenId: "logs",
    ascii,
    liveMaxCells: 480,
    fullscreenMaxCells: 1_920,
    viewport: { width: 20, height: 10 },
    isThreeWindow: (id) => id === "three",
  });

  assertEquals(snapshot.fullscreenTargetCells, 200);
  assertEquals(snapshot.fullscreenViewportCells, 200);
  assertEquals(snapshot.effectiveMaxCells, WORKBENCH_THREE_LIVE_MAX_CELLS);
  assertStrictEquals(snapshot.runtimeAscii, ascii);
});

Deno.test("API workbench Three policy floors live caps to the visible tiled pane area", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    ascii,
    liveMaxCells: 480,
    liveViewport: { width: 51, height: 17 },
    fullscreenMaxCells: 1_920,
    viewport: { width: 160, height: 48 },
  });

  assertEquals(snapshot.effectiveMaxCells, 867);
  assertStrictEquals(snapshot.runtimeAscii, ascii);
});

Deno.test("API workbench Three policy raises live runtime ASCII to resized tiled pane area", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    ascii,
    liveMaxCells: 960,
    liveViewport: { width: 71, height: 22 },
    fullscreenMaxCells: 1_920,
    viewport: { width: 220, height: 60 },
  });

  assertEquals(snapshot.effectiveMaxCells, 1_562);
  assertEquals(snapshot.runtimeAscii.renderMaxCells, 1_562);
  assertEquals(ascii.renderMaxCells, 960);
});

Deno.test("API workbench Three policy tracks large tiled panes at console cell resolution", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    ascii,
    liveMaxCells: 960,
    liveViewport: { width: 100, height: 50 },
    fullscreenMaxCells: 1_920,
    viewport: { width: 220, height: 60 },
  });

  assertEquals(snapshot.effectiveMaxCells, 5_000);
  assertEquals(snapshot.runtimeAscii.renderMaxCells, 5_000);
  assertEquals(ascii.renderMaxCells, 960);
});

Deno.test("API workbench Three policy chooses fullscreen pane as runtime budget source", () => {
  const source = resolveWorkbenchThreeRuntimeBudgetSourceId({
    fallbackId: "three",
    fullscreenId: "viz:three-lattice",
    interactiveIds: ["three"],
    isThreeWindow: (id) => id === "three" || id.startsWith("viz:three"),
  });

  assertEquals(source, "viz:three-lattice");
});

Deno.test("API workbench Three policy chooses active dynamic pane before fallback", () => {
  const source = resolveWorkbenchThreeRuntimeBudgetSourceId({
    fallbackId: "three",
    interactiveIds: ["viz:three-solenoid"],
    isThreeWindow: (id) => id === "three" || id.startsWith("viz:three"),
  });

  assertEquals(source, "viz:three-solenoid");
});

Deno.test("API workbench Three policy raises live ASCII options to the final effective runtime cap", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const raised = resolveWorkbenchThreeLiveAsciiOptions(ascii, 2_800);

  assertEquals(raised.renderMaxCells, 2_800);
  assertEquals(ascii.renderMaxCells, 960);
  assertStrictEquals(resolveWorkbenchThreeLiveAsciiOptions(raised, 960), raised);
});

Deno.test("API workbench Three policy raises tiled dynamic panes from their measured body size", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const raised = resolveWorkbenchThreeTiledAsciiOptions({
    ascii,
    liveViewport: { width: 71, height: 22 },
    liveMaxCells: 480,
  });

  assertEquals(raised.renderMaxCells, 1_562);
  assertEquals(ascii.renderMaxCells, 960);
  assertStrictEquals(
    resolveWorkbenchThreeTiledAsciiOptions({
      ascii: raised,
      liveViewport: { width: 20, height: 10 },
      liveMaxCells: 480,
    }),
    raised,
  );
});

Deno.test("API workbench Three policy compares every runtime ASCII option", () => {
  const base = createDefaultWorkbenchAsciiOptions();

  assertEquals(sameWorkbenchThreeAsciiOptions(base, { ...base }), true);
  assertEquals(sameWorkbenchThreeAsciiOptions(base, { ...base, renderMaxCells: base.renderMaxCells + 1 }), false);
  assertEquals(sameWorkbenchThreeAsciiOptions(base, { ...base, kittyGraphics: !base.kittyGraphics }), false);
  assertEquals(sameWorkbenchThreeAsciiOptions(base, { ...base, terminalGlyphStyle: "glyphs" }), false);
});

Deno.test("API workbench Three policy starts at the full live tier but keeps rescue cadence available", () => {
  assertEquals(WORKBENCH_THREE_INITIAL_CELLS, 960);
  assertEquals(
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
    1000 / 20,
  );
  assertEquals(
    apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_RESCUE_CELLS, { live: true }),
    WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS,
  );
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(60, { live: true }), 1000 / 12);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(960, { live: true }), 1000 / 20);
});

Deno.test("API workbench Three policy recovers to the live tier after sustained quiet output", () => {
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

  assertEquals(state.currentCells, 960);
  assertEquals(state.lowFrames, 0);
});

Deno.test("API workbench Three policy preserves the tiled visual floor under sustained high pressure", () => {
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
  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three fullscreen pressure ignores byte volume while cadence is healthy", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 180_000,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_FULLSCREEN_MIN_CELLS, { live: true }),
  };

  const frames = (API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY.highFrameThreshold ?? 1) * 8;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three fullscreen pressure can still downshift on sustained low FPS", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_FULLSCREEN_MAX_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 180_000,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, { live: true }),
    observedFps: 4,
    targetFps: 15,
    observedFrameCount: WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  };

  const frames = API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 15_400);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three fullscreen pressure recovers through large-pane tiers", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 4_000,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_FULLSCREEN_MIN_CELLS, { live: true }),
  };

  const frames = API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY.lowFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 7_680);
  assertEquals(state.lowFrames, 0);
});

Deno.test("API workbench Three policy keeps ordinary startup block frames below the byte-rate ceiling", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 4_600,
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

  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy backs off when observed FPS is visibly below target", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 1_200,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
    observedFps: 10,
    targetFps: 20,
    observedFrameCount: WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy does not recover while observed FPS is still low", () => {
  const state = createWorkbenchThreeTerminalPressureState(120);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 300,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(120, { live: true }),
    observedFps: 8,
    targetFps: 15,
    observedFrameCount: WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  };

  const frames = (API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold ?? 1) + 5;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 480);
  assertEquals(state.lowFrames, 0);
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

Deno.test("API workbench Three policy reacts to collapsed cadence after the startup window", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 1_200,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
    observedFps: 3,
    targetFps: 24,
    observedFrameCount: WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy scopes collapsed cadence even with mixed redraw rows", () => {
  const state = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
  const next = resolveWorkbenchThreeTerminalPressureUpdate(state, {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    currentCells: WORKBENCH_THREE_INITIAL_CELLS,
    renderedThreeGrids: 1,
    renderedThreeRows: 8,
    changedRows: 42,
    bytes: 1_200,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, { live: true }),
    observedFps: 3,
    targetFps: 20,
    observedFrameCount: WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  });

  assertEquals(next.scoped, true);
  assertEquals(next.currentCells, WORKBENCH_THREE_INITIAL_CELLS);
  assertEquals(next.highFrames, 1);
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

  assertEquals(state.currentCells, 960);
  assertEquals(state.lowFrames, 0);
});

Deno.test("API workbench Three policy clamps below-floor pressure state back to the visual floor", () => {
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

  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy downshifts sustained 960-cell block output", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 30_000,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(960, { live: true }),
  };

  const frames = API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold ?? 1;
  for (let index = 0; index < frames; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);
});

Deno.test("API workbench Three policy keeps 480-cell output at the tiled visual floor", () => {
  const state = createWorkbenchThreeTerminalPressureState(480);
  const sample = {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    renderedThreeGrids: 1,
    bytes: 3_400,
    durationMs: 0.05,
    sampleDurationMs: apiWorkbenchThreeFrameIntervalForCells(480, { live: true }),
  };

  for (let index = 0; index < 10; index += 1) {
    Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, sample));
  }

  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);
  assertEquals(state.lowFrames, 0);
});

Deno.test("API workbench Three policy clamps rescue-tier states to the tiled visual floor", () => {
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

  assertEquals(state.currentCells, 480);
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

  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);
});

type WorkbenchThreePolicyTestId = "inspector" | "three" | "viz" | "logs";

const isThreePolicyTestWindow = (id: WorkbenchThreePolicyTestId) => id === "three" || id === "viz";
const threePolicyTestWindows: WorkbenchThreePolicyTestId[] = ["inspector", "three", "viz", "logs"];

Deno.test("API workbench Three policy makes the active Three window interactive", () => {
  const state = resolveWorkbenchThreeWindowState({
    activeId: "three",
    windows: threePolicyTestWindows,
    isThreeWindow: isThreePolicyTestWindow,
  });

  assertEquals(state.live, true);
  assertEquals(state.fullscreenThree, false);
  assertEquals(state.threeWindowCount, 2);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "three"), true);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "viz"), false);
});

Deno.test("API workbench Three policy makes fullscreen Three window interactive", () => {
  const state = resolveWorkbenchThreeWindowState({
    activeId: "inspector",
    fullscreenId: "viz",
    windows: threePolicyTestWindows,
    isThreeWindow: isThreePolicyTestWindow,
  });

  assertEquals(state.live, true);
  assertEquals(state.fullscreenThree, true);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "viz"), true);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "three"), false);
});

Deno.test("API workbench Three policy blocks live and interactive state behind modal overlays", () => {
  const state = resolveWorkbenchThreeWindowState({
    activeId: "three",
    fullscreenId: "three",
    windows: threePolicyTestWindows,
    isThreeWindow: isThreePolicyTestWindow,
    blocked: true,
  });

  assertEquals(state.live, false);
  assertEquals(state.fullscreenThree, true);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "three"), false);
});

Deno.test("API workbench Three policy reports no live state without Three windows", () => {
  const state = resolveWorkbenchThreeWindowState<"inspector" | "logs">({
    activeId: "inspector",
    windows: ["inspector", "logs"],
    isThreeWindow: () => false,
  });

  assertEquals(state.live, false);
  assertEquals(state.threeWindowCount, 0);
  assertEquals(state.fullscreenThree, false);
});

Deno.test("API workbench Three policy reuses window-state storage and clears stale interactivity", () => {
  const target = createWorkbenchThreeWindowState<WorkbenchThreePolicyTestId>("inspector");
  const interactiveIds = target.interactiveIds;

  const first = resolveWorkbenchThreeWindowStateInto(target, {
    activeId: "three",
    windows: threePolicyTestWindows,
    isThreeWindow: isThreePolicyTestWindow,
  });
  assertEquals(first, target);
  assertEquals(first.interactiveIds, interactiveIds);
  assertEquals(workbenchThreeWindowStateIsInteractive(first, "three"), true);

  const second = resolveWorkbenchThreeWindowStateInto(target, {
    activeId: "logs",
    fullscreenId: "viz",
    windows: threePolicyTestWindows,
    isThreeWindow: isThreePolicyTestWindow,
  });

  assertEquals(second, target);
  assertEquals(second.interactiveIds, interactiveIds);
  assertEquals(workbenchThreeWindowStateIsInteractive(second, "three"), false);
  assertEquals(workbenchThreeWindowStateIsInteractive(second, "viz"), true);
});
