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
  return cases
    .map(inspectBenchmarkCase)
    .filter((benchmark) => matchesBenchmarkQuery(benchmark, query))
    .sort((left, right) =>
      (left.category ?? "").localeCompare(right.category ?? "") || left.name.localeCompare(right.name)
    );
}

/** Aggregates benchmark catalog metadata. */
export function inspectBenchmarkCatalog(cases: readonly BenchmarkCaseInspection[]): BenchmarkCatalogInspection {
  return {
    count: cases.length,
    thresholded: cases.filter((benchmark) => benchmark.thresholded).length,
    categories: uniqueSorted(cases.map((benchmark) => benchmark.category).filter(isString)),
    tags: uniqueSorted(cases.flatMap((benchmark) => benchmark.tags)),
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
  const failed = results.filter((result) => !result.passed);
  const totalMs = results.reduce((total, result) => total + result.totalMs, 0);
  return {
    results: [...results],
    passed: failed.length === 0,
    failed,
    totalMs,
    averageMs: results.length === 0 ? 0 : totalMs / results.length,
  };
}

/** Formats benchmark results as stable text for CLI output and smoke tests. */
export function formatBenchmarkResults(results: readonly BenchmarkResult[]): string {
  return results
    .map((result) =>
      `${result.passed ? "ok" : "fail"} ${result.name}: ${
        result.averageMs.toFixed(3)
      }ms avg (${result.iterations} iterations, ${result.totalMs.toFixed(3)}ms total${formatThresholds(result)})`
    )
    .join("\n");
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
  const thresholds = [
    result.maxAverageMs === undefined ? undefined : `max avg ${result.maxAverageMs.toFixed(3)}ms`,
    result.maxTotalMs === undefined ? undefined : `max total ${result.maxTotalMs.toFixed(3)}ms`,
  ].filter((value): value is string => value !== undefined);
  return thresholds.length === 0 ? "" : `, ${thresholds.join(", ")}`;
}

function formatBenchmarkCaseThresholds(benchmark: BenchmarkCaseInspection): string {
  const thresholds = [
    benchmark.maxAverageMs === undefined ? undefined : `avg <= ${benchmark.maxAverageMs}`,
    benchmark.maxTotalMs === undefined ? undefined : `total <= ${benchmark.maxTotalMs}`,
  ].filter(isString);
  return thresholds.join(", ") || "-";
}

function matchesBenchmarkQuery(benchmark: BenchmarkCaseInspection, query: BenchmarkCatalogQuery): boolean {
  if (query.category && benchmark.category !== query.category) return false;
  if (query.tag && !benchmark.tags.includes(query.tag)) return false;
  if (query.thresholded !== undefined && benchmark.thresholded !== query.thresholded) return false;
  if (!query.search) return true;
  const parts = query.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  const haystack = [
    benchmark.name,
    benchmark.category,
    benchmark.description,
    ...benchmark.tags,
  ].join(" ").toLowerCase();
  return parts.every((part) => haystack.includes(part));
}

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort();
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}
