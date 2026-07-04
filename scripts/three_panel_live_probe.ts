import { createDefaultAsciiOptions } from "../app/ascii_options.ts";
import {
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_INITIAL_CELLS,
} from "../app/workbench_three_policy.ts";
import { ThreePanelFrameView, type ThreeSceneState } from "../app/three_panel.ts";
import { Signal } from "../src/signals/mod.ts";
import { formatThreePanelProbeLines, type ThreePanelProbeSample } from "../src/three_ascii/panel_probe.ts";
import { choiceArg, delay, numberArg, stringArg } from "../src/three_ascii/probe_cli.ts";
import type { ThreeAsciiRendererPerformance } from "../src/three_ascii/renderer.ts";
import { type ThreeSceneMode, threeSceneModes, type ThreeSceneSignal } from "../app/types.ts";

const frames = numberArg(Deno.args, "--frames", 36);
const width = numberArg(Deno.args, "--width", 80);
const height = numberArg(Deno.args, "--height", 24);
const maxCells = numberArg(Deno.args, "--max-cells", WORKBENCH_THREE_INITIAL_CELLS);
const intervalMs = numberArg(Deno.args, "--interval", apiWorkbenchThreeFrameIntervalForCells(maxCells, { live: true }));
const mode = choiceArg(Deno.args, "--mode", "studio" as ThreeSceneMode, threeSceneModes);
const glyphs = stringArg(Deno.args, "--glyphs", "blocks") as ReturnType<
  typeof createDefaultAsciiOptions
>["terminalGlyphStyle"];

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

const samples: ThreePanelProbeSample[] = [];
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

console.log(
  formatThreePanelProbeLines({ mode, glyphs, width, height, maxCells, intervalMs }, samples, firstGridElapsedMs).join(
    "\n",
  ),
);

function samplePanel(
  index: number,
  elapsedMs: number,
  performanceInfo: ThreeAsciiRendererPerformance,
): ThreePanelProbeSample {
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
