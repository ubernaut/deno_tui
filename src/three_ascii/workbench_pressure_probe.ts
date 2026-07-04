import { average } from "./probe_cli.ts";

export interface WorkbenchThreePressureProbeSample {
  index: number;
  rendererMs: number;
  sceneMs: number;
  readbackMs: number;
  assemblyMs: number;
  flushMs: number;
  bytes: number;
  changedRows: number;
  sourceChangedRows: number;
  gridUpdates: number;
  columns: number;
  rows: number;
  cells: number;
}

export interface WorkbenchThreePressureProbeSummary {
  warmup?: WorkbenchThreePressureProbeSample;
  latest?: WorkbenchThreePressureProbeSample;
  steady: WorkbenchThreePressureProbeSample[];
  averageRendererMs: number;
  averageFlushMs: number;
  averageBytes: number;
  averageChangedRows: number;
  averageSourceChangedRows: number;
}

/** Clones a Three ASCII grid row-by-row so mutable renderer grids can be compared across frames. */
export function snapshotWorkbenchThreeProbeGridRows(
  grid: readonly (readonly string[] | undefined)[],
): readonly string[][] {
  const snapshot = new Array<string[]>(grid.length);
  for (let row = 0; row < grid.length; row += 1) {
    snapshot[row] = [...(grid[row] ?? [])];
  }
  return snapshot;
}

/** Counts rows whose source cell content changed between two probe samples. */
export function countWorkbenchThreeProbeChangedGridRows(
  previous: readonly (readonly string[] | undefined)[],
  next: readonly (readonly string[] | undefined)[],
): number {
  const rows = Math.max(previous.length, next.length);
  let changed = 0;
  for (let row = 0; row < rows; row += 1) {
    if (!workbenchThreeProbeGridRowsEqual(previous[row], next[row])) changed += 1;
  }
  return changed;
}

/** Summarizes workbench Three pressure samples while excluding placeholder and startup renderer frames. */
export function summarizeWorkbenchThreePressureProbe(
  samples: readonly WorkbenchThreePressureProbeSample[],
): WorkbenchThreePressureProbeSummary {
  const valid = samples.filter((sample) =>
    sample.rows > 0 && sample.columns > 0 && sample.cells > 0 && sample.rendererMs > 0
  );
  const steady = valid.slice(1);
  return {
    warmup: valid[0],
    latest: samples.at(-1),
    steady,
    averageRendererMs: average(steady.map((sample) => sample.rendererMs)),
    averageFlushMs: average(steady.map((sample) => sample.flushMs)),
    averageBytes: average(steady.map((sample) => sample.bytes)),
    averageChangedRows: average(steady.map((sample) => sample.changedRows)),
    averageSourceChangedRows: average(steady.map((sample) => sample.sourceChangedRows)),
  };
}

function workbenchThreeProbeGridRowsEqual(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  if (left === right) return true;
  const leftLength = left?.length ?? 0;
  const rightLength = right?.length ?? 0;
  if (leftLength !== rightLength) return false;
  for (let column = 0; column < leftLength; column += 1) {
    if (left![column] !== right![column]) return false;
  }
  return true;
}
