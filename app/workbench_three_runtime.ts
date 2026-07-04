import { Signal } from "../src/signals/mod.ts";
import {
  createWorkbenchThreeTerminalPressureState,
  formatWorkbenchThreeTerminalPressureUpdateLog,
  resolveWorkbenchThreeTerminalPressureUpdate,
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

export interface ApiWorkbenchThreeRuntimeOptions {
  hasLiveThreeWindow: () => boolean;
  onPressureChange?: (message: string) => void;
}

/** Owns API workbench Three renderer cadence and terminal-pressure state. */
export class ApiWorkbenchThreeRuntimeController {
  readonly liveMaxCells = new Signal(WORKBENCH_THREE_INITIAL_CELLS);
  readonly frameInterval: Signal<number>;

  #pressure: WorkbenchThreeTerminalPressureState;
  #pressureSample: ApiWorkbenchThreePressureSample = emptyPressureSample();

  constructor(private readonly options: ApiWorkbenchThreeRuntimeOptions) {
    this.frameInterval = new Signal(
      apiWorkbenchThreeFrameIntervalForCells(this.liveMaxCells.peek(), { live: this.options.hasLiveThreeWindow() }),
    );
    this.#pressure = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
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
    const next = resolveWorkbenchThreeTerminalPressureUpdate(this.#pressure, {
      ...API_WORKBENCH_THREE_PRESSURE_POLICY,
      currentCells: this.liveMaxCells.peek(),
      renderedThreeGrids: sample.renderedThreeGrids,
      renderedThreeRows: sample.renderedThreeRows,
      changedRows: stats.changed,
      bytes: stats.bytes,
      durationMs: stats.durationMs,
      sampleDurationMs: this.frameInterval.peek(),
    });
    this.#pressure.currentCells = next.currentCells;
    this.#pressure.highFrames = next.highFrames;
    this.#pressure.lowFrames = next.lowFrames;
    if (!next.changed) return;

    this.liveMaxCells.value = next.currentCells;
    this.syncFrameInterval();
    this.options.onPressureChange?.(
      formatWorkbenchThreeTerminalPressureUpdateLog({
        direction: next.direction,
        currentCells: next.currentCells,
        bytes: stats.bytes,
        durationMs: stats.durationMs,
        sampleDurationMs: this.frameInterval.peek(),
        renderedThreeGrids: sample.renderedThreeGrids,
      }),
    );
  }

  inspectPressure(): WorkbenchThreeTerminalPressureState {
    return { ...this.#pressure };
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
