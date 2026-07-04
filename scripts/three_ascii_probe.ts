import { ThreeAsciiRenderer, type ThreeAsciiRendererPerformance } from "../src/three_ascii/renderer.ts";
import { asciiEffectOptions, createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import { createNeonThreeScene } from "../app/neon_three.ts";
import type { TerminalGlyphStyle } from "../src/three_ascii/glyphs.ts";

type ThreeAsciiProbeReadbackStrategy = "blocking" | "deferred";

interface ProbeOptions {
  columns: number;
  rows: number;
  frames: number;
  warmup: number;
  delayMs: number;
  style: TerminalGlyphStyle;
  readbackStrategy: ThreeAsciiProbeReadbackStrategy;
}

interface TimingSummary {
  min: number;
  avg: number;
  p50: number;
  p95: number;
  max: number;
}

const options = parseArgs(Deno.args);
const ascii = createDefaultAsciiOptions();
ascii.terminalGlyphStyle = options.style;

const bundle = createNeonThreeScene("studio", { wireframeThickness: ascii.wireframeThickness });
const renderer = new ThreeAsciiRenderer({
  scene: bundle.scene,
  camera: bundle.camera,
  columns: options.columns,
  rows: options.rows,
  effect: asciiEffectOptions(ascii),
  terminalEdgeBias: ascii.terminalEdgeBias,
  terminalGlyphStyle: ascii.terminalGlyphStyle,
  deferredReadbackSlots: ascii.deferredReadbackSlots,
  readbackStrategy: options.readbackStrategy,
});

try {
  const samples: ThreeAsciiRendererPerformance[] = [];
  for (let frame = 0; frame < options.frames + options.warmup; frame += 1) {
    await renderer.renderFrame(1 / 30, () => {
      bundle.tick(performance.now(), {
        x: 0.6,
        y: 0.42,
        depth: 0.6,
        twist: 0.25,
        lift: 0.42,
        pulse: 0.7,
        active: true,
        pressed: false,
      });
    }, { ansi: true });
    const perf = renderer.inspectPerformance();
    if (perf && frame >= options.warmup) samples.push(perf);
    if (options.delayMs > 0) await delay(options.delayMs);
  }

  const latest = samples.at(-1);
  const output = {
    options,
    frames: samples.length,
    cells: options.columns * options.rows,
    totalMs: summarize(samples.map((sample) => sample.totalMs)),
    sceneMs: summarize(samples.map((sample) => sample.sceneMs)),
    ansiMs: summarize(samples.map((sample) => sample.ansiMs)),
    readbackMs: summarize(samples.map((sample) => sample.readbackMs)),
    assemblyMs: summarize(samples.map((sample) => sample.assemblyMs)),
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
  console.log(JSON.stringify(output, null, 2));
} finally {
  renderer.destroy();
  bundle.dispose();
}

function parseArgs(args: readonly string[]): ProbeOptions {
  const options: ProbeOptions = {
    columns: 40,
    rows: 24,
    frames: 90,
    warmup: 12,
    delayMs: 0,
    style: "blocks",
    readbackStrategy: "deferred",
  };

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

  return options;
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

function summarize(values: readonly number[]): TimingSummary {
  if (values.length === 0) return { min: 0, avg: 0, p50: 0, p95: 0, max: 0 };
  const sorted = values.slice().sort((left, right) => left - right);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: round(sorted[0]!),
    avg: round(total / values.length),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted[sorted.length - 1]!),
  };
}

function percentile(sorted: readonly number[], quantile: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * quantile)));
  return sorted[index]!;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
