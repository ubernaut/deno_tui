import {
  prepareWorkbenchFrame,
  renderFrameRow,
  renderFrameSlice,
  Signal,
  WorkbenchAnsiScreenPainter,
  type WorkbenchFrame,
  writeFrame,
} from "../mod.ts";
import { ThreePanelFrameView, type ThreeSceneState } from "../app/three_panel.ts";
import { writeWorkbenchThreeGrid } from "../app/workbench_three_grid.ts";
import { createDefaultWorkbenchAsciiOptions } from "../src/app/workbench_ascii.ts";
import {
  apiWorkbenchThreeFrameIntervalForCells,
  WORKBENCH_THREE_INITIAL_CELLS,
  WORKBENCH_THREE_READBACK_STRATEGY,
} from "../app/workbench_three_policy.ts";
import { choiceArg, delay, numberArg } from "../src/three_ascii/probe_cli.ts";
import {
  countWorkbenchThreeProbeChangedGridRows,
  formatWorkbenchThreePressureProbeLines,
  snapshotWorkbenchThreeProbeGridRows,
  type WorkbenchThreePressureProbeSample,
} from "../src/three_ascii/workbench_pressure_probe.ts";
import { type ThreeSceneMode, threeSceneModes } from "../app/types.ts";

const frames = numberArg(Deno.args, "--frames", 24);
const frameWidth = numberArg(Deno.args, "--frame-width", 168);
const frameHeight = numberArg(Deno.args, "--frame-height", 54);
const panelWidth = numberArg(Deno.args, "--panel-width", 96);
const panelHeight = numberArg(Deno.args, "--panel-height", 32);
const maxCells = numberArg(Deno.args, "--max-cells", WORKBENCH_THREE_INITIAL_CELLS);
const mode = choiceArg(Deno.args, "--mode", "studio" as ThreeSceneMode, threeSceneModes);
const glyphs = choiceArg(Deno.args, "--glyphs", "blocks", ["blocks", "glyphs", "mixed"] as const);
const readbackStrategy = choiceArg(Deno.args, "--readback", WORKBENCH_THREE_READBACK_STRATEGY, [
  "blocking",
  "deferred",
] as const);
const intervalMs = numberArg(Deno.args, "--interval", apiWorkbenchThreeFrameIntervalForCells(maxCells, { live: true }));

let bytesWritten = 0;
const painter = new WorkbenchAnsiScreenPainter({
  writeSync(data) {
    bytesWritten += data.byteLength;
    return data.byteLength;
  },
});
const frame: WorkbenchFrame = [];
const rowBuffer: string[] = [];
const sourceRowIndexes: number[] = [];
const sourceColumnIndexes: number[] = [];
const rectangle = new Signal({ column: 0, row: 0, width: panelWidth, height: panelHeight }, { deepObserve: true });
const scene = new Signal<ThreeSceneState | null>({
  mode,
  signal: { x: 0.45, y: 0.62, depth: 0.55, twist: 0.35, lift: 0.42, pulse: 0.75, active: true, pressed: false },
});
const ascii = new Signal({
  ...createDefaultWorkbenchAsciiOptions(),
  terminalGlyphStyle: glyphs,
  renderMaxCells: maxCells,
});
const maxRenderCells = new Signal(maxCells);
let gridUpdates = 0;
const panel = new ThreePanelFrameView({
  rectangle,
  scene,
  ascii,
  maxRenderCells,
  frameInterval: intervalMs,
  readbackStrategy,
  onUpdate: () => {
    gridUpdates += 1;
  },
});

const samples: WorkbenchThreePressureProbeSample[] = [];
let previousGrid: readonly (readonly string[] | undefined)[] = [];

try {
  for (let index = 1; index <= frames; index += 1) {
    await delay(intervalMs);
    scene.value = {
      mode,
      signal: {
        x: 0.35 + (index % 7) / 20,
        y: 0.5 + (index % 5) / 18,
        depth: 0.48 + (index % 3) / 14,
        twist: 0.25 + (index % 9) / 16,
        lift: 0.35 + (index % 6) / 15,
        pulse: 0.65 + (index % 4) / 12,
        active: true,
        pressed: index % 8 === 0,
      },
    };
    samples.push(drawSample(index));
  }
} finally {
  panel.dispose();
  rectangle.dispose();
  scene.dispose();
  ascii.dispose();
  maxRenderCells.dispose();
}

console.log(
  formatWorkbenchThreePressureProbeLines({
    mode,
    glyphs,
    readback: readbackStrategy,
    frameWidth,
    frameHeight,
    panelWidth,
    panelHeight,
    maxCells,
    intervalMs,
    totalBytes: bytesWritten,
  }, samples).join("\n"),
);

function drawSample(index: number): WorkbenchThreePressureProbeSample {
  const prepared = prepareWorkbenchFrame(frame, frameHeight);
  writeFrame(
    prepared,
    frameWidth,
    0,
    0,
    `\x1b[38;2;242;236;255;48;2;32;17;47mTHREE WORKBENCH PRESSURE ${index.toString().padStart(2, "0")}\x1b[0m`,
  );
  const grid = panel.grid.peek();
  writeWorkbenchThreeGrid(
    prepared,
    { column: 4, row: 3, width: panelWidth, height: panelHeight },
    grid,
    "\x1b[48;2;9;4;15m \x1b[0m",
    {
      scale: "down",
      rowBuffer,
      sourceColumns: grid[0]?.length ?? 0,
      sourceRowIndexes,
      sourceColumnIndexes,
    },
  );
  const stats = painter.flush(prepared, frameWidth, frameHeight, renderFrameRow, renderFrameSlice);
  const performance = panel.inspectPerformance();
  const sourceChangedRows = countWorkbenchThreeProbeChangedGridRows(previousGrid, grid);
  previousGrid = snapshotWorkbenchThreeProbeGridRows(grid);
  return {
    index,
    rendererMs: performance?.totalMs ?? 0,
    sceneMs: performance?.sceneMs ?? 0,
    readbackMs: performance?.readbackMs ?? 0,
    assemblyMs: performance?.assemblyMs ?? 0,
    flushMs: stats.durationMs,
    bytes: stats.bytes,
    changedRows: stats.changed,
    sourceChangedRows,
    gridUpdates,
    columns: performance?.columns ?? grid[0]?.length ?? 0,
    rows: performance?.rows ?? grid.length,
    cells: performance?.cells ?? (grid[0]?.length ?? 0) * grid.length,
  };
}
