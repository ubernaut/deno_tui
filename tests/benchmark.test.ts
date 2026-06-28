import { assertEquals } from "./deps.ts";
import {
  BenchmarkRunner,
  formatBenchmarkResults,
  formatBenchmarkSummary,
  summarizeBenchmarkResults,
} from "../src/perf/mod.ts";

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
