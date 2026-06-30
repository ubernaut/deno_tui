import {
  BenchmarkRunner,
  createBenchmarkCatalogReport,
  formatBenchmarkCatalogMarkdown,
  formatBenchmarkSummary,
} from "../mod.ts";
import { benchmarkCases } from "./benchmark_cases.ts";

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
