import { createDefaultAsciiOptions } from "../app/ascii_options.ts";
import {
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_INITIAL_CELLS,
} from "../app/workbench_three_policy.ts";
import { ThreePanelFrameView, type ThreeSceneState } from "../app/three_panel.ts";
import { Signal } from "../src/signals/mod.ts";
import type { ThreeAsciiRendererPerformance } from "../src/three_ascii/renderer.ts";
import { type ThreeSceneMode, threeSceneModes, type ThreeSceneSignal } from "../app/types.ts";

interface ProbeSample {
  index: number;
  elapsedMs: number;
  totalMs: number;
  sceneMs: number;
  readbackMs: number;
  assemblyMs: number;
  columns: number;
  rows: number;
  cells: number;
  updates: number;
  lifecycle: string;
}

const frames = numberArg("--frames", 36);
const width = numberArg("--width", 80);
const height = numberArg("--height", 24);
const maxCells = numberArg("--max-cells", WORKBENCH_THREE_INITIAL_CELLS);
const intervalMs = numberArg("--interval", apiWorkbenchThreeFrameIntervalForCells(maxCells, { live: true }));
const mode = sceneModeArg("--mode", "studio");
const glyphs = stringArg("--glyphs", "blocks") as ReturnType<typeof createDefaultAsciiOptions>["terminalGlyphStyle"];

const rectangle = new Signal({ column: 0, row: 0, width, height }, { deepObserve: true });
const ascii = new Signal({
  ...createDefaultAsciiOptions("sharp"),
  renderMaxCells: maxCells,
  terminalGlyphStyle: glyphs,
});
const maxRenderCells = new Signal(maxCells);
const frameInterval = new Signal(intervalMs);
const scene = new Signal<ThreeSceneState | null>({
  mode,
  signal: signalForFrame(0, frames),
});

let updates = 0;
const panel = new ThreePanelFrameView({
  rectangle,
  scene,
  ascii,
  frameInterval,
  maxRenderCells,
  onUpdate: () => {
    updates += 1;
  },
});

const samples: ProbeSample[] = [];
const probeStart = performance.now();
let firstGridElapsedMs: number | undefined;

try {
  for (let index = 0; index < frames; index += 1) {
    const started = performance.now();
    scene.value = { mode, signal: signalForFrame(index, frames) };
    await delay(intervalMs);
    const performanceInfo = panel.inspectPerformance();
    const grid = panel.grid.peek();
    if (firstGridElapsedMs === undefined && grid.length > 0 && (grid[0]?.length ?? 0) > 0) {
      firstGridElapsedMs = performance.now() - probeStart;
    }
    if (performanceInfo) {
      samples.push(samplePanel(index, performance.now() - started, performanceInfo));
    }
  }
} finally {
  panel.dispose();
  rectangle.dispose();
  ascii.dispose();
  maxRenderCells.dispose();
  frameInterval.dispose();
  scene.dispose();
}

const first = samples[0];
const steady = samples.slice(1).filter((sample) => sample.rows > 0 && sample.columns > 0);
const averageTotalMs = average(steady.map((sample) => sample.totalMs));
const averageSceneMs = average(steady.map((sample) => sample.sceneMs));
const averageReadbackMs = average(steady.map((sample) => sample.readbackMs));
const averageAssemblyMs = average(steady.map((sample) => sample.assemblyMs));
const latest = samples.at(-1);

console.log("three-panel live probe");
console.log(
  `mode=${mode} glyphs=${glyphs} rect=${width}x${height} maxCells=${maxCells} interval=${formatMs(intervalMs)}`,
);
console.log(
  `warmup=${formatMs(first?.totalMs)} steady=${formatMs(averageTotalMs)} fps=${formatFps(averageTotalMs)} latest=${
    latest ? `${latest.columns}x${latest.rows}/${latest.cells}c` : "none"
  } firstGrid=${formatMs(firstGridElapsedMs)}`,
);
console.log(
  `scene=${formatMs(averageSceneMs)} readback=${formatMs(averageReadbackMs)} assembly=${
    formatMs(averageAssemblyMs)
  } updates=${latest?.updates ?? updates}`,
);
for (const sample of samples) {
  console.log(
    `${sample.index.toString().padStart(2, "0")} total=${formatMs(sample.totalMs)} elapsed=${
      formatMs(sample.elapsedMs)
    } grid=${sample.columns}x${sample.rows} cells=${sample.cells} state=${sample.lifecycle} updates=${sample.updates}`,
  );
}

function samplePanel(
  index: number,
  elapsedMs: number,
  performanceInfo: ThreeAsciiRendererPerformance,
): ProbeSample {
  const grid = panel.grid.peek();
  const lifecycle = panel.inspectLifecycle().state;
  const rows = grid.length;
  const columns = grid[0]?.length ?? 0;
  return {
    index,
    elapsedMs,
    totalMs: performanceInfo.totalMs,
    sceneMs: performanceInfo.sceneMs,
    readbackMs: performanceInfo.readbackMs,
    assemblyMs: performanceInfo.assemblyMs,
    columns,
    rows,
    cells: performanceInfo.cells,
    updates,
    lifecycle,
  };
}

function signalForFrame(index: number, total: number): ThreeSceneSignal {
  const pulse = total <= 1 ? 0 : index / (total - 1);
  return {
    x: 0.55 + pulse * 0.35,
    y: 0.45 + Math.sin(pulse * Math.PI * 2) * 0.2,
    depth: 0.75,
    twist: 0.25 + pulse * 0.5,
    lift: pulse,
    pulse,
    active: true,
    pressed: index % 8 < 4,
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
