import {
  BenchmarkRunner,
  createBenchmarkCatalogReport,
  formatBenchmarkCatalogMarkdown,
  formatBenchmarkSummary,
} from "../mod.ts";
import { parseBenchmarkCliOptions, selectBenchmarkCases } from "./benchmark_cli.ts";
import { benchmarkCases } from "./benchmark_cases.ts";

const options = parseBenchmarkCliOptions(Deno.args);
const selectedCases = selectBenchmarkCases(benchmarkCases, options.query);

if (options.list) {
  if (options.json) {
    console.log(JSON.stringify(createBenchmarkCatalogReport({ cases: benchmarkCases, query: options.query }), null, 2));
  } else {
    console.log(formatBenchmarkCatalogMarkdown({ cases: benchmarkCases, query: options.query }));
  }
  Deno.exit(0);
}

const runner = new BenchmarkRunner(selectedCases);

const summary = await runner.summarize();

if (options.json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(formatBenchmarkSummary(summary));
}

if (!summary.passed) {
  Deno.exit(1);
}
