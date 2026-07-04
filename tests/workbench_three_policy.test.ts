import { assertEquals } from "./deps.ts";
import {
  API_WORKBENCH_THREE_PRESSURE_POLICY,
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_INITIAL_CELLS,
  WORKBENCH_THREE_PRESSURE_LEVELS,
} from "../app/workbench_three_policy.ts";

Deno.test("API workbench Three policy exposes ordered pressure levels", () => {
  assertEquals(Array.from(new Set(WORKBENCH_THREE_PRESSURE_LEVELS)).sort((left, right) => left - right), [
    120,
    240,
    480,
    960,
    1_920,
    3_840,
  ]);
  assertEquals(WORKBENCH_THREE_INITIAL_CELLS, 480);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytes, 240_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highBytesPerGrid, 96_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowBytesPerGrid, 18_000);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.highFrameThreshold, 2);
  assertEquals(API_WORKBENCH_THREE_PRESSURE_POLICY.lowFrameThreshold, 30);
});

Deno.test("API workbench Three policy keeps live panes faster than idle panes", () => {
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(120, { live: true }), 1000 / 18);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(240, { live: true }), 1000 / 18);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(480, { live: true }), 1000 / 18);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(960, { live: true }), 1000 / 18);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(1_920, { live: true }), 1000 / 14);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: true }), 1000 / 10);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(240, { live: false }), 1000 / 8);
  assertEquals(apiWorkbenchThreeFrameIntervalForCells(3_840, { live: false }), 1000 / 5);
});
