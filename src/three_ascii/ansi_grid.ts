// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

import {
  ASCII_FILL_GLYPHS,
  blockFillGlyphForBucket,
  EDGE_GLYPHS,
  FILL_GLYPHS,
  type TerminalGlyphStyle,
} from "./glyphs.ts";

const TILE_PIXEL_COUNT = 64;
const DEFAULT_TERMINAL_EDGE_BIAS = 1;
const RESET = "\x1b[0m";
const GOHU_11_EDGE_SHAPE_MISMATCH = [0, 3, 10, 9] as const;
const GOHU_11_FILL_GLYPH_COVERAGE = [0, 2, 4, 6, 9, 11, 13, 15, 18, 18] as const;
const ASCII_FILL_GLYPH_COVERAGE = [0, 1, 2, 4, 6, 8, 10, 13, 16, 18] as const;
const MIXED_FILL_GLYPHS_BY_INDEX = createMixedFillGlyphTable();
const CELL_GLYPH_KEY_STRIDE = 64;
const GLYPH_KEY_GLYPHS_OFFSET = 16;
const GLYPH_KEY_MIXED_OFFSET = 32;
const EDGE_GLYPH_KEY_OFFSET = 48;
const GLYPHS_BY_KEY = createGlyphKeyTable();

/** Input buffers for assembling a terminal ANSI grid from three Ascii GPU readback data. */
export interface ThreeAsciiAnsiGridInput {
  columns: number;
  rows: number;
  fillGlyphs: ArrayLike<number>;
  edgeGlyphs?: ArrayLike<number>;
  colors: ArrayLike<number>;
  terminalGlyphStyle?: TerminalGlyphStyle;
  terminalEdgeBias?: number;
  backgroundColor?: Color | string | number;
}

/** Reusable ANSI grid assembler that keeps color and cell string caches warm across frames. */
export class ThreeAsciiAnsiGridAssembler {
  private readonly toByte = createLinearByteCache();
  private readonly foregroundAnsiCache = new Map<number, string>();
  private readonly cellCache = new Map<number, string>();
  private readonly reuseGrid: boolean;
  private reusableGrid: string[][] = [];
  private backgroundKey = -1;
  private backgroundAnsi = "";
  private blankAnsi = "";
  private backgroundRed = 0;
  private backgroundGreen = 0;
  private backgroundBlue = 0;

  constructor(options: { reuseGrid?: boolean } = {}) {
    this.reuseGrid = options.reuseGrid ?? false;
  }

  build(input: ThreeAsciiAnsiGridInput): string[][] {
    const columns = Math.max(0, Math.floor(input.columns));
    const rows = Math.max(0, Math.floor(input.rows));
    const fillGlyphs = input.fillGlyphs;
    const edgeGlyphs = input.edgeGlyphs;
    const hasEdges = edgeGlyphs !== undefined;
    const colors = input.colors;
    const terminalGlyphStyle = input.terminalGlyphStyle ?? "blocks";
    const terminalEdgeBias = Math.max(0.5, input.terminalEdgeBias ?? DEFAULT_TERMINAL_EDGE_BIAS);
    this.setBackground(colorValue(input.backgroundColor, 0x000000));
    let lastForegroundKey = -1;
    let lastGlyphKey = -1;
    let lastCell = "";
    let lastRawRed = Number.NaN;
    let lastRawGreen = Number.NaN;
    let lastRawBlue = Number.NaN;
    const grid = this.reuseGrid ? this.prepareReusableGrid(rows, columns) : createStringGrid(rows, columns);

    if (!hasEdges) {
      return this.buildFillOnlyGrid(
        grid,
        columns,
        rows,
        fillGlyphs,
        colors,
        terminalGlyphStyle,
        lastForegroundKey,
        lastGlyphKey,
        lastCell,
        lastRawRed,
        lastRawGreen,
        lastRawBlue,
      );
    }

    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];

      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const fillGlyphIndex = Math.round(fillGlyphs[index] ?? 0);
        let edgeGlyphIndex = 0;
        let dominantCount = 0;
        let totalCount = 0;
        let secondCount = 0;
        if (hasEdges) {
          const edgeOffset = index * 4;
          edgeGlyphIndex = Math.round(edgeGlyphs[edgeOffset] ?? 0);
          dominantCount = edgeGlyphs[edgeOffset + 1] ?? 0;
          totalCount = edgeGlyphs[edgeOffset + 2] ?? 0;
          secondCount = edgeGlyphs[edgeOffset + 3] ?? 0;
        }

        if (fillGlyphIndex < 5 && (!hasEdges || edgeGlyphIndex <= 0 || dominantCount <= 0 || totalCount <= 0)) {
          outputRow[column] = this.blankAnsi;
          continue;
        }

        const glyphKey = terminalGlyphForCell(
          terminalGlyphStyle,
          edgeGlyphIndex,
          dominantCount,
          totalCount,
          secondCount,
          fillGlyphIndex,
          terminalEdgeBias,
        );

        const colorOffset = index * 4;
        const rawRed = colors[colorOffset] ?? 0;
        const rawGreen = colors[colorOffset + 1] ?? 0;
        const rawBlue = colors[colorOffset + 2] ?? 0;
        if (
          rawRed === lastRawRed && rawGreen === lastRawGreen && rawBlue === lastRawBlue && glyphKey === lastGlyphKey
        ) {
          outputRow[column] = lastCell;
          continue;
        }

        let foregroundRed = this.toByte(rawRed);
        let foregroundGreen = this.toByte(rawGreen);
        let foregroundBlue = this.toByte(rawBlue);
        if (
          terminalGlyphStyle === "blocks" && glyphKey > 0 && glyphKey < GLYPH_KEY_GLYPHS_OFFSET && fillGlyphIndex < 14
        ) {
          const amount = fillBucketFromGlyphIndex(fillGlyphIndex) / 9;
          foregroundRed = mixByteChannel(this.backgroundRed, foregroundRed, amount);
          foregroundGreen = mixByteChannel(this.backgroundGreen, foregroundGreen, amount);
          foregroundBlue = mixByteChannel(this.backgroundBlue, foregroundBlue, amount);
        }

        const foregroundKey = (foregroundRed << 16) | (foregroundGreen << 8) | foregroundBlue;
        if (foregroundKey === lastForegroundKey && glyphKey === lastGlyphKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const cell = this.cellFor(foregroundKey, foregroundRed, foregroundGreen, foregroundBlue, glyphKey);

        lastForegroundKey = foregroundKey;
        lastGlyphKey = glyphKey;
        lastCell = cell;
        lastRawRed = rawRed;
        lastRawGreen = rawGreen;
        lastRawBlue = rawBlue;

        outputRow[column] = cell;
      }
    }

    return grid;
  }

  clear(): void {
    this.foregroundAnsiCache.clear();
    this.cellCache.clear();
    this.reusableGrid = [];
    this.backgroundKey = -1;
    this.backgroundAnsi = "";
    this.blankAnsi = "";
  }

  private buildFillOnlyGrid(
    grid: string[][],
    columns: number,
    rows: number,
    fillGlyphs: ArrayLike<number>,
    colors: ArrayLike<number>,
    terminalGlyphStyle: TerminalGlyphStyle,
    lastForegroundKey: number,
    lastGlyphKey: number,
    lastCell: string,
    lastRawRed: number,
    lastRawGreen: number,
    lastRawBlue: number,
  ): string[][] {
    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];

      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const fillGlyphIndex = Math.round(fillGlyphs[index] ?? 0);
        if (fillGlyphIndex < 5) {
          outputRow[column] = this.blankAnsi;
          continue;
        }

        const glyphKey = terminalFillGlyphForCell(terminalGlyphStyle, fillGlyphIndex);
        const colorOffset = index * 4;
        const rawRed = colors[colorOffset] ?? 0;
        const rawGreen = colors[colorOffset + 1] ?? 0;
        const rawBlue = colors[colorOffset + 2] ?? 0;
        if (
          rawRed === lastRawRed && rawGreen === lastRawGreen && rawBlue === lastRawBlue && glyphKey === lastGlyphKey
        ) {
          outputRow[column] = lastCell;
          continue;
        }

        let foregroundRed = this.toByte(rawRed);
        let foregroundGreen = this.toByte(rawGreen);
        let foregroundBlue = this.toByte(rawBlue);
        if (
          terminalGlyphStyle === "blocks" && glyphKey > 0 && glyphKey < GLYPH_KEY_GLYPHS_OFFSET && fillGlyphIndex < 14
        ) {
          const amount = fillBucketFromGlyphIndex(fillGlyphIndex) / 9;
          foregroundRed = mixByteChannel(this.backgroundRed, foregroundRed, amount);
          foregroundGreen = mixByteChannel(this.backgroundGreen, foregroundGreen, amount);
          foregroundBlue = mixByteChannel(this.backgroundBlue, foregroundBlue, amount);
        }

        const foregroundKey = (foregroundRed << 16) | (foregroundGreen << 8) | foregroundBlue;
        if (foregroundKey === lastForegroundKey && glyphKey === lastGlyphKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const cell = this.cellFor(foregroundKey, foregroundRed, foregroundGreen, foregroundBlue, glyphKey);
        lastForegroundKey = foregroundKey;
        lastGlyphKey = glyphKey;
        lastCell = cell;
        lastRawRed = rawRed;
        lastRawGreen = rawGreen;
        lastRawBlue = rawBlue;

        outputRow[column] = cell;
      }
    }

    return grid;
  }

  private cellFor(
    foregroundKey: number,
    foregroundRed: number,
    foregroundGreen: number,
    foregroundBlue: number,
    glyphKey: number,
  ): string {
    const cellKey = foregroundKey * CELL_GLYPH_KEY_STRIDE + glyphKey;
    let cell = this.cellCache.get(cellKey);
    if (cell !== undefined) return cell;

    let foregroundAnsi = this.foregroundAnsiCache.get(foregroundKey);
    if (foregroundAnsi === undefined) {
      foregroundAnsi = rgbToAnsiForeground(foregroundRed, foregroundGreen, foregroundBlue);
      this.foregroundAnsiCache.set(foregroundKey, foregroundAnsi);
    }

    cell = `${this.backgroundAnsi}${foregroundAnsi}${glyphForKey(glyphKey)}${RESET}`;
    this.cellCache.set(cellKey, cell);
    return cell;
  }

  private prepareReusableGrid(rows: number, columns: number): string[][] {
    const grid = this.reusableGrid;
    grid.length = rows;
    for (let row = 0; row < rows; row += 1) {
      grid[row] ??= [];
      grid[row].length = columns;
    }
    return grid;
  }

  private setBackground(backgroundColor: Color): void {
    const [backgroundRed, backgroundGreen, backgroundBlue] = colorToBytes(backgroundColor);
    const backgroundKey = (backgroundRed << 16) | (backgroundGreen << 8) | backgroundBlue;
    if (backgroundKey === this.backgroundKey) {
      return;
    }

    this.backgroundKey = backgroundKey;
    this.backgroundRed = backgroundRed;
    this.backgroundGreen = backgroundGreen;
    this.backgroundBlue = backgroundBlue;
    this.backgroundAnsi = rgbToAnsiBackground(backgroundRed, backgroundGreen, backgroundBlue);
    const backgroundForeground = rgbToAnsiForeground(backgroundRed, backgroundGreen, backgroundBlue);
    this.blankAnsi = `${this.backgroundAnsi}${backgroundForeground} ${RESET}`;
    this.cellCache.clear();
  }
}

/** Builds the terminal ANSI cell grid for a three Ascii frame. */
export function buildThreeAsciiAnsiGrid(input: ThreeAsciiAnsiGridInput): string[][] {
  return new ThreeAsciiAnsiGridAssembler().build(input);
}

export function colorValue(input: Color | string | number | undefined, fallback: number): Color {
  return input instanceof Color ? input : new Color(input ?? fallback);
}

function createStringGrid(rows: number, columns: number): string[][] {
  const grid = new Array<string[]>(rows);
  for (let row = 0; row < rows; row += 1) {
    grid[row] = new Array<string>(columns);
  }
  return grid;
}

function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function linearUnitToByte(value: number): number {
  return Math.round(linearToSrgb(value) * 255);
}

function createLinearByteCache(): (value: number) => number {
  const cache = new Map<number, number>();
  return (value: number): number => {
    const cached = cache.get(value);
    if (cached !== undefined) return cached;
    const byte = linearUnitToByte(value);
    cache.set(value, byte);
    return byte;
  };
}

function colorToBytes(color: Color): [number, number, number] {
  return [
    linearUnitToByte(color.r),
    linearUnitToByte(color.g),
    linearUnitToByte(color.b),
  ];
}

function rgbToAnsiForeground(red: number, green: number, blue: number): string {
  return `\x1b[38;2;${red};${green};${blue}m`;
}

function rgbToAnsiBackground(red: number, green: number, blue: number): string {
  return `\x1b[48;2;${red};${green};${blue}m`;
}

function mixByteChannel(left: number, right: number, amount: number): number {
  return Math.round(left + (right - left) * clampUnit(amount));
}

function fillBucketFromGlyphIndex(index: number): number {
  return Math.max(0, Math.min(FILL_GLYPHS.length - 1, index - 5));
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function fillCoverageForGohu11(fillGlyphIndex: number): number {
  if (fillGlyphIndex < 5) {
    return 0;
  }

  const bucket = Math.max(0, Math.min(GOHU_11_FILL_GLYPH_COVERAGE.length - 1, fillGlyphIndex - 5));
  return GOHU_11_FILL_GLYPH_COVERAGE[bucket] / TILE_PIXEL_COUNT;
}

function fillCoverageForAscii(fillBucket: number): number {
  const bucket = Math.max(0, Math.min(ASCII_FILL_GLYPH_COVERAGE.length - 1, fillBucket));
  return ASCII_FILL_GLYPH_COVERAGE[bucket] / TILE_PIXEL_COUNT;
}

function createMixedFillGlyphTable(): string[] {
  const table = new Array<string>(FILL_GLYPHS.length + 5);
  for (let fillGlyphIndex = 0; fillGlyphIndex < table.length; fillGlyphIndex++) {
    const bucket = fillBucketFromGlyphIndex(fillGlyphIndex);
    const targetCoverage = fillCoverageForGohu11(fillGlyphIndex);
    let bestGlyph = " ";
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < FILL_GLYPHS.length; index++) {
      const score = mixedFillGlyphScore(
        (GOHU_11_FILL_GLYPH_COVERAGE[index] ?? 0) / TILE_PIXEL_COUNT,
        index,
        bucket,
        targetCoverage,
        0,
      );
      if (score < bestScore) {
        bestScore = score;
        bestGlyph = FILL_GLYPHS[index] ?? " ";
      }
    }

    for (let index = 0; index < ASCII_FILL_GLYPHS.length; index++) {
      const score = mixedFillGlyphScore(fillCoverageForAscii(index), index, bucket, targetCoverage, 0.002);
      if (score < bestScore) {
        bestScore = score;
        bestGlyph = ASCII_FILL_GLYPHS[index] ?? " ";
      }
    }

    table[fillGlyphIndex] = bestGlyph;
  }
  return table;
}

function mixedFillGlyphScore(
  coverage: number,
  index: number,
  bucket: number,
  targetCoverage: number,
  familyBias: number,
): number {
  return Math.abs(coverage - targetCoverage) + Math.abs(index - bucket) * 0.001 + familyBias;
}

function createGlyphKeyTable(): string[] {
  const table = Array<string>(CELL_GLYPH_KEY_STRIDE).fill(" ");
  for (let index = 0; index < FILL_GLYPHS.length + 5; index += 1) {
    const bucket = fillBucketFromGlyphIndex(index);
    table[index] = blockFillGlyphForBucket(bucket);
    table[GLYPH_KEY_GLYPHS_OFFSET + index] = ASCII_FILL_GLYPHS[bucket] ?? " ";
    table[GLYPH_KEY_MIXED_OFFSET + index] = MIXED_FILL_GLYPHS_BY_INDEX[index] ?? " ";
  }
  for (let index = 0; index < EDGE_GLYPHS.length; index += 1) {
    table[EDGE_GLYPH_KEY_OFFSET + index] = EDGE_GLYPHS[index] ?? " ";
  }
  return table;
}

function glyphForKey(key: number): string {
  return GLYPHS_BY_KEY[Math.max(0, Math.min(GLYPHS_BY_KEY.length - 1, key))] ?? " ";
}

function pickMixedFillGlyph(fillGlyphIndex: number): number {
  const index = Math.max(0, Math.min(MIXED_FILL_GLYPHS_BY_INDEX.length - 1, fillGlyphIndex));
  return GLYPH_KEY_MIXED_OFFSET + index;
}

function terminalFillGlyphForCell(style: TerminalGlyphStyle, fillGlyphIndex: number): number {
  const bucket = fillBucketFromGlyphIndex(fillGlyphIndex);
  switch (style) {
    case "glyphs":
      return GLYPH_KEY_GLYPHS_OFFSET + bucket;
    case "mixed":
      return pickMixedFillGlyph(fillGlyphIndex);
    default:
      return bucket;
  }
}

function terminalGlyphForCell(
  style: TerminalGlyphStyle,
  edgeGlyphIndex: number,
  dominantCount: number,
  totalCount: number,
  secondCount: number,
  fillGlyphIndex: number,
  edgeBias: number,
): number {
  const edgeCandidate = shouldUseGohu11EdgeGlyph(
    edgeGlyphIndex,
    dominantCount,
    totalCount,
    secondCount,
    fillGlyphIndex,
    edgeBias,
  );

  if (edgeCandidate) {
    const edgeIndex = Math.max(0, Math.min(EDGE_GLYPHS.length - 1, edgeGlyphIndex));
    return EDGE_GLYPH_KEY_OFFSET + edgeIndex;
  }

  return terminalFillGlyphForCell(style, fillGlyphIndex);
}

function shouldUseGohu11EdgeGlyph(
  edgeGlyphIndex: number,
  dominantCount: number,
  totalCount: number,
  secondCount: number,
  fillGlyphIndex: number,
  edgeBias = DEFAULT_TERMINAL_EDGE_BIAS,
): boolean {
  const direction = edgeGlyphIndex - 1;
  if (direction < 0 || direction >= GOHU_11_EDGE_SHAPE_MISMATCH.length || dominantCount <= 0 || totalCount <= 0) {
    return false;
  }

  // Gohu 11 matches the LUT vertical/horizontal marks reasonably well, but
  // the diagonal glyphs are visually louder and a poorer bitmap match. Bias
  // edge promotion toward clearly dominant, well-separated edge buckets.
  const mismatchWeight = GOHU_11_EDGE_SHAPE_MISMATCH[direction] / 48;
  const directionShare = dominantCount / totalCount;
  const separation = secondCount > 0 ? (dominantCount - secondCount) / dominantCount : 1;
  const dominantCoverage = dominantCount / TILE_PIXEL_COUNT;
  const fillCoverage = fillCoverageForGohu11(fillGlyphIndex);
  const clampedBias = Math.max(0.5, edgeBias);
  const biasOffset = clampedBias - 1;

  const minShare = 0.54 + mismatchWeight * 0.6 + biasOffset * 0.12;
  const minSeparation = 0.12 + mismatchWeight * 0.55 + biasOffset * 0.18;
  const minCoverage = 0.09 + fillCoverage * 0.14 + mismatchWeight * 0.08 + biasOffset * 0.06;

  return (
    directionShare >= clampUnit(minShare) &&
    separation >= clampUnit(minSeparation) &&
    dominantCoverage >= clampUnit(minCoverage)
  );
}
