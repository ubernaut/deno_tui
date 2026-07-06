import { clamp } from "./styles.ts";
import { sampleSeries, type VisualizationDrive } from "./visualization_drive.ts";
import type { Accent, RenderContext, Severity, SourceFrame } from "./types.ts";

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
