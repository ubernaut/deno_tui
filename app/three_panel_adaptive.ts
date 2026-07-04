import { asciiControlValues } from "./ascii_options.ts";

const ADAPTIVE_RENDER_CELLS_MIN = 960;
const ADAPTIVE_RENDER_CELLS_SLOW_FRAMES = 2;
const ADAPTIVE_RENDER_CELLS_FAST_FRAMES = 120;

export interface ThreePanelAdaptiveRenderBudgetInput {
  requestedMaxCells: number;
  currentMaxCells?: number;
  frameMs: number;
  targetMs: number;
  slowFrames: number;
  fastFrames: number;
}

export interface ThreePanelAdaptiveRenderBudgetResult {
  maxCells?: number;
  slowFrames: number;
  fastFrames: number;
  direction: "down" | "up" | "steady";
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
  const budgetSteps = asciiControlValues("renderMaxCells")
    .filter((value) => value >= ADAPTIVE_RENDER_CELLS_MIN && value <= requestedMaxCells)
    .sort((a, b) => a - b);
  const steps = budgetSteps.length ? budgetSteps : [requestedMaxCells];
  const slowThreshold = Math.max(100, input.targetMs * 1.8);
  const fastThreshold = Math.max(1, input.targetMs * 0.7);

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
