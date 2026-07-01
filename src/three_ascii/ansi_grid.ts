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
  private readonly cellCache = new Map<number, Map<string, string>>();
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
    let lastGlyph = "";
    let lastCell = "";
    const grid = this.reuseGrid ? this.prepareReusableGrid(rows, columns) : createStringGrid(rows, columns);

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

        const glyph = hasEdges
          ? terminalGlyphForCell(
            terminalGlyphStyle,
            edgeGlyphIndex,
            dominantCount,
            totalCount,
            secondCount,
            fillGlyphIndex,
            terminalEdgeBias,
          )
          : terminalFillGlyphForCell(terminalGlyphStyle, fillGlyphIndex);

        const colorOffset = index * 4;
        let foregroundRed = this.toByte(colors[colorOffset] ?? 0);
        let foregroundGreen = this.toByte(colors[colorOffset + 1] ?? 0);
        let foregroundBlue = this.toByte(colors[colorOffset + 2] ?? 0);
        if (terminalGlyphStyle === "blocks" && glyph === "█" && fillGlyphIndex < 14) {
          const amount = fillBucketFromGlyphIndex(fillGlyphIndex) / 9;
          foregroundRed = mixByteChannel(this.backgroundRed, foregroundRed, amount);
          foregroundGreen = mixByteChannel(this.backgroundGreen, foregroundGreen, amount);
          foregroundBlue = mixByteChannel(this.backgroundBlue, foregroundBlue, amount);
        }

        const foregroundKey = (foregroundRed << 16) | (foregroundGreen << 8) | foregroundBlue;
        if (foregroundKey === lastForegroundKey && glyph === lastGlyph) {
          outputRow[column] = lastCell;
          continue;
        }

        let foregroundAnsi = this.foregroundAnsiCache.get(foregroundKey);
        if (foregroundAnsi === undefined) {
          foregroundAnsi = rgbToAnsiForeground(foregroundRed, foregroundGreen, foregroundBlue);
          this.foregroundAnsiCache.set(foregroundKey, foregroundAnsi);
        }

        let glyphCells = this.cellCache.get(foregroundKey);
        if (glyphCells === undefined) {
          glyphCells = new Map<string, string>();
          this.cellCache.set(foregroundKey, glyphCells);
        }
        let cell = glyphCells.get(glyph);
        if (cell === undefined) {
          cell = `${this.backgroundAnsi}${foregroundAnsi}${glyph}${RESET}`;
          glyphCells.set(glyph, cell);
        }

        lastForegroundKey = foregroundKey;
        lastGlyph = glyph;
        lastCell = cell;

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
  return Array.from({ length: rows }, () => Array<string>(columns));
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
  const candidates = [
    ...FILL_GLYPHS.map((glyph, index) => ({
      glyph,
      coverage: (GOHU_11_FILL_GLYPH_COVERAGE[index] ?? 0) / TILE_PIXEL_COUNT,
      index,
      familyBias: 0,
    })),
    ...ASCII_FILL_GLYPHS.map((glyph, index) => ({
      glyph,
      coverage: fillCoverageForAscii(index),
      index,
      familyBias: 0.002,
    })),
  ];

  return Array.from({ length: FILL_GLYPHS.length + 5 }, (_, fillGlyphIndex) => {
    const bucket = fillBucketFromGlyphIndex(fillGlyphIndex);
    const targetCoverage = fillCoverageForGohu11(fillGlyphIndex);
    return candidates.reduce((best, candidate) => {
      const bestScore = Math.abs(best.coverage - targetCoverage) + Math.abs(best.index - bucket) * 0.001 +
        best.familyBias;
      const candidateScore = Math.abs(candidate.coverage - targetCoverage) +
        Math.abs(candidate.index - bucket) * 0.001 +
        candidate.familyBias;
      return candidateScore < bestScore ? candidate : best;
    }).glyph;
  });
}

function pickMixedFillGlyph(fillGlyphIndex: number): string {
  return MIXED_FILL_GLYPHS_BY_INDEX[Math.max(0, Math.min(MIXED_FILL_GLYPHS_BY_INDEX.length - 1, fillGlyphIndex))] ??
    " ";
}

function terminalFillGlyphForCell(style: TerminalGlyphStyle, fillGlyphIndex: number): string {
  const bucket = fillBucketFromGlyphIndex(fillGlyphIndex);
  switch (style) {
    case "glyphs":
      return ASCII_FILL_GLYPHS[bucket] ?? " ";
    case "mixed":
      return pickMixedFillGlyph(fillGlyphIndex);
    default:
      return blockFillGlyphForBucket(bucket);
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
): string {
  const edgeCandidate = shouldUseGohu11EdgeGlyph(
    edgeGlyphIndex,
    dominantCount,
    totalCount,
    secondCount,
    fillGlyphIndex,
    edgeBias,
  );

  if (edgeCandidate) {
    return EDGE_GLYPHS[Math.max(0, Math.min(EDGE_GLYPHS.length - 1, edgeGlyphIndex))] ?? " ";
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
