import { clamp } from "./styles.ts";
import type { RenderContext, SourceFrame } from "./types.ts";

interface VisualizationSourceDrive {
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
  const sources = new Array<VisualizationSourceDrive>(sourceFrames.length);
  for (let sourceIndex = 0; sourceIndex < sourceFrames.length; sourceIndex += 1) {
    const source = sourceFrames[sourceIndex]!;
    const rawSeries = sampleSeries(source.series.length > 0 ? source.series : [source.value], sampleWidth);
    let floor = source.value;
    let ceiling = source.value;
    for (const value of rawSeries) {
      floor = Math.min(floor, value);
      ceiling = Math.max(ceiling, value);
    }
    const span = Math.max(0, ceiling - floor);
    const normalizedSeries = new Array<number>(rawSeries.length);
    for (let index = 0; index < rawSeries.length; index += 1) {
      const value = rawSeries[index]!;
      const local = span < 0.035 ? value : clamp((value - floor) / Math.max(span, 0.001), 0, 1);
      const motion = index === 0 ? Math.abs(source.value - value) : Math.abs(value - (rawSeries[index - 1] ?? value));
      normalizedSeries[index] = clamp(local * 0.72 + value * 0.22 + motion * 0.48, 0, 1);
    }
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

    sources[sourceIndex] = {
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
  }

  const primary = sources[0]!;
  const secondary = sources[1] ?? primary;
  const rawSeries = averageSourceSeries(sources, sampleWidth, "rawSeries");
  const normalizedSeries = averageSourceSeries(sources, sampleWidth, "normalizedSeries");
  const spreadSeries = new Array<number>(sampleWidth);
  const motionSeries = new Array<number>(sampleWidth);
  const pulseSeries = new Array<number>(sampleWidth);
  for (let index = 0; index < sampleWidth; index += 1) {
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (const source of sources) {
      const value = source.normalizedSeries[index] ?? source.normalizedValue;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    const value = normalizedSeries[index] ?? 0;
    const motion = index === 0 ? 0 : Math.abs(value - (normalizedSeries[index - 1] ?? value));
    spreadSeries[index] = clamp(high - low, 0, 1);
    motionSeries[index] = motion;
    pulseSeries[index] = clamp(value * 0.6 + motion * 0.18 + spreadSeries[index]! * 0.22, 0, 1);
  }
  const current = last(normalizedSeries);
  let valueSum = 0;
  let peakValue = current;
  let sourceVolatilitySum = 0;
  let divergenceSum = 0;
  let activeCount = 0;
  for (const source of sources) {
    valueSum += source.value;
    peakValue = Math.max(peakValue, source.value);
    sourceVolatilitySum += source.volatility;
    divergenceSum += Math.abs(source.normalizedValue - current);
    if (source.energy >= 0.55 || source.value >= 0.62) activeCount += 1;
  }
  const absolute = clamp(valueSum / sources.length, 0, 1);
  const peak = clamp(Math.max(peakValue, absolute), 0, 1);
  let floor = Number.POSITIVE_INFINITY;
  let ceiling = Number.NEGATIVE_INFINITY;
  for (const value of normalizedSeries) {
    floor = Math.min(floor, value);
    ceiling = Math.max(ceiling, value);
  }
  const span = clamp(ceiling - floor, 0, 1);
  const slope = seriesSlope(normalizedSeries, Math.min(6, sampleWidth - 1));
  const previousSlope = seriesSlopeRange(
    normalizedSeries,
    Math.max(2, normalizedSeries.length - 2),
    Math.min(6, sampleWidth - 1),
  );
  const jerk = clamp(slope - previousSlope, -1, 1);
  const volatility = clamp(
    clamp(sourceVolatilitySum / sources.length, 0, 1) * 0.55 + seriesVolatility(normalizedSeries) * 0.45,
    0,
    1,
  );
  const divergence = clamp(
    clamp(divergenceSum / sources.length, 0, 1) * 1.4 +
      Math.abs(primary.normalizedValue - secondary.normalizedValue) * 0.25,
    0,
    1,
  );
  const imbalance = clamp(primary.normalizedValue - secondary.normalizedValue, -1, 1);
  let alertPressure = context.system.alerts.length > 0 ? 0.76 : 0;
  for (const alert of context.system.alerts) {
    if (alert.severity === "alarm") {
      alertPressure = 1;
      break;
    }
  }
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
  const series = new Array<number>(48);
  for (let index = 0; index < series.length; index += 1) {
    series[index] = (Math.sin((phase + index) * 0.18) + 1) / 2;
  }
  return {
    id: "fallback",
    name: "Fallback Pulse",
    accent: "signal",
    value: (Math.sin(phase * 0.18) + 1) / 2,
    series,
    detailLines: ["FALLBACK SOURCE"],
  };
}

export function sampleSeries(values: number[], width: number): number[] {
  if (width <= 0) {
    return [];
  }
  const output = new Array<number>(width);
  for (let index = 0; index < width; index += 1) {
    output[index] = sampleSeriesValue(values, index, width);
  }
  return output;
}

export function sampleSeriesValue(values: readonly number[], index: number, width: number): number {
  if (width <= 0 || values.length === 0) return 0;
  const safeIndex = Math.max(0, Math.min(Math.floor(index), Math.max(0, width - 1)));
  const ratio = width === 1 ? 0 : safeIndex / (width - 1);
  const position = Math.round(ratio * (values.length - 1));
  return clamp(values[position] ?? 0, 0, 1);
}

export function moduloUnit(value: number): number {
  const remainder = value % 1;
  return remainder < 0 ? remainder + 1 : remainder;
}

function averageSourceSeries(
  sources: readonly VisualizationSourceDrive[],
  width: number,
  key: "rawSeries" | "normalizedSeries",
): number[] {
  if (sources.length === 0) {
    return new Array<number>(width).fill(0);
  }
  const output = new Array<number>(width);
  for (let index = 0; index < width; index += 1) {
    let sum = 0;
    for (const source of sources) sum += source[key][index] ?? 0;
    output[index] = clamp(sum / sources.length, 0, 1);
  }
  return output;
}

function seriesSlope(values: number[], steps = 4): number {
  return seriesSlopeRange(values, values.length, steps);
}

function seriesSlopeRange(values: number[], count: number, steps = 4): number {
  if (values.length <= 1) {
    return 0;
  }
  const end = Math.min(values.length, Math.max(0, count)) - 1;
  if (end <= 0) return 0;
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
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index]!;
  }
  return clamp(sum / values.length, 0, 1);
}

function last(values: number[]): number {
  return values[values.length - 1] ?? 0;
}
