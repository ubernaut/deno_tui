import { asciiControlValues, type ThreeAsciiConfigOptions } from "../three_ascii/options.ts";
import type { ThreeAsciiRenderFrameOptions } from "../three_ascii/renderer.ts";

const ADAPTIVE_RENDER_CELLS_MIN = 30;
const ADAPTIVE_PRESSURE_RENDER_CELL_STEPS = [30, 60, 120, 240, 480] as const;
const ADAPTIVE_RENDER_CELLS_LIVE_FLOOR = 480;
const ADAPTIVE_RENDER_CELLS_SLOW_FRAMES = 2;
const ADAPTIVE_RENDER_CELLS_FAST_FRAMES = 120;
export const THREE_PANEL_ADAPTIVE_WARMUP_FRAMES = 1;
const adaptiveRenderCellStepCache = new Map<number, readonly number[]>();

export interface ThreePanelRectLike {
  width: number;
  height: number;
}

export interface ThreePanelRenderPolicyInput {
  ascii: Pick<ThreeAsciiConfigOptions, "kittyGraphics" | "kittyDisableAscii">;
  graphicsAvailable: boolean;
  graphicsRectangle: ThreePanelRectLike;
  rendererSupportsImage: boolean;
}

export interface ThreePanelRenderPolicy {
  kittyActive: boolean;
  renderAscii: boolean;
  renderImage: boolean;
  frameOptions: ThreeAsciiRenderFrameOptions;
}

export interface ThreePanelRenderSize {
  columns: number;
  rows: number;
}

export interface ThreePanelRequestedMaxCellsInput {
  userMaxCells: number;
  pressureMaxCells?: number;
}

export interface ThreePanelRuntimeBudgetInput {
  interactive: boolean;
  userMaxCells: number;
  maxRenderCells?: number;
  idleMaxRenderCells?: number;
  frameInterval: number;
  idleFrameInterval?: number;
}

export interface ThreePanelRuntimeBudget {
  requestedMaxCells: number;
  frameInterval: number;
}

export interface ThreePanelAdaptiveRenderBudgetInput {
  requestedMaxCells: number;
  currentMaxCells?: number;
  frameMs: number;
  targetMs: number;
  slowFrames: number;
  fastFrames: number;
  sampleFrames?: number;
  warmupFrames?: number;
}

export interface ThreePanelAdaptiveRenderBudgetResult {
  maxCells?: number;
  slowFrames: number;
  fastFrames: number;
  direction: "down" | "up" | "steady";
}

export interface ThreePanelAdaptiveRenderBudgetUpdateInput {
  requestedMaxCells: number;
  frameMs: number;
  targetMs: number;
}

export interface ThreePanelAdaptiveRenderBudgetUpdateResult extends ThreePanelAdaptiveRenderBudgetResult {
  changed: boolean;
}

export function resolveThreePanelRenderSize(
  rect: ThreePanelRectLike,
  maxCells?: number,
): ThreePanelRenderSize {
  const columns = Math.max(1, Math.floor(rect.width));
  const rows = Math.max(1, Math.floor(rect.height));
  const cellLimit = Math.max(1, Math.floor(maxCells ?? columns * rows));
  const cells = columns * rows;
  if (cells <= cellLimit) return { columns, rows };

  const scale = Math.sqrt(cellLimit / cells);
  return {
    columns: Math.max(1, Math.min(columns, Math.floor(columns * scale))),
    rows: Math.max(1, Math.min(rows, Math.floor(rows * scale))),
  };
}

/** Owns adaptive render-cell state for a Three panel without mutating saved user settings. */
export class ThreePanelAdaptiveRenderBudgetController {
  #maxCells?: number;
  #requestedMaxCells = 0;
  #rectArea = 0;
  #slowFrames = 0;
  #fastFrames = 0;
  #sampleFrames = 0;

  renderSize(
    rect: Pick<{ width: number; height: number }, "width" | "height">,
    requestedMaxCells: number,
  ): ThreePanelRenderSize {
    const requested = normalizeRequestedMaxCells(requestedMaxCells);
    this.#resetForRequestedCells(requested);
    this.#resetForExpandedViewport(rect);
    return resolveThreePanelRenderSize(rect, this.#maxCells ?? requested);
  }

  update(input: ThreePanelAdaptiveRenderBudgetUpdateInput): ThreePanelAdaptiveRenderBudgetUpdateResult {
    const requestedMaxCells = normalizeRequestedMaxCells(input.requestedMaxCells);
    this.#resetForRequestedCells(requestedMaxCells);
    const next = resolveThreePanelAdaptiveRenderBudget({
      requestedMaxCells,
      currentMaxCells: this.#maxCells,
      frameMs: input.frameMs,
      targetMs: input.targetMs,
      slowFrames: this.#slowFrames,
      fastFrames: this.#fastFrames,
      sampleFrames: this.#sampleFrames,
    });
    this.#sampleFrames += 1;
    this.#slowFrames = next.slowFrames;
    this.#fastFrames = next.fastFrames;
    if (next.maxCells === this.#maxCells) return { ...next, changed: false };
    this.#maxCells = next.maxCells;
    return { ...next, changed: true };
  }

  reset(): void {
    this.#maxCells = undefined;
    this.#requestedMaxCells = 0;
    this.#rectArea = 0;
    this.#slowFrames = 0;
    this.#fastFrames = 0;
    this.#sampleFrames = 0;
  }

  #resetForRequestedCells(requestedMaxCells: number): void {
    if (requestedMaxCells === this.#requestedMaxCells) return;
    this.#requestedMaxCells = requestedMaxCells;
    this.#maxCells = undefined;
    this.#slowFrames = 0;
    this.#fastFrames = 0;
    this.#sampleFrames = 0;
  }

  #resetForExpandedViewport(rect: Pick<{ width: number; height: number }, "width" | "height">): void {
    const area = Math.max(1, Math.floor(rect.width)) * Math.max(1, Math.floor(rect.height));
    if (area <= this.#rectArea) {
      this.#rectArea = area;
      return;
    }
    this.#rectArea = area;
    this.#maxCells = undefined;
    this.#slowFrames = 0;
    this.#fastFrames = 0;
    this.#sampleFrames = 0;
  }
}

/** Adjusts the Three ASCII render-cell budget from live frame timing without changing saved user settings. */
export function resolveThreePanelAdaptiveRenderBudget(
  input: ThreePanelAdaptiveRenderBudgetInput,
): ThreePanelAdaptiveRenderBudgetResult {
  const adaptiveFloor = adaptiveRenderCellFloorForRequest(input.requestedMaxCells);
  const requestedMaxCells = Math.max(adaptiveFloor, Math.floor(input.requestedMaxCells));
  const currentMaxCells = Math.max(
    adaptiveFloor,
    Math.min(requestedMaxCells, Math.floor(input.currentMaxCells ?? requestedMaxCells)),
  );
  const steps = adaptiveRenderCellStepsForRequest(requestedMaxCells, adaptiveFloor);
  const slowThreshold = Math.max(50, input.targetMs * 1.8);
  const fastThreshold = Math.max(1, input.targetMs * 0.7);
  const sampleFrames = Math.max(0, Math.floor(input.sampleFrames ?? Number.POSITIVE_INFINITY));
  const warmupFrames = Math.max(0, Math.floor(input.warmupFrames ?? THREE_PANEL_ADAPTIVE_WARMUP_FRAMES));

  if (sampleFrames < warmupFrames) {
    return { maxCells: input.currentMaxCells, slowFrames: 0, fastFrames: 0, direction: "steady" };
  }

  if (input.frameMs >= slowThreshold) {
    const slowFrames = input.slowFrames + 1;
    if (slowFrames >= ADAPTIVE_RENDER_CELLS_SLOW_FRAMES) {
      const lower = previousRenderCellStep(steps, currentMaxCells);
      if (lower < currentMaxCells) {
        return { maxCells: lower, slowFrames: 0, fastFrames: 0, direction: "down" };
      }
    }
    return { maxCells: input.currentMaxCells, slowFrames, fastFrames: 0, direction: "steady" };
  }

  if (input.currentMaxCells !== undefined && currentMaxCells < requestedMaxCells && input.frameMs <= fastThreshold) {
    const fastFrames = input.fastFrames + 1;
    if (fastFrames >= ADAPTIVE_RENDER_CELLS_FAST_FRAMES) {
      const higher = nextRenderCellStep(steps, currentMaxCells);
      return {
        maxCells: higher >= requestedMaxCells ? undefined : higher,
        slowFrames: 0,
        fastFrames: 0,
        direction: "up",
      };
    }
    return { maxCells: input.currentMaxCells, slowFrames: 0, fastFrames, direction: "steady" };
  }

  return { maxCells: input.currentMaxCells, slowFrames: 0, fastFrames: 0, direction: "steady" };
}

export function resolveThreePanelRequestedMaxCells(input: ThreePanelRequestedMaxCellsInput): number {
  const userCells = Math.max(1, Math.floor(input.userMaxCells));
  const pressureCap = input.pressureMaxCells === undefined
    ? userCells
    : Math.max(1, Math.floor(input.pressureMaxCells));
  return Math.min(userCells, pressureCap);
}

export function resolveThreePanelFrameInterval(frameInterval: number): number {
  return Math.max(1, frameInterval);
}

/** Resolves the active render-cell cap and frame cadence for live or idle Three panels. */
export function resolveThreePanelRuntimeBudget(input: ThreePanelRuntimeBudgetInput): ThreePanelRuntimeBudget {
  const pressureMaxCells = !input.interactive && input.idleMaxRenderCells !== undefined
    ? input.idleMaxRenderCells
    : input.maxRenderCells;
  const frameInterval = !input.interactive && input.idleFrameInterval !== undefined
    ? input.idleFrameInterval
    : input.frameInterval;
  return {
    requestedMaxCells: resolveThreePanelRequestedMaxCells({
      userMaxCells: input.userMaxCells,
      pressureMaxCells,
    }),
    frameInterval: resolveThreePanelFrameInterval(frameInterval),
  };
}

export function resolveThreePanelRenderPolicy(input: ThreePanelRenderPolicyInput): ThreePanelRenderPolicy {
  const kittyRequested = input.ascii.kittyGraphics;
  const kittyActive = Boolean(
    kittyRequested && input.graphicsAvailable && input.rendererSupportsImage &&
      input.graphicsRectangle.width > 0 && input.graphicsRectangle.height > 0,
  );
  const renderAscii = !kittyActive || !input.ascii.kittyDisableAscii;
  return {
    kittyActive,
    renderAscii,
    renderImage: kittyActive,
    frameOptions: {
      ansi: renderAscii,
      image: kittyActive,
    },
  };
}

function normalizeRequestedMaxCells(value: number): number {
  return Math.max(1, Math.floor(value));
}

function adaptiveRenderCellFloorForRequest(requestedMaxCells: number): number {
  const requested = Math.max(1, Math.floor(requestedMaxCells));
  return requested >= ADAPTIVE_RENDER_CELLS_LIVE_FLOOR * 2
    ? ADAPTIVE_RENDER_CELLS_LIVE_FLOOR
    : ADAPTIVE_RENDER_CELLS_MIN;
}

function adaptiveRenderCellStepsForRequest(
  requestedMaxCells: number,
  floor = ADAPTIVE_RENDER_CELLS_MIN,
): readonly number[] {
  const cacheKey = requestedMaxCells * 10_000 + floor;
  const cached = adaptiveRenderCellStepCache.get(cacheKey);
  if (cached) return cached;

  const source = asciiControlValues("renderMaxCells");
  const steps: number[] = [];
  for (let index = 0; index < ADAPTIVE_PRESSURE_RENDER_CELL_STEPS.length; index += 1) {
    const value = ADAPTIVE_PRESSURE_RENDER_CELL_STEPS[index]!;
    if (value >= floor && value <= requestedMaxCells) steps.push(value);
  }
  for (let index = 0; index < source.length; index += 1) {
    const value = source[index]!;
    if (value >= floor && value <= requestedMaxCells) steps.push(value);
  }
  steps.sort((a, b) => a - b);
  const resolved = steps.length ? steps : [requestedMaxCells];
  adaptiveRenderCellStepCache.set(cacheKey, resolved);
  return resolved;
}

function previousRenderCellStep(steps: readonly number[], current: number): number {
  let previous = steps[0] ?? current;
  for (const step of steps) {
    if (step >= current) return previous;
    previous = step;
  }
  return previous;
}

function nextRenderCellStep(steps: readonly number[], current: number): number {
  for (const step of steps) {
    if (step > current) return step;
  }
  return steps.at(-1) ?? current;
}
