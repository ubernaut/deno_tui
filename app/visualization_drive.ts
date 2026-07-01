import { clamp } from "./styles.ts";
import type { RenderContext, SourceFrame } from "./types.ts";

export interface VisualizationSourceDrive {
  source: SourceFrame;
  rawSeries: number[];
  normalizedSeries: number[];
  value: number;
  normalizedValue: number;
  average: number;
  floor: number;
  ceiling: number;
  span: number;
  slope: number;
  volatility: number;
  energy: number;
}

export interface VisualizationDrive {
  sources: VisualizationSourceDrive[];
  primary: VisualizationSourceDrive;
  secondary: VisualizationSourceDrive;
  rawSeries: number[];
  normalizedSeries: number[];
  spreadSeries: number[];
  motionSeries: number[];
  pulseSeries: number[];
  current: number;
  absolute: number;
  peak: number;
  floor: number;
  ceiling: number;
  span: number;
  slope: number;
  jerk: number;
  volatility: number;
  divergence: number;
  imbalance: number;
  cadence: number;
  density: number;
  hazard: number;
  alertPressure: number;
  activeCount: number;
  phase: number;
  scan: number;
}

export function buildVisualizationDrive(
  context: Pick<RenderContext, "sources" | "phase" | "system">,
  width = 48,
): VisualizationDrive {
  const sampleWidth = Math.max(8, width);
  const sourceFrames = context.sources.length > 0 ? context.sources : [fallbackSource(context.phase)];
  const sources = sourceFrames.map((source) => {
    const rawSeries = sampleSeries(source.series.length > 0 ? source.series : [source.value], sampleWidth);
    const floor = Math.min(source.value, ...rawSeries);
    const ceiling = Math.max(source.value, ...rawSeries);
    const span = Math.max(0, ceiling - floor);
    const normalizedSeries = rawSeries.map((value, index) => {
      const local = span < 0.035 ? value : clamp((value - floor) / Math.max(span, 0.001), 0, 1);
      const motion = index === 0 ? Math.abs(source.value - value) : Math.abs(value - (rawSeries[index - 1] ?? value));
      return clamp(local * 0.72 + value * 0.22 + motion * 0.48, 0, 1);
    });
    const normalizedValue = (() => {
      const local = span < 0.035 ? source.value : clamp((source.value - floor) / Math.max(span, 0.001), 0, 1);
      return clamp(local * 0.72 + source.value * 0.28, 0, 1);
    })();
    const average = mergeValueFromSeries(normalizedSeries);
    const slope = seriesSlope(normalizedSeries, Math.min(6, sampleWidth - 1));
    const volatility = seriesVolatility(normalizedSeries);
    const energy = clamp(
      normalizedValue * 0.44 + average * 0.18 + volatility * 0.24 + Math.abs(slope) * 0.14,
      0,
      1,
    );

    return {
      source,
      rawSeries,
      normalizedSeries,
      value: clamp(source.value, 0, 1),
      normalizedValue,
      average,
      floor,
      ceiling,
      span,
      slope,
      volatility,
      energy,
    };
  });

  const primary = sources[0]!;
  const secondary = sources[1] ?? primary;
  const rawSeries = averageSeries(sources.map((source) => source.rawSeries), sampleWidth);
  const normalizedSeries = averageSeries(sources.map((source) => source.normalizedSeries), sampleWidth);
  const spreadSeries = Array.from({ length: sampleWidth }, (_, index) => {
    const values = sources.map((source) => source.normalizedSeries[index] ?? source.normalizedValue);
    return clamp(Math.max(...values) - Math.min(...values), 0, 1);
  });
  const motionSeries = normalizedSeries.map((value, index) =>
    index === 0 ? 0 : Math.abs(value - (normalizedSeries[index - 1] ?? value))
  );
  const pulseSeries = normalizedSeries.map((value, index) =>
    clamp(value * 0.6 + motionSeries[index] * 0.18 + spreadSeries[index] * 0.22, 0, 1)
  );
  const current = last(normalizedSeries);
  const absolute = clamp(sources.reduce((sum, source) => sum + source.value, 0) / sources.length, 0, 1);
  const peak = clamp(Math.max(...sources.map((source) => source.value), current, absolute), 0, 1);
  const floor = Math.min(...normalizedSeries);
  const ceiling = Math.max(...normalizedSeries);
  const span = clamp(ceiling - floor, 0, 1);
  const slope = seriesSlope(normalizedSeries, Math.min(6, sampleWidth - 1));
  const previousSlope = seriesSlope(
    normalizedSeries.slice(0, Math.max(2, normalizedSeries.length - 2)),
    Math.min(6, sampleWidth - 1),
  );
  const jerk = clamp(slope - previousSlope, -1, 1);
  const volatility = clamp(
    mergeValueFromSeries(sources.map((source) => source.volatility)) * 0.55 + seriesVolatility(normalizedSeries) * 0.45,
    0,
    1,
  );
  const divergence = clamp(
    mergeValueFromSeries(sources.map((source) => Math.abs(source.normalizedValue - current))) * 1.4 +
      Math.abs(primary.normalizedValue - secondary.normalizedValue) * 0.25,
    0,
    1,
  );
  const imbalance = clamp(primary.normalizedValue - secondary.normalizedValue, -1, 1);
  const alertPressure = context.system.alerts.some((alert) => alert.severity === "alarm")
    ? 1
    : context.system.alerts.length > 0
    ? 0.76
    : 0;
  const activeCount = sources.filter((source) => source.energy >= 0.55 || source.value >= 0.62).length;
  const cadence = clamp(0.16 + volatility * 0.34 + Math.abs(slope) * 0.26 + divergence * 0.24, 0, 1);
  const density = clamp(
    0.18 + current * 0.34 + volatility * 0.24 + divergence * 0.12 + (activeCount / sources.length) * 0.12,
    0,
    1,
  );
  const hazard = clamp(
    Math.max(alertPressure, absolute * 0.24 + current * 0.28 + peak * 0.2 + volatility * 0.16 + divergence * 0.12),
    0,
    1,
  );
  const phase = context.phase +
    Math.round(current * 37 + volatility * 29 + divergence * 23 + absolute * 17 + activeCount * 7);
  const scan = moduloUnit(context.phase * 0.027 + current * 0.31 + volatility * 0.21 + divergence * 0.17);

  return {
    sources,
    primary,
    secondary,
    rawSeries,
    normalizedSeries,
    spreadSeries,
    motionSeries,
    pulseSeries,
    current,
    absolute,
    peak,
    floor,
    ceiling,
    span,
    slope,
    jerk,
    volatility,
    divergence,
    imbalance,
    cadence,
    density,
    hazard,
    alertPressure,
    activeCount,
    phase,
    scan,
  };
}

export function fallbackSource(phase: number): SourceFrame {
  return {
    id: "fallback",
    name: "Fallback Pulse",
    accent: "signal",
    value: (Math.sin(phase * 0.18) + 1) / 2,
    series: Array.from({ length: 48 }, (_, index) => (Math.sin((phase + index) * 0.18) + 1) / 2),
    detailLines: ["FALLBACK SOURCE"],
  };
}

export function sampleSeries(values: number[], width: number): number[] {
  if (width <= 0) {
    return [];
  }
  if (values.length === 0) {
    return Array.from({ length: width }, () => 0);
  }
  return Array.from({ length: width }, (_, index) => {
    const ratio = width === 1 ? 0 : index / (width - 1);
    const position = Math.round(ratio * (values.length - 1));
    return clamp(values[position] ?? 0, 0, 1);
  });
}

export function moduloUnit(value: number): number {
  const remainder = value % 1;
  return remainder < 0 ? remainder + 1 : remainder;
}

function averageSeries(series: number[][], width: number): number[] {
  if (series.length === 0) {
    return Array.from({ length: width }, () => 0);
  }
  return Array.from(
    { length: width },
    (_, index) => clamp(series.reduce((sum, values) => sum + (values[index] ?? 0), 0) / series.length, 0, 1),
  );
}

function seriesSlope(values: number[], steps = 4): number {
  if (values.length <= 1) {
    return 0;
  }
  const end = values.length - 1;
  const start = Math.max(0, end - Math.max(1, steps));
  return clamp((values[end]! - values[start]!) * 1.4, -1, 1);
}

function seriesVolatility(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    total += Math.abs(values[index]! - values[index - 1]!);
  }
  return clamp((total / (values.length - 1)) * 2.4, 0, 1);
}

function mergeValueFromSeries(values: number[]): number {
  if (values.length === 0) {
    return 0.12;
  }
  return clamp(values.reduce((sum, value) => sum + value, 0) / values.length, 0, 1);
}

function last(values: number[]): number {
  return values[values.length - 1] ?? 0;
}
