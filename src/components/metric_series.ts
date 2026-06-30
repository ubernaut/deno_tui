// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";

/** Public interface describing a metric Clamp Range. */
export interface MetricClampRange {
  min?: number;
  max?: number;
}

/** Public interface describing a metric Series Stats. */
export interface MetricSeriesStats {
  count: number;
  min: number;
  max: number;
  latest: number;
  average: number;
  sum: number;
}

/** Options for configuring metric Series Controller. */
export interface MetricSeriesControllerOptions {
  limit?: number;
  initialValues?: readonly number[];
  clamp?: boolean | MetricClampRange;
}

/** Serializable inspection snapshot for metric Series. */
export interface MetricSeriesInspection {
  values: number[];
  stats: MetricSeriesStats;
  limit: number;
  empty: boolean;
}

/** Built-in dEFAULT METRIC SERIES LIMIT definitions. */
export const DEFAULT_METRIC_SERIES_LIMIT = 60;

/** Public helper for normalize Metric Value. */
export function normalizeMetricValue(value: number, clamp?: boolean | MetricClampRange): number {
  let normalized = Number.isFinite(value) ? value : 0;
  if (!clamp) return normalized;

  const min = typeof clamp === "object" ? clamp.min ?? 0 : 0;
  const max = typeof clamp === "object" ? clamp.max ?? 1 : 1;
  normalized = Math.max(min, Math.min(max, normalized));
  return normalized;
}

/** Public helper for normalize Metric Limit. */
export function normalizeMetricLimit(limit: number): number {
  return Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0));
}

/** Public helper for push Metric Value. */
export function pushMetricValue(
  values: readonly number[],
  value: number,
  limit = DEFAULT_METRIC_SERIES_LIMIT,
  clamp?: boolean | MetricClampRange,
): number[] {
  const normalizedLimit = normalizeMetricLimit(limit);
  if (normalizedLimit === 0) return [];

  const next = values.slice(-Math.max(0, normalizedLimit - 1));
  next.push(normalizeMetricValue(value, clamp));
  return next;
}

/** Public helper for metric Series Stats. */
export function metricSeriesStats(values: readonly number[]): MetricSeriesStats {
  if (!values.length) {
    return { count: 0, min: 0, max: 0, latest: 0, average: 0, sum: 0 };
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;

  for (const value of values) {
    const normalized = normalizeMetricValue(value);
    min = Math.min(min, normalized);
    max = Math.max(max, normalized);
    sum += normalized;
  }

  return {
    count: values.length,
    min,
    max,
    latest: normalizeMetricValue(values[values.length - 1]),
    average: sum / values.length,
    sum,
  };
}

/** State controller for metric Series behavior. */
export class MetricSeriesController {
  readonly values: Signal<number[]>;
  readonly stats: Signal<MetricSeriesStats>;
  readonly limit: Signal<number>;

  #clamp?: boolean | MetricClampRange;

  constructor(options: MetricSeriesControllerOptions = {}) {
    const limit = normalizeMetricLimit(options.limit ?? DEFAULT_METRIC_SERIES_LIMIT);
    this.#clamp = options.clamp;
    this.limit = new Signal<number>(limit);
    this.values = new Signal<number[]>([]);
    this.stats = new Signal<MetricSeriesStats>(metricSeriesStats([]));
    this.reset(options.initialValues ?? []);
  }

  push(value: number): void {
    this.#setValues(pushMetricValue(this.values.peek(), value, this.limit.peek(), this.#clamp));
  }

  pushMany(values: readonly number[]): void {
    const limit = this.limit.peek();
    if (limit === 0) {
      this.#setValues([]);
      return;
    }

    const normalized = values.map((value) => normalizeMetricValue(value, this.#clamp));
    this.#setValues([...this.values.peek(), ...normalized].slice(-limit));
  }

  reset(values: readonly number[] = []): void {
    const limit = this.limit.peek();
    const normalized = values.map((value) => normalizeMetricValue(value, this.#clamp));
    this.#setValues(limit === 0 ? [] : normalized.slice(-limit));
  }

  setLimit(limit: number): void {
    const normalizedLimit = normalizeMetricLimit(limit);
    this.limit.value = normalizedLimit;
    this.#setValues(normalizedLimit === 0 ? [] : this.values.peek().slice(-normalizedLimit));
  }

  setClamp(clamp?: boolean | MetricClampRange): void {
    this.#clamp = clamp;
    this.reset(this.values.peek());
  }

  latest(fallback = 0): number {
    const values = this.values.peek();
    return values.length ? values[values.length - 1] : fallback;
  }

  snapshot(): number[] {
    return [...this.values.peek()];
  }

  inspect(): MetricSeriesInspection {
    const values = this.snapshot();
    return {
      values,
      stats: this.stats.peek(),
      limit: this.limit.peek(),
      empty: values.length === 0,
    };
  }

  dispose(): void {
    this.values.dispose();
    this.stats.dispose();
    this.limit.dispose();
  }

  #setValues(values: number[]): void {
    this.values.value = values;
    this.stats.value = metricSeriesStats(values);
  }
}
