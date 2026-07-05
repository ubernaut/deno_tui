import { Signal } from "../signals/mod.ts";
import {
  createWorkbenchThreeTerminalPressureState,
  formatWorkbenchThreeTerminalPressureUpdateLog,
  resolveWorkbenchThreeTerminalPressureUpdate,
  workbenchThreeTerminalBytesPerSecond,
  type WorkbenchThreeTerminalPressureState,
} from "./workbench_three_terminal_pressure.ts";
import {
  API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY,
  API_WORKBENCH_THREE_PRESSURE_POLICY,
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_FULLSCREEN_MAX_CELLS,
  WORKBENCH_THREE_FULLSCREEN_MIN_CELLS,
  WORKBENCH_THREE_INITIAL_CELLS,
} from "./workbench_three_policy.ts";
import type { WorkbenchThreeCadenceInspection } from "./workbench_three_cadence.ts";

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
  fullscreenThree?: boolean;
  frameIntervalMs: number;
  stats: ApiWorkbenchThreeFlushStats;
  sample: ApiWorkbenchThreePressureSample;
  observedFps?: number;
  targetFps?: number;
  observedFrameCount?: number;
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

export interface ApiWorkbenchThreePressureUpdateGate {
  modalOpen?: boolean;
  dropdownOpen?: boolean;
  configOpen?: boolean;
}

export interface ApiWorkbenchThreeRuntimeOptions {
  hasLiveThreeWindow: () => boolean;
  hasFullscreenThreeWindow?: () => boolean;
  onPressureChange?: (message: string) => void;
}

/** Resolves one workbench Three terminal-pressure update without mutating controller signals. */
export function resolveApiWorkbenchThreePressureChange(
  input: ApiWorkbenchThreePressureChangeInput,
): ApiWorkbenchThreePressureChange {
  return resolveApiWorkbenchThreePressureChangeInto(emptyPressureChange(), input);
}

/** Resolves one workbench Three terminal-pressure update into a caller-owned result. */
export function resolveApiWorkbenchThreePressureChangeInto(
  target: ApiWorkbenchThreePressureChange,
  input: ApiWorkbenchThreePressureChangeInput,
): ApiWorkbenchThreePressureChange {
  const policy = input.fullscreenThree
    ? API_WORKBENCH_THREE_FULLSCREEN_PRESSURE_POLICY
    : API_WORKBENCH_THREE_PRESSURE_POLICY;
  const next = resolveWorkbenchThreeTerminalPressureUpdate(input.pressure, {
    ...policy,
    currentCells: input.currentCells,
    renderedThreeGrids: input.sample.renderedThreeGrids,
    renderedThreeRows: input.sample.renderedThreeRows,
    changedRows: input.stats.changed,
    bytes: input.stats.bytes,
    durationMs: input.stats.durationMs,
    sampleDurationMs: input.frameIntervalMs,
    observedFps: input.observedFps,
    targetFps: input.targetFps,
    observedFrameCount: input.observedFrameCount,
  });
  target.pressure.currentCells = next.currentCells;
  target.pressure.highFrames = next.highFrames;
  target.pressure.lowFrames = next.lowFrames;
  if (!next.changed) {
    target.changed = false;
    target.nextCells = input.currentCells;
    target.scoped = next.scoped;
    target.logMessage = undefined;
    return target;
  }

  target.changed = true;
  target.nextCells = next.currentCells;
  target.scoped = next.scoped;
  target.logMessage = formatWorkbenchThreeTerminalPressureUpdateLog({
    direction: next.direction,
    currentCells: next.currentCells,
    bytes: input.stats.bytes,
    durationMs: input.stats.durationMs,
    sampleDurationMs: input.frameIntervalMs,
    renderedThreeGrids: input.sample.renderedThreeGrids,
  });
  return target;
}

/** Returns true when a frame should be allowed to adapt Three terminal-pressure budgets. */
export function shouldUpdateApiWorkbenchThreePressure(input: ApiWorkbenchThreePressureUpdateGate): boolean {
  return !input.modalOpen && !input.dropdownOpen && !input.configOpen;
}

/** Owns API workbench Three renderer cadence and terminal-pressure state. */
export class ApiWorkbenchThreeRuntimeController {
  readonly liveMaxCells = new Signal(WORKBENCH_THREE_INITIAL_CELLS);
  readonly fullscreenMaxCells = new Signal(WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);
  readonly frameInterval: Signal<number>;

  #pressure: WorkbenchThreeTerminalPressureState;
  #fullscreenPressure: WorkbenchThreeTerminalPressureState;
  #pressureSample: ApiWorkbenchThreePressureSample = emptyPressureSample();
  #lastPressureInspection: ApiWorkbenchThreePressureInspection;
  #pressureChange = emptyPressureChange();
  #pressureChangeInput: ApiWorkbenchThreePressureChangeInput;
  #lastFullscreenTargetCells = 0;
  #fullscreenTargetActive = false;

  constructor(private readonly options: ApiWorkbenchThreeRuntimeOptions) {
    this.frameInterval = new Signal(
      apiWorkbenchThreeFrameIntervalForCells(this.activeMaxCells(), { live: this.options.hasLiveThreeWindow() }),
    );
    this.#pressure = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_INITIAL_CELLS);
    this.#fullscreenPressure = createWorkbenchThreeTerminalPressureState(WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);
    this.#lastPressureInspection = emptyPressureInspection(this.#pressure);
    this.#pressureChangeInput = {
      pressure: this.#pressure,
      currentCells: this.liveMaxCells.peek(),
      frameIntervalMs: this.frameInterval.peek(),
      stats: { changed: 0, bytes: 0, durationMs: 0 },
      sample: this.#pressureSample,
    };
  }

  syncFrameInterval(): void {
    const next = apiWorkbenchThreeFrameIntervalForCells(this.activeMaxCells(), {
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

  resetPressureCounters(): void {
    this.#pressure.highFrames = 0;
    this.#pressure.lowFrames = 0;
    this.#fullscreenPressure.highFrames = 0;
    this.#fullscreenPressure.lowFrames = 0;
    this.#lastPressureInspection.highFrames = 0;
    this.#lastPressureInspection.lowFrames = 0;
  }

  /** Promotes fullscreen render pressure to a new viewport target without fighting later pressure downshifts. */
  syncFullscreenTargetCells(targetCells: number, active = this.hasFullscreenThreeWindow()): number {
    const target = Math.max(
      WORKBENCH_THREE_FULLSCREEN_MIN_CELLS,
      Math.min(WORKBENCH_THREE_FULLSCREEN_MAX_CELLS, Math.floor(targetCells)),
    );
    if (!active) {
      this.#fullscreenTargetActive = false;
      this.#lastFullscreenTargetCells = 0;
      return this.fullscreenMaxCells.peek();
    }

    const enteringFullscreen = !this.#fullscreenTargetActive;
    this.#fullscreenTargetActive = true;
    if ((enteringFullscreen || target !== this.#lastFullscreenTargetCells) && target > this.fullscreenMaxCells.peek()) {
      this.fullscreenMaxCells.value = target;
      this.#fullscreenPressure.currentCells = target;
      this.#fullscreenPressure.highFrames = 0;
      this.#fullscreenPressure.lowFrames = 0;
      this.#lastPressureInspection.currentCells = target;
      this.#lastPressureInspection.highFrames = 0;
      this.#lastPressureInspection.lowFrames = 0;
      this.syncFrameInterval();
    }
    this.#lastFullscreenTargetCells = target;
    return this.fullscreenMaxCells.peek();
  }

  inspectPressureSample(): ApiWorkbenchThreePressureSample {
    return { ...this.#pressureSample };
  }

  inspectPressureSampleInto(target: ApiWorkbenchThreePressureSample): ApiWorkbenchThreePressureSample {
    return writePressureSample(target, this.#pressureSample);
  }

  updatePressure(
    stats: ApiWorkbenchThreeFlushStats,
    sample: ApiWorkbenchThreePressureSample = this.#pressureSample,
    telemetry: Pick<ApiWorkbenchThreePressureChangeInput, "observedFps" | "targetFps" | "observedFrameCount"> = {},
  ): void {
    const fullscreenThree = this.hasFullscreenThreeWindow();
    const pressure = this.activePressure();
    const maxCells = fullscreenThree ? this.fullscreenMaxCells : this.liveMaxCells;
    this.#pressureChangeInput.pressure = pressure;
    this.#pressureChangeInput.currentCells = maxCells.peek();
    this.#pressureChangeInput.fullscreenThree = fullscreenThree;
    this.#pressureChangeInput.frameIntervalMs = this.frameInterval.peek();
    this.#pressureChangeInput.stats = stats;
    this.#pressureChangeInput.sample = sample;
    this.#pressureChangeInput.observedFps = telemetry.observedFps;
    this.#pressureChangeInput.targetFps = telemetry.targetFps;
    this.#pressureChangeInput.observedFrameCount = telemetry.observedFrameCount;
    const change = resolveApiWorkbenchThreePressureChangeInto(this.#pressureChange, this.#pressureChangeInput);
    pressure.currentCells = change.pressure.currentCells;
    pressure.highFrames = change.pressure.highFrames;
    pressure.lowFrames = change.pressure.lowFrames;
    this.#lastPressureInspection.currentCells = change.pressure.currentCells;
    this.#lastPressureInspection.highFrames = change.pressure.highFrames;
    this.#lastPressureInspection.lowFrames = change.pressure.lowFrames;
    this.#lastPressureInspection.lastBytes = Math.max(0, Math.floor(stats.bytes));
    this.#lastPressureInspection.lastByteRate = workbenchThreeTerminalBytesPerSecond({
      bytes: stats.bytes,
      sampleDurationMs: this.frameInterval.peek(),
    });
    this.#lastPressureInspection.lastChangedRows = Math.max(0, Math.floor(stats.changed));
    this.#lastPressureInspection.lastRenderedGrids = Math.max(0, Math.floor(sample.renderedThreeGrids));
    this.#lastPressureInspection.lastRenderedRows = Math.max(0, Math.floor(sample.renderedThreeRows));
    this.#lastPressureInspection.lastScoped = change.scoped;
    if (!change.changed) return;

    maxCells.value = change.nextCells;
    this.syncFrameInterval();
    if (change.logMessage) this.options.onPressureChange?.(change.logMessage);
  }

  updatePressureFromCadence(
    stats: ApiWorkbenchThreeFlushStats,
    cadence: Pick<WorkbenchThreeCadenceInspection, "measuredFps" | "updates">,
    sample: ApiWorkbenchThreePressureSample = this.#pressureSample,
  ): void {
    this.updatePressure(stats, sample, {
      observedFps: cadence.measuredFps,
      observedFrameCount: cadence.updates,
      targetFps: 1000 / this.frameInterval.peek(),
    });
  }

  inspectPressure(): WorkbenchThreeTerminalPressureState {
    return { ...this.activePressure() };
  }

  inspectPressureInto(target: WorkbenchThreeTerminalPressureState): WorkbenchThreeTerminalPressureState {
    return writePressureState(target, this.activePressure());
  }

  inspectPressureDetails(): ApiWorkbenchThreePressureInspection {
    return { ...this.#lastPressureInspection };
  }

  inspectPressureDetailsInto(target: ApiWorkbenchThreePressureInspection): ApiWorkbenchThreePressureInspection {
    return writePressureInspection(target, this.#lastPressureInspection);
  }

  dispose(): void {
    this.liveMaxCells.dispose();
    this.fullscreenMaxCells.dispose();
    this.frameInterval.dispose();
  }

  private hasFullscreenThreeWindow(): boolean {
    return this.options.hasFullscreenThreeWindow?.() ?? false;
  }

  private activeMaxCells(): number {
    return this.hasFullscreenThreeWindow() ? this.fullscreenMaxCells.peek() : this.liveMaxCells.peek();
  }

  private activePressure(): WorkbenchThreeTerminalPressureState {
    return this.hasFullscreenThreeWindow() ? this.#fullscreenPressure : this.#pressure;
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

function emptyPressureChange(): ApiWorkbenchThreePressureChange {
  return {
    pressure: { currentCells: 0, highFrames: 0, lowFrames: 0 },
    changed: false,
    nextCells: 0,
    scoped: false,
  };
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

function writePressureInspection(
  target: ApiWorkbenchThreePressureInspection,
  source: ApiWorkbenchThreePressureInspection,
): ApiWorkbenchThreePressureInspection {
  writePressureState(target, source);
  target.lastBytes = source.lastBytes;
  target.lastByteRate = source.lastByteRate;
  target.lastChangedRows = source.lastChangedRows;
  target.lastRenderedGrids = source.lastRenderedGrids;
  target.lastRenderedRows = source.lastRenderedRows;
  target.lastScoped = source.lastScoped;
  return target;
}

function writePressureState<T extends WorkbenchThreeTerminalPressureState>(
  target: T,
  source: WorkbenchThreeTerminalPressureState,
): T {
  target.currentCells = source.currentCells;
  target.highFrames = source.highFrames;
  target.lowFrames = source.lowFrames;
  return target;
}

function writePressureSample(
  target: ApiWorkbenchThreePressureSample,
  source: ApiWorkbenchThreePressureSample,
): ApiWorkbenchThreePressureSample {
  target.renderedThreeGrids = source.renderedThreeGrids;
  target.renderedThreeRows = source.renderedThreeRows;
  return target;
}
