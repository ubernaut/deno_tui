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
} from "../src/perf/mod.ts";
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

  assertEquals(report.inspection.count, 9);
  assertEquals(report.inspection.thresholded, 9);
  assertEquals(report.inspection.categories, ["data", "input", "layout", "render", "runtime", "widgets"]);
  assertEquals(names.includes("data/table-select-100k"), true);
  assertEquals(names.includes("data/list-visible-50k"), true);
  assertEquals(names.includes("input/mouse-hit-test-500-targets"), true);
  assertEquals(names.includes("layout/tile-rects-resize-wall"), true);
  assertEquals(names.includes("runtime/scheduler-batch-100"), true);
  assertEquals(names.includes("widgets/theme-standard-39-components"), true);
});
