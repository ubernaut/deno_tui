import {
  BenchmarkRunner,
  type BenchmarkSummary,
  createBenchmarkCatalogReport,
  formatBenchmarkCatalogMarkdown,
  formatBenchmarkSummary,
  summarizeBenchmarkResults,
  summarizeBestBenchmarkSummaries,
} from "../mod.ts";
import { parseBenchmarkCliOptions, selectBenchmarkCases } from "./benchmark_cli.ts";
import { formatEmptyBenchmarkSelectionError } from "./benchmark_cli.ts";
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

if (selectedCases.length === 0) {
  console.error(formatEmptyBenchmarkSelectionError(options.query));
  Deno.exit(1);
}

const summary = await summarizeSelectedBenchmarks(options.repeat);

if (options.json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(formatBenchmarkSummary(summary));
}

if (!summary.passed) {
  Deno.exit(1);
}

async function summarizeSelectedBenchmarks(repeat: number): Promise<BenchmarkSummary> {
  const summaries: BenchmarkSummary[] = [];
  for (let index = 0; index < repeat; index += 1) {
    const runner = new BenchmarkRunner(selectedCases);
    summaries.push(await runner.summarize());
  }
  return summaries.length === 0 ? summarizeBenchmarkResults([]) : summarizeBestBenchmarkSummaries(summaries);
}
