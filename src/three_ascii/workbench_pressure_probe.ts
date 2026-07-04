import { choiceArg, formatFps, formatMs, numberArg } from "./probe_cli.ts";
import { workbenchThreeTerminalBytesPerSecond } from "../app/workbench_three_terminal_pressure.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";
import type { ThreeAsciiReadbackStrategy } from "./renderer_options.ts";

export interface WorkbenchThreePressureProbeSample {
  index: number;
  maxCells: number;
  sampleDurationMs: number;
  rendererMs: number;
  initMs: number;
  sceneMs: number;
  sceneUpdateMs?: number;
  sceneRenderMs?: number;
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
  averageByteRate: number;
  averageChangedRows: number;
  averageSourceChangedRows: number;
}

export interface WorkbenchThreePressureProbeValidationOptions {
  minSteadyFrames: number;
  minGridUpdates: number;
  minAverageSourceChangedRows: number;
}

export interface WorkbenchThreePressureProbeValidationResult {
  ok: boolean;
  errors: string[];
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
  asciiCells?: number;
  adaptive?: boolean;
  intervalMs: number;
  totalBytes: number;
}

export interface WorkbenchThreePressureProbeCliDefaults<Mode extends string> {
  initialCells: number;
  readbackStrategy: ThreeAsciiReadbackStrategy;
  mode: Mode;
  modes: readonly Mode[];
  frameIntervalForCells: (cells: number) => number;
}

export interface WorkbenchThreePressureProbeCliOptions<Mode extends string> {
  frames: number;
  frameWidth: number;
  frameHeight: number;
  panelWidth: number;
  panelHeight: number;
  maxCells: number;
  asciiCells: number;
  mode: Mode;
  glyphs: TerminalGlyphStyle;
  readbackStrategy: ThreeAsciiReadbackStrategy;
  adaptive: boolean;
  check: boolean;
  minSteadyFrames: number;
  minGridUpdates: number;
  minAverageSourceChangedRows: number;
  intervalMs: number;
}

export function parseWorkbenchThreePressureProbeCliOptions<Mode extends string>(
  args: readonly string[],
  defaults: WorkbenchThreePressureProbeCliDefaults<Mode>,
): WorkbenchThreePressureProbeCliOptions<Mode> {
  const maxCells = numberArg(args, "--max-cells", defaults.initialCells);
  return {
    frames: numberArg(args, "--frames", 24),
    frameWidth: numberArg(args, "--frame-width", 168),
    frameHeight: numberArg(args, "--frame-height", 54),
    panelWidth: numberArg(args, "--panel-width", 96),
    panelHeight: numberArg(args, "--panel-height", 32),
    maxCells,
    asciiCells: numberArg(args, "--ascii-cells", maxCells),
    mode: choiceArg(args, "--mode", defaults.mode, defaults.modes),
    glyphs: choiceArg(args, "--glyphs", "blocks" as TerminalGlyphStyle, ["blocks", "glyphs", "mixed"] as const),
    readbackStrategy: choiceArg(args, "--readback", defaults.readbackStrategy, ["blocking", "deferred"] as const),
    adaptive: args.includes("--adaptive"),
    check: args.includes("--check"),
    minSteadyFrames: numberArg(args, "--min-steady-frames", 3),
    minGridUpdates: numberArg(args, "--min-grid-updates", 2),
    minAverageSourceChangedRows: numberArg(args, "--min-source-rows", 1),
    intervalMs: numberArg(args, "--interval", defaults.frameIntervalForCells(maxCells)),
  };
}

/** Clones a Three ASCII grid row-by-row so mutable renderer grids can be compared across frames. */
export function snapshotWorkbenchThreeProbeGridRows(
  grid: readonly (readonly string[] | undefined)[],
): readonly string[][] {
  return snapshotWorkbenchThreeProbeGridRowsInto(new Array<string[]>(grid.length), grid);
}

/** Reuses a caller-owned snapshot buffer while preserving renderer grid history for frame-to-frame comparisons. */
export function snapshotWorkbenchThreeProbeGridRowsInto(
  snapshot: string[][],
  grid: readonly (readonly string[] | undefined)[],
): string[][] {
  snapshot.length = grid.length;
  for (let row = 0; row < grid.length; row += 1) {
    const source = grid[row] ?? [];
    const target = snapshot[row] ?? [];
    target.length = source.length;
    for (let column = 0; column < source.length; column += 1) {
      target[column] = source[column]!;
    }
    snapshot[row] = target;
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
  let warmup: WorkbenchThreePressureProbeSample | undefined;
  const steady: WorkbenchThreePressureProbeSample[] = [];
  let totalRendererMs = 0;
  let totalFlushMs = 0;
  let totalBytes = 0;
  let totalByteRate = 0;
  let totalChangedRows = 0;
  let totalSourceChangedRows = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]!;
    if (sample.rows <= 0 || sample.columns <= 0 || sample.cells <= 0 || sample.rendererMs <= 0) continue;
    if (!warmup) {
      warmup = sample;
      continue;
    }
    steady.push(sample);
    totalRendererMs += sample.rendererMs;
    totalFlushMs += sample.flushMs;
    totalBytes += sample.bytes;
    totalByteRate += workbenchThreeTerminalBytesPerSecond(sample);
    totalChangedRows += sample.changedRows;
    totalSourceChangedRows += sample.sourceChangedRows;
  }
  const steadyCount = steady.length;
  return {
    warmup,
    latest: samples.at(-1),
    steady,
    averageRendererMs: steadyCount > 0 ? totalRendererMs / steadyCount : 0,
    averageFlushMs: steadyCount > 0 ? totalFlushMs / steadyCount : 0,
    averageBytes: steadyCount > 0 ? totalBytes / steadyCount : 0,
    averageByteRate: steadyCount > 0 ? totalByteRate / steadyCount : 0,
    averageChangedRows: steadyCount > 0 ? totalChangedRows / steadyCount : 0,
    averageSourceChangedRows: steadyCount > 0 ? totalSourceChangedRows / steadyCount : 0,
  };
}

/** Validates that a workbench Three pressure probe observed real renderer frames and changing source grids. */
export function validateWorkbenchThreePressureProbe(
  samples: readonly WorkbenchThreePressureProbeSample[],
  options: WorkbenchThreePressureProbeValidationOptions,
): WorkbenchThreePressureProbeValidationResult {
  const summary = summarizeWorkbenchThreePressureProbe(samples);
  return validateWorkbenchThreePressureProbeSummary(summary, options);
}

/** Validates an already-computed workbench Three pressure summary. */
export function validateWorkbenchThreePressureProbeSummary(
  summary: WorkbenchThreePressureProbeSummary,
  options: WorkbenchThreePressureProbeValidationOptions,
): WorkbenchThreePressureProbeValidationResult {
  const latest = summary.latest;
  const errors: string[] = [];
  if (!summary.warmup) {
    errors.push("no valid renderer frame was observed");
  }
  if (summary.steady.length < options.minSteadyFrames) {
    errors.push(`steady renderer frames ${summary.steady.length} < ${options.minSteadyFrames}`);
  }
  if ((latest?.gridUpdates ?? 0) < options.minGridUpdates) {
    errors.push(`grid updates ${latest?.gridUpdates ?? 0} < ${options.minGridUpdates}`);
  }
  if (summary.averageSourceChangedRows < options.minAverageSourceChangedRows) {
    errors.push(
      `average source-changed rows ${
        summary.averageSourceChangedRows.toFixed(1)
      } < ${options.minAverageSourceChangedRows}`,
    );
  }
  return { ok: errors.length === 0, errors };
}

export function formatWorkbenchThreePressureProbeLines(
  options: WorkbenchThreePressureProbeOptions,
  samples: readonly WorkbenchThreePressureProbeSample[],
): string[] {
  const summary = summarizeWorkbenchThreePressureProbe(samples);
  return formatWorkbenchThreePressureProbeSummaryLines(options, samples, summary);
}

/** Formats workbench Three pressure report lines from an already-computed summary. */
export function formatWorkbenchThreePressureProbeSummaryLines(
  options: WorkbenchThreePressureProbeOptions,
  samples: readonly WorkbenchThreePressureProbeSample[],
  summary: WorkbenchThreePressureProbeSummary,
): string[] {
  const latest = summary.latest;
  const lines = [
    "three-workbench pressure probe",
    `mode=${options.mode} glyphs=${options.glyphs} readback=${options.readback} frame=${options.frameWidth}x${options.frameHeight} panel=${options.panelWidth}x${options.panelHeight} maxCells=${options.maxCells}${
      options.asciiCells === undefined || options.asciiCells === options.maxCells
        ? ""
        : ` asciiCells=${options.asciiCells}`
    }${options.adaptive ? " adaptive" : ""} interval=${formatMs(options.intervalMs)}`,
    `warmup=${formatMs(summary.warmup?.rendererMs)} renderer=${formatMs(summary.averageRendererMs)} fps=${
      formatFps(summary.averageRendererMs)
    } flush=${formatMs(summary.averageFlushMs)} bytes=${Math.round(summary.averageBytes)} rate=${
      Math.round(summary.averageByteRate)
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
      } scene=${formatMs(sample.sceneMs)}${formatScenePhases(sample)} read=${formatMs(sample.readbackMs)} asm=${
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

function formatScenePhases(sample: WorkbenchThreePressureProbeSample): string {
  if (sample.sceneUpdateMs === undefined && sample.sceneRenderMs === undefined) return "";
  return ` update=${formatMs(sample.sceneUpdateMs ?? 0)} render=${formatMs(sample.sceneRenderMs ?? 0)}`;
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
