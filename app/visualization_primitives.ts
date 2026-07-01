import { clamp } from "./styles.ts";
import { sampleSeries, type VisualizationDrive } from "./visualization_drive.ts";
import type { Accent } from "./types.ts";

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
  return Array.from(
    { length: rows },
    (_, row) =>
      Array.from({ length: columns }, (_, column) => entries[row + column * rows])
        .filter((value): value is string => Boolean(value))
        .map((value) => crop(value, itemWidth).padEnd(itemWidth, " "))
        .join(" "),
  ).join("\n");
}

export function crop(text: string, width: number) {
  if (text.length <= width) {
    return text;
  }
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

export function createMatrix(width: number, height: number, fill = " ") {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

export function renderMatrix(matrix: string[][]) {
  return matrix.map((row) => row.join("")).join("\n");
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
