/** Mutable terminal-output pressure counters for workbench-hosted Three ASCII panes. */
export interface WorkbenchThreeTerminalPressureState {
  currentCells: number;
  highFrames: number;
  lowFrames: number;
}

/** Inputs used to adapt a live Three ASCII source grid from terminal flush pressure. */
export interface WorkbenchThreeTerminalPressureOptions {
  renderedThreeGrids: number;
  bytes: number;
  durationMs?: number;
  levels: readonly number[];
  highBytes: number;
  lowBytes: number;
  highBytesPerGrid?: number;
  lowBytesPerGrid?: number;
  highDurationMs?: number;
  highFrameThreshold?: number;
  lowFrameThreshold?: number;
}

/** Result of applying terminal-output pressure to a Three ASCII render-cell budget. */
export interface WorkbenchThreeTerminalPressureResult extends WorkbenchThreeTerminalPressureState {
  changed: boolean;
  direction: "down" | "up" | "steady";
}

/** Inputs used to resolve the live render cadence for a workbench-hosted Three ASCII pane. */
export interface WorkbenchThreeFrameIntervalOptions {
  live?: boolean;
  liveIntervals: ReadonlyMap<number, number>;
  idleIntervals: ReadonlyMap<number, number>;
  liveDefaultMs: number;
  idleDefaultMs: number;
}

/** Minimal window state needed to decide whether a Three pane should use live cadence. */
export interface WorkbenchThreeCadenceWindow {
  id: string;
  state?: "normal" | "minimized" | "fullscreen" | "closed" | string;
}

/** Inputs used to decide whether workbench Three panes should render at interactive or idle cadence. */
export interface WorkbenchThreeLiveCadenceOptions {
  activeId?: string;
  fullscreenId?: string;
  windows: readonly WorkbenchThreeCadenceWindow[];
  isThreeWindow: (id: string) => boolean;
}

/** Minimal renderer telemetry needed to decide whether a visible grid is real Three output. */
export interface WorkbenchThreeGridPressureTelemetry {
  cells?: number;
}

/** Inputs used to decide whether a terminal flush is attributable to rendered Three panes. */
export interface WorkbenchThreePressureSampleScope {
  renderedThreeGrids: number;
  renderedThreeRows: number;
  changedRows: number;
  toleranceRows?: number;
}

/** Creates pressure counters initialized to the preferred render-cell budget. */
export function createWorkbenchThreeTerminalPressureState(defaultCells: number): WorkbenchThreeTerminalPressureState {
  return {
    currentCells: Math.max(1, Math.floor(defaultCells)),
    highFrames: 0,
    lowFrames: 0,
  };
}

/** Resolves the frame interval for the current terminal-pressure render-cell budget. */
export function workbenchThreeFrameIntervalForCells(
  cells: number,
  options: WorkbenchThreeFrameIntervalOptions,
): number {
  const intervals = options.live ? options.liveIntervals : options.idleIntervals;
  const fallback = options.live ? options.liveDefaultMs : options.idleDefaultMs;
  return intervals.get(Math.max(1, Math.floor(cells))) ?? Math.max(1, fallback);
}

/** Returns true when any visible workbench window should keep Three rendering interactive. */
export function workbenchThreeShouldUseLiveCadence(options: WorkbenchThreeLiveCadenceOptions): boolean {
  if (options.fullscreenId) return options.isThreeWindow(options.fullscreenId);
  for (const window of options.windows) {
    const state = window.state ?? "normal";
    if ((state === "normal" || state === "fullscreen") && options.isThreeWindow(window.id)) {
      return true;
    }
  }
  return false;
}

/** Returns true when a Three pane should count toward terminal-output pressure adaptation. */
export function shouldCountWorkbenchThreeGridPressure(
  grid: readonly (readonly string[] | undefined)[] | undefined,
  telemetry: WorkbenchThreeGridPressureTelemetry | undefined,
): boolean {
  return Boolean(telemetry && (telemetry.cells ?? 0) > 0 && grid && grid.length > 0);
}

/** Returns true when a flush sample is narrow enough to represent Three pane output pressure. */
export function shouldApplyWorkbenchThreeTerminalPressureSample(input: WorkbenchThreePressureSampleScope): boolean {
  if (input.renderedThreeGrids <= 0 || input.renderedThreeRows <= 0 || input.changedRows <= 0) return false;
  const toleranceRows = Math.max(0, Math.floor(input.toleranceRows ?? 8));
  return input.changedRows <= Math.max(1, Math.floor(input.renderedThreeRows)) + toleranceRows;
}

/** Resolves the next render-cell budget for workbench Three panes from terminal flush byte pressure. */
export function resolveWorkbenchThreeTerminalPressureBudget(
  state: WorkbenchThreeTerminalPressureState,
  options: WorkbenchThreeTerminalPressureOptions,
): WorkbenchThreeTerminalPressureResult {
  const levels = normalizedLevels(options.levels);
  const current = clampToLevel(state.currentCells, levels);
  const highFrameThreshold = Math.max(1, Math.floor(options.highFrameThreshold ?? 2));
  const lowFrameThreshold = Math.max(1, Math.floor(options.lowFrameThreshold ?? 120));

  if (options.renderedThreeGrids <= 0 || options.bytes <= 0) {
    return {
      currentCells: current,
      highFrames: 0,
      lowFrames: 0,
      changed: current !== state.currentCells,
      direction: "steady",
    };
  }

  const highDurationMs = Math.max(1, options.highDurationMs ?? Number.POSITIVE_INFINITY);
  const bytesPerGrid = options.bytes / Math.max(1, options.renderedThreeGrids);
  const highBytesPerGrid = options.highBytesPerGrid ?? Number.POSITIVE_INFINITY;
  const lowBytesPerGrid = options.lowBytesPerGrid ?? Number.POSITIVE_INFINITY;
  const highPressure = options.bytes >= options.highBytes || bytesPerGrid >= highBytesPerGrid ||
    (options.durationMs ?? 0) >= highDurationMs;
  if (highPressure && current > levels[0]!) {
    const highFrames = state.highFrames + 1;
    if (highFrames >= highFrameThreshold) {
      const next = nextLowerLevel(current, levels);
      return {
        currentCells: next,
        highFrames: 0,
        lowFrames: 0,
        changed: next !== state.currentCells,
        direction: "down",
      };
    }
    return {
      currentCells: current,
      highFrames,
      lowFrames: 0,
      changed: current !== state.currentCells,
      direction: "steady",
    };
  }

  if (options.bytes <= options.lowBytes && bytesPerGrid <= lowBytesPerGrid && current < levels[levels.length - 1]!) {
    const lowFrames = state.lowFrames + 1;
    if (lowFrames >= lowFrameThreshold) {
      const next = nextHigherLevel(current, levels);
      return { currentCells: next, highFrames: 0, lowFrames: 0, changed: next !== state.currentCells, direction: "up" };
    }
    return {
      currentCells: current,
      highFrames: 0,
      lowFrames,
      changed: current !== state.currentCells,
      direction: "steady",
    };
  }

  return {
    currentCells: current,
    highFrames: 0,
    lowFrames: 0,
    changed: current !== state.currentCells,
    direction: "steady",
  };
}

function normalizedLevels(levels: readonly number[]): number[] {
  const normalized = Array.from(new Set(levels.map((level) => Math.max(1, Math.floor(level)))))
    .sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [1];
}

function clampToLevel(value: number, levels: readonly number[]): number {
  let closest = levels[0]!;
  let closestDistance = Math.abs(value - closest);
  for (let index = 1; index < levels.length; index += 1) {
    const candidate = levels[index]!;
    const distance = Math.abs(value - candidate);
    if (distance >= closestDistance) continue;
    closest = candidate;
    closestDistance = distance;
  }
  return closest;
}

function nextLowerLevel(value: number, levels: readonly number[]): number {
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    const candidate = levels[index]!;
    if (candidate < value) return candidate;
  }
  return levels[0]!;
}

function nextHigherLevel(value: number, levels: readonly number[]): number {
  for (const candidate of levels) {
    if (candidate > value) return candidate;
  }
  return levels[levels.length - 1]!;
}
