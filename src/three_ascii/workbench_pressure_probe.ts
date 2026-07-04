import { average, formatFps, formatMs } from "./probe_cli.ts";
import { workbenchThreeTerminalBytesPerSecond } from "../app/workbench_three_terminal_pressure.ts";

export interface WorkbenchThreePressureProbeSample {
  index: number;
  maxCells: number;
  sampleDurationMs: number;
  rendererMs: number;
  initMs: number;
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

export interface WorkbenchThreePressureProbeOptions {
  mode: string;
  glyphs: string;
  readback: string;
  frameWidth: number;
  frameHeight: number;
  panelWidth: number;
  panelHeight: number;
  maxCells: number;
  adaptive?: boolean;
  intervalMs: number;
  totalBytes: number;
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

export function formatWorkbenchThreePressureProbeLines(
  options: WorkbenchThreePressureProbeOptions,
  samples: readonly WorkbenchThreePressureProbeSample[],
): string[] {
  const summary = summarizeWorkbenchThreePressureProbe(samples);
  const latest = summary.latest;
  const lines = [
    "three-workbench pressure probe",
    `mode=${options.mode} glyphs=${options.glyphs} readback=${options.readback} frame=${options.frameWidth}x${options.frameHeight} panel=${options.panelWidth}x${options.panelHeight} maxCells=${options.maxCells}${
      options.adaptive ? " adaptive" : ""
    } interval=${formatMs(options.intervalMs)}`,
    `warmup=${formatMs(summary.warmup?.rendererMs)} renderer=${formatMs(summary.averageRendererMs)} fps=${
      formatFps(summary.averageRendererMs)
    } flush=${formatMs(summary.averageFlushMs)} bytes=${Math.round(summary.averageBytes)} rate=${
      Math.round(average(pressureByteRates(summary.steady)))
    }B/s changedRows=${summary.averageChangedRows.toFixed(1)} sourceRows=${
      summary.averageSourceChangedRows.toFixed(1)
    } updates=${latest?.gridUpdates ?? 0} latest=${
      latest ? `${latest.columns}x${latest.rows}/${latest.cells}c` : "none"
    } totalBytes=${options.totalBytes}`,
  ];
  for (const sample of samples) {
    lines.push(
      `${sample.index.toString().padStart(2, "0")} renderer=${formatMs(sample.rendererMs)} init=${
        formatMs(sample.initMs)
      } scene=${formatMs(sample.sceneMs)} read=${formatMs(sample.readbackMs)} asm=${
        formatMs(sample.assemblyMs)
      } flush=${formatMs(sample.flushMs)} bytes=${sample.bytes} rate=${
        Math.round(workbenchThreeTerminalBytesPerSecond(sample))
      }B/s changed=${sample.changedRows} sourceChanged=${sample.sourceChangedRows} cap=${sample.maxCells} interval=${
        formatMs(sample.sampleDurationMs)
      } updates=${sample.gridUpdates} grid=${sample.columns}x${sample.rows}`,
    );
  }
  return lines;
}

function pressureByteRates(samples: readonly WorkbenchThreePressureProbeSample[]): number[] {
  return samples.map((sample) => workbenchThreeTerminalBytesPerSecond(sample));
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
