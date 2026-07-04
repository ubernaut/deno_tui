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
  levels: readonly number[];
  highBytes: number;
  lowBytes: number;
  highFrameThreshold?: number;
  lowFrameThreshold?: number;
}

/** Result of applying terminal-output pressure to a Three ASCII render-cell budget. */
export interface WorkbenchThreeTerminalPressureResult extends WorkbenchThreeTerminalPressureState {
  changed: boolean;
  direction: "down" | "up" | "steady";
}

/** Creates pressure counters initialized to the preferred render-cell budget. */
export function createWorkbenchThreeTerminalPressureState(defaultCells: number): WorkbenchThreeTerminalPressureState {
  return {
    currentCells: Math.max(1, Math.floor(defaultCells)),
    highFrames: 0,
    lowFrames: 0,
  };
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

  if (options.bytes >= options.highBytes && current > levels[0]!) {
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

  if (options.bytes <= options.lowBytes && current < levels[levels.length - 1]!) {
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
