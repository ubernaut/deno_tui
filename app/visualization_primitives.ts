import { clamp } from "./styles.ts";
import type { WorkbenchWindowOptionGroup } from "../src/app/workbench_window_registry.ts";
import type { Accent, RenderContext, Severity, SourceFrame, SystemSnapshot } from "./types.ts";

type WorkbenchSyntheticGroup = WorkbenchWindowOptionGroup;

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

interface SyntheticWorkbenchSystemOptions {
  cpuCoreCount?: number;
  timestamp?: number;
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

export function waveSeries(length: number, phase: number, frequency: number, offset: number, scale = 1): number[] {
  const series = new Array<number>(length);
  for (let index = 0; index < length; index++) {
    series[index] = unitWave(phase + index, frequency, offset) * scale;
  }
  return series;
}

export function unitWave(value: number, frequency: number, offset: number): number {
  return Math.max(
    0,
    Math.min(
      1,
      0.5 +
        Math.sin(value * frequency + offset) * 0.34 +
        Math.cos(value * (frequency * 0.37) + offset * 2.1) * 0.16,
    ),
  );
}

export function stringSeed(value: string): number {
  let seed = 0;
  for (let index = 0; index < value.length; index += 1) {
    seed += value.charCodeAt(index);
  }
  return seed;
}

export function monitorGlyph(drive: VisualizationDrive, accent: Accent) {
  if (drive.hazard >= 0.9) {
    return "█";
  }
  if (drive.volatility >= 0.52) {
    return accent === "amber" ? "▓" : accent === "violet" ? "◆" : "▒";
  }
  return accent === "alarm" ? "╳" : accent === "amber" ? "■" : accent === "violet" ? "◆" : "●";
}

export function miniMeter(value: number, width: number, heat: number) {
  const ramp = heat >= 0.9 ? "█" : heat >= 0.72 ? "▓" : "▒";
  const fill = Math.round(clamp(value, 0, 1) * width);
  return `[${ramp.repeat(fill).padEnd(width, "·")}]`;
}

export function plotHistory(values: number[], width: number, height: number, glyph: string) {
  return signalChart(sampleSeries(values, width), width, height, glyph);
}

export function barChart(values: number[], width: number, height: number, glyphs: readonly string[]) {
  const columns = sampleSeries(values, width);
  const matrix = createMatrix(width, height, " ");
  for (let x = 0; x < width; x += 1) {
    const filled = Math.max(1, Math.round((columns[x] ?? 0) * height));
    for (let row = 0; row < height; row += 1) {
      const fromBottom = height - row;
      if (fromBottom <= filled) {
        const normalized = clamp(fromBottom / Math.max(1, filled), 0, 1);
        const glyphIndex = Math.min(glyphs.length - 1, Math.max(1, Math.ceil(normalized * (glyphs.length - 1))));
        setCell(matrix, x, row, glyphs[glyphIndex] ?? glyphs[glyphs.length - 1] ?? "#");
      }
    }
  }
  return renderMatrix(matrix);
}

export function signalChart(values: number[], width: number, height: number, glyph: string) {
  const sampled = sampleSeries(values, width);
  const matrix = createMatrix(width, height, " ");
  const threshold = Math.floor(height / 2);
  for (let x = 0; x < width; x += 1) {
    setCell(matrix, x, threshold, "─");
  }
  let previousY = threshold;
  for (let x = 0; x < width; x += 1) {
    const y = Math.round((1 - (sampled[x] ?? 0)) * Math.max(0, height - 1));
    if (x > 0) {
      drawLine(matrix, x - 1, previousY, x, y, glyph);
    }
    setCell(matrix, x, y, glyph);
    previousY = y;
  }
  return renderMatrix(matrix);
}

export function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function gridify(entries: string[], width: number) {
  const itemWidth = width >= 72 ? 28 : width >= 52 ? 24 : width >= 40 ? 20 : 16;
  const columns = Math.max(1, Math.floor((width + 1) / (itemWidth + 1)));
  const rows = Math.ceil(entries.length / columns);
  let output = "";
  for (let row = 0; row < rows; row += 1) {
    if (row > 0) output += "\n";
    let first = true;
    for (let column = 0; column < columns; column += 1) {
      const value = entries[row + column * rows];
      if (!value) continue;
      if (!first) output += " ";
      output += crop(value, itemWidth).padEnd(itemWidth, " ");
      first = false;
    }
  }
  return output;
}

export function crop(text: string, width: number) {
  if (width <= 0) return "";
  if (text.length <= width) {
    return text;
  }
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

export function formatLoadAverage(values: readonly number[], separator = " / "): string {
  if (values.length === 0) return "";
  const parts = new Array<string>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    parts[index] = values[index]!.toFixed(2);
  }
  return parts.join(separator);
}

export function severityForValue(value: number, warning: number, alarm: number): Severity {
  return value >= alarm ? "alarm" : value >= warning ? "warning" : "info";
}

export function alertText(context: RenderContext) {
  const alert = context.system.alerts[0];
  return alert ? `${alert.title} / ${alert.detail}` : "";
}

export function driveAlert(drive: VisualizationDrive) {
  if (drive.hazard >= 0.92) {
    return "LIMIT CASCADE";
  }
  if (drive.divergence >= 0.66) {
    return "CHANNEL FRACTURE";
  }
  if (drive.volatility >= 0.58) {
    return "OSCILLATION SPIKE";
  }
  if (drive.slope >= 0.24) {
    return "SURGE FRONT";
  }
  return "";
}

export function hottestAccent(sources: readonly SourceFrame[]): Accent {
  let hasAmber = false;
  for (const source of sources) {
    if (source.accent === "alarm") return "alarm";
    if (source.accent === "amber") hasAmber = true;
  }
  if (hasAmber) return "amber";
  return sources[0]?.accent ?? "signal";
}

export function sourceFooter(sources: readonly SourceFrame[]) {
  if (sources.length === 0) return "SRC NONE";
  let footer = "SRC ";
  for (let index = 0; index < sources.length; index += 1) {
    if (index > 0) footer += " + ";
    footer += crop(sources[index]!.name.toUpperCase(), 12);
  }
  return footer;
}

export function sourceDetailFooter(sources: readonly SourceFrame[]) {
  if (sources.length === 0) return sourceFooter(sources);
  let footer = "";
  const count = Math.min(2, sources.length);
  for (let index = 0; index < count; index += 1) {
    const source = sources[index]!;
    const detail = source.detailLines[0] ?? `${Math.round(source.value * 100)}%`;
    if (index > 0) footer += " / ";
    footer += `${crop(source.name.toUpperCase(), 8)} ${crop(detail, 20)}`;
  }
  return footer || sourceFooter(sources);
}

export function sceneAlert(sources: readonly SourceFrame[]) {
  let hottest: SourceFrame | undefined;
  for (const source of sources) {
    if (source.accent === "alarm") {
      hottest = source;
      break;
    }
    if (!hottest && source.accent === "amber") hottest = source;
  }
  if (!hottest) {
    return "";
  }

  return hottest.accent === "alarm"
    ? `${crop(hottest.name.toUpperCase(), 10)} CRIT`
    : `${crop(hottest.name.toUpperCase(), 10)} WARN`;
}

export function sourceWarnings(sources: readonly SourceFrame[], drive: VisualizationDrive) {
  const warnings: string[] = [];
  for (const source of sources) {
    const name = source.name.toUpperCase();
    for (const line of source.detailLines) {
      warnings.push(`${name}  ${line}`);
      if (warnings.length >= 4) return warnings;
    }
  }
  warnings.push(`VECTOR DRIVE ${(drive.current * 100).toFixed(0)}%`);
  if (warnings.length >= 4) return warnings;
  warnings.push(`OSCILLATION ${(drive.volatility * 100).toFixed(0)}%`);
  if (warnings.length >= 4) return warnings;
  warnings.push(
    drive.divergence >= 0.6
      ? `CHANNEL SPLIT ${(drive.divergence * 100).toFixed(0)}%`
      : `DENSITY ${(drive.density * 100).toFixed(0)}%`,
  );
  return warnings;
}

export function sourceNameMatrix(sources: readonly SourceFrame[]) {
  let matrix = "";
  for (let index = 0; index < sources.length; index += 1) {
    if (index > 0) matrix += " / ";
    matrix += crop(sources[index]!.name.toUpperCase(), 8);
  }
  return matrix;
}

export function monitorSourceIds(visualizationId: string): string[] {
  return monitorSourceIdsInto([], visualizationId);
}

export function monitorSourceIdsInto(target: string[], visualizationId: string): string[] {
  target.length = 0;
  switch (visualizationId) {
    case "cpu-monitor":
      target.push("sys:cpu", "sys:load");
      break;
    case "cpu-legend":
      target.push("sys:cpu-cores");
      break;
    case "cpu-hex-grid":
      target.push("sys:cpu-cores", "sys:processes");
      break;
    case "gpu-combined-monitor":
      target.push("sys:gpu", "sys:gpu-chip", "sys:gpu-memory");
      break;
    case "gpu-chip-monitor":
      target.push("sys:gpu-chip", "sys:gpu");
      break;
    case "gpu-memory-monitor":
      target.push("sys:gpu-memory", "sys:gpu");
      break;
    case "memory-monitor":
      target.push("sys:memory", "sys:swap", "sys:load");
      break;
    case "temperature-monitor":
      target.push("sys:temperature", "sys:alerts");
      break;
    case "disk-monitor":
      target.push("sys:disk", "sys:alerts");
      break;
    case "network-monitor":
      target.push("sys:network");
      break;
    case "process-monitor":
      target.push("sys:processes", "sys:cpu");
      break;
    default:
      target.push("sys:cpu", "sys:memory", "sys:alerts");
      break;
  }
  return target;
}

export function syntheticWorkbenchSourcesInto(
  target: SourceFrame[],
  id: string,
  group: WorkbenchSyntheticGroup,
  phase: number,
): SourceFrame[] {
  const seed = stringSeed(id);
  target.length = 3;
  target[0] = syntheticWorkbenchSourceFrame(
    id,
    group,
    "primary",
    group,
    group === "Monitor" ? "signal" : "phosphor",
    seed % 29,
    phase,
    0,
  );
  target[1] = syntheticWorkbenchSourceFrame(id, group, "secondary", "Harmonic", "violet", seed % 41, phase, 1);
  target[2] = syntheticWorkbenchSourceFrame(
    id,
    group,
    "noise",
    "Noise",
    seed % 2 === 0 ? "amber" : "alarm",
    seed % 17,
    phase,
    2,
  );
  return target;
}

export function syntheticWorkbenchSystem(
  phase: number,
  group: WorkbenchSyntheticGroup,
  options: SyntheticWorkbenchSystemOptions = {},
): SystemSnapshot {
  const hot = unitWave(phase, 0.07, group === "Monitor" ? 0.1 : 0.33);
  const warm = unitWave(phase, 0.045, 0.55);
  const cpuCoreCount = Math.max(1, options.cpuCoreCount ?? globalThis.navigator?.hardwareConcurrency ?? 1);
  const cpuCores = new Array<SystemSnapshot["cpuCores"][number]>(cpuCoreCount);
  for (let index = 0; index < cpuCoreCount; index++) {
    cpuCores[index] = {
      label: String(index),
      usage: unitWave(phase + index * 7, 0.06, index * 0.13) * 100,
    };
  }
  const processes = new Array<SystemSnapshot["processes"][number]>(8);
  const processNames = ["deno", "webgpu", "worker", "renderer", "scheduler", "cache", "input", "theme"];
  for (let index = 0; index < processes.length; index++) {
    processes[index] = {
      pid: 4200 + index,
      name: processNames[index] ?? "task",
      state: index % 3 === 0 ? "run" : "sleep",
      cpuPercent: unitWave(phase + index, 0.09, index * 0.2) * 80,
      memoryPercent: unitWave(phase + index, 0.05, index * 0.15) * 18,
      memoryBytes: (128 + index * 64) * 1024 ** 2,
      processor: index % cpuCoreCount,
    };
  }

  return {
    timestamp: options.timestamp ?? Date.now(),
    hostname: "workbench",
    osRelease: "demo",
    uptimeSeconds: phase,
    loadavg: [hot * 2.4, warm * 1.8, Math.max(hot, warm)],
    cpuOverall: hot * 100,
    cpuCores,
    cpuHistory: waveSeries(72, phase, 0.07, 0.03, 100),
    gpu: {
      available: true,
      name: "Workbench RTX",
      utilizationPercent: hot * 100,
      memoryUsed: warm * 18 * 1024 ** 3,
      memoryTotal: 24 * 1024 ** 3,
      memoryPercent: warm * 75,
      temperatureCelsius: 34 + hot * 48,
      powerWatts: 90 + hot * 230,
      graphicsClockMhz: 1500 + hot * 1050,
      memoryClockMhz: 9000 + warm * 1500,
    },
    gpuUtilizationHistory: waveSeries(72, phase, 0.075, 0.31),
    gpuMemoryHistory: waveSeries(72, phase, 0.042, 0.62),
    memory: {
      total: 32 * 1024 ** 3,
      used: warm * 26 * 1024 ** 3,
      available: (1 - warm) * 26 * 1024 ** 3,
      free: (1 - warm) * 18 * 1024 ** 3,
      swapTotal: 8 * 1024 ** 3,
      swapUsed: hot * 2 * 1024 ** 3,
      percent: warm * 100,
      swapPercent: hot * 25,
    },
    memoryHistory: waveSeries(72, phase, 0.045, 0.21),
    swapHistory: waveSeries(72, phase, 0.038, 0.49, 0.35),
    temperatures: [
      { label: "CPU", celsius: 38 + hot * 50 },
      { label: "GPU", celsius: 35 + warm * 46 },
    ],
    disks: [
      {
        filesystem: "/dev/nvme0n1",
        mount: "/",
        total: 1024 * 1024 ** 3,
        used: warm * 820 * 1024 ** 3,
        available: (1 - warm) * 820 * 1024 ** 3,
        percent: Math.round(warm * 100),
      },
    ],
    networks: [
      {
        name: "eth0",
        addresses: ["10.0.0.2"],
        rxBytes: phase * 95_000,
        txBytes: phase * 72_000,
        rxRate: hot * 95_000_000,
        txRate: warm * 72_000_000,
      },
    ],
    rxHistory: waveSeries(72, phase, 0.1, 0.2),
    txHistory: waveSeries(72, phase, 0.085, 0.4),
    processes,
    alerts: hot > 0.92 ? [{ severity: "warning", title: "WORKBENCH", detail: "LOAD SPIKE" }] : [],
    diagnostics: [],
  };
}

export function createMatrix(width: number, height: number, fill = " ") {
  const matrix = new Array<string[]>(Math.max(0, height));
  const columns = Math.max(0, width);
  for (let row = 0; row < matrix.length; row += 1) {
    matrix[row] = new Array<string>(columns).fill(fill);
  }
  return matrix;
}

export function renderMatrix(matrix: string[][]) {
  let output = "";
  for (let row = 0; row < matrix.length; row += 1) {
    if (row > 0) output += "\n";
    output += matrix[row]!.join("");
  }
  return output;
}

export function setCell(matrix: string[][], x: number, y: number, char: string) {
  const row = matrix[y];
  if (!row || x < 0 || x >= row.length) {
    return;
  }
  row[x] = char;
}

function syntheticWorkbenchSourceFrame(
  id: string,
  group: WorkbenchSyntheticGroup,
  sourceId: string,
  name: string,
  accent: Accent,
  offset: number,
  phase: number,
  index: number,
): SourceFrame {
  const series = waveSeries(72, phase + offset, 0.08 + index * 0.025, 0.11 + index * 0.07);
  const value = series.at(-1) ?? 0.5;
  return {
    id: `workbench:${id}:${sourceId}`,
    name,
    accent,
    value,
    series,
    detailLines: [`${Math.round(value * 100)}%`, group],
  };
}

export function drawLine(matrix: string[][], x1: number, y1: number, x2: number, y2: number, char: string) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(x1 + ((x2 - x1) * step) / steps);
    const y = Math.round(y1 + ((y2 - y1) * step) / steps);
    setCell(matrix, x, y, char);
  }
}

export function drawEllipse(
  matrix: string[][],
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  glyph: string,
) {
  const steps = Math.max(24, Math.round(Math.max(radiusX, radiusY) * 8));
  for (let step = 0; step < steps; step += 1) {
    const theta = (step / steps) * Math.PI * 2;
    const x = Math.round(centerX + Math.cos(theta) * radiusX);
    const y = Math.round(centerY + Math.sin(theta) * radiusY);
    setCell(matrix, x, y, glyph);
  }
}
