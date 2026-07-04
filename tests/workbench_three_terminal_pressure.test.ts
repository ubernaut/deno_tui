import { assertEquals } from "./deps.ts";
import {
  createWorkbenchThreeTerminalPressureState,
  resolveWorkbenchThreeTerminalPressureBudget,
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
