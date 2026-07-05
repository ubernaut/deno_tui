import { type BenchmarkCase, type BenchmarkCatalogQuery, queryBenchmarkCases } from "../src/perf/mod.ts";

/** Parsed command-line options for the benchmark executable. */
export interface BenchmarkCliOptions {
  query: BenchmarkCatalogQuery;
  list: boolean;
  json: boolean;
  repeat: number;
}

/** Parses benchmark CLI selectors without executing benchmark work. */
export function parseBenchmarkCliOptions(args: readonly string[]): BenchmarkCliOptions {
  const query: BenchmarkCatalogQuery = {};
  let list = false;
  let json = false;
  let repeat = 1;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--list" || arg === "--catalog") {
      list = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--repeat") {
      const value = args[index + 1];
      if (value !== undefined) {
        repeat = parseRepeatCount(value);
        index += 1;
      }
    } else if (arg.startsWith("--repeat=")) {
      repeat = parseRepeatCount(arg.slice("--repeat=".length));
    } else if (arg === "--name") {
      const value = args[index + 1];
      if (value !== undefined) {
        appendBenchmarkName(query, value);
        index += 1;
      }
    } else if (arg.startsWith("--name=")) {
      appendBenchmarkName(query, arg.slice("--name=".length));
    } else if (arg === "--filter" || arg === "--search" || arg === "--query") {
      const value = args[index + 1];
      if (value !== undefined) {
        query.search = value;
        index += 1;
      }
    } else if (arg.startsWith("--filter=")) {
      query.search = arg.slice("--filter=".length);
    } else if (arg.startsWith("--search=")) {
      query.search = arg.slice("--search=".length);
    } else if (arg.startsWith("--query=")) {
      query.search = arg.slice("--query=".length);
    } else if (arg === "--category") {
      const value = args[index + 1];
      if (value !== undefined) {
        query.category = value;
        index += 1;
      }
    } else if (arg.startsWith("--category=")) {
      query.category = arg.slice("--category=".length);
    } else if (arg === "--tag") {
      const value = args[index + 1];
      if (value !== undefined) {
        query.tag = value;
        index += 1;
      }
    } else if (arg.startsWith("--tag=")) {
      query.tag = arg.slice("--tag=".length);
    } else if (arg === "--thresholded") {
      query.thresholded = true;
    } else if (arg === "--unthresholded") {
      query.thresholded = false;
    }
  }

  return { query, list, json, repeat };
}

/** Returns matching benchmark cases in their original execution order. */
export function selectBenchmarkCases(
  cases: readonly BenchmarkCase[],
  query: BenchmarkCatalogQuery = {},
): BenchmarkCase[] {
  const matchedNames = new Set(queryBenchmarkCases(cases, query).map((entry) => entry.name));
  return cases.filter((benchmark) => matchedNames.has(benchmark.name));
}

/** Formats a benchmark selector miss so targeted performance runs cannot pass without running cases. */
export function formatEmptyBenchmarkSelectionError(query: BenchmarkCatalogQuery = {}): string {
  const selectors: string[] = [];
  if (query.name) selectors.push(`name=${JSON.stringify(query.name)}`);
  if (query.search) selectors.push(`query=${JSON.stringify(query.search)}`);
  if (query.category) selectors.push(`category=${JSON.stringify(query.category)}`);
  if (query.tag) selectors.push(`tag=${JSON.stringify(query.tag)}`);
  if (query.thresholded !== undefined) selectors.push(`thresholded=${query.thresholded}`);
  return selectors.length === 0
    ? "No benchmark cases are available."
    : `No benchmark cases matched ${selectors.join(", ")}. Use --list with the same selector to inspect the catalog.`;
}

function appendBenchmarkName(query: BenchmarkCatalogQuery, name: string): void {
  if (query.name === undefined) {
    query.name = name;
    return;
  }
  query.name = Array.isArray(query.name) ? [...query.name, name] : [query.name, name];
}

function parseRepeatCount(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(25, Math.floor(parsed)));
}
