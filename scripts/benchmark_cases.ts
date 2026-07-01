import {
  AsyncScheduler,
  BenchmarkCase,
  BoxObject,
  buildThreeAsciiAnsiGrid,
  Canvas,
  createMouseInteractionRouter,
  createRenderLoop,
  createStandardComponentThemeDefinitions,
  createThemeProvider,
  createThemeProviderReport,
  cropToWidth,
  DirtyRegion,
  emptyStyle,
  flexRects,
  MemoryCanvasSink,
  renderSparkline,
  runTaskBatch,
  standardThemeComponentNames,
  TableController,
  TextObject,
  textWidth,
  ThreeAsciiAnsiGridAssembler,
  tileRects,
  visibleListRows,
} from "../mod.ts";
import { createHtmlCssLayoutDemo } from "../app/html_css_layout_demo.ts";
import { LayoutMeasurementCache, simpleLayoutSolver } from "../src/layout/mod.ts";
import {
  type SystemMetricsCommandOutput,
  type SystemMetricsDirEntry,
  type SystemMetricsNetworkInterface,
  type SystemMetricsProvider,
  SystemMonitor,
} from "../app/system_metrics.ts";

const sparklineValues = Array.from({ length: 200 }, (_, index) => Math.sin(index / 8));
const threeAsciiColumns = 96;
const threeAsciiRows = 40;
const threeAsciiCellCount = threeAsciiColumns * threeAsciiRows;
const threeAsciiFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiColors = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiSolidFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiSolidEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiSolidColors = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiPatternFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiPatternEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiPatternColors = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiSparseFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiSparseEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiSparseColors = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiReadbackFillSource = new Float32Array(threeAsciiCellCount);
const threeAsciiReadbackEdgeSource = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiReadbackColorSource = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiReadbackFillCpu = new Float32Array(threeAsciiCellCount);
const threeAsciiReadbackEdgeCpu = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiReadbackColorCpu = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiGridAssembler = new ThreeAsciiAnsiGridAssembler({ reuseGrid: true });
let threeAsciiReadbackCursor = 0;
let threeAsciiReadbackChecksum = 0;
const ansiRichRows = Array.from({ length: 250 }, (_, index) => {
  const red = (index * 17) % 256;
  const green = (index * 29) % 256;
  const blue = (index * 47) % 256;
  const label = `process-${index.toString().padStart(4, "0")}`;
  return `\x1b[38;2;${red};${green};${blue}m${label}\x1b[0m ` +
    `\x1b[48;2;${blue};${red};${green}m ${"█".repeat((index % 18) + 1)} \x1b[0m ` +
    `cpu=${(index * 7) % 100}% mem=${(index * 13) % 100}%`;
});
const largeListItems = Array.from({ length: 50_000 }, (_, index) => `process-${index.toString().padStart(5, "0")}`);
const largeTable = new TableController({ rowCount: 100_000, viewportHeight: 44 });
const resizeBounds = Array.from({ length: 96 }, (_, index) => ({
  column: 0,
  row: 0,
  width: 72 + (index % 12) * 12,
  height: 24 + (index % 8) * 4,
}));
const mouseRouter = createMouseInteractionRouter();
const dirtyRegionRectangles = Array.from({ length: 400 }, (_, index) => ({
  column: (index * 7) % 180,
  row: (index * 5) % 70,
  width: 8 + (index % 17),
  height: 2 + (index % 9),
}));
const dirtyRegionProbeRectangles = Array.from({ length: 300 }, (_, index) => ({
  column: (index * 11) % 190,
  row: (index * 3) % 76,
  width: 4 + (index % 23),
  height: 1 + (index % 11),
}));
const threeAsciiPatternPalette = [
  [0.95, 0.12, 0.18],
  [0.12, 0.9, 0.35],
  [0.12, 0.42, 0.96],
  [0.95, 0.78, 0.18],
] as const;

for (let index = 0; index < threeAsciiCellCount; index += 1) {
  const x = index % threeAsciiColumns;
  const y = Math.floor(index / threeAsciiColumns);
  threeAsciiFillGlyphs[index] = 5 + ((x + y) % 10);
  const edgeOffset = index * 4;
  threeAsciiEdgeGlyphs[edgeOffset] = (x * 3 + y) % 5;
  threeAsciiEdgeGlyphs[edgeOffset + 1] = (x % 6) + 2;
  threeAsciiEdgeGlyphs[edgeOffset + 2] = 24;
  threeAsciiEdgeGlyphs[edgeOffset + 3] = y % 4;
  const colorOffset = index * 4;
  threeAsciiColors[colorOffset] = (x % 16) / 15;
  threeAsciiColors[colorOffset + 1] = (y % 12) / 11;
  threeAsciiColors[colorOffset + 2] = ((x + y) % 20) / 19;
  threeAsciiColors[colorOffset + 3] = 1;

  threeAsciiSolidFillGlyphs[index] = 14;
  threeAsciiSolidColors[colorOffset] = 0.18;
  threeAsciiSolidColors[colorOffset + 1] = 0.9;
  threeAsciiSolidColors[colorOffset + 2] = 0.72;
  threeAsciiSolidColors[colorOffset + 3] = 1;
  if (x === y || x === threeAsciiColumns - y - 1 || x % 24 === 0) {
    threeAsciiSolidEdgeGlyphs[edgeOffset] = 1 + (x % 4);
    threeAsciiSolidEdgeGlyphs[edgeOffset + 1] = 18;
    threeAsciiSolidEdgeGlyphs[edgeOffset + 2] = 24;
    threeAsciiSolidEdgeGlyphs[edgeOffset + 3] = 2;
  }

  threeAsciiPatternFillGlyphs[index] = 14;
  const patternColor = threeAsciiPatternPalette[(x * 3 + y * 5) % threeAsciiPatternPalette.length];
  threeAsciiPatternColors[colorOffset] = patternColor[0];
  threeAsciiPatternColors[colorOffset + 1] = patternColor[1];
  threeAsciiPatternColors[colorOffset + 2] = patternColor[2];
  threeAsciiPatternColors[colorOffset + 3] = 1;
  if ((x + y) % 19 === 0) {
    threeAsciiPatternEdgeGlyphs[edgeOffset] = 1 + (x % 4);
    threeAsciiPatternEdgeGlyphs[edgeOffset + 1] = 20;
    threeAsciiPatternEdgeGlyphs[edgeOffset + 2] = 24;
    threeAsciiPatternEdgeGlyphs[edgeOffset + 3] = 1;
  }

  const sparseColorOffset = index * 4;
  threeAsciiSparseColors[sparseColorOffset] = (x % 16) / 15;
  threeAsciiSparseColors[sparseColorOffset + 1] = (y % 12) / 11;
  threeAsciiSparseColors[sparseColorOffset + 2] = ((x + y) % 20) / 19;
  threeAsciiSparseColors[sparseColorOffset + 3] = 1;
  if ((x + y) % 7 === 0 || (x > 42 && x < 54 && y > 12 && y < 28)) {
    threeAsciiSparseFillGlyphs[index] = 5 + ((x + y) % 10);
  }
  if ((x * 5 + y * 3) % 23 === 0) {
    const sparseEdgeOffset = index * 4;
    threeAsciiSparseEdgeGlyphs[sparseEdgeOffset] = (x + y) % 5;
    threeAsciiSparseEdgeGlyphs[sparseEdgeOffset + 1] = (x % 6) + 3;
    threeAsciiSparseEdgeGlyphs[sparseEdgeOffset + 2] = 24;
    threeAsciiSparseEdgeGlyphs[sparseEdgeOffset + 3] = y % 4;
  }
}
threeAsciiReadbackFillSource.set(threeAsciiFillGlyphs);
threeAsciiReadbackEdgeSource.set(threeAsciiEdgeGlyphs);
threeAsciiReadbackColorSource.set(threeAsciiColors);

for (let index = 0; index < 500; index += 1) {
  mouseRouter.register({
    id: `target-${index}`,
    bounds: {
      column: (index % 25) * 6,
      row: Math.floor(index / 25) * 2,
      width: 5,
      height: 2,
    },
    zIndex: index % 7,
    onPress: () => true,
  });
}

function runCanvasOverlapWorkload(): void {
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({
    sink,
    size: { columns: 160, rows: 48 },
  });

  for (let index = 0; index < 72; index += 1) {
    const box = new BoxObject({
      canvas,
      style: emptyStyle,
      zIndex: index,
      rectangle: {
        column: (index * 9) % 132,
        row: (index * 5) % 36,
        width: 18 + (index % 7),
        height: 6 + (index % 5),
      },
      filler: String.fromCharCode(65 + (index % 26)),
    });
    box.draw();
  }

  canvas.render();
  sink.clear();

  const modal = new BoxObject({
    canvas,
    style: emptyStyle,
    zIndex: 500,
    rectangle: { column: 30, row: 8, width: 82, height: 24 },
    filler: "#",
  });
  modal.draw();
  canvas.render();

  for (let step = 0; step < 6; step += 1) {
    modal.rectangle.value = {
      column: 24 + step * 4,
      row: 6 + (step % 3),
      width: 82,
      height: 24,
    };
    canvas.render();
  }

  modal.erase();
  canvas.render();

  const finalStats = sink.lastStats;
  if ((finalStats?.flushedCells ?? 0) === 0) {
    throw new Error("canvas overlap workload did not flush any cells");
  }
  if ((finalStats?.fullRedraws ?? 0) > 0 || (finalStats?.flushedCells ?? Number.POSITIVE_INFINITY) >= 160 * 48) {
    throw new Error("canvas overlap workload regressed to full-screen redraw");
  }
}

function runDirtyRegionWorkload(): void {
  const region = DirtyRegion.fromRectangles(dirtyRegionRectangles);
  let intersections = 0;
  for (const rectangle of dirtyRegionProbeRectangles) {
    intersections += region.intersections(rectangle).length;
  }
  if (region.isEmpty() || intersections <= 0) {
    throw new Error("dirty region workload did not produce intersections");
  }
}

function runApiWorkbenchFrameWorkload(): void {
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({
    sink,
    size: { columns: 168, rows: 52 },
  });

  drawWorkbenchText(canvas, "API WORKBENCH  [File] View Layout Theme Help", 0, 0, 168);
  drawWorkbenchText(canvas, "F10 menu  N new  Shift+T themes  G config  Q quit", 0, 50, 168);

  const panes = [
    { title: "INSPECTOR", column: 1, row: 2, width: 70, height: 21 },
    { title: "DATA TABLE", column: 73, row: 2, width: 94, height: 21 },
    { title: "CONTROLS", column: 1, row: 24, width: 70, height: 22 },
    { title: "LOGS", column: 73, row: 24, width: 94, height: 22 },
  ];

  for (const [paneIndex, pane] of panes.entries()) {
    new BoxObject({
      canvas,
      style: emptyStyle,
      zIndex: paneIndex,
      rectangle: pane,
      filler: " ",
    }).draw();
    drawWorkbenchText(canvas, `[${pane.title}]`, pane.column + 2, pane.row, Math.min(18, pane.width - 4), 20);
    drawWorkbenchText(canvas, "[-] [□] [↻] [x]", pane.column + pane.width - 18, pane.row, 17, 20);
  }

  for (let row = 0; row < 15; row += 1) {
    drawWorkbenchText(
      canvas,
      `${row === 0 ? ">" : " "} Surface ${row.toString().padStart(2, "0")}  ${
        ["runtime", "layout", "data", "theme"][row % 4]
      }  ${["ready", "active", "queued", "tracked"][row % 4]}  ${row * 7}ms`,
      75,
      5 + row,
      88,
      30,
    );
  }

  const controlRows = [
    "[ Run Action ] presses=0",
    "Slider     ████████░░░░░░  6/10",
    "Checkbox   ✓ live   x compact",
    "Radio      > Fast",
    "Combo      Unit-01 Signal",
    "Dropdown   [ Diagnostics v]",
    "Input      deno task health",
    "Textbox    Editable notes / click controls or type here",
    "Progress   ███████░░░░ 42%",
  ];
  for (const [index, text] of controlRows.entries()) {
    drawWorkbenchText(canvas, text, 4, 27 + index, 64, 30);
  }

  for (let row = 0; row < 18; row += 1) {
    drawWorkbenchText(
      canvas,
      `log ${row.toString().padStart(2, "0")} workbench controller rendered synthetic row with wrapped diagnostics`,
      75,
      27 + row,
      88,
      30,
    );
  }

  canvas.render();
  sink.clear();

  drawWorkbenchText(canvas, "recent action: render tick updated table selection", 4, 18, 64, 40);
  drawWorkbenchText(canvas, "> Surface 07  data     selected  49ms", 75, 12, 88, 40);
  canvas.render();

  const modal = new BoxObject({
    canvas,
    style: emptyStyle,
    zIndex: 1_000,
    rectangle: { column: 45, row: 14, width: 78, height: 16 },
    filler: " ",
  });
  modal.draw();
  drawWorkbenchText(canvas, "HELP", 48, 15, 12, 1_001);
  drawWorkbenchText(
    canvas,
    "Keyboard: arrows move focus, Tab cycles windows, Enter activates controls.",
    48,
    18,
    72,
    1_001,
  );
  drawWorkbenchText(canvas, "Mouse: click rows, drag sliders, wheel scrolls active windows.", 48, 20, 72, 1_001);
  drawWorkbenchText(canvas, "[ Cancel ]  [ Apply ]  [ OK ]", 68, 27, 34, 1_001);
  canvas.render();
  modal.erase();
  canvas.render();

  if ((sink.lastStats?.flushedCells ?? 0) === 0) {
    throw new Error("API Workbench frame workload did not flush any cells");
  }
}

function runThreeAsciiReadbackCopyWorkload(): void {
  threeAsciiReadbackFillCpu.set(threeAsciiReadbackFillSource);
  threeAsciiReadbackEdgeCpu.set(threeAsciiReadbackEdgeSource);
  threeAsciiReadbackColorCpu.set(threeAsciiReadbackColorSource);

  const fillIndex = threeAsciiReadbackCursor % threeAsciiReadbackFillCpu.length;
  const edgeIndex = (threeAsciiReadbackCursor * 3) % threeAsciiReadbackEdgeCpu.length;
  const colorIndex = (threeAsciiReadbackCursor * 5) % threeAsciiReadbackColorCpu.length;
  threeAsciiReadbackCursor = (threeAsciiReadbackCursor + 17) % threeAsciiReadbackColorCpu.length;
  threeAsciiReadbackChecksum = (
    threeAsciiReadbackChecksum +
    threeAsciiReadbackFillCpu[fillIndex] +
    threeAsciiReadbackEdgeCpu[edgeIndex] +
    threeAsciiReadbackColorCpu[colorIndex]
  ) % 1_000_000;

  if (!Number.isFinite(threeAsciiReadbackChecksum)) {
    throw new Error("three Ascii readback copy produced invalid data");
  }
}

function drawWorkbenchText(
  canvas: Canvas,
  value: string,
  column: number,
  row: number,
  width: number,
  zIndex = 10,
): void {
  new TextObject({
    canvas,
    style: emptyStyle,
    zIndex,
    value: cropToWidth(value.padEnd(width), width),
    overwriteRectangle: true,
    rectangle: { column, row, width },
  }).draw();
}

class BenchmarkMetricsProvider implements SystemMetricsProvider {
  step = 0;
  processStatReads = 0;
  readonly pids = Array.from({ length: 150 }, (_, index) => 1_000 + index);

  advance(): void {
    this.step += 1;
  }

  resetCounters(): void {
    this.processStatReads = 0;
  }

  now(): number {
    return 1_000 + this.step * 11_000;
  }

  hostname(): string {
    return "bench-host";
  }

  osRelease(): string {
    return "bench-os";
  }

  hardwareConcurrency(): number {
    return 16;
  }

  systemMemoryInfo(): Deno.SystemMemoryInfo {
    return {
      total: 64 * 1024 ** 3,
      free: 16 * 1024 ** 3,
      available: 24 * 1024 ** 3,
      buffers: 0,
      cached: 8 * 1024 ** 3,
      swapTotal: 8 * 1024 ** 3,
      swapFree: 6 * 1024 ** 3,
    };
  }

  loadavg(): [number, number, number] {
    return [2.5, 2.25, 2];
  }

  networkInterfaces(): SystemMetricsNetworkInterface[] {
    return [{ name: "eth0", address: "192.0.2.20" }];
  }

  async readTextFile(path: string): Promise<string> {
    if (path === "/proc/stat") return benchmarkProcStat(this.step);
    if (path === "/proc/uptime") return `${10_000 + this.step}.00 0.00\n`;
    if (path === "/proc/net/dev") return benchmarkProcNetDev(this.step);
    if (path.startsWith("/proc/") && path.endsWith("/stat")) {
      const pid = Number(path.split("/")[2] ?? 0);
      this.processStatReads += 1;
      return benchmarkProcessStat(pid, this.step);
    }
    if (path === "/sys/class/thermal/thermal_zone0/type") return "bench_pkg\n";
    if (path === "/sys/class/thermal/thermal_zone0/temp") return "61000\n";
    throw new Error(`missing benchmark fixture: ${path}`);
  }

  async *readDir(path: string): AsyncIterable<SystemMetricsDirEntry> {
    if (path === "/proc") {
      for (const pid of this.pids) {
        yield { name: String(pid), isDirectory: true };
      }
      return;
    }
    if (path === "/sys/class/thermal") {
      yield { name: "thermal_zone0", isDirectory: true };
    }
  }

  async command(command: string, _args: string[]): Promise<SystemMetricsCommandOutput> {
    if (command === "df") {
      return commandOutput([
        "Filesystem 1B-blocks Used Available Use% Mounted on",
        "/dev/nvme0n1p2 1000000000 610000000 390000000 61% /",
        "/dev/nvme1n1p1 2000000000 900000000 1100000000 45% /data",
      ].join("\n"));
    }
    if (command === "nvidia-smi") {
      return commandOutput("Bench GPU, 82, 8192, 24576, 71, 220, 2100, 10500\n");
    }
    return { success: false, stdout: new Uint8Array() };
  }
}

function commandOutput(output: string): SystemMetricsCommandOutput {
  return {
    success: true,
    stdout: new TextEncoder().encode(output),
  };
}

function benchmarkProcStat(step: number): string {
  const busy = 1_000 + step * 80;
  const idle = 8_000 + step * 120;
  const rows = [`cpu ${busy} 0 ${busy} ${idle} 0 0 0 0 0 0`];
  for (let core = 0; core < 16; core += 1) {
    rows.push(`cpu${core} ${busy + core * 7} 0 ${busy + core * 3} ${idle + core * 11} 0 0 0 0 0 0`);
  }
  return rows.join("\n");
}

function benchmarkProcNetDev(step: number): string {
  const rxBytes = 1_000_000 + step * 1_500_000;
  const txBytes = 2_000_000 + step * 900_000;
  return [
    "Inter-|   Receive                                                |  Transmit",
    " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
    `  eth0: ${rxBytes} 0 0 0 0 0 0 0 ${txBytes} 0 0 0 0 0 0 0`,
  ].join("\n");
}

function benchmarkProcessStat(pid: number, step: number): string {
  const tail = Array.from({ length: 37 }, () => "0");
  tail[0] = "R";
  tail[11] = String(pid * 10 + step * ((pid % 9) + 1));
  tail[12] = String(step * ((pid % 5) + 1));
  tail[21] = String(256 + (pid % 4096));
  tail[36] = String(pid % 16);
  return `${pid} (bench-${pid}) ${tail.join(" ")}`;
}

const metricsProvider = new BenchmarkMetricsProvider();
const metricsMonitor = new SystemMonitor({
  historyLength: 16,
  provider: metricsProvider,
  processLimit: 100,
  processScanLimit: 120,
});
const markupLayoutCache = new LayoutMeasurementCache();
const markupLayoutSolver = simpleLayoutSolver({ intrinsicMeasurementCache: markupLayoutCache });

/** High-volume UI, runtime, and rendering benchmark workloads used by the benchmark CLI. */
export const benchmarkCases: BenchmarkCase[] = [
  {
    name: "layout/flex-rects-3-pane",
    category: "layout",
    description: "Solve a three-pane row flex layout into terminal rectangles.",
    tags: ["layout", "rects", "resize"],
    iterations: 1_000,
    maxAverageMs: 2,
    run: () => {
      flexRects({ column: 0, row: 0, width: 120, height: 40 }, "row", [
        { id: "a", basis: 20, grow: 1 },
        { id: "b", basis: 40, grow: 2 },
        { id: "c", basis: 10, grow: 1 },
      ], 1);
    },
  },
  {
    name: "layout/tile-rects-resize-wall",
    category: "layout",
    description: "Re-score a responsive multi-window tile layout across frequent terminal resize bounds.",
    tags: ["layout", "resize", "windows"],
    iterations: 300,
    maxAverageMs: 6,
    run: () => {
      for (const bounds of resizeBounds) {
        tileRects(bounds, {
          itemCount: 24,
          minTileWidth: 24,
          minTileHeight: 8,
          maxColumns: 6,
          gap: 1,
          allowVerticalOverflow: true,
        });
      }
    },
  },
  {
    name: "layout/html-css-demo-solve",
    category: "layout",
    description: "Parse, cascade, and solve the HTML/CSS layout portfolio demo with cached intrinsic measurements.",
    tags: ["layout", "html", "css", "cache"],
    iterations: 300,
    maxAverageMs: 8,
    run: () => {
      const result = createHtmlCssLayoutDemo({ column: 0, row: 0, width: 96, height: 32 }, {
        solver: markupLayoutSolver,
      });
      if (!result.layout.byId.has("layout-stage")) {
        throw new Error("HTML/CSS layout demo did not produce expected boxes");
      }
    },
  },
  {
    name: "render/sparkline-80",
    category: "render",
    description: "Render a dense dashboard sparkline into an 80-cell text series.",
    tags: ["render", "dashboard"],
    iterations: 1_000,
    maxAverageMs: 2,
    run: () => {
      renderSparkline(sparklineValues, 80);
    },
  },
  {
    name: "render/canvas-overlap-modal-churn",
    category: "render",
    description: "Render many overlapping canvas boxes while a high-z modal moves and closes.",
    tags: ["render", "canvas", "dirty-region", "windows"],
    iterations: 30,
    maxAverageMs: 75,
    run: runCanvasOverlapWorkload,
  },
  {
    name: "render/canvas-dirty-region-400-rects",
    category: "render",
    description: "Merge 400 dirty rectangles into row segments and probe clipped intersections.",
    tags: ["render", "canvas", "dirty-region"],
    iterations: 250,
    maxAverageMs: 4,
    run: runDirtyRegionWorkload,
  },
  {
    name: "render/api-workbench-frame",
    category: "render",
    description:
      "Render a deterministic API Workbench-style frame with panes, tables, controls, logs, and modal churn.",
    tags: ["render", "canvas", "workbench", "windows"],
    iterations: 35,
    maxAverageMs: 35,
    run: runApiWorkbenchFrameWorkload,
  },
  {
    name: "render/ansi-text-measure-crop-250",
    category: "render",
    description: "Measure and crop ANSI truecolor rows with wide block glyphs.",
    tags: ["render", "ansi", "text", "table"],
    iterations: 300,
    maxAverageMs: 8,
    run: () => {
      let total = 0;
      for (const row of ansiRichRows) {
        total += textWidth(row);
        total += cropToWidth(row, 64).length;
      }
      if (total <= 0) {
        throw new Error("ANSI text measurement produced no output");
      }
    },
  },
  {
    name: "render/three-ascii-ansi-grid-96x40",
    category: "render",
    description: "CPU-assemble a 96x40 truecolor ANSI grid from Three ASCII readback buffers.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly"],
    iterations: 150,
    maxAverageMs: 12,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiFillGlyphs,
        edgeGlyphs: threeAsciiEdgeGlyphs,
        colors: threeAsciiColors,
        terminalGlyphStyle: "mixed",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      if (grid.length !== threeAsciiRows || grid[0]?.length !== threeAsciiColumns) {
        throw new Error("three Ascii grid dimensions changed");
      }
    },
  },
  {
    name: "render/three-ascii-ansi-grid-solid-96x40",
    category: "render",
    description: "CPU-assemble a repeated-color block-heavy Three ASCII grid with cached ANSI cell strings.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "cache"],
    iterations: 200,
    maxAverageMs: 6,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiSolidFillGlyphs,
        edgeGlyphs: threeAsciiSolidEdgeGlyphs,
        colors: threeAsciiSolidColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      if (grid.length !== threeAsciiRows || grid[0]?.length !== threeAsciiColumns) {
        throw new Error("solid three Ascii grid dimensions changed");
      }
    },
  },
  {
    name: "render/three-ascii-ansi-grid-pattern-96x40",
    category: "render",
    description: "CPU-assemble a patterned block-mode Three ASCII grid with recurring non-adjacent cell strings.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "cache"],
    iterations: 200,
    maxAverageMs: 6,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiPatternFillGlyphs,
        edgeGlyphs: threeAsciiPatternEdgeGlyphs,
        colors: threeAsciiPatternColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      if (grid.length !== threeAsciiRows || grid[0]?.length !== threeAsciiColumns) {
        throw new Error("pattern three Ascii grid dimensions changed");
      }
    },
  },
  {
    name: "render/three-ascii-ansi-grid-warm-cache-96x40",
    category: "render",
    description: "CPU-assemble recurring Three ASCII frames while reusing ANSI conversion, cell, and grid-row caches.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "cache"],
    iterations: 250,
    maxAverageMs: 5,
    run: () => {
      const grid = threeAsciiGridAssembler.build({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiPatternFillGlyphs,
        edgeGlyphs: threeAsciiPatternEdgeGlyphs,
        colors: threeAsciiPatternColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      if (grid.length !== threeAsciiRows || grid[0]?.length !== threeAsciiColumns) {
        throw new Error("warm-cache three Ascii grid dimensions changed");
      }
    },
  },
  {
    name: "render/three-ascii-ansi-grid-sparse-96x40",
    category: "render",
    description: "CPU-assemble a sparse 96x40 truecolor ANSI grid while skipping proven blank cells.",
    tags: ["render", "three", "ascii", "ansi", "cpu", "assembly", "sparse"],
    iterations: 200,
    maxAverageMs: 8,
    run: () => {
      const grid = buildThreeAsciiAnsiGrid({
        columns: threeAsciiColumns,
        rows: threeAsciiRows,
        fillGlyphs: threeAsciiSparseFillGlyphs,
        edgeGlyphs: threeAsciiSparseEdgeGlyphs,
        colors: threeAsciiSparseColors,
        terminalGlyphStyle: "blocks",
        terminalEdgeBias: 1.15,
        backgroundColor: 0x000000,
      });
      if (grid.length !== threeAsciiRows || grid[0]?.length !== threeAsciiColumns) {
        throw new Error("sparse three Ascii grid dimensions changed");
      }
    },
  },
  {
    name: "render/three-ascii-readback-copy-96x40",
    category: "render",
    description: "Copy a 96x40 Three Ascii fill, edge, and color readback payload into CPU-visible buffers.",
    tags: ["render", "three", "ascii", "readback", "copy"],
    iterations: 1_000,
    maxAverageMs: 2,
    run: runThreeAsciiReadbackCopyWorkload,
  },
  {
    name: "render/render-loop-300-steps",
    category: "render",
    description: "Step a render loop through a burst of frames and read frame pressure telemetry.",
    tags: ["render", "telemetry"],
    iterations: 200,
    maxAverageMs: 3,
    run: () => {
      let frames = 0;
      const loop = createRenderLoop({
        immediate: false,
        tick: () => {
          frames += 1;
        },
      });
      for (let index = 0; index < 300; index += 1) loop.step();
      if (frames !== 300) throw new Error("render loop dropped a manual step");
      loop.inspect();
    },
  },
  {
    name: "data/table-select-100k",
    category: "data",
    description: "Select, reveal, page, scroll, and inspect a 100k-row table controller.",
    tags: ["data", "table", "selection"],
    iterations: 200,
    maxAverageMs: 5,
    run: () => {
      for (let index = 0; index < 250; index += 1) {
        largeTable.select((index * 997) % 100_000);
        if (index % 8 === 0) largeTable.pageDown();
        if (index % 11 === 0) largeTable.scroll(3);
      }
      largeTable.inspect();
    },
  },
  {
    name: "data/list-visible-50k",
    category: "data",
    description: "Resolve visible rows for a 50k-item list while the selected row moves through the source.",
    tags: ["data", "list", "virtualized"],
    iterations: 500,
    maxAverageMs: 2,
    run: () => {
      for (let index = 0; index < 100; index += 1) {
        visibleListRows(largeListItems, (index * 499) % largeListItems.length, 36);
      }
    },
  },
  {
    name: "data/system-monitor-fixture-sample",
    category: "data",
    description: "Sample fixture-backed CPU, memory, network, disk, GPU, and capped process metrics from 150 PIDs.",
    tags: ["data", "monitor", "processes", "fixtures"],
    iterations: 80,
    maxAverageMs: 5,
    run: async () => {
      metricsProvider.advance();
      metricsProvider.resetCounters();
      await metricsMonitor.sample();
      const snapshot = metricsMonitor.snapshot.peek();
      if (snapshot.processes.length !== 100 || snapshot.cpuCores.length !== 16) {
        throw new Error("system monitor fixture sample did not produce expected rows");
      }
      if (metricsProvider.processStatReads !== 120) {
        throw new Error("system monitor fixture sample did not respect the process scan cap");
      }
    },
  },
  {
    name: "input/mouse-hit-test-500-targets",
    category: "input",
    description: "Route pointer movement across 500 z-ordered mouse regions.",
    tags: ["input", "mouse", "routing"],
    iterations: 120,
    maxAverageMs: 15,
    run: () => {
      for (let index = 0; index < 300; index += 1) {
        mouseRouter.hitTest((index * 7) % 150, (index * 5) % 40, "press");
      }
    },
  },
  {
    name: "widgets/theme-standard-39-components",
    category: "widgets",
    description: "Build standard semantic component theme definitions and audit provider coverage.",
    tags: ["widgets", "theme", "catalog"],
    iterations: 100,
    maxAverageMs: 20,
    run: () => {
      createStandardComponentThemeDefinitions();
      createThemeProviderReport(createThemeProvider(), {
        preview: false,
        coverage: { components: standardThemeComponentNames() },
      });
    },
  },
  {
    name: "runtime/scheduler-batch-100",
    category: "runtime",
    description: "Process 100 ordered tasks through the bounded async scheduler and inspect telemetry.",
    tags: ["runtime", "scheduler", "concurrency", "telemetry"],
    iterations: 25,
    maxAverageMs: 25,
    run: async () => {
      const scheduler = new AsyncScheduler({ concurrency: 8 });
      const results = await runTaskBatch(
        Array.from({ length: 100 }, (_, index) => index),
        {
          scheduler,
          task: (value) => value * 2,
        },
      );
      if (results.length !== 100 || scheduler.inspect().completed !== 100) {
        throw new Error("scheduler batch did not complete all tasks");
      }
    },
  },
];
