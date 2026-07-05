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
