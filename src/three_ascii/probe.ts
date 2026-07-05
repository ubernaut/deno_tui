import type { TerminalGlyphStyle } from "./glyphs.ts";
import type { ThreeAsciiRendererPerformance } from "./renderer.ts";

export type ThreeAsciiProbeReadbackStrategy = "blocking" | "deferred";

export interface ThreeAsciiProbeOptions {
  columns: number;
  rows: number;
  frames: number;
  warmup: number;
  delayMs: number;
  style: TerminalGlyphStyle;
  readbackStrategy: ThreeAsciiProbeReadbackStrategy;
}

export interface ThreeAsciiProbeTimingSummary {
  min: number;
  avg: number;
  p50: number;
  p95: number;
  max: number;
}

export interface ThreeAsciiProbeReport {
  options: ThreeAsciiProbeOptions;
  frames: number;
  cells: number;
  totalMs: ThreeAsciiProbeTimingSummary;
  sceneMs: ThreeAsciiProbeTimingSummary;
  ansiMs: ThreeAsciiProbeTimingSummary;
  readbackMs: ThreeAsciiProbeTimingSummary;
  assemblyMs: ThreeAsciiProbeTimingSummary;
  deferred?: {
    slots?: number;
    pending?: number;
    unresolved?: number;
    resolved?: number;
    saturated?: boolean;
  };
}

export function defaultThreeAsciiProbeOptions(): ThreeAsciiProbeOptions {
  return {
    columns: 40,
    rows: 24,
    frames: 90,
    warmup: 12,
    delayMs: 1,
    style: "blocks",
    readbackStrategy: "deferred",
  };
}

export function parseThreeAsciiProbeOptions(args: readonly string[]): ThreeAsciiProbeOptions {
  const options = defaultThreeAsciiProbeOptions();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") continue;
    const [rawKey, inlineValue] = arg.split("=", 2);
    const key = rawKey.replace(/^--/, "");
    const value = inlineValue ?? args[index + 1];
    if (inlineValue === undefined && arg.startsWith("--")) index += 1;
    switch (key) {
      case "columns":
        options.columns = positiveInteger(value, "columns");
        break;
      case "rows":
        options.rows = positiveInteger(value, "rows");
        break;
      case "frames":
        options.frames = positiveInteger(value, "frames");
        break;
      case "warmup":
        options.warmup = Math.max(0, positiveInteger(value, "warmup"));
        break;
      case "delay":
      case "delayMs":
        options.delayMs = nonNegativeNumber(value, "delay");
        break;
      case "style":
        if (value !== "blocks" && value !== "glyphs" && value !== "mixed") {
          throw new Error(`Unsupported style: ${value}`);
        }
        options.style = value;
        break;
      case "readback":
      case "readbackStrategy":
        if (value !== "blocking" && value !== "deferred") {
          throw new Error(`Unsupported readback strategy: ${value}`);
        }
        options.readbackStrategy = value;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.delayMs = Math.max(1, options.delayMs);

  return options;
}

export function summarizeThreeAsciiProbeTimings(values: readonly number[]): ThreeAsciiProbeTimingSummary {
  if (values.length === 0) return { min: 0, avg: 0, p50: 0, p95: 0, max: 0 };
  const sorted = values.slice();
  sorted.sort((left, right) => left - right);
  let total = 0;
  for (let index = 0; index < values.length; index += 1) {
    total += values[index]!;
  }
  return {
    min: round(sorted[0]!),
    avg: round(total / values.length),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted[sorted.length - 1]!),
  };
}

export function threeAsciiProbeReport(
  options: ThreeAsciiProbeOptions,
  samples: readonly ThreeAsciiRendererPerformance[],
): ThreeAsciiProbeReport {
  const latest = samples.at(-1);
  const timings: number[] = [];
  return {
    options,
    frames: samples.length,
    cells: options.columns * options.rows,
    totalMs: summarizeThreeAsciiProbeSampleTimings(samples, timings, "totalMs"),
    sceneMs: summarizeThreeAsciiProbeSampleTimings(samples, timings, "sceneMs"),
    ansiMs: summarizeThreeAsciiProbeSampleTimings(samples, timings, "ansiMs"),
    readbackMs: summarizeThreeAsciiProbeSampleTimings(samples, timings, "readbackMs"),
    assemblyMs: summarizeThreeAsciiProbeSampleTimings(samples, timings, "assemblyMs"),
    deferred: latest
      ? {
        slots: latest.deferredReadbackSlots,
        pending: latest.deferredReadbackPending,
        unresolved: latest.deferredReadbackUnresolved,
        resolved: latest.deferredReadbackResolved,
        saturated: latest.deferredReadbackSaturated,
      }
      : undefined,
  };
}

export interface ThreePanelProbeSample {
  index: number;
  elapsedMs: number;
  totalMs: number;
  initMs: number;
  sceneMs: number;
  sceneUpdateMs?: number;
  sceneRenderMs?: number;
  readbackMs: number;
  assemblyMs: number;
  columns: number;
  rows: number;
  cells: number;
  updates: number;
  deferredPending?: number;
  deferredUnresolved?: number;
  deferredResolved?: number;
  deferredSaturated?: boolean;
  lifecycle: string;
}

export interface ThreePanelProbeOptions {
  mode: string;
  glyphs: string;
  readback?: string;
  width: number;
  height: number;
  maxCells: number;
  intervalMs: number;
}

export interface ThreePanelProbeSummary {
  first?: ThreePanelProbeSample;
  latest?: ThreePanelProbeSample;
  steady: ThreePanelProbeSample[];
  averageTotalMs: number;
  averageInitMs: number;
  averageSceneMs: number;
  averageSceneUpdateMs: number;
  averageSceneRenderMs: number;
  averageReadbackMs: number;
  averageAssemblyMs: number;
}

export interface ThreePanelProbeValidationOptions {
  minSteadyFrames: number;
  minGridUpdates: number;
  maxAverageTotalMs: number;
}

export interface ThreePanelProbeValidationResult {
  ok: boolean;
  errors: string[];
}

export function summarizeThreePanelProbe(samples: readonly ThreePanelProbeSample[]): ThreePanelProbeSummary {
  const steady: ThreePanelProbeSample[] = [];
  let totalMs = 0;
  let initMs = 0;
  let sceneMs = 0;
  let sceneUpdateMs = 0;
  let sceneUpdateCount = 0;
  let sceneRenderMs = 0;
  let sceneRenderCount = 0;
  let readbackMs = 0;
  let assemblyMs = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]!;
    if (sample.rows <= 0 || sample.columns <= 0) continue;
    steady.push(sample);
    totalMs += sample.totalMs;
    initMs += sample.initMs;
    sceneMs += sample.sceneMs;
    if (sample.sceneUpdateMs !== undefined) {
      sceneUpdateMs += sample.sceneUpdateMs;
      sceneUpdateCount += 1;
    }
    if (sample.sceneRenderMs !== undefined) {
      sceneRenderMs += sample.sceneRenderMs;
      sceneRenderCount += 1;
    }
    readbackMs += sample.readbackMs;
    assemblyMs += sample.assemblyMs;
  }

  const steadyCount = steady.length;
  return {
    first: samples[0],
    latest: samples.at(-1),
    steady,
    averageTotalMs: averageFromSum(totalMs, steadyCount),
    averageInitMs: averageFromSum(initMs, steadyCount),
    averageSceneMs: averageFromSum(sceneMs, steadyCount),
    averageSceneUpdateMs: averageFromSum(sceneUpdateMs, sceneUpdateCount),
    averageSceneRenderMs: averageFromSum(sceneRenderMs, sceneRenderCount),
    averageReadbackMs: averageFromSum(readbackMs, steadyCount),
    averageAssemblyMs: averageFromSum(assemblyMs, steadyCount),
  };
}

/** Validates that a live Three panel probe observed real renderer frames and acceptable steady timing. */
export function validateThreePanelProbeSummary(
  summary: ThreePanelProbeSummary,
  options: ThreePanelProbeValidationOptions,
): ThreePanelProbeValidationResult {
  const errors: string[] = [];
  if (summary.steady.length < options.minSteadyFrames) {
    errors.push(`steady renderer frames ${summary.steady.length} < ${options.minSteadyFrames}`);
  }
  if ((summary.latest?.updates ?? 0) < options.minGridUpdates) {
    errors.push(`grid updates ${summary.latest?.updates ?? 0} < ${options.minGridUpdates}`);
  }
  if (summary.averageTotalMs <= 0) {
    errors.push("average renderer frame time was not observed");
  } else if (summary.averageTotalMs > options.maxAverageTotalMs) {
    errors.push(
      `average renderer frame ${formatMs(summary.averageTotalMs)} > ${formatMs(options.maxAverageTotalMs)}`,
    );
  }
  return { ok: errors.length === 0, errors };
}

export function formatThreePanelProbeLines(
  options: ThreePanelProbeOptions,
  samples: readonly ThreePanelProbeSample[],
  firstGridElapsedMs: number | undefined,
): string[] {
  const summary = summarizeThreePanelProbe(samples);
  const latest = summary.latest;
  const readback = options.readback ? ` readback=${options.readback}` : "";
  const lines = [
    "three-panel live probe",
    `mode=${options.mode} glyphs=${options.glyphs}${readback} rect=${options.width}x${options.height} maxCells=${options.maxCells} interval=${
      formatMs(options.intervalMs)
    }`,
    `warmup=${formatMs(summary.first?.totalMs)} steady=${formatMs(summary.averageTotalMs)} fps=${
      formatFps(summary.averageTotalMs)
    } latest=${latest ? `${latest.columns}x${latest.rows}/${latest.cells}c` : "none"} firstGrid=${
      formatMs(firstGridElapsedMs)
    }`,
    `init=${formatMs(summary.averageInitMs)} scene=${formatMs(summary.averageSceneMs)}${
      formatScenePhaseSummary(summary)
    } readback=${formatMs(summary.averageReadbackMs)} assembly=${formatMs(summary.averageAssemblyMs)} updates=${
      latest?.updates ?? 0
    }${formatDeferredQueueSummary(latest)}`,
  ];
  for (const sample of samples) {
    lines.push(
      `${sample.index.toString().padStart(2, "0")} total=${formatMs(sample.totalMs)} init=${
        formatMs(sample.initMs)
      } elapsed=${
        formatMs(sample.elapsedMs)
      } grid=${sample.columns}x${sample.rows} cells=${sample.cells} state=${sample.lifecycle} updates=${sample.updates}${
        formatDeferredQueueSummary(sample)
      }`,
    );
  }
  return lines;
}

export function numberArg(args: readonly string[], name: string, fallback: number): number {
  const raw = argValue(args, name);
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function stringArg(args: readonly string[], name: string, fallback: string): string {
  return argValue(args, name) || fallback;
}

export function choiceArg<const T extends string>(
  args: readonly string[],
  name: string,
  fallback: T,
  choices: readonly T[],
): T {
  const value = stringArg(args, name, fallback);
  return (choices as readonly string[]).includes(value) ? value as T : fallback;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function averageWhere<T>(
  values: readonly T[],
  select: (value: T) => number,
  include: (value: T) => boolean = () => true,
): number {
  let total = 0;
  let count = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!include(value)) continue;
    total += select(value);
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

export function formatMs(value: number | undefined): string {
  return `${(value ?? 0).toFixed(2)}ms`;
}

export function formatFps(frameMs: number): string {
  return frameMs > 0 ? (1000 / frameMs).toFixed(1) : "0.0";
}

function summarizeThreeAsciiProbeSampleTimings(
  samples: readonly ThreeAsciiRendererPerformance[],
  timings: number[],
  key: "totalMs" | "sceneMs" | "ansiMs" | "readbackMs" | "assemblyMs",
): ThreeAsciiProbeTimingSummary {
  timings.length = samples.length;
  for (let index = 0; index < samples.length; index += 1) {
    timings[index] = samples[index]![key];
  }
  return summarizeThreeAsciiProbeTimings(timings);
}

function formatDeferredQueueSummary(sample: ThreePanelProbeSample | undefined): string {
  if (!sample || sample.deferredPending === undefined) return "";
  const saturation = sample.deferredSaturated ? " saturated" : "";
  return ` queue=${sample.deferredPending}/${sample.deferredUnresolved ?? 0}/${
    sample.deferredResolved ?? 0
  }${saturation}`;
}

function formatScenePhaseSummary(summary: ThreePanelProbeSummary): string {
  if (summary.averageSceneUpdateMs === 0 && summary.averageSceneRenderMs === 0) return "";
  return ` update=${formatMs(summary.averageSceneUpdateMs)} render=${formatMs(summary.averageSceneRenderMs)}`;
}

function averageFromSum(total: number, count: number): number {
  return count === 0 ? 0 : total / count;
}

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive ${name}, got ${value}`);
  }
  return Math.floor(parsed);
}

function nonNegativeNumber(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Expected non-negative ${name}, got ${value}`);
  }
  return parsed;
}

function percentile(sorted: readonly number[], quantile: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * quantile)));
  return sorted[index]!;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function argValue(args: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg?.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg !== name) continue;
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) return undefined;
    return next;
  }
  return undefined;
}
