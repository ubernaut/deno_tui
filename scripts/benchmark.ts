import {
  type BenchmarkResult,
  BenchmarkRunner,
  type BenchmarkSummary,
  createBenchmarkCatalogReport,
  formatBenchmarkCatalogMarkdown,
  formatBenchmarkSummary,
  summarizeBenchmarkResults,
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
  let bestSummary: BenchmarkSummary | undefined;
  for (let index = 0; index < repeat; index += 1) {
    const runner = new BenchmarkRunner(selectedCases);
    const summary = await runner.summarize();
    bestSummary = bestSummary ? bestOfBenchmarkSummaries(bestSummary, summary) : summary;
  }
  return bestSummary ?? summarizeBenchmarkResults([]);
}

function bestOfBenchmarkSummaries(left: BenchmarkSummary, right: BenchmarkSummary): BenchmarkSummary {
  const results = new Array<BenchmarkResult>(left.results.length);
  for (let index = 0; index < left.results.length; index += 1) {
    const leftResult = left.results[index]!;
    const rightResult = right.results.find((result) => result.name === leftResult.name);
    results[index] = rightResult && isBetterBenchmarkResult(rightResult, leftResult) ? rightResult : leftResult;
  }
  return summarizeBenchmarkResults(results);
}

function isBetterBenchmarkResult(candidate: BenchmarkResult, current: BenchmarkResult): boolean {
  return candidate.averageMs < current.averageMs ||
    (candidate.averageMs === current.averageMs && candidate.totalMs < current.totalMs);
}
