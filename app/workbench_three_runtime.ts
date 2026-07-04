import { Signal } from "../src/signals/mod.ts";
import {
  createWorkbenchThreeTerminalPressureState,
  formatWorkbenchThreeTerminalPressureUpdateLog,
  resolveWorkbenchThreeTerminalPressureUpdate,
  workbenchThreeTerminalBytesPerSecond,
  type WorkbenchThreeTerminalPressureState,
} from "../src/app/workbench_three_terminal_pressure.ts";
import {
  API_WORKBENCH_THREE_PRESSURE_POLICY,
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_INITIAL_CELLS,
} from "./workbench_three_policy.ts";

export interface ApiWorkbenchThreeFlushStats {
  changed: number;
  bytes: number;
  durationMs: number;
}

export interface ApiWorkbenchThreePressureSample {
  renderedThreeGrids: number;
  renderedThreeRows: number;
}

export interface ApiWorkbenchThreePressureChangeInput {
  pressure: WorkbenchThreeTerminalPressureState;
  currentCells: number;
  frameIntervalMs: number;
  stats: ApiWorkbenchThreeFlushStats;
  sample: ApiWorkbenchThreePressureSample;
}

export interface ApiWorkbenchThreePressureChange {
  pressure: WorkbenchThreeTerminalPressureState;
  changed: boolean;
  nextCells: number;
  scoped: boolean;
  logMessage?: string;
}

export interface ApiWorkbenchThreePressureInspection extends WorkbenchThreeTerminalPressureState {
  lastBytes: number;
  lastByteRate: number;
  lastChangedRows: number;
  lastRenderedGrids: number;
  lastRenderedRows: number;
  lastScoped: boolean;
}

export interface ApiWorkbenchThreeRuntimeOptions {
  hasLiveThreeWindow: () => boolean;
  onPressureChange?: (message: string) => void;
}

/** Resolves one workbench Three terminal-pressure update without mutating controller signals. */
export function resolveApiWorkbenchThreePressureChange(
  input: ApiWorkbenchThreePressureChangeInput,
): ApiWorkbenchThreePressureChange {
  const next = resolveWorkbenchThreeTerminalPressureUpdate(input.pressure, {
    ...API_WORKBENCH_THREE_PRESSURE_POLICY,
    currentCells: input.currentCells,
    renderedThreeGrids: input.sample.renderedThreeGrids,
    renderedThreeRows: input.sample.renderedThreeRows,
    changedRows: input.stats.changed,
    bytes: input.stats.bytes,
    durationMs: input.stats.durationMs,
    sampleDurationMs: input.frameIntervalMs,
  });
  const pressure = {
    currentCells: next.currentCells,
    highFrames: next.highFrames,
    lowFrames: next.lowFrames,
  };
  if (!next.changed) {
    return { pressure, changed: false, nextCells: input.currentCells, scoped: next.scoped };
  }

  return {
    pressure,
    changed: true,
    nextCells: next.currentCells,
    scoped: next.scoped,
    logMessage: formatWorkbenchThreeTerminalPressureUpdateLog({
      direction: next.direction,
      currentCells: next.currentCells,
      bytes: input.stats.bytes,
      durationMs: input.stats.durationMs,
      sampleDurationMs: input.frameIntervalMs,
      renderedThreeGrids: input.sample.renderedThreeGrids,
    }),
  };
}

/** Owns API workbench Three renderer cadence and terminal-pressure state. */
export class ApiWorkbenchThreeRuntimeController {
  readonly liveMaxCells = new Signal(WORKBENCH_THREE_INITIAL_CELLS);
  readonly frameInterval: Signal<number>;

  #pressure: WorkbenchThreeTerminalPressureState;
  #pressureSample: ApiWorkbenchThreePressureSample = emptyPressureSample();
  #lastPressureInspection: ApiWorkbenchThreePressureInspection;

  constructor(private readonly options: ApiWorkbenchThreeRuntimeOptions) {
    this.frameInterval = new Signal(
      apiWorkbenchThreeFrameIntervalForCells(this.liveMaxCells.peek(), { live: this.options.hasLiveThreeWindow() }),
    );
    this.#pressure = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
    this.#lastPressureInspection = emptyPressureInspection(this.#pressure);
  }

  syncFrameInterval(): void {
    const next = apiWorkbenchThreeFrameIntervalForCells(this.liveMaxCells.peek(), {
      live: this.options.hasLiveThreeWindow(),
    });
    if (this.frameInterval.peek() !== next) this.frameInterval.value = next;
  }

  resetPressureSample(): void {
    this.#pressureSample = emptyPressureSample(this.#pressureSample);
  }

  recordRenderedGridForPressure(rows: number): void {
    this.#pressureSample.renderedThreeGrids += 1;
    this.#pressureSample.renderedThreeRows += Math.max(0, Math.floor(rows));
  }

  inspectPressureSample(): ApiWorkbenchThreePressureSample {
    return { ...this.#pressureSample };
  }

  updatePressure(
    stats: ApiWorkbenchThreeFlushStats,
    sample: ApiWorkbenchThreePressureSample = this.#pressureSample,
  ): void {
    const change = resolveApiWorkbenchThreePressureChange({
      pressure: this.#pressure,
      currentCells: this.liveMaxCells.peek(),
      frameIntervalMs: this.frameInterval.peek(),
      stats,
      sample,
    });
    this.#pressure.currentCells = change.pressure.currentCells;
    this.#pressure.highFrames = change.pressure.highFrames;
    this.#pressure.lowFrames = change.pressure.lowFrames;
    this.#lastPressureInspection = {
      ...change.pressure,
      lastBytes: Math.max(0, Math.floor(stats.bytes)),
      lastByteRate: workbenchThreeTerminalBytesPerSecond({
        bytes: stats.bytes,
        sampleDurationMs: this.frameInterval.peek(),
      }),
      lastChangedRows: Math.max(0, Math.floor(stats.changed)),
      lastRenderedGrids: Math.max(0, Math.floor(sample.renderedThreeGrids)),
      lastRenderedRows: Math.max(0, Math.floor(sample.renderedThreeRows)),
      lastScoped: change.scoped,
    };
    if (!change.changed) return;

    this.liveMaxCells.value = change.nextCells;
    this.syncFrameInterval();
    if (change.logMessage) this.options.onPressureChange?.(change.logMessage);
  }

  inspectPressure(): WorkbenchThreeTerminalPressureState {
    return { ...this.#pressure };
  }

  inspectPressureDetails(): ApiWorkbenchThreePressureInspection {
    return { ...this.#lastPressureInspection };
  }

  dispose(): void {
    this.liveMaxCells.dispose();
    this.frameInterval.dispose();
  }
}

function emptyPressureSample(target: ApiWorkbenchThreePressureSample = {
  renderedThreeGrids: 0,
  renderedThreeRows: 0,
}): ApiWorkbenchThreePressureSample {
  target.renderedThreeGrids = 0;
  target.renderedThreeRows = 0;
  return target;
}

function emptyPressureInspection(
  pressure: WorkbenchThreeTerminalPressureState,
): ApiWorkbenchThreePressureInspection {
  return {
    ...pressure,
    lastBytes: 0,
    lastByteRate: 0,
    lastChangedRows: 0,
    lastRenderedGrids: 0,
    lastRenderedRows: 0,
    lastScoped: false,
  };
}
