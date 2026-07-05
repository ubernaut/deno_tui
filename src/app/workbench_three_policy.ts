import {
  workbenchThreeFrameIntervalForCells,
  type WorkbenchThreeTerminalPressureOptions,
} from "./workbench_three_terminal_pressure.ts";

export const WORKBENCH_THREE_LIVE_MAX_CELLS = 960;
export const WORKBENCH_THREE_FULLSCREEN_MIN_CELLS = 3_840;
export const WORKBENCH_THREE_FULLSCREEN_MAX_CELLS = 7_680;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_FLOOR_CELLS = 1_920;
export const WORKBENCH_THREE_RESCUE_CELLS = 30;
export const WORKBENCH_THREE_EMERGENCY_CELLS = 60;
export const WORKBENCH_THREE_INITIAL_CELLS = 480;

export const WORKBENCH_THREE_PRESSURE_LEVELS = [
  WORKBENCH_THREE_RESCUE_CELLS,
  WORKBENCH_THREE_EMERGENCY_CELLS,
  120,
  240,
  480,
  WORKBENCH_THREE_LIVE_MAX_CELLS,
] as const;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_LEVELS = [
  WORKBENCH_THREE_FULLSCREEN_PRESSURE_FLOOR_CELLS,
  WORKBENCH_THREE_FULLSCREEN_MIN_CELLS,
  WORKBENCH_THREE_FULLSCREEN_MAX_CELLS,
] as const;

export const WORKBENCH_THREE_PRESSURE_HIGH_BYTES = 480_000;
export const WORKBENCH_THREE_PRESSURE_LOW_BYTES = 35_000;
export const WORKBENCH_THREE_PRESSURE_HIGH_BYTES_PER_GRID = 24_000;
export const WORKBENCH_THREE_PRESSURE_LOW_BYTES_PER_GRID = 2_500;
export const WORKBENCH_THREE_PRESSURE_HIGH_BYTES_PER_SECOND = 60_000;
export const WORKBENCH_THREE_PRESSURE_LOW_BYTES_PER_SECOND = 30_000;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_GRID = 96_000;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_GRID = 18_000;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_SECOND = 1_000_000;
export const WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_SECOND = 240_000;
export const WORKBENCH_THREE_PRESSURE_HIGH_DURATION_MS = 50;
export const WORKBENCH_THREE_PRESSURE_HIGH_FRAME_THRESHOLD = 3;
export const WORKBENCH_THREE_PRESSURE_LOW_FRAME_THRESHOLD = 30;
export const WORKBENCH_THREE_PRESSURE_LOW_FPS_RATIO = 0.6;
export const WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES = 18;
export const WORKBENCH_THREE_DRAW_INTERVAL_MS = 1000 / 30;
export const WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS = 1000 / 10;
export const WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS = 1000 / 12;
export const WORKBENCH_THREE_READBACK_STRATEGY = "deferred" as const;

export const WORKBENCH_THREE_FRAME_INTERVAL_BY_CELLS = new Map<number, number>([
  [WORKBENCH_THREE_RESCUE_CELLS, WORKBENCH_THREE_RESCUE_DRAW_INTERVAL_MS],
  [WORKBENCH_THREE_EMERGENCY_CELLS, WORKBENCH_THREE_EMERGENCY_DRAW_INTERVAL_MS],
  [120, 1000 / 15],
  [240, 1000 / 20],
  [480, 1000 / 20],
  [WORKBENCH_THREE_LIVE_MAX_CELLS, 1000 / 20],
  [1_920, 1000 / 20],
  [3_840, 1000 / 20],
  [WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, 1000 / 15],
]);

export const WORKBENCH_THREE_IDLE_FRAME_INTERVAL_BY_CELLS = new Map<number, number>([
  [WORKBENCH_THREE_RESCUE_CELLS, 1000 / 8],
  [WORKBENCH_THREE_EMERGENCY_CELLS, 1000 / 8],
  [120, 1000 / 8],
  [240, 1000 / 8],
  [480, 1000 / 8],
  [WORKBENCH_THREE_LIVE_MAX_CELLS, 1000 / 8],
  [1_920, 1000 / 6],
  [3_840, 1000 / 5],
  [WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, 1000 / 4],
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
  highBytesPerSecond: WORKBENCH_THREE_PRESSURE_HIGH_BYTES_PER_SECOND,
  lowBytesPerSecond: WORKBENCH_THREE_PRESSURE_LOW_BYTES_PER_SECOND,
  highDurationMs: WORKBENCH_THREE_PRESSURE_HIGH_DURATION_MS,
  lowFpsRatio: WORKBENCH_THREE_PRESSURE_LOW_FPS_RATIO,
  minObservedFpsFrames: WORKBENCH_THREE_PRESSURE_MIN_FPS_FRAMES,
  highFrameThreshold: WORKBENCH_THREE_PRESSURE_HIGH_FRAME_THRESHOLD,
  lowFrameThreshold: WORKBENCH_THREE_PRESSURE_LOW_FRAME_THRESHOLD,
};

export const API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY: ApiWorkbenchThreePressurePolicy = {
  ...API_WORKBENCH_THREE_PRESSURE_POLICY,
  levels: WORKBENCH_THREE_FULLSCREEN_PRESSURE_LEVELS,
  highBytesPerGrid: WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_GRID,
  lowBytesPerGrid: WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_GRID,
  highBytesPerSecond: WORKBENCH_THREE_FULLSCREEN_PRESSURE_HIGH_BYTES_PER_SECOND,
  lowBytesPerSecond: WORKBENCH_THREE_FULLSCREEN_PRESSURE_LOW_BYTES_PER_SECOND,
};

export function apiWorkbenchThreeFrameIntervalForCells(cells: number, options: { live?: boolean } = {}): number {
  return workbenchThreeFrameIntervalForCells(cells, {
    live: options.live,
    liveIntervals: WORKBENCH_THREE_FRAME_INTERVAL_BY_CELLS,
    idleIntervals: WORKBENCH_THREE_IDLE_FRAME_INTERVAL_BY_CELLS,
    liveDefaultMs: WORKBENCH_THREE_DRAW_INTERVAL_MS,
    idleDefaultMs: 1000 / 8,
  });
}

/** Resolves the active render-cell cap while a Three pane owns fullscreen. */
export function apiWorkbenchThreeEffectiveMaxCells(
  currentCells: number,
  _options: { fullscreenThree?: boolean; fullscreenMinCells?: number } = {},
): number {
  const current = Math.max(1, Math.floor(currentCells));
  return current;
}

/** Returns the runtime render-cell target for a fullscreen Three pane at the current terminal viewport size. */
export function workbenchThreeFullscreenRenderCells(
  rect: { width: number; height: number },
  options: { minCells?: number; maxCells?: number } = {},
): number {
  const minCells = Math.max(1, Math.floor(options.minCells ?? WORKBENCH_THREE_FULLSCREEN_MIN_CELLS));
  const maxCells = Math.max(minCells, Math.floor(options.maxCells ?? WORKBENCH_THREE_FULLSCREEN_MAX_CELLS));
  const area = Math.max(1, Math.floor(rect.width) * Math.floor(rect.height));
  return Math.max(minCells, Math.min(maxCells, area));
}
