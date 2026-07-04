import { asciiControlValues } from "./ascii_options.ts";
import { resolveThreePanelRenderSize, type ThreePanelRenderSize } from "./three_panel_policy.ts";

const ADAPTIVE_RENDER_CELLS_MIN = 60;
const ADAPTIVE_PRESSURE_RENDER_CELL_STEPS = [60, 120, 240, 480] as const;
const ADAPTIVE_RENDER_CELLS_SLOW_FRAMES = 2;
const ADAPTIVE_RENDER_CELLS_FAST_FRAMES = 120;
export const THREE_PANEL_ADAPTIVE_WARMUP_FRAMES = 1;

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

/** Owns adaptive render-cell state for a Three panel without mutating saved user settings. */
export class ThreePanelAdaptiveRenderBudgetController {
  #maxCells?: number;
  #requestedMaxCells = 0;
  #slowFrames = 0;
  #fastFrames = 0;
  #sampleFrames = 0;

  renderSize(
    rect: Pick<{ width: number; height: number }, "width" | "height">,
    requestedMaxCells: number,
  ): ThreePanelRenderSize {
    const requested = normalizeRequestedMaxCells(requestedMaxCells);
    this.#resetForRequestedCells(requested);
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
}

/** Adjusts the Three ASCII render-cell budget from live frame timing without changing saved user settings. */
export function resolveThreePanelAdaptiveRenderBudget(
  input: ThreePanelAdaptiveRenderBudgetInput,
): ThreePanelAdaptiveRenderBudgetResult {
  const requestedMaxCells = Math.max(ADAPTIVE_RENDER_CELLS_MIN, Math.floor(input.requestedMaxCells));
  const currentMaxCells = Math.max(
    ADAPTIVE_RENDER_CELLS_MIN,
    Math.min(requestedMaxCells, Math.floor(input.currentMaxCells ?? requestedMaxCells)),
  );
  const budgetSteps = [...ADAPTIVE_PRESSURE_RENDER_CELL_STEPS, ...asciiControlValues("renderMaxCells")]
    .filter((value) => value >= ADAPTIVE_RENDER_CELLS_MIN && value <= requestedMaxCells)
    .sort((a, b) => a - b);
  const steps = budgetSteps.length ? budgetSteps : [requestedMaxCells];
  const slowThreshold = Math.max(100, input.targetMs * 1.8);
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

function normalizeRequestedMaxCells(value: number): number {
  return Math.max(1, Math.floor(value));
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
