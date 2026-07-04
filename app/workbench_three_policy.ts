import {
  workbenchThreeFrameIntervalForCells,
  type WorkbenchThreeTerminalPressureOptions,
} from "../src/app/workbench_three_terminal_pressure.ts";

export const WORKBENCH_THREE_LIVE_MAX_CELLS = 960;
export const WORKBENCH_THREE_EMERGENCY_CELLS = 120;
export const WORKBENCH_THREE_INITIAL_CELLS = 480;

export const WORKBENCH_THREE_PRESSURE_LEVELS = [
  WORKBENCH_THREE_EMERGENCY_CELLS,
  240,
  480,
  WORKBENCH_THREE_LIVE_MAX_CELLS,
] as const;

export const WORKBENCH_THREE_PRESSURE_HIGH_BYTES = 240_000;
export const WORKBENCH_THREE_PRESSURE_LOW_BYTES = 35_000;
export const WORKBENCH_THREE_PRESSURE_HIGH_BYTES_PER_GRID = 96_000;
export const WORKBENCH_THREE_PRESSURE_LOW_BYTES_PER_GRID = 18_000;
export const WORKBENCH_THREE_PRESSURE_HIGH_DURATION_MS = 50;
export const WORKBENCH_THREE_PRESSURE_HIGH_FRAME_THRESHOLD = 2;
export const WORKBENCH_THREE_PRESSURE_LOW_FRAME_THRESHOLD = 30;

export const WORKBENCH_THREE_FRAME_INTERVAL_BY_CELLS = new Map<number, number>([
  [WORKBENCH_THREE_EMERGENCY_CELLS, 1000 / 18],
  [240, 1000 / 18],
  [480, 1000 / 18],
  [WORKBENCH_THREE_LIVE_MAX_CELLS, 1000 / 18],
  [1_920, 1000 / 14],
  [3_840, 1000 / 10],
]);

export const WORKBENCH_THREE_IDLE_FRAME_INTERVAL_BY_CELLS = new Map<number, number>([
  [WORKBENCH_THREE_EMERGENCY_CELLS, 1000 / 8],
  [240, 1000 / 8],
  [480, 1000 / 8],
  [WORKBENCH_THREE_LIVE_MAX_CELLS, 1000 / 8],
  [1_920, 1000 / 6],
  [3_840, 1000 / 5],
]);

export type ApiWorkbenchThreePressurePolicy = Omit<
  WorkbenchThreeTerminalPressureOptions,
  "renderedThreeGrids" | "bytes" | "durationMs"
>;

export const API_WORKBENCH_THREE_PRESSURE_POLICY: ApiWorkbenchThreePressurePolicy = {
  levels: WORKBENCH_THREE_PRESSURE_LEVELS,
  highBytes: WORKBENCH_THREE_PRESSURE_HIGH_BYTES,
  lowBytes: WORKBENCH_THREE_PRESSURE_LOW_BYTES,
  highBytesPerGrid: WORKBENCH_THREE_PRESSURE_HIGH_BYTES_PER_GRID,
  lowBytesPerGrid: WORKBENCH_THREE_PRESSURE_LOW_BYTES_PER_GRID,
  highDurationMs: WORKBENCH_THREE_PRESSURE_HIGH_DURATION_MS,
  highFrameThreshold: WORKBENCH_THREE_PRESSURE_HIGH_FRAME_THRESHOLD,
  lowFrameThreshold: WORKBENCH_THREE_PRESSURE_LOW_FRAME_THRESHOLD,
};

export function apiWorkbenchThreeFrameIntervalForCells(cells: number, options: { live?: boolean } = {}): number {
  return workbenchThreeFrameIntervalForCells(cells, {
    live: options.live,
    liveIntervals: WORKBENCH_THREE_FRAME_INTERVAL_BY_CELLS,
    idleIntervals: WORKBENCH_THREE_IDLE_FRAME_INTERVAL_BY_CELLS,
    liveDefaultMs: 1000 / 18,
    idleDefaultMs: 1000 / 8,
  });
}
