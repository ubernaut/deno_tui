import { assertEquals } from "./deps.ts";
import {
  createWorkbenchThreeTerminalPressureState,
  formatWorkbenchThreeTerminalPressureUpdateLog,
  resolveWorkbenchThreeTerminalPressureBudget,
  resolveWorkbenchThreeTerminalPressureUpdate,
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

Deno.test("workbench Three terminal pressure update scopes slow full-screen redraws", () => {
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
  assertEquals(slow.scoped, true);
  assertEquals(slow.currentCells, 480);
  assertEquals(slow.direction, "down");
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
  assertEquals(workbenchThreeFrameIntervalForCells(960, { ...options, live: true }), 1000 / 10);
  assertEquals(workbenchThreeFrameIntervalForCells(999, { ...options, live: true }), 1000 / 12);
  assertEquals(workbenchThreeFrameIntervalForCells(240, { ...options, live: false }), 1000 / 6);
});

Deno.test("workbench Three live cadence follows focused or fullscreen Three panes", () => {
  const windows = [
    { id: "explorer", state: "normal" },
    { id: "three", state: "normal" },
    { id: "three-lattice", state: "minimized" },
  ];
  const isThreeWindow = (id: string) => id.startsWith("three");

  assertEquals(workbenchThreeShouldUseLiveCadence({ activeId: "three", windows, isThreeWindow }), true);
  assertEquals(workbenchThreeShouldUseLiveCadence({ activeId: "explorer", windows, isThreeWindow }), false);
  assertEquals(workbenchThreeShouldUseLiveCadence({ activeId: "three-lattice", windows, isThreeWindow }), false);
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

Deno.test("workbench Three per-window interactivity follows only the targeted pane", () => {
  const windows = [
    { id: "three", state: "normal" },
    { id: "three-lattice", state: "normal" },
    { id: "three-hidden", state: "minimized" },
  ];

  assertEquals(workbenchThreeWindowIsInteractive({ id: "three", activeId: "three", windows }), true);
  assertEquals(workbenchThreeWindowIsInteractive({ id: "three-lattice", activeId: "three", windows }), false);
  assertEquals(workbenchThreeWindowIsInteractive({ id: "three-hidden", activeId: "three-hidden", windows }), false);
  assertEquals(
    workbenchThreeWindowIsInteractive({
      id: "three-lattice",
      activeId: "three",
      fullscreenId: "three-lattice",
      windows,
    }),
    true,
  );
  assertEquals(workbenchThreeWindowIsInteractive({ id: "three", activeId: "three", windows, blocked: true }), false);
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
