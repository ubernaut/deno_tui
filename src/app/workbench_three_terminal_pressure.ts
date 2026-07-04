/** Caches normalized pressure levels for stable policy arrays used on every frame. */
const normalizedLevelCache = new WeakMap<readonly number[], { source: number[]; levels: number[] }>();

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
  sampleDurationMs?: number;
  highBytesPerSecond?: number;
  lowBytesPerSecond?: number;
  highFrameThreshold?: number;
  lowFrameThreshold?: number;
}

/** Result of applying terminal-output pressure to a Three ASCII render-cell budget. */
export interface WorkbenchThreeTerminalPressureResult extends WorkbenchThreeTerminalPressureState {
  changed: boolean;
  direction: "down" | "up" | "steady";
}

/** Inputs used to apply terminal-output pressure around the current live render-cell cap. */
export interface WorkbenchThreeTerminalPressureUpdateOptions extends WorkbenchThreeTerminalPressureOptions {
  currentCells: number;
  renderedThreeRows: number;
  changedRows: number;
  toleranceRows?: number;
}

/** Result of applying a terminal flush sample to the current Three pressure state. */
export interface WorkbenchThreeTerminalPressureUpdateResult extends WorkbenchThreeTerminalPressureResult {
  scoped: boolean;
}

/** Inputs used to describe a terminal-pressure render-cell budget change. */
export interface WorkbenchThreeTerminalPressureUpdateLogOptions {
  direction: WorkbenchThreeTerminalPressureResult["direction"];
  currentCells: number;
  bytes: number;
  durationMs: number;
  sampleDurationMs?: number;
  renderedThreeGrids: number;
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
  blocked?: boolean;
}

/** Inputs used to decide whether one workbench Three pane should use live cadence. */
export interface WorkbenchThreeWindowInteractivityOptions {
  id: string;
  activeId?: string;
  fullscreenId?: string;
  windows: readonly WorkbenchThreeCadenceWindow[];
  blocked?: boolean;
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

/** Inputs used to convert terminal output bytes over a frame/sample window into bytes per second. */
export interface WorkbenchThreeTerminalByteRateOptions {
  bytes: number;
  sampleDurationMs?: number;
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

/** Returns true when a visible Three workbench window should keep Three rendering interactive. */
export function workbenchThreeShouldUseLiveCadence(options: WorkbenchThreeLiveCadenceOptions): boolean {
  if (options.blocked) return false;
  if (options.fullscreenId) return options.isThreeWindow(options.fullscreenId);
  for (const window of options.windows) {
    if (!options.isThreeWindow(window.id)) continue;
    const state = window.state ?? "normal";
    if (state === "normal" || state === "fullscreen") return true;
  }
  return false;
}

/** Returns true when a specific visible Three pane should render at foreground/live cadence. */
export function workbenchThreeWindowIsInteractive(options: WorkbenchThreeWindowInteractivityOptions): boolean {
  if (options.blocked) return false;
  if (options.fullscreenId) return options.fullscreenId === options.id;
  for (const window of options.windows) {
    if (window.id !== options.id) continue;
    const state = window.state ?? "normal";
    return state === "normal" || state === "fullscreen";
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

/** Applies scoping and budget adaptation for one terminal flush sample. */
export function resolveWorkbenchThreeTerminalPressureUpdate(
  state: WorkbenchThreeTerminalPressureState,
  options: WorkbenchThreeTerminalPressureUpdateOptions,
): WorkbenchThreeTerminalPressureUpdateResult {
  const currentState = {
    currentCells: Math.max(1, Math.floor(options.currentCells)),
    highFrames: state.highFrames,
    lowFrames: state.lowFrames,
  };
  const rowScoped = shouldApplyWorkbenchThreeTerminalPressureSample({
    renderedThreeGrids: options.renderedThreeGrids,
    renderedThreeRows: options.renderedThreeRows,
    changedRows: options.changedRows,
    toleranceRows: options.toleranceRows,
  });
  const highDurationMs = Math.max(1, options.highDurationMs ?? Number.POSITIVE_INFINITY);
  const durationScoped = !rowScoped && options.renderedThreeGrids > 0 && options.renderedThreeRows > 0 &&
    options.changedRows > 0 && (options.durationMs ?? 0) >= highDurationMs;
  const scoped = rowScoped || durationScoped;
  const next = resolveWorkbenchThreeTerminalPressureBudget(currentState, {
    ...options,
    renderedThreeGrids: scoped ? options.renderedThreeGrids : 0,
  });
  return { ...next, scoped };
}

/** Formats the user-visible log line for a Three terminal-pressure budget change. */
export function formatWorkbenchThreeTerminalPressureUpdateLog(
  options: WorkbenchThreeTerminalPressureUpdateLogOptions,
): string {
  const byteRate = workbenchThreeTerminalBytesPerSecond(options);
  const rateText = byteRate > 0 ? ` rate ${Math.round(byteRate)}B/s` : "";
  return `three pressure ${options.direction} ${options.currentCells} cells; ${options.bytes} bytes/${
    options.durationMs.toFixed(1)
  }ms${rateText} across ${options.renderedThreeGrids} grid(s)`;
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
  const highBytesPerSecond = options.highBytesPerSecond ?? Number.POSITIVE_INFINITY;
  const bytesPerSecond = workbenchThreeTerminalBytesPerSecond(options);
  const lowBytesPerGrid = options.lowBytesPerGrid ?? Number.POSITIVE_INFINITY;
  const lowBytesPerSecond = options.lowBytesPerSecond ?? Number.POSITIVE_INFINITY;
  const highPressure = options.bytes >= options.highBytes || bytesPerGrid >= highBytesPerGrid ||
    (options.durationMs ?? 0) >= highDurationMs || bytesPerSecond >= highBytesPerSecond;
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

  const lowByteRate = bytesPerSecond <= lowBytesPerSecond;
  if (
    options.bytes <= options.lowBytes && bytesPerGrid <= lowBytesPerGrid && lowByteRate &&
    current < levels[levels.length - 1]!
  ) {
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

export function workbenchThreeTerminalBytesPerSecond(options: WorkbenchThreeTerminalByteRateOptions): number {
  if (options.sampleDurationMs === undefined || options.sampleDurationMs <= 0 || options.bytes <= 0) return 0;
  return options.bytes / (options.sampleDurationMs / 1000);
}

function normalizedLevels(levels: readonly number[]): number[] {
  const cached = normalizedLevelCache.get(levels);
  if (cached && samePressureLevelSource(cached.source, levels)) return cached.levels;
  const source = new Array<number>(levels.length);
  const unique: number[] = [];
  for (let index = 0; index < levels.length; index += 1) {
    const raw = levels[index]!;
    source[index] = raw;
    const normalized = Math.max(1, Math.floor(raw));
    let exists = false;
    for (let uniqueIndex = 0; uniqueIndex < unique.length; uniqueIndex += 1) {
      if (unique[uniqueIndex] !== normalized) continue;
      exists = true;
      break;
    }
    if (!exists) unique.push(normalized);
  }
  unique.sort((left, right) => left - right);
  const normalized = unique.length > 0 ? unique : [1];
  normalizedLevelCache.set(levels, { source, levels: normalized });
  return normalized;
}

function samePressureLevelSource(source: readonly number[], levels: readonly number[]): boolean {
  if (source.length !== levels.length) return false;
  for (let index = 0; index < levels.length; index += 1) {
    if (!Object.is(source[index], levels[index])) return false;
  }
  return true;
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
