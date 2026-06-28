// Copyright 2023 Im-Beast. MIT license.
export interface BenchmarkCase {
  name: string;
  iterations?: number;
  warmupIterations?: number;
  maxAverageMs?: number;
  maxTotalMs?: number;
  run: () => void | Promise<void>;
}

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

export interface BenchmarkRunnerOptions {
  now?: () => number;
  defaultIterations?: number;
  defaultWarmupIterations?: number;
}

export interface BenchmarkSummary {
  results: BenchmarkResult[];
  passed: boolean;
  failed: BenchmarkResult[];
}

export class BenchmarkRunner {
  readonly #now: () => number;
  readonly #defaultIterations: number;
  readonly #defaultWarmupIterations: number;

  constructor(
    private readonly cases: readonly BenchmarkCase[],
    options: BenchmarkRunnerOptions = {},
  ) {
    this.#now = options.now ?? (() => performance.now());
    this.#defaultIterations = Math.max(1, Math.floor(options.defaultIterations ?? 1));
    this.#defaultWarmupIterations = Math.max(0, Math.floor(options.defaultWarmupIterations ?? 0));
  }

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

  async summarize(): Promise<BenchmarkSummary> {
    return summarizeBenchmarkResults(await this.run());
  }
}

export function summarizeBenchmarkResults(results: readonly BenchmarkResult[]): BenchmarkSummary {
  const failed = results.filter((result) => !result.passed);
  return {
    results: [...results],
    passed: failed.length === 0,
    failed,
  };
}

export function formatBenchmarkResults(results: readonly BenchmarkResult[]): string {
  return results
    .map((result) =>
      `${result.passed ? "ok" : "fail"} ${result.name}: ${
        result.averageMs.toFixed(3)
      }ms avg (${result.iterations} iterations, ${result.totalMs.toFixed(3)}ms total${formatThresholds(result)})`
    )
    .join("\n");
}

function formatThresholds(result: BenchmarkResult): string {
  const thresholds = [
    result.maxAverageMs === undefined ? undefined : `max avg ${result.maxAverageMs.toFixed(3)}ms`,
    result.maxTotalMs === undefined ? undefined : `max total ${result.maxTotalMs.toFixed(3)}ms`,
  ].filter((value): value is string => value !== undefined);
  return thresholds.length === 0 ? "" : `, ${thresholds.join(", ")}`;
}
