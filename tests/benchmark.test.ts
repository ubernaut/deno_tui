import { assertEquals } from "./deps.ts";
import {
  BenchmarkRunner,
  createBenchmarkCatalogReport,
  formatBenchmarkCatalogMarkdown,
  formatBenchmarkResults,
  formatBenchmarkSummary,
  inspectBenchmarkCatalog,
  queryBenchmarkCases,
  summarizeBenchmarkResults,
  summarizeBestBenchmarkSummaries,
} from "../src/perf/mod.ts";
import {
  formatEmptyBenchmarkSelectionError,
  parseBenchmarkCliOptions,
  selectBenchmarkCases,
} from "../scripts/benchmark_cli.ts";
import { benchmarkCases } from "../scripts/benchmark_cases.ts";

Deno.test("BenchmarkRunner reports average timings with warmup", async () => {
  let count = 0;
  let now = 0;
  const runner = new BenchmarkRunner([
    {
      name: "counter",
      iterations: 3,
      warmupIterations: 2,
      maxAverageMs: 2,
      run: () => {
        count += 1;
        now += 2;
      },
    },
  ], { now: () => now });

  const [result] = await runner.run();
  assertEquals(count, 5);
  assertEquals(result.name, "counter");
  assertEquals(result.iterations, 3);
  assertEquals(result.warmupIterations, 2);
  assertEquals(result.totalMs, 6);
  assertEquals(result.averageMs, 2);
  assertEquals(result.passed, true);
  assertEquals(
    formatBenchmarkResults([result]),
    "ok counter: 2.000ms avg (3 iterations, 6.000ms total, max avg 2.000ms)",
  );
});

Deno.test("BenchmarkRunner summarizes threshold failures", async () => {
  let now = 0;
  const runner = new BenchmarkRunner([
    {
      name: "slow",
      iterations: 2,
      maxTotalMs: 3,
      run: () => {
        now += 2;
      },
    },
  ], { now: () => now });

  const summary = await runner.summarize();

  assertEquals(summary.passed, false);
  assertEquals(summary.failed.map((result) => result.name), ["slow"]);
  assertEquals(summary.totalMs, 4);
  assertEquals(summary.averageMs, 4);
  assertEquals(summarizeBenchmarkResults(summary.results).passed, false);
  assertEquals(formatBenchmarkResults(summary.results).startsWith("fail slow:"), true);
  assertEquals(
    formatBenchmarkSummary(summary),
    [
      "fail slow: 2.000ms avg (2 iterations, 4.000ms total, max total 3.000ms)",
      "fail benchmark summary: 1 cases, 1 failed, 4.000ms total, 4.000ms avg/case",
    ].join("\n"),
  );
});

Deno.test("summarizeBestBenchmarkSummaries keeps best averages across noisy repeats", () => {
  const slow = summarizeBenchmarkResults([
    {
      name: "render/a",
      iterations: 10,
      warmupIterations: 0,
      totalMs: 40,
      averageMs: 4,
      maxAverageMs: 3,
      passed: false,
    },
    {
      name: "render/b",
      iterations: 10,
      warmupIterations: 0,
      totalMs: 20,
      averageMs: 2,
      maxAverageMs: 3,
      passed: true,
    },
  ]);
  const fast = summarizeBenchmarkResults([
    {
      name: "render/a",
      iterations: 10,
      warmupIterations: 0,
      totalMs: 25,
      averageMs: 2.5,
      maxAverageMs: 3,
      passed: true,
    },
    {
      name: "render/b",
      iterations: 10,
      warmupIterations: 0,
      totalMs: 30,
      averageMs: 3,
      maxAverageMs: 3,
      passed: true,
    },
  ]);

  const best = summarizeBestBenchmarkSummaries([slow, fast]);

  assertEquals(best.passed, true);
  assertEquals(best.results.map((result) => [result.name, result.averageMs]), [
    ["render/a", 2.5],
    ["render/b", 2],
  ]);
  assertEquals(summarizeBestBenchmarkSummaries([]).results, []);
});

Deno.test("benchmark catalogs filter inspect and format case metadata", () => {
  const cases = [
    {
      name: "layout/flex",
      category: "layout",
      description: "Solve flexible pane rectangles.",
      tags: ["layout", "rects"],
      iterations: 100,
      maxAverageMs: 1,
      run() {},
    },
    {
      name: "render/sparkline",
      category: "render",
      tags: ["dashboard", "text"],
      iterations: 50,
      run() {},
    },
  ];
  const runner = new BenchmarkRunner(cases);
  const report = createBenchmarkCatalogReport({ cases, query: { tag: "layout" } });
  const markdown = formatBenchmarkCatalogMarkdown({
    cases,
    query: { category: "layout" },
    title: "Layout Benchmarks",
  });

  assertEquals(queryBenchmarkCases(cases, { search: "flex rects" }).map((entry) => entry.name), ["layout/flex"]);
  assertEquals(report.inspection, {
    count: 1,
    thresholded: 1,
    categories: ["layout"],
    tags: ["layout", "rects"],
  });
  assertEquals(inspectBenchmarkCatalog(runner.inspect().cases).count, 2);
  assertEquals(
    markdown,
    [
      "# Layout Benchmarks",
      "",
      "1 cases, 1 with thresholds.",
      "",
      "| Case | Category | Iterations | Thresholds | Tags | Description |",
      "| --- | --- | ---: | --- | --- | --- |",
      "| layout/flex | layout | 100 | avg <= 1 | layout, rects | Solve flexible pane rectangles. |",
    ].join("\n"),
  );
});

Deno.test("benchmark CLI catalog covers high-volume TUI workloads", () => {
  const report = createBenchmarkCatalogReport({ cases: benchmarkCases });
  const names = report.cases.map((entry) => entry.name);

  assertEquals(report.inspection.count, 79);
  assertEquals(report.inspection.thresholded, 79);
  assertEquals(report.inspection.categories, ["data", "input", "layout", "render", "runtime", "widgets"]);
  assertEquals(names.includes("data/table-select-100k"), true);
  assertEquals(names.includes("data/table-filter-25k"), true);
  assertEquals(names.includes("data/local-query-page-25k"), true);
  assertEquals(names.includes("data/command-search-1k"), true);
  assertEquals(names.includes("data/command-search-index-1k"), true);
  assertEquals(names.includes("data/list-visible-50k"), true);
  assertEquals(names.includes("data/system-monitor-fixture-sample"), true);
  assertEquals(names.includes("data/system-monitor-large-process-sample"), true);
  assertEquals(names.includes("data/source-frame-resolution"), true);
  assertEquals(names.includes("input/mouse-hit-test-500-targets"), true);
  assertEquals(names.includes("input/terminal-decode-batched"), true);
  assertEquals(names.includes("layout/html-css-demo-solve"), true);
  assertEquals(names.includes("layout/cpu-hex-tile-layout-88"), true);
  assertEquals(names.includes("layout/tile-rects-resize-wall"), true);
  assertEquals(names.includes("layout/window-manager-churn"), true);
  assertEquals(names.includes("render/ansi-text-measure-crop-250"), true);
  assertEquals(names.includes("render/textbox-wrap-250"), true);
  assertEquals(names.includes("render/api-workbench-frame"), true);
  assertEquals(names.includes("render/workbench-sparse-frame"), true);
  assertEquals(names.includes("render/workbench-plain-frame-row-168"), true);
  assertEquals(names.includes("render/workbench-blank-frame-row-168"), true);
  assertEquals(names.includes("render/workbench-string-frame-full-row"), true);
  assertEquals(names.includes("render/workbench-frame-render-commands-96"), true);
  assertEquals(names.includes("render/workbench-line-signal-diff-168x54"), true);
  assertEquals(names.includes("render/workbench-changed-span-detection-168"), true);
  assertEquals(names.includes("render/workbench-visible-window-rects-60"), true);
  assertEquals(names.includes("runtime/workbench-workspace-snapshot-projection"), true);
  assertEquals(names.includes("render/workbench-three-header-telemetry"), true);
  assertEquals(names.includes("render/workbench-three-pressure-policy"), true);
  assertEquals(names.includes("render/textobject-full-row-canvas-220x70"), true);
  assertEquals(names.includes("render/workbench-scaled-three-grid-220x70"), true);
  assertEquals(names.includes("render/workbench-capped-three-grid-220x70"), true);
  assertEquals(names.includes("render/workbench-vertical-three-grid-109x70"), true);
  assertEquals(names.includes("render/workbench-sparse-three-grid-220x70"), true);
  assertEquals(names.includes("render/ansi-styled-character-split-160"), true);
  assertEquals(names.includes("render/plain-ascii-character-split-160"), true);
  assertEquals(names.includes("render/ansi-canvas-sink-styled-range-160"), true);
  assertEquals(names.includes("render/ansi-canvas-sink-truecolor-background-range-160"), true);
  assertEquals(names.includes("render/canvas-overlap-modal-churn"), true);
  assertEquals(names.includes("render/canvas-dirty-region-400-rects"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-96x40"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-fill-only-96x40"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-compact-block-96x40"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-solid-96x40"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-block-runs-96x40"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-partial-block-96x40"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-pattern-96x40"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-glyph-cache-96x40"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-sparse-96x40"), true);
  assertEquals(names.includes("render/three-ascii-ansi-grid-warm-cache-96x40"), true);
  assertEquals(names.includes("render/three-ascii-terminal-row-sparse-96x40"), true);
  assertEquals(names.includes("render/three-ascii-direct-frame-diff-96x40"), true);
  assertEquals(names.includes("render/three-ascii-frame-diff-96x40"), true);
  assertEquals(names.includes("render/rerender-range-dense-160x50"), true);
  assertEquals(names.includes("render/rerender-cell-sparse-1k"), true);
  assertEquals(names.includes("render/rerender-range-clipped-120"), true);
  assertEquals(names.includes("render/three-ascii-range-apply-160"), true);
  assertEquals(names.includes("render/rerender-cell-fractional-1k"), true);
  assertEquals(names.includes("render/three-ascii-readback-copy-96x40"), true);
  assertEquals(names.includes("render/three-ascii-compact-block-readback-copy-96x40"), true);
  assertEquals(names.includes("render/three-ascii-image-compact-768x320"), true);
  assertEquals(names.includes("render/three-ascii-uniform-clean-1k"), true);
  assertEquals(names.includes("render/three-ascii-probe-report-180"), true);
  assertEquals(names.includes("render/workbench-three-pressure-probe-summary-180"), true);
  assertEquals(
    queryBenchmarkCases(benchmarkCases, { tag: "assembly" }).map((entry) => entry.name),
    [
      "render/three-ascii-ansi-grid-96x40",
      "render/three-ascii-ansi-grid-block-runs-96x40",
      "render/three-ascii-ansi-grid-compact-block-96x40",
      "render/three-ascii-ansi-grid-fill-only-96x40",
      "render/three-ascii-ansi-grid-glyph-cache-96x40",
      "render/three-ascii-ansi-grid-partial-block-96x40",
      "render/three-ascii-ansi-grid-pattern-96x40",
      "render/three-ascii-ansi-grid-solid-96x40",
      "render/three-ascii-ansi-grid-sparse-96x40",
      "render/three-ascii-ansi-grid-warm-cache-96x40",
    ],
  );
  assertEquals(
    queryBenchmarkCases(benchmarkCases, { tag: "readback" }).map((entry) => entry.name),
    [
      "render/three-ascii-compact-block-readback-copy-96x40",
      "render/three-ascii-image-compact-768x320",
      "render/three-ascii-readback-copy-96x40",
    ],
  );
  assertEquals(names.includes("runtime/terminal-screen-replay"), true);
  assertEquals(names.includes("runtime/terminal-screen-edit-churn"), true);
  assertEquals(names.includes("runtime/terminal-copy-row-projection"), true);
  assertEquals(names.includes("runtime/terminal-pane-title-render-commands"), true);
  assertEquals(names.includes("runtime/terminal-workspace-layout-churn"), true);
  assertEquals(names.includes("runtime/scheduler-batch-100"), true);
  assertEquals(names.includes("widgets/theme-standard-39-components"), true);
});

Deno.test("benchmark CLI selectors filter executable cases", () => {
  const options = parseBenchmarkCliOptions(["--filter", "terminal replay", "--tag=terminal", "--json"]);
  const selected = selectBenchmarkCases(benchmarkCases, options.query);

  assertEquals(options.json, true);
  assertEquals(options.list, false);
  assertEquals(options.repeat, 1);
  assertEquals(options.query, { search: "terminal replay", tag: "terminal" });
  assertEquals(selected.map((entry) => entry.name), ["runtime/terminal-screen-replay"]);
});

Deno.test("benchmark CLI accepts query as a search alias", () => {
  const separated = parseBenchmarkCliOptions(["--query", "three-ascii-ansi-grid", "--category", "render"]);
  const assigned = parseBenchmarkCliOptions(["--query=workbench frame"]);

  assertEquals(separated.query, { search: "three-ascii-ansi-grid", category: "render" });
  assertEquals(
    selectBenchmarkCases(benchmarkCases, separated.query).map((entry) => entry.name),
    [
      "render/three-ascii-ansi-grid-96x40",
      "render/three-ascii-ansi-grid-solid-96x40",
      "render/three-ascii-ansi-grid-block-runs-96x40",
      "render/three-ascii-ansi-grid-partial-block-96x40",
      "render/three-ascii-ansi-grid-pattern-96x40",
      "render/three-ascii-ansi-grid-fill-only-96x40",
      "render/three-ascii-ansi-grid-compact-block-96x40",
      "render/three-ascii-ansi-grid-glyph-cache-96x40",
      "render/three-ascii-ansi-grid-warm-cache-96x40",
      "render/three-ascii-ansi-grid-sparse-96x40",
    ],
  );
  assertEquals(assigned.query, { search: "workbench frame" });
});

Deno.test("benchmark CLI repeat count is opt-in and bounded", () => {
  assertEquals(parseBenchmarkCliOptions(["--repeat", "3"]).repeat, 3);
  assertEquals(parseBenchmarkCliOptions(["--repeat=4"]).repeat, 4);
  assertEquals(parseBenchmarkCliOptions(["--repeat=0"]).repeat, 1);
  assertEquals(parseBenchmarkCliOptions(["--repeat=100"]).repeat, 25);
  assertEquals(parseBenchmarkCliOptions(["--repeat=nope"]).repeat, 1);
});

Deno.test("benchmark CLI formats empty selector errors", () => {
  assertEquals(
    formatEmptyBenchmarkSelectionError({ search: "three-ascii-deferred", category: "render" }),
    'No benchmark cases matched query="three-ascii-deferred", category="render". Use --list with the same selector to inspect the catalog.',
  );
  assertEquals(formatEmptyBenchmarkSelectionError(), "No benchmark cases are available.");
});
