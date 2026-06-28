import { BenchmarkRunner, flexRects, formatBenchmarkSummary, renderSparkline } from "../mod.ts";

const runner = new BenchmarkRunner([
  {
    name: "flexRects/100",
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
    iterations: 1_000,
    run: () => {
      renderSparkline(Array.from({ length: 200 }, (_, index) => Math.sin(index / 8)), 80);
    },
  },
]);

const summary = await runner.summarize();

if (Deno.args.includes("--json")) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(formatBenchmarkSummary(summary));
}

if (!summary.passed) {
  Deno.exit(1);
}
