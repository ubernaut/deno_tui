import { assertEquals, assertStrictEquals, assertStringIncludes } from "./deps.ts";
import {
  countWorkbenchThreeProbeChangedGridRows,
  formatWorkbenchThreePressureProbeLines,
  formatWorkbenchThreePressureProbeSummaryLines,
  parseWorkbenchThreePressureProbeCliOptions,
  snapshotWorkbenchThreeProbeGridRows,
  snapshotWorkbenchThreeProbeGridRowsInto,
  summarizeWorkbenchThreePressureProbe,
  validateWorkbenchThreePressureProbe,
  validateWorkbenchThreePressureProbeSummary,
  type WorkbenchThreePressureProbeSample,
} from "../src/app/workbench_three_pressure_probe.ts";
import {
  createWorkbenchThreeTerminalPressureState,
  formatWorkbenchThreeTerminalPressureUpdateLog,
  resolveWorkbenchThreeTerminalPressureBudget,
  resolveWorkbenchThreeTerminalPressureBudgetInto,
  resolveWorkbenchThreeTerminalPressureUpdate,
  resolveWorkbenchThreeTerminalPressureUpdateInto,
  shouldApplyWorkbenchThreeTerminalPressureSample,
  shouldCountWorkbenchThreeGridPressure,
  workbenchThreeFrameIntervalForCells,
  workbenchThreeShouldUseLiveCadence,
  workbenchThreeTerminalBytesPerSecond,
  workbenchThreeWindowIsInteractive,
} from "../src/app/workbench_three_terminal_pressure.ts";

Deno.test("workbench Three terminal pressure steps down across sustained heavy output", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const options = {
    renderedThreeGrids: 1,
    bytes: 90_000,
    levels: [240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 2,
    lowFrameThreshold: 3,
  };

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, options));
  assertEquals(state.currentCells, 960);
  assertEquals(state.highFrames, 1);

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, options));
  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, options));
  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, options));
  assertEquals(state.currentCells, 240);
});

Deno.test("workbench Three terminal pressure budget can reuse caller-owned results", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const target = {
    currentCells: 0,
    highFrames: 0,
    lowFrames: 0,
    changed: false,
    direction: "steady" as const,
  };
  const result = resolveWorkbenchThreeTerminalPressureBudgetInto(target, state, {
    renderedThreeGrids: 1,
    bytes: 90_000,
    levels: [240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 1,
  });

  assertStrictEquals(result, target);
  assertEquals(target.currentCells, 480);
  assertEquals(target.direction, "down");
});

Deno.test("workbench Three terminal pressure recovers slowly after low output", () => {
  const state = createWorkbenchThreeTerminalPressureState(240);
  const options = {
    renderedThreeGrids: 1,
    bytes: 10_000,
    levels: [240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 2,
    lowFrameThreshold: 3,
  };

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, options));
  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, options));
  assertEquals(state.currentCells, 240);
  assertEquals(state.lowFrames, 2);

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, options));
  assertEquals(state.currentCells, 480);
  assertEquals(state.lowFrames, 0);
});

Deno.test("workbench Three terminal pressure notices mutated level arrays", () => {
  const levels = [240, 480, 960];
  const state = createWorkbenchThreeTerminalPressureState(960);
  const options = {
    renderedThreeGrids: 1,
    bytes: 90_000,
    levels,
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 1,
  };

  assertEquals(resolveWorkbenchThreeTerminalPressureBudget(state, options).currentCells, 480);

  levels[1] = 360;

  assertEquals(resolveWorkbenchThreeTerminalPressureBudget(state, options).currentCells, 360);
});

Deno.test("workbench Three terminal pressure can step down on the first high-output frame", () => {
  const state = createWorkbenchThreeTerminalPressureState(480);
  const next = resolveWorkbenchThreeTerminalPressureBudget(state, {
    renderedThreeGrids: 1,
    bytes: 90_000,
    levels: [240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 1,
  });

  assertEquals(next.currentCells, 240);
  assertEquals(next.highFrames, 0);
  assertEquals(next.direction, "down");
});

Deno.test("workbench Three terminal pressure can step down from slow terminal writes", () => {
  const state = createWorkbenchThreeTerminalPressureState(240);
  const next = resolveWorkbenchThreeTerminalPressureBudget(state, {
    renderedThreeGrids: 1,
    bytes: 10_000,
    durationMs: 80,
    levels: [120, 240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highDurationMs: 50,
    highFrameThreshold: 1,
  });

  assertEquals(next.currentCells, 120);
  assertEquals(next.highFrames, 0);
  assertEquals(next.direction, "down");
});

Deno.test("workbench Three terminal pressure can step down from per-grid byte pressure", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const next = resolveWorkbenchThreeTerminalPressureBudget(state, {
    renderedThreeGrids: 1,
    bytes: 28_000,
    levels: [120, 240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highBytesPerGrid: 24_000,
    highFrameThreshold: 1,
  });

  assertEquals(next.currentCells, 480);
  assertEquals(next.direction, "down");
});

Deno.test("workbench Three terminal pressure can step down from sustained terminal byte rate", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const options = {
    renderedThreeGrids: 1,
    bytes: 7_000,
    sampleDurationMs: 50,
    levels: [240, 480, 960],
    highBytes: 240_000,
    lowBytes: 1_000,
    highBytesPerGrid: 96_000,
    highBytesPerSecond: 120_000,
    highFrameThreshold: 2,
  };

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, options));
  assertEquals(state.currentCells, 960);
  assertEquals(state.highFrames, 1);

  Object.assign(state, resolveWorkbenchThreeTerminalPressureBudget(state, options));
  assertEquals(state.currentCells, 480);
  assertEquals(state.highFrames, 0);
});

Deno.test("workbench Three terminal pressure waits for enough cadence samples before fps downshift", () => {
  const base = {
    renderedThreeGrids: 1,
    bytes: 1,
    sampleDurationMs: 50,
    levels: [120, 240, 480],
    highBytes: 240_000,
    lowBytes: 0,
    highBytesPerGrid: 240_000,
    highBytesPerSecond: 240_000,
    observedFps: 3,
    targetFps: 20,
    lowFpsRatio: 0.5,
    highFrameThreshold: 1,
    minObservedFpsFrames: 6,
  };
  const state = createWorkbenchThreeTerminalPressureState(480);

  assertEquals(
    resolveWorkbenchThreeTerminalPressureBudget(state, { ...base, observedFrameCount: 5 }).currentCells,
    480,
  );
  assertEquals(
    resolveWorkbenchThreeTerminalPressureBudget(state, { ...base, observedFrameCount: 6 }).currentCells,
    240,
  );
});

Deno.test("workbench Three terminal pressure ignores byte rate without a sample duration", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const next = resolveWorkbenchThreeTerminalPressureBudget(state, {
    renderedThreeGrids: 1,
    bytes: 7_000,
    levels: [240, 480, 960],
    highBytes: 240_000,
    lowBytes: 1_000,
    highBytesPerGrid: 96_000,
    highBytesPerSecond: 120_000,
    highFrameThreshold: 1,
  });

  assertEquals(next.currentCells, 960);
  assertEquals(next.direction, "steady");
});

Deno.test("workbench Three terminal byte rate handles valid and missing sample windows", () => {
  assertEquals(workbenchThreeTerminalBytesPerSecond({ bytes: 6_000, sampleDurationMs: 50 }), 120_000);
  assertEquals(workbenchThreeTerminalBytesPerSecond({ bytes: 6_000 }), 0);
  assertEquals(workbenchThreeTerminalBytesPerSecond({ bytes: 6_000, sampleDurationMs: 0 }), 0);
  assertEquals(workbenchThreeTerminalBytesPerSecond({ bytes: -1, sampleDurationMs: 50 }), 0);
});

Deno.test("workbench Three terminal pressure permits larger block frames under tuned per-grid budget", () => {
  const state = createWorkbenchThreeTerminalPressureState(1_920);
  const next = resolveWorkbenchThreeTerminalPressureBudget(state, {
    renderedThreeGrids: 1,
    bytes: 72_000,
    levels: [120, 240, 480, 960, 1_920, 3_840],
    highBytes: 240_000,
    lowBytes: 35_000,
    highBytesPerGrid: 96_000,
    lowBytesPerGrid: 18_000,
    highDurationMs: 50,
    durationMs: 18,
    highFrameThreshold: 1,
    lowFrameThreshold: 90,
  });

  assertEquals(next.currentCells, 1_920);
  assertEquals(next.direction, "steady");
});

Deno.test("workbench Three terminal pressure only recovers when total and per-grid output are low", () => {
  const state = createWorkbenchThreeTerminalPressureState(240);
  const base = {
    renderedThreeGrids: 1,
    levels: [120, 240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    lowBytesPerGrid: 9_000,
    lowFrameThreshold: 1,
  };

  assertEquals(
    resolveWorkbenchThreeTerminalPressureBudget(state, { ...base, bytes: 12_000 }).currentCells,
    240,
  );
  assertEquals(
    resolveWorkbenchThreeTerminalPressureBudget(state, { ...base, bytes: 8_000 }).currentCells,
    480,
  );
});

Deno.test("workbench Three terminal pressure only recovers below the low byte-rate floor", () => {
  const state = createWorkbenchThreeTerminalPressureState(120);
  const base = {
    renderedThreeGrids: 1,
    bytes: 900,
    sampleDurationMs: 33.33,
    levels: [120, 240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    lowBytesPerGrid: 1_500,
    lowBytesPerSecond: 20_000,
    lowFrameThreshold: 1,
  };

  assertEquals(resolveWorkbenchThreeTerminalPressureBudget(state, base).currentCells, 120);
  assertEquals(
    resolveWorkbenchThreeTerminalPressureBudget(state, { ...base, bytes: 500 }).currentCells,
    240,
  );
});

Deno.test("workbench Three terminal pressure resets counters when no Three grid was rendered", () => {
  const state = { currentCells: 480, highFrames: 1, lowFrames: 2 };
  const next = resolveWorkbenchThreeTerminalPressureBudget(state, {
    renderedThreeGrids: 0,
    bytes: 100_000,
    levels: [240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
  });

  assertEquals(next.currentCells, 480);
  assertEquals(next.highFrames, 0);
  assertEquals(next.lowFrames, 0);
  assertEquals(next.changed, false);
});

Deno.test("workbench Three terminal pressure update scopes flush samples before adapting", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const unrelated = resolveWorkbenchThreeTerminalPressureUpdate(state, {
    currentCells: 960,
    renderedThreeGrids: 1,
    renderedThreeRows: 12,
    changedRows: 40,
    bytes: 100_000,
    levels: [240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 1,
  });

  assertEquals(unrelated.scoped, false);
  assertEquals(unrelated.currentCells, 960);
  assertEquals(unrelated.highFrames, 0);
  assertEquals(unrelated.changed, false);

  const scoped = resolveWorkbenchThreeTerminalPressureUpdate(state, {
    currentCells: 960,
    renderedThreeGrids: 1,
    renderedThreeRows: 36,
    changedRows: 40,
    bytes: 100_000,
    levels: [240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 1,
  });

  assertEquals(scoped.scoped, true);
  assertEquals(scoped.currentCells, 480);
  assertEquals(scoped.direction, "down");
});

Deno.test("workbench Three terminal pressure update can reuse caller-owned results", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const target = {
    currentCells: 0,
    highFrames: 0,
    lowFrames: 0,
    changed: false,
    direction: "steady" as const,
    scoped: false,
  };
  const result = resolveWorkbenchThreeTerminalPressureUpdateInto(target, state, {
    currentCells: 960,
    renderedThreeGrids: 1,
    renderedThreeRows: 36,
    changedRows: 40,
    bytes: 100_000,
    levels: [240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 1,
  });

  assertStrictEquals(result, target);
  assertEquals(target.scoped, true);
  assertEquals(target.currentCells, 480);
  assertEquals(target.direction, "down");
});

Deno.test("workbench Three terminal pressure update ignores slow full-screen redraws outside Three rows", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const fast = resolveWorkbenchThreeTerminalPressureUpdate(state, {
    currentCells: 960,
    renderedThreeGrids: 1,
    renderedThreeRows: 12,
    changedRows: 54,
    bytes: 100_000,
    durationMs: 10,
    highDurationMs: 50,
    levels: [120, 240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 1,
  });
  assertEquals(fast.scoped, false);
  assertEquals(fast.currentCells, 960);

  const slow = resolveWorkbenchThreeTerminalPressureUpdate(state, {
    currentCells: 960,
    renderedThreeGrids: 1,
    renderedThreeRows: 12,
    changedRows: 54,
    bytes: 100_000,
    durationMs: 90,
    highDurationMs: 50,
    levels: [120, 240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 1,
  });
  assertEquals(slow.scoped, false);
  assertEquals(slow.currentCells, 960);
  assertEquals(slow.direction, "steady");
});

Deno.test("workbench Three terminal pressure update scopes collapsed cadence with mixed redraw rows", () => {
  const state = createWorkbenchThreeTerminalPressureState(960);
  const next = resolveWorkbenchThreeTerminalPressureUpdate(state, {
    currentCells: 960,
    renderedThreeGrids: 1,
    renderedThreeRows: 12,
    changedRows: 54,
    bytes: 6_000,
    durationMs: 10,
    sampleDurationMs: 50,
    observedFps: 3,
    targetFps: 20,
    lowFpsRatio: 0.6,
    observedFrameCount: 6,
    minObservedFpsFrames: 6,
    levels: [120, 240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    highFrameThreshold: 1,
  });

  assertEquals(next.scoped, true);
  assertEquals(next.currentCells, 480);
  assertEquals(next.direction, "down");
});

Deno.test("workbench Three terminal pressure update starts from current live cap", () => {
  const state = { currentCells: 240, highFrames: 0, lowFrames: 0 };
  const next = resolveWorkbenchThreeTerminalPressureUpdate(state, {
    currentCells: 960,
    renderedThreeGrids: 1,
    renderedThreeRows: 16,
    changedRows: 16,
    bytes: 10_000,
    levels: [240, 480, 960],
    highBytes: 80_000,
    lowBytes: 35_000,
    lowFrameThreshold: 1,
  });

  assertEquals(next.scoped, true);
  assertEquals(next.currentCells, 960);
  assertEquals(next.direction, "steady");
  assertEquals(next.changed, false);
});

Deno.test("workbench Three terminal pressure update log matches workbench presentation", () => {
  assertEquals(
    formatWorkbenchThreeTerminalPressureUpdateLog({
      direction: "down",
      currentCells: 480,
      bytes: 12345,
      durationMs: 6.789,
      renderedThreeGrids: 2,
    }),
    "three pressure down 480 cells; 12345 bytes/6.8ms across 2 grid(s)",
  );
});

Deno.test("workbench Three terminal pressure update log reports sustained byte rate when sampled", () => {
  assertEquals(
    formatWorkbenchThreeTerminalPressureUpdateLog({
      direction: "down",
      currentCells: 240,
      bytes: 6_000,
      durationMs: 1.2,
      sampleDurationMs: 50,
      renderedThreeGrids: 1,
    }),
    "three pressure down 240 cells; 6000 bytes/1.2ms rate 120000B/s across 1 grid(s)",
  );
});

Deno.test("workbench Three frame interval policy keeps smaller live budgets smoother", () => {
  const liveIntervals = new Map([
    [120, 1000 / 18],
    [240, 1000 / 16],
    [480, 1000 / 14],
    [960, 1000 / 10],
  ]);
  const idleIntervals = new Map([[120, 1000 / 6]]);
  const options = {
    liveIntervals,
    idleIntervals,
    liveDefaultMs: 1000 / 12,
    idleDefaultMs: 1000 / 6,
  };

  assertEquals(workbenchThreeFrameIntervalForCells(120, { ...options, live: true }), 1000 / 18);
  assertEquals(workbenchThreeFrameIntervalForCells(480, { ...options, live: true }), 1000 / 14);
  assertEquals(workbenchThreeFrameIntervalForCells(720, { ...options, live: true }), 1000 / 10);
  assertEquals(workbenchThreeFrameIntervalForCells(960, { ...options, live: true }), 1000 / 10);
  assertEquals(workbenchThreeFrameIntervalForCells(999, { ...options, live: true }), 1000 / 10);
  assertEquals(workbenchThreeFrameIntervalForCells(240, { ...options, live: false }), 1000 / 6);
});

Deno.test("workbench Three live cadence follows visible or fullscreen Three panes", () => {
  const windows = [
    { id: "explorer", state: "normal" },
    { id: "three", state: "normal" },
    { id: "three-lattice", state: "minimized" },
  ];
  const isThreeWindow = (id: string) => id.startsWith("three");

  assertEquals(workbenchThreeShouldUseLiveCadence({ activeId: "three", windows, isThreeWindow }), true);
  assertEquals(workbenchThreeShouldUseLiveCadence({ activeId: "explorer", windows, isThreeWindow }), true);
  assertEquals(workbenchThreeShouldUseLiveCadence({ activeId: "three-lattice", windows, isThreeWindow }), true);
  assertEquals(
    workbenchThreeShouldUseLiveCadence({ activeId: "explorer", fullscreenId: "three", windows, isThreeWindow }),
    true,
  );
  assertEquals(
    workbenchThreeShouldUseLiveCadence({ activeId: "three", fullscreenId: "explorer", windows, isThreeWindow }),
    false,
  );
  assertEquals(
    workbenchThreeShouldUseLiveCadence({ activeId: "three", windows, isThreeWindow, blocked: true }),
    false,
  );
  assertEquals(
    workbenchThreeShouldUseLiveCadence({
      activeId: "explorer",
      fullscreenId: "three",
      windows,
      isThreeWindow,
      blocked: true,
    }),
    false,
  );
});

Deno.test("workbench Three live cadence ignores hidden Three panes", () => {
  const windows = [
    { id: "explorer", state: "normal" },
    { id: "three", state: "minimized" },
    { id: "three-lattice", state: "closed" },
  ];
  const isThreeWindow = (id: string) => id.startsWith("three");

  assertEquals(workbenchThreeShouldUseLiveCadence({ activeId: "explorer", windows, isThreeWindow }), false);
});

Deno.test("workbench Three per-window interactivity follows visible or fullscreen panes", () => {
  const windows = [
    { id: "three", state: "normal" },
    { id: "three-lattice", state: "normal" },
    { id: "three-hidden", state: "minimized" },
  ];
  const isThreeWindow = (id: string) => id.startsWith("three");

  assertEquals(workbenchThreeWindowIsInteractive({ id: "three", activeId: "three", windows }), true);
  assertEquals(workbenchThreeWindowIsInteractive({ id: "three-lattice", activeId: "three", windows }), true);
  assertEquals(workbenchThreeWindowIsInteractive({ id: "three-lattice", activeId: "three-lattice", windows }), true);
  assertEquals(
    workbenchThreeWindowIsInteractive({ id: "three-lattice", activeId: "three", windows, isThreeWindow }),
    false,
  );
  assertEquals(
    workbenchThreeWindowIsInteractive({ id: "three-lattice", activeId: "three-lattice", windows, isThreeWindow }),
    true,
  );
  assertEquals(workbenchThreeWindowIsInteractive({ id: "three-hidden", activeId: "three-hidden", windows }), false);
  assertEquals(
    workbenchThreeWindowIsInteractive({
      id: "three",
      activeId: "three",
      fullscreenId: "three-lattice",
      windows,
      isThreeWindow,
    }),
    false,
  );
  assertEquals(
    workbenchThreeWindowIsInteractive({
      id: "three-lattice",
      activeId: "three",
      fullscreenId: "three-lattice",
      windows,
      isThreeWindow,
    }),
    true,
  );
  assertEquals(
    workbenchThreeWindowIsInteractive({ id: "three", activeId: "three", windows, isThreeWindow, blocked: true }),
    false,
  );
});

Deno.test("workbench Three per-window interactivity keeps a single visible pane live", () => {
  const windows = [
    { id: "explorer", state: "normal" },
    { id: "three", state: "normal" },
    { id: "three-hidden", state: "minimized" },
  ];
  const isThreeWindow = (id: string) => id.startsWith("three");

  assertEquals(
    workbenchThreeWindowIsInteractive({ id: "three", activeId: "explorer", windows, isThreeWindow }),
    true,
  );
});

Deno.test("workbench Three pressure ignores startup fallback grids without renderer telemetry", () => {
  assertEquals(
    shouldCountWorkbenchThreeGridPressure([["INITIALIZING"]], undefined),
    false,
  );
  assertEquals(
    shouldCountWorkbenchThreeGridPressure([["INITIALIZING"]], { cells: 0 }),
    false,
  );
});

Deno.test("workbench Three pressure counts visible renderer-backed grids", () => {
  assertEquals(
    shouldCountWorkbenchThreeGridPressure([["█"]], { cells: 1 }),
    true,
  );
  assertEquals(
    shouldCountWorkbenchThreeGridPressure([], { cells: 1 }),
    false,
  );
});

Deno.test("workbench Three pressure samples ignore unrelated full-screen redraws", () => {
  assertEquals(
    shouldApplyWorkbenchThreeTerminalPressureSample({
      renderedThreeGrids: 1,
      renderedThreeRows: 18,
      changedRows: 24,
    }),
    true,
  );
  assertEquals(
    shouldApplyWorkbenchThreeTerminalPressureSample({
      renderedThreeGrids: 1,
      renderedThreeRows: 18,
      changedRows: 54,
    }),
    false,
  );
});

Deno.test("workbench Three pressure samples scope low cadence even with other changed rows", () => {
  assertEquals(
    shouldApplyWorkbenchThreeTerminalPressureSample({
      renderedThreeGrids: 1,
      renderedThreeRows: 18,
      changedRows: 54,
      observedFps: 3,
      targetFps: 20,
      lowFpsRatio: 0.6,
      observedFrameCount: 6,
      minObservedFpsFrames: 6,
    }),
    true,
  );
});

Deno.test("workbench Three pressure samples require real rendered Three rows", () => {
  assertEquals(
    shouldApplyWorkbenchThreeTerminalPressureSample({
      renderedThreeGrids: 0,
      renderedThreeRows: 18,
      changedRows: 18,
    }),
    false,
  );
  assertEquals(
    shouldApplyWorkbenchThreeTerminalPressureSample({
      renderedThreeGrids: 1,
      renderedThreeRows: 0,
      changedRows: 18,
    }),
    false,
  );
});

Deno.test("summarizeWorkbenchThreePressureProbe excludes placeholder and startup samples", () => {
  const samples: WorkbenchThreePressureProbeSample[] = [
    pressureProbeSample({ index: 1, rendererMs: 0, rows: 8, columns: 26, cells: 208 }),
    pressureProbeSample({ index: 2, rendererMs: 1680, rows: 8, columns: 26, cells: 208 }),
    pressureProbeSample({ index: 3, rendererMs: 0.8, flushMs: 0.03, bytes: 45, changedRows: 1, sourceChangedRows: 8 }),
    pressureProbeSample({ index: 4, rendererMs: 1.2, flushMs: 0.05, bytes: 55, changedRows: 3, sourceChangedRows: 4 }),
  ];

  const summary = summarizeWorkbenchThreePressureProbe(samples);

  assertEquals(summary.warmup?.index, 2);
  assertEquals(summary.latest?.index, 4);
  assertEquals(summary.steady.map((entry) => entry.index), [3, 4]);
  assertEquals(summary.averageRendererMs, 1);
  assertEquals(summary.averageFlushMs, 0.04);
  assertEquals(summary.averageBytes, 50);
  assertEquals(summary.averageByteRate, 1000);
  assertEquals(summary.averageChangedRows, 2);
  assertEquals(summary.averageSourceChangedRows, 6);
  assertEquals(summary.averageObservedFps, 0);
});

Deno.test("summarizeWorkbenchThreePressureProbe reports empty steady metrics without valid renderer frames", () => {
  const summary = summarizeWorkbenchThreePressureProbe([
    pressureProbeSample({ index: 1, rendererMs: 0, rows: 0, columns: 0, cells: 0 }),
  ]);

  assertEquals(summary.warmup, undefined);
  assertEquals(summary.latest?.index, 1);
  assertEquals(summary.steady, []);
  assertEquals(summary.averageRendererMs, 0);
  assertEquals(summary.averageFlushMs, 0);
  assertEquals(summary.averageBytes, 0);
  assertEquals(summary.averageByteRate, 0);
  assertEquals(summary.averageChangedRows, 0);
  assertEquals(summary.averageSourceChangedRows, 0);
  assertEquals(summary.averageObservedFps, 0);
});

Deno.test("workbench Three probe grid snapshots preserve mutable renderer frame history", () => {
  const grid = [
    ["a", "b"],
    ["c", "d"],
  ];
  const snapshot = snapshotWorkbenchThreeProbeGridRows(grid);

  grid[0]![1] = "B";
  grid.push(["e"]);

  assertEquals(snapshot, [["a", "b"], ["c", "d"]]);
  assertEquals(countWorkbenchThreeProbeChangedGridRows(snapshot, grid), 2);
});

Deno.test("workbench Three probe grid snapshots can reuse caller-owned rows", () => {
  const target = [["stale", "row"], ["keep"]];
  const firstRow = target[0]!;
  const secondRow = target[1]!;
  const snapshot = snapshotWorkbenchThreeProbeGridRowsInto(target, [["a"], undefined, ["c", "d"]]);

  assertEquals(snapshot, [["a"], [], ["c", "d"]]);
  assertEquals(snapshot, target);
  assertEquals(snapshot[0], firstRow);
  assertEquals(snapshot[1], secondRow);

  const next = snapshotWorkbenchThreeProbeGridRowsInto(target, [["x", "y"]]);
  assertEquals(next, [["x", "y"]]);
  assertEquals(next[0], firstRow);
});

Deno.test("workbench Three probe changed-row counter handles equal sparse and resized grids", () => {
  assertEquals(
    countWorkbenchThreeProbeChangedGridRows(
      [["a"], undefined, ["c"]],
      [["a"], [], ["C"], ["d"]],
    ),
    2,
  );
});

Deno.test("validateWorkbenchThreePressureProbe accepts real changing renderer frames", () => {
  const samples = [
    pressureProbeSample({ index: 1, rendererMs: 0, rows: 8, columns: 26, cells: 208, gridUpdates: 1 }),
    pressureProbeSample({ index: 2, rendererMs: 5, rows: 8, columns: 26, cells: 208, gridUpdates: 2 }),
    pressureProbeSample({
      index: 3,
      rendererMs: 4,
      rows: 8,
      columns: 26,
      cells: 208,
      sourceChangedRows: 5,
      gridUpdates: 3,
      observedFps: 18,
    }),
    pressureProbeSample({
      index: 4,
      rendererMs: 4,
      rows: 8,
      columns: 26,
      cells: 208,
      sourceChangedRows: 3,
      gridUpdates: 4,
      observedFps: 16,
    }),
  ];
  const options = {
    minSteadyFrames: 2,
    minGridUpdates: 3,
    minAverageSourceChangedRows: 1,
    minAverageObservedFps: 15,
  };
  const result = validateWorkbenchThreePressureProbe(samples, options);

  assertEquals(result, { ok: true, errors: [] });
  assertEquals(
    validateWorkbenchThreePressureProbeSummary(summarizeWorkbenchThreePressureProbe(samples), options),
    result,
  );
});

Deno.test("validateWorkbenchThreePressureProbe rejects cached grids without renderer telemetry", () => {
  const result = validateWorkbenchThreePressureProbe([
    pressureProbeSample({
      index: 1,
      rendererMs: 0,
      rows: 8,
      columns: 26,
      cells: 208,
      sourceChangedRows: 2,
      gridUpdates: 1,
    }),
    pressureProbeSample({
      index: 2,
      rendererMs: 0,
      rows: 8,
      columns: 26,
      cells: 208,
      sourceChangedRows: 0,
      gridUpdates: 4,
    }),
  ], {
    minSteadyFrames: 2,
    minGridUpdates: 2,
    minAverageSourceChangedRows: 1,
  });

  assertEquals(result.ok, false);
  assertEquals(result.errors, [
    "no valid renderer frame was observed",
    "steady renderer frames 0 < 2",
    "average source-changed rows 0.0 < 1",
  ]);
});

Deno.test("validateWorkbenchThreePressureProbe can reject low observed FPS", () => {
  const result = validateWorkbenchThreePressureProbe([
    pressureProbeSample({
      index: 1,
      rendererMs: 0,
      rows: 8,
      columns: 26,
      cells: 208,
      sourceChangedRows: 2,
      gridUpdates: 1,
    }),
    pressureProbeSample({
      index: 2,
      rendererMs: 5,
      rows: 8,
      columns: 26,
      cells: 208,
      sourceChangedRows: 2,
      gridUpdates: 2,
    }),
    pressureProbeSample({
      index: 3,
      rendererMs: 4,
      rows: 8,
      columns: 26,
      cells: 208,
      sourceChangedRows: 2,
      gridUpdates: 3,
      observedFps: 3,
    }),
    pressureProbeSample({
      index: 4,
      rendererMs: 4,
      rows: 8,
      columns: 26,
      cells: 208,
      sourceChangedRows: 2,
      gridUpdates: 4,
      observedFps: 5,
    }),
  ], {
    minSteadyFrames: 2,
    minGridUpdates: 3,
    minAverageSourceChangedRows: 1,
    minAverageObservedFps: 10,
  });

  assertEquals(result.ok, false);
  assertEquals(result.errors, ["average observed FPS 4.0 < 10"]);
});

Deno.test("validateWorkbenchThreePressureProbe can reject collapsed latest render caps", () => {
  const result = validateWorkbenchThreePressureProbe([
    pressureProbeSample({
      index: 1,
      rendererMs: 10,
      maxCells: 3840,
      rows: 30,
      columns: 128,
      cells: 3840,
      gridUpdates: 1,
    }),
    pressureProbeSample({
      index: 2,
      rendererMs: 8,
      maxCells: 480,
      rows: 16,
      columns: 30,
      cells: 480,
      sourceChangedRows: 8,
      gridUpdates: 2,
    }),
  ], {
    minSteadyFrames: 1,
    minGridUpdates: 2,
    minAverageSourceChangedRows: 1,
    minLatestCells: 960,
  });

  assertEquals(result.ok, false);
  assertEquals(result.errors, ["latest max cells 480 < 960"]);
});

Deno.test("formatWorkbenchThreePressureProbeLines reports source changes and update counts", () => {
  const options = {
    mode: "studio",
    glyphs: "blocks",
    readback: "deferred",
    frameWidth: 168,
    frameHeight: 54,
    panelWidth: 96,
    panelHeight: 32,
    maxCells: 960,
    fullscreen: true,
    intervalMs: 50,
    totalBytes: 12345,
  };
  const samples = [
    pressureProbeSample({
      index: 1,
      rendererMs: 0,
      rows: 17,
      columns: 53,
      cells: 901,
      sourceChangedRows: 17,
      gridUpdates: 1,
    }),
    pressureProbeSample({
      index: 2,
      rendererMs: 1000,
      rows: 17,
      columns: 53,
      cells: 901,
      sourceChangedRows: 0,
      gridUpdates: 1,
    }),
    pressureProbeSample({
      index: 3,
      rendererMs: 12,
      sceneUpdateMs: 3,
      sceneRenderMs: 7,
      rows: 17,
      columns: 53,
      cells: 901,
      bytes: 20,
      sampleDurationMs: 100,
      observedFps: 12.5,
      observedFrameCount: 2,
      sourceChangedRows: 16,
      gridUpdates: 2,
    }),
  ];
  const lines = formatWorkbenchThreePressureProbeLines(options, samples);
  assertEquals(
    formatWorkbenchThreePressureProbeSummaryLines(options, samples, summarizeWorkbenchThreePressureProbe(samples)),
    lines,
  );

  assertEquals(lines[0], "three-workbench pressure probe");
  assertStringIncludes(lines[1], "mode=studio glyphs=blocks readback=deferred");
  assertStringIncludes(lines[1], "frame=168x54 panel=96x32 maxCells=960 fullscreen interval=50.00ms");
  assertStringIncludes(lines[2], "renderer=12.00ms");
  assertStringIncludes(lines[2], "observed=12.5fps");
  assertStringIncludes(lines[2], "rate=200B/s");
  assertStringIncludes(lines[2], "sourceRows=16.0");
  assertStringIncludes(lines[2], "updates=2");
  assertStringIncludes(lines[2], "latest=53x17/901c");
  assertStringIncludes(lines[2], "totalBytes=12345");
  assertStringIncludes(lines[5], "03 renderer=12.00ms init=0.00ms");
  assertStringIncludes(lines[5], "update=3.00ms render=7.00ms");
  assertStringIncludes(lines[5], "bytes=20 rate=200B/s");
  assertStringIncludes(lines[5], "sourceChanged=16 cap=960 interval=100.00ms observed=12.5fps observedFrames=2");
  assertStringIncludes(lines[5], "updates=2 grid=53x17");
});

Deno.test("parseWorkbenchThreePressureProbeCliOptions separates pressure and saved ASCII cell budgets", () => {
  const options = parseWorkbenchThreePressureProbeCliOptions(
    [
      "--frames",
      "40",
      "--max-cells",
      "120",
      "--ascii-cells",
      "1920",
      "--mode",
      "relay",
      "--glyphs",
      "mixed",
      "--readback",
      "deferred",
      "--adaptive",
      "--check",
      "--min-steady-frames",
      "5",
      "--min-grid-updates=7",
      "--min-source-rows",
      "2",
      "--min-observed-fps",
      "12",
      "--fullscreen",
      "--min-latest-cells",
      "480",
    ],
    pressureProbeDefaults(),
  );

  assertEquals(options.frames, 40);
  assertEquals(options.maxCells, 120);
  assertEquals(options.asciiCells, 1920);
  assertEquals(options.mode, "relay");
  assertEquals(options.glyphs, "mixed");
  assertEquals(options.readbackStrategy, "deferred");
  assertEquals(options.adaptive, true);
  assertEquals(options.check, true);
  assertEquals(options.minSteadyFrames, 5);
  assertEquals(options.minGridUpdates, 7);
  assertEquals(options.minAverageSourceChangedRows, 2);
  assertEquals(options.minAverageObservedFps, 12);
  assertEquals(options.fullscreen, true);
  assertEquals(options.minLatestCells, 480);
  assertEquals(options.intervalMs, 33);
});

Deno.test("parseWorkbenchThreePressureProbeCliOptions falls back to pressure cells for ASCII cells", () => {
  const options = parseWorkbenchThreePressureProbeCliOptions(
    ["--max-cells=240", "--interval", "50"],
    pressureProbeDefaults(),
  );

  assertEquals(options.maxCells, 240);
  assertEquals(options.asciiCells, 240);
  assertEquals(options.fullscreen, false);
  assertEquals(options.minLatestCells, 0);
  assertEquals(options.intervalMs, 50);
});

function pressureProbeSample(
  overrides: Partial<WorkbenchThreePressureProbeSample> & Pick<WorkbenchThreePressureProbeSample, "index">,
): WorkbenchThreePressureProbeSample {
  return {
    index: overrides.index,
    maxCells: overrides.maxCells ?? 960,
    sampleDurationMs: overrides.sampleDurationMs ?? 50,
    rendererMs: overrides.rendererMs ?? 1,
    initMs: overrides.initMs ?? 0,
    sceneMs: overrides.sceneMs ?? 0.5,
    sceneUpdateMs: overrides.sceneUpdateMs,
    sceneRenderMs: overrides.sceneRenderMs,
    readbackMs: overrides.readbackMs ?? 0.1,
    assemblyMs: overrides.assemblyMs ?? 0.05,
    flushMs: overrides.flushMs ?? 0.01,
    bytes: overrides.bytes ?? 10,
    changedRows: overrides.changedRows ?? 1,
    sourceChangedRows: overrides.sourceChangedRows ?? 1,
    observedFps: overrides.observedFps,
    observedFrameCount: overrides.observedFrameCount,
    gridUpdates: overrides.gridUpdates ?? 1,
    columns: overrides.columns ?? 26,
    rows: overrides.rows ?? 8,
    cells: overrides.cells ?? 208,
  };
}

function pressureProbeDefaults() {
  return {
    initialCells: 120,
    readbackStrategy: "blocking" as const,
    mode: "studio",
    modes: ["studio", "relay"] as const,
    frameIntervalForCells: (cells: number) => cells === 120 ? 33 : 66,
  };
}
