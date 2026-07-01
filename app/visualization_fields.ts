import { clamp } from "./styles.ts";
import { moduloUnit } from "./visualization_drive.ts";
import type { VisualizationDrive } from "./visualization_drive.ts";
import { clampInt, createMatrix, drawEllipse, drawLine, renderMatrix, setCell } from "./visualization_primitives.ts";

export function harmonicField(width: number, height: number, drive: VisualizationDrive, glyph: string) {
  const matrix = createMatrix(width, height, " ");
  const spacing = Math.max(3, 7 - Math.round(drive.divergence * 4));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x + y + Math.floor(drive.phase * 0.25)) % spacing === 0) {
        setCell(matrix, x, y, "·");
      }
    }
  }

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const amplitudeX = Math.max(3, Math.floor(width * (0.16 + drive.current * 0.24 + drive.divergence * 0.08)));
  const amplitudeY = Math.max(2, Math.floor(height * (0.18 + drive.density * 0.26)));
  const traces = Math.max(2, Math.min(4, drive.activeCount + 1));

  for (let trace = 0; trace < traces; trace += 1) {
    const source = drive.sources[trace % drive.sources.length]!;
    let previousX = centerX;
    let previousY = centerY;
    for (let step = 0; step < Math.max(width * 2, 48); step += 1) {
      const t = (step / Math.max(width * 2 - 1, 1)) * Math.PI * 2;
      const phase = drive.phase * 0.04 + trace * 0.9 + source.normalizedValue * 1.6;
      const x = Math.round(
        centerX +
          Math.sin(t * (2 + drive.cadence * 2 + trace * 0.25) + phase) * amplitudeX * (0.72 + trace * 0.08),
      );
      const y = Math.round(
        centerY +
          Math.sin(t * (3 + drive.divergence * 2.5) - phase) * amplitudeY +
          Math.cos(t * (1.5 + source.volatility * 3) + phase) * amplitudeY * 0.34,
      );
      drawLine(matrix, previousX, previousY, x, y, glyph);
      previousX = x;
      previousY = y;
    }
  }

  return renderMatrix(matrix);
}

export function psychograph(width: number, height: number, drive: VisualizationDrive, glyph: string) {
  const matrix = createMatrix(width, height, " ");
  const drift = drive.current * 0.9 + drive.volatility * 0.8;
  let previousX = 0;
  let previousY = Math.floor(height / 2);
  for (let x = 0; x < width; x += 1) {
    const local = drive.pulseSeries[x % drive.pulseSeries.length] ?? drive.current;
    const y = Math.round(
      height / 2 +
        Math.sin(x * (0.26 + drive.cadence * 0.24) + drive.phase * 0.13) * (height * 0.18 + drift * 2.4) +
        Math.cos(x * (0.09 + drive.divergence * 0.18) - drive.phase * 0.07) * (height * 0.1 + local * 2.2) +
        Math.sin(x * 0.51 + drive.phase * 0.17) * drive.volatility * 2.6,
    );
    drawLine(matrix, previousX, previousY, x, y, glyph);
    if ((x + drive.phase) % Math.max(5, 11 - Math.round(drive.volatility * 8)) === 0) {
      setCell(matrix, x, clampInt(y + Math.round(local * 2 - 1), 0, height - 1), "•");
    }
    previousX = x;
    previousY = y;
  }
  return renderMatrix(matrix);
}

export function circularField(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const outerX = Math.max(4, Math.floor(width * (0.2 + drive.current * 0.12 + drive.divergence * 0.08)));
  const outerY = Math.max(2, Math.floor(height * (0.26 + drive.density * 0.12)));
  const ringCount = Math.max(2, Math.min(4, 2 + Math.round(drive.hazard * 2)));

  for (let ring = 0; ring < ringCount; ring += 1) {
    const inset = ring * 2;
    drawEllipse(
      matrix,
      centerX,
      centerY,
      Math.max(2, outerX - inset),
      Math.max(1, outerY - Math.floor(inset / 2)),
      ring === ringCount - 1 ? "◎" : "◌",
    );
  }

  drawLine(
    matrix,
    centerX,
    Math.max(0, centerY - outerY - 2),
    centerX,
    Math.min(height - 1, centerY + outerY + 2),
    "│",
  );
  drawLine(matrix, Math.max(0, centerX - outerX - 4), centerY, Math.min(width - 1, centerX + outerX + 4), centerY, "─");
  drawLine(
    matrix,
    Math.max(0, centerX - outerX),
    Math.max(0, centerY - outerY),
    Math.min(width - 1, centerX + outerX),
    Math.min(height - 1, centerY + outerY),
    "╱",
  );
  drawLine(
    matrix,
    Math.max(0, centerX - outerX),
    Math.min(height - 1, centerY + outerY),
    Math.min(width - 1, centerX + outerX),
    Math.max(0, centerY - outerY),
    "╲",
  );
  setCell(matrix, centerX, centerY, drive.hazard >= 0.88 ? "█" : "◆");
  return renderMatrix(matrix);
}

export function heatmap(width: number, height: number, drive: VisualizationDrive, glyphs: readonly string[]) {
  const matrix = createMatrix(width, height, " ");
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const seed = drive.normalizedSeries[(x + y) % drive.normalizedSeries.length] ?? drive.current;
      const pulse = drive.pulseSeries[(x * 2 + y) % drive.pulseSeries.length] ?? drive.current;
      const spread = drive.spreadSeries[(x + y * 2) % drive.spreadSeries.length] ?? drive.divergence;
      const value = clamp(
        seed * 0.42 +
          pulse * 0.24 +
          spread * 0.16 +
          ((Math.sin((x + drive.phase) * (0.13 + drive.cadence * 0.08)) +
              Math.cos((y - drive.phase) * (0.21 + drive.volatility * 0.12)) +
              2) / 4) * 0.18,
        0,
        1,
      );
      const glyphIndex = Math.min(glyphs.length - 1, Math.floor(value * glyphs.length));
      setCell(matrix, x, y, glyphs[glyphIndex] ?? glyphs[glyphs.length - 1] ?? "#");
    }
  }
  return renderMatrix(matrix);
}

export function routeBoard(width: number, rows: number, drive: VisualizationDrive, glyphs: readonly string[]) {
  const matrix = createMatrix(width, rows, " ");
  const lanes = Math.max(2, Math.min(4, drive.sources.length + 1));
  for (let row = 0; row < rows; row += 1) {
    const source = drive.sources[row % drive.sources.length] ?? drive.primary;
    const spread = drive.spreadSeries[row % drive.spreadSeries.length] ?? drive.divergence;
    const limit = Math.floor(
      clamp(source.normalizedSeries[row % source.normalizedSeries.length] * 0.72 + spread * 0.28, 0, 1) * (width - 1),
    );
    const cursor = Math.floor(moduloUnit(drive.scan + row / Math.max(rows, 1) + source.slope * 0.25) * (width - 1));
    for (let column = 0; column < width; column += 1) {
      const onLane = (row + column + lanes) % Math.max(3, lanes + 1) === 0;
      const filled = column <= limit;
      const glyph = column === cursor
        ? "█"
        : filled
        ? glyphs[glyphs.length - 1] ?? "#"
        : onLane
        ? glyphs[2] ?? "▂"
        : glyphs[1] ?? ".";
      setCell(matrix, column, row, glyph);
    }
  }
  return renderMatrix(matrix);
}
