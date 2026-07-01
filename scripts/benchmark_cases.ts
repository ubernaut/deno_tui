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
  emptyStyle,
  flexRects,
  MemoryCanvasSink,
  renderSparkline,
  runTaskBatch,
  standardThemeComponentNames,
  TableController,
  textWidth,
  tileRects,
  visibleListRows,
} from "../mod.ts";

const sparklineValues = Array.from({ length: 200 }, (_, index) => Math.sin(index / 8));
const threeAsciiColumns = 96;
const threeAsciiRows = 40;
const threeAsciiCellCount = threeAsciiColumns * threeAsciiRows;
const threeAsciiFillGlyphs = new Float32Array(threeAsciiCellCount);
const threeAsciiEdgeGlyphs = new Float32Array(threeAsciiCellCount * 4);
const threeAsciiColors = new Float32Array(threeAsciiCellCount * 4);
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
}

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

  if ((sink.lastStats?.flushedCells ?? 0) === 0) {
    throw new Error("canvas overlap workload did not flush any cells");
  }
}

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
    maxAverageMs: 85,
    run: runCanvasOverlapWorkload,
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
    description: "Assemble a 96x40 truecolor ANSI grid from three Ascii readback buffers.",
    tags: ["render", "three", "ascii", "ansi"],
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
