import { asciiEffectOptions, createDefaultAsciiOptions } from "../app/ascii_options.ts";
import { createNeonThreeScene } from "../app/neon_three.ts";
import { type ThreeSceneMode, threeSceneModes, type ThreeSceneSignal } from "../app/types.ts";
import { ThreeAsciiRenderer } from "../src/three_ascii/renderer.ts";

interface ProbeSample {
  index: number;
  elapsedMs: number;
  totalMs: number;
  sceneMs: number;
  readbackMs: number;
  assemblyMs: number;
  rows: number;
  columns: number;
}

const frames = numberArg("--frames", 24);
const columns = numberArg("--columns", 31);
const rows = numberArg("--rows", 15);
const intervalMs = numberArg("--interval", 55);
const mode = sceneModeArg("--mode", "studio");

const ascii = {
  ...createDefaultAsciiOptions("sharp"),
  terminalGlyphStyle: stringArg("--glyphs", "blocks") as ReturnType<
    typeof createDefaultAsciiOptions
  >["terminalGlyphStyle"],
};
const bundle = createNeonThreeScene(mode, { wireframeThickness: ascii.wireframeThickness });
const renderer = new ThreeAsciiRenderer({
  scene: bundle.scene,
  camera: bundle.camera,
  columns,
  rows,
  effect: asciiEffectOptions(ascii),
  terminalGlyphStyle: ascii.terminalGlyphStyle,
  terminalEdgeBias: ascii.terminalEdgeBias,
  readbackStrategy: "deferred",
  deferredReadbackSlots: ascii.deferredReadbackSlots,
});

const samples: ProbeSample[] = [];

try {
  for (let index = 0; index < frames; index += 1) {
    const started = performance.now();
    const frame = await renderer.renderFrame(
      intervalMs / 1000,
      () => bundle.tick(performance.now(), signalForFrame(index, frames)),
      { ansi: true },
    );
    const elapsedMs = performance.now() - started;
    const performanceInfo = renderer.inspectPerformance();
    if (performanceInfo) {
      samples.push({
        index,
        elapsedMs,
        totalMs: performanceInfo.totalMs,
        sceneMs: performanceInfo.sceneMs,
        readbackMs: performanceInfo.readbackMs,
        assemblyMs: performanceInfo.assemblyMs,
        rows: frame.grid?.length ?? 0,
        columns: frame.grid?.[0]?.length ?? 0,
      });
    }
    if (index < frames - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
} finally {
  renderer.destroy();
  bundle.dispose();
}

const warmup = samples[0];
const steady = samples.slice(1).filter((sample) => sample.rows > 0 && sample.columns > 0);
const averageTotalMs = average(steady.map((sample) => sample.totalMs));
const averageSceneMs = average(steady.map((sample) => sample.sceneMs));
const averageReadbackMs = average(steady.map((sample) => sample.readbackMs));
const averageAssemblyMs = average(steady.map((sample) => sample.assemblyMs));

console.log(`three-ascii live probe`);
console.log(`scene=${mode} glyphs=${ascii.terminalGlyphStyle} size=${columns}x${rows} frames=${frames}`);
console.log(`warmup=${formatMs(warmup?.totalMs)} steady=${formatMs(averageTotalMs)} fps=${formatFps(averageTotalMs)}`);
console.log(
  `scene=${formatMs(averageSceneMs)} readback=${formatMs(averageReadbackMs)} assembly=${formatMs(averageAssemblyMs)}`,
);
for (const sample of samples) {
  console.log(
    `${sample.index.toString().padStart(2, "0")} total=${formatMs(sample.totalMs)} elapsed=${
      formatMs(sample.elapsedMs)
    } grid=${sample.columns}x${sample.rows}`,
  );
}

function signalForFrame(index: number, total: number): ThreeSceneSignal {
  const pulse = total <= 1 ? 0 : index / (total - 1);
  return {
    x: 0.6 + pulse * 0.4,
    y: 0.35 + pulse * 0.25,
    depth: 0.7,
    twist: 0.45,
    lift: pulse,
    pulse,
    active: true,
    pressed: false,
  };
}

function numberArg(name: string, fallback: number): number {
  const prefix = `${name}=`;
  const raw = Deno.args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stringArg(name: string, fallback: string): string {
  const prefix = `${name}=`;
  return Deno.args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function sceneModeArg(name: string, fallback: ThreeSceneMode): ThreeSceneMode {
  const value = stringArg(name, fallback);
  return (threeSceneModes as readonly string[]).includes(value) ? value as ThreeSceneMode : fallback;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatMs(value: number | undefined): string {
  return `${(value ?? 0).toFixed(2)}ms`;
}

function formatFps(frameMs: number): string {
  return frameMs > 0 ? (1000 / frameMs).toFixed(1) : "0.0";
}
