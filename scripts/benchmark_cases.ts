import {
  AsyncScheduler,
  BenchmarkCase,
  createMouseInteractionRouter,
  createRenderLoop,
  createStandardComponentThemeDefinitions,
  createThemeProvider,
  createThemeProviderReport,
  flexRects,
  renderSparkline,
  runTaskBatch,
  standardThemeComponentNames,
  TableController,
  tileRects,
  visibleListRows,
} from "../mod.ts";

const sparklineValues = Array.from({ length: 200 }, (_, index) => Math.sin(index / 8));
const largeListItems = Array.from({ length: 50_000 }, (_, index) => `process-${index.toString().padStart(5, "0")}`);
const largeTable = new TableController({ rowCount: 100_000, viewportHeight: 44 });
const resizeBounds = Array.from({ length: 96 }, (_, index) => ({
  column: 0,
  row: 0,
  width: 72 + (index % 12) * 12,
  height: 24 + (index % 8) * 4,
}));
const mouseRouter = createMouseInteractionRouter();

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
