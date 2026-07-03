// Copyright 2023 Im-Beast. MIT license.
/** A named benchmark workload with optional warmup and pass/fail thresholds. */
export interface BenchmarkCase {
  name: string;
  category?: string;
  description?: string;
  tags?: readonly string[];
  iterations?: number;
  warmupIterations?: number;
  maxAverageMs?: number;
  maxTotalMs?: number;
  run: () => void | Promise<void>;
}

/** Serializable benchmark case metadata for docs, CI reports, and selectors. */
export interface BenchmarkCaseInspection {
  name: string;
  category?: string;
  description?: string;
  tags: string[];
  iterations?: number;
  warmupIterations?: number;
  maxAverageMs?: number;
  maxTotalMs?: number;
  thresholded: boolean;
}

/** Query fields for selecting benchmark cases by name, metadata, or threshold status. */
export interface BenchmarkCatalogQuery {
  search?: string;
  category?: string;
  tag?: string;
  thresholded?: boolean;
}

/** Aggregate metadata for a benchmark case catalog. */
export interface BenchmarkCatalogInspection {
  count: number;
  thresholded: number;
  categories: string[];
  tags: string[];
}

/** Filtered benchmark catalog with aggregate inspection metadata. */
export interface BenchmarkCatalogReport {
  cases: BenchmarkCaseInspection[];
  inspection: BenchmarkCatalogInspection;
}

/** Inputs for creating a benchmark catalog report. */
export interface BenchmarkCatalogReportOptions {
  cases: readonly BenchmarkCase[];
  query?: BenchmarkCatalogQuery;
}

/** Options for rendering benchmark case metadata as Markdown. */
export interface BenchmarkCatalogMarkdownOptions extends BenchmarkCatalogReportOptions {
  title?: string;
  includeSummary?: boolean;
}

/** Timing result for one benchmark case after warmup and measured iterations. */
export interface BenchmarkResult {
  name: string;
  iterations: number;
  warmupIterations: number;
  totalMs: number;
  averageMs: number;
  maxAverageMs?: number;
  maxTotalMs?: number;
  passed: boolean;
}

/** Shared runner options for deterministic tests and suite-level iteration defaults. */
export interface BenchmarkRunnerOptions {
  now?: () => number;
  defaultIterations?: number;
  defaultWarmupIterations?: number;
}

/** Aggregate benchmark status with failed cases split out for CI gates. */
export interface BenchmarkSummary {
  results: BenchmarkResult[];
  passed: boolean;
  failed: BenchmarkResult[];
  totalMs: number;
  averageMs: number;
}

/** Runs benchmark cases sequentially and reports threshold-aware timing results. */
export class BenchmarkRunner {
  readonly #now: () => number;
  readonly #defaultIterations: number;
  readonly #defaultWarmupIterations: number;

  /** Creates a benchmark runner for a fixed case list. */
  constructor(
    private readonly cases: readonly BenchmarkCase[],
    options: BenchmarkRunnerOptions = {},
  ) {
    this.#now = options.now ?? (() => performance.now());
    this.#defaultIterations = Math.max(1, Math.floor(options.defaultIterations ?? 1));
    this.#defaultWarmupIterations = Math.max(0, Math.floor(options.defaultWarmupIterations ?? 0));
  }

  /** Runs all cases and returns raw timing results. */
  async run(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    for (const benchmark of this.cases) {
      const iterations = Math.max(1, Math.floor(benchmark.iterations ?? this.#defaultIterations));
      const warmupIterations = Math.max(
        0,
        Math.floor(benchmark.warmupIterations ?? this.#defaultWarmupIterations),
      );
      for (let index = 0; index < warmupIterations; index += 1) {
        await benchmark.run();
      }

      const start = this.#now();
      for (let index = 0; index < iterations; index += 1) {
        await benchmark.run();
      }
      const totalMs = this.#now() - start;
      const averageMs = totalMs / iterations;
      const passed = (benchmark.maxAverageMs === undefined || averageMs <= benchmark.maxAverageMs) &&
        (benchmark.maxTotalMs === undefined || totalMs <= benchmark.maxTotalMs);
      results.push({
        name: benchmark.name,
        iterations,
        warmupIterations,
        totalMs,
        averageMs,
        maxAverageMs: benchmark.maxAverageMs,
        maxTotalMs: benchmark.maxTotalMs,
        passed,
      });
    }
    return results;
  }

  /** Runs all cases and returns a pass/fail summary. */
  async summarize(): Promise<BenchmarkSummary> {
    return summarizeBenchmarkResults(await this.run());
  }

  /** Returns serializable case metadata without running benchmark work. */
  inspect(query: BenchmarkCatalogQuery = {}): BenchmarkCatalogReport {
    return createBenchmarkCatalogReport({ cases: this.cases, query });
  }
}

/** Returns normalized metadata for a benchmark case without executing it. */
export function inspectBenchmarkCase(benchmark: BenchmarkCase): BenchmarkCaseInspection {
  return {
    name: benchmark.name,
    category: benchmark.category,
    description: benchmark.description,
    tags: [...new Set(benchmark.tags ?? [])].sort(),
    iterations: benchmark.iterations,
    warmupIterations: benchmark.warmupIterations,
    maxAverageMs: benchmark.maxAverageMs,
    maxTotalMs: benchmark.maxTotalMs,
    thresholded: benchmark.maxAverageMs !== undefined || benchmark.maxTotalMs !== undefined,
  };
}

/** Filters benchmark case metadata for docs, settings, and CI selectors. */
export function queryBenchmarkCases(
  cases: readonly BenchmarkCase[],
  query: BenchmarkCatalogQuery = {},
): BenchmarkCaseInspection[] {
  const matches: BenchmarkCaseInspection[] = [];
  for (const benchmark of cases) {
    const inspection = inspectBenchmarkCase(benchmark);
    if (matchesBenchmarkQuery(inspection, query)) matches.push(inspection);
  }
  return matches.sort(compareBenchmarkCaseInspections);
}

/** Aggregates benchmark catalog metadata. */
export function inspectBenchmarkCatalog(cases: readonly BenchmarkCaseInspection[]): BenchmarkCatalogInspection {
  let thresholded = 0;
  const categories = new Set<string>();
  const tags = new Set<string>();
  for (const benchmark of cases) {
    if (benchmark.thresholded) thresholded += 1;
    if (benchmark.category !== undefined) categories.add(benchmark.category);
    for (const tag of benchmark.tags) {
      tags.add(tag);
    }
  }
  return {
    count: cases.length,
    thresholded,
    categories: sortedSetValues(categories),
    tags: sortedSetValues(tags),
  };
}

/** Creates a filtered benchmark catalog report. */
export function createBenchmarkCatalogReport(options: BenchmarkCatalogReportOptions): BenchmarkCatalogReport {
  const cases = queryBenchmarkCases(options.cases, options.query);
  return {
    cases,
    inspection: inspectBenchmarkCatalog(cases),
  };
}

/** Formats benchmark case metadata as Markdown without running the suite. */
export function formatBenchmarkCatalogMarkdown(options: BenchmarkCatalogMarkdownOptions): string {
  const report = createBenchmarkCatalogReport(options);
  const lines = [`# ${options.title ?? "Benchmark Catalog"}`, ""];
  if (options.includeSummary ?? true) {
    lines.push(`${report.inspection.count} cases, ${report.inspection.thresholded} with thresholds.`, "");
  }
  lines.push("| Case | Category | Iterations | Thresholds | Tags | Description |");
  lines.push("| --- | --- | ---: | --- | --- | --- |");
  for (const benchmark of report.cases) {
    lines.push(
      `| ${benchmark.name} | ${benchmark.category ?? "-"} | ${benchmark.iterations ?? "-"} | ${
        formatBenchmarkCaseThresholds(benchmark)
      } | ${benchmark.tags.join(", ") || "-"} | ${benchmark.description ?? "-"} |`,
    );
  }
  return lines.join("\n");
}

/** Summarizes previously collected benchmark results. */
export function summarizeBenchmarkResults(results: readonly BenchmarkResult[]): BenchmarkSummary {
  let totalMs = 0;
  const failed: BenchmarkResult[] = [];
  const clonedResults = new Array<BenchmarkResult>(results.length);
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]!;
    clonedResults[index] = result;
    totalMs += result.totalMs;
    if (!result.passed) failed.push(result);
  }
  return {
    results: clonedResults,
    passed: failed.length === 0,
    failed,
    totalMs,
    averageMs: results.length === 0 ? 0 : totalMs / results.length,
  };
}

/** Summarizes repeated benchmark summaries by keeping the best average result for each case. */
export function summarizeBestBenchmarkSummaries(summaries: readonly BenchmarkSummary[]): BenchmarkSummary {
  if (summaries.length === 0) return summarizeBenchmarkResults([]);
  const first = summaries[0]!;
  const results = new Array<BenchmarkResult>(first.results.length);
  for (let index = 0; index < first.results.length; index += 1) {
    let best = first.results[index]!;
    for (let summaryIndex = 1; summaryIndex < summaries.length; summaryIndex += 1) {
      const candidate = summaries[summaryIndex]!.results.find((result) => result.name === best.name);
      if (candidate && isBetterBenchmarkResult(candidate, best)) best = candidate;
    }
    results[index] = best;
  }
  return summarizeBenchmarkResults(results);
}

/** Formats benchmark results as stable text for CLI output and smoke tests. */
export function formatBenchmarkResults(results: readonly BenchmarkResult[]): string {
  const lines = new Array<string>(results.length);
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]!;
    lines[index] = `${result.passed ? "ok" : "fail"} ${result.name}: ${
      result.averageMs.toFixed(3)
    }ms avg (${result.iterations} iterations, ${result.totalMs.toFixed(3)}ms total${formatThresholds(result)})`;
  }
  return lines.join("\n");
}

/** Formats a benchmark summary with an aggregate footer for CLI reports. */
export function formatBenchmarkSummary(summary: BenchmarkSummary): string {
  const body = formatBenchmarkResults(summary.results);
  const footer = `${
    summary.passed ? "ok" : "fail"
  } benchmark summary: ${summary.results.length} cases, ${summary.failed.length} failed, ${
    summary.totalMs.toFixed(3)
  }ms total, ${summary.averageMs.toFixed(3)}ms avg/case`;
  return body ? `${body}\n${footer}` : footer;
}

function formatThresholds(result: BenchmarkResult): string {
  const thresholds: string[] = [];
  if (result.maxAverageMs !== undefined) thresholds.push(`max avg ${result.maxAverageMs.toFixed(3)}ms`);
  if (result.maxTotalMs !== undefined) thresholds.push(`max total ${result.maxTotalMs.toFixed(3)}ms`);
  return thresholds.length === 0 ? "" : `, ${thresholds.join(", ")}`;
}

function isBetterBenchmarkResult(candidate: BenchmarkResult, current: BenchmarkResult): boolean {
  return candidate.averageMs < current.averageMs ||
    (candidate.averageMs === current.averageMs && candidate.totalMs < current.totalMs);
}

function formatBenchmarkCaseThresholds(benchmark: BenchmarkCaseInspection): string {
  const thresholds: string[] = [];
  if (benchmark.maxAverageMs !== undefined) thresholds.push(`avg <= ${benchmark.maxAverageMs}`);
  if (benchmark.maxTotalMs !== undefined) thresholds.push(`total <= ${benchmark.maxTotalMs}`);
  return thresholds.join(", ") || "-";
}

function matchesBenchmarkQuery(benchmark: BenchmarkCaseInspection, query: BenchmarkCatalogQuery): boolean {
  if (query.category && benchmark.category !== query.category) return false;
  if (query.tag && !benchmark.tags.includes(query.tag)) return false;
  if (query.thresholded !== undefined && benchmark.thresholded !== query.thresholded) return false;
  if (!query.search) return true;
  return benchmarkMatchesSearch(benchmark, query.search);
}

function sortedSetValues<T extends string>(values: Set<T>): T[] {
  return [...values].sort();
}

function compareBenchmarkCaseInspections(left: BenchmarkCaseInspection, right: BenchmarkCaseInspection): number {
  return (left.category ?? "").localeCompare(right.category ?? "") || left.name.localeCompare(right.name);
}

function benchmarkMatchesSearch(benchmark: BenchmarkCaseInspection, search: string): boolean {
  let start = -1;
  const normalized = search.toLowerCase();
  for (let index = 0; index <= normalized.length; index += 1) {
    const char = index < normalized.length ? normalized[index] : " ";
    if (char !== undefined && !isSearchWhitespace(char)) {
      if (start < 0) start = index;
      continue;
    }
    if (start < 0) continue;
    if (!benchmarkIncludesSearchPart(benchmark, normalized.slice(start, index))) return false;
    start = -1;
  }
  return true;
}

function benchmarkIncludesSearchPart(benchmark: BenchmarkCaseInspection, part: string): boolean {
  if (benchmark.name.toLowerCase().includes(part)) return true;
  if (benchmark.category?.toLowerCase().includes(part)) return true;
  if (benchmark.description?.toLowerCase().includes(part)) return true;
  for (const tag of benchmark.tags) {
    if (tag.toLowerCase().includes(part)) return true;
  }
  return false;
}

function isSearchWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\t" || char === "\r" || char === "\f";
}
