// Copyright 2023 Im-Beast. MIT license.
export interface BenchmarkCase {
  name: string;
  iterations?: number;
  run: () => void | Promise<void>;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  averageMs: number;
}

export class BenchmarkRunner {
  constructor(private readonly cases: readonly BenchmarkCase[]) {}

  async run(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    for (const benchmark of this.cases) {
      const iterations = Math.max(1, Math.floor(benchmark.iterations ?? 1));
      const start = performance.now();
      for (let index = 0; index < iterations; index += 1) {
        await benchmark.run();
      }
      const totalMs = performance.now() - start;
      results.push({
        name: benchmark.name,
        iterations,
        totalMs,
        averageMs: totalMs / iterations,
      });
    }
    return results;
  }
}

export function formatBenchmarkResults(results: readonly BenchmarkResult[]): string {
  return results
    .map((result) =>
      `${result.name}: ${result.averageMs.toFixed(3)}ms avg (${result.iterations} iterations, ${
        result.totalMs.toFixed(3)
      }ms total)`
    )
    .join("\n");
}
