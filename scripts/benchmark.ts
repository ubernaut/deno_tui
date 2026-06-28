import {
  BenchmarkCase,
  BenchmarkRunner,
  createBenchmarkCatalogReport,
  flexRects,
  formatBenchmarkCatalogMarkdown,
  formatBenchmarkSummary,
  renderSparkline,
} from "../mod.ts";

const benchmarkCases: BenchmarkCase[] = [
  {
    name: "flexRects/100",
    category: "layout",
    description: "Solve a three-pane row flex layout into terminal rectangles.",
    tags: ["layout", "rects"],
    iterations: 1_000,
    run: () => {
      flexRects({ column: 0, row: 0, width: 120, height: 40 }, "row", [
        { id: "a", basis: 20, grow: 1 },
        { id: "b", basis: 40, grow: 2 },
        { id: "c", basis: 10, grow: 1 },
      ], 1);
    },
  },
  {
    name: "sparkline/80",
    category: "render",
    description: "Render a dense dashboard sparkline into an 80-cell text series.",
    tags: ["render", "dashboard"],
    iterations: 1_000,
    run: () => {
      renderSparkline(Array.from({ length: 200 }, (_, index) => Math.sin(index / 8)), 80);
    },
  },
];

if (Deno.args.includes("--list") || Deno.args.includes("--catalog")) {
  if (Deno.args.includes("--json")) {
    console.log(JSON.stringify(createBenchmarkCatalogReport({ cases: benchmarkCases }), null, 2));
  } else {
    console.log(formatBenchmarkCatalogMarkdown({ cases: benchmarkCases }));
  }
  Deno.exit(0);
}

const runner = new BenchmarkRunner(benchmarkCases);

const summary = await runner.summarize();

if (Deno.args.includes("--json")) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(formatBenchmarkSummary(summary));
}

if (!summary.passed) {
  Deno.exit(1);
}
