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
const MAX_LINEAR_BYTE_CACHE_SIZE = 65536;
const MAX_FOREGROUND_ANSI_CACHE_SIZE = 4096;
const MAX_CELL_CACHE_SIZE = 16384;
const MAX_MIXED_FOREGROUND_CACHE_SIZE = 8192;
const GLYPH_MODE_BLOCKS = 0;
const GLYPH_MODE_GLYPHS = 1;
const GLYPH_MODE_MIXED = 2;

type TerminalGlyphMode = typeof GLYPH_MODE_BLOCKS | typeof GLYPH_MODE_GLYPHS | typeof GLYPH_MODE_MIXED;
const BLOCK_FILL_GLYPH_KEYS_BY_INDEX = createFillGlyphKeyTable(GLYPH_MODE_BLOCKS);
const ASCII_FILL_GLYPH_KEYS_BY_INDEX = createFillGlyphKeyTable(GLYPH_MODE_GLYPHS);
const MIXED_FILL_GLYPH_KEYS_BY_INDEX = createFillGlyphKeyTable(GLYPH_MODE_MIXED);

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
  private readonly mixedForegroundKeyCache = new Map<number, number>();
  private readonly reuseGrid: boolean;
  private reusableGrid: string[][] = [];
  private backgroundKey = -1;
  private backgroundAnsi = "";
  private blankAnsi = "";
  private backgroundRed = 0;
  private backgroundGreen = 0;
  private backgroundBlue = 0;
  private cachedColorRawRed = new Float64Array(0);
  private cachedColorRawGreen = new Float64Array(0);
  private cachedColorRawBlue = new Float64Array(0);
  private cachedColorByteKeys = new Uint32Array(0);
  private stableBackgroundInput: string | number | undefined;
  private hasStableBackgroundInput = false;
  private stableBackgroundColorRef?: Color;
  private stableBackgroundColorRed = Number.NaN;
  private stableBackgroundColorGreen = Number.NaN;
  private stableBackgroundColorBlue = Number.NaN;

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
    const terminalGlyphMode = terminalGlyphModeForStyle(terminalGlyphStyle);
    const terminalFillGlyphKeys = terminalFillGlyphKeysForMode(terminalGlyphMode);
    const terminalEdgeBias = Math.max(0.5, input.terminalEdgeBias ?? DEFAULT_TERMINAL_EDGE_BIAS);
    const cellCount = columns * rows;
    this.setBackground(input.backgroundColor);
    this.prepareColorCache(cellCount);
    this.pruneCaches();
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
        terminalGlyphMode,
        terminalFillGlyphKeys,
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
      const rowOffset = row * columns;

      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const fillGlyphIndex = Math.round(fillGlyphs[index] ?? 0);
        const edgeOffset = index * 4;
        const edgeGlyphIndex = Math.round(edgeGlyphs[edgeOffset] ?? 0);
        const dominantCount = edgeGlyphs[edgeOffset + 1] ?? 0;
        const totalCount = edgeGlyphs[edgeOffset + 2] ?? 0;
        const secondCount = edgeGlyphs[edgeOffset + 3] ?? 0;

        if (fillGlyphIndex < 5 && (edgeGlyphIndex <= 0 || dominantCount <= 0 || totalCount <= 0)) {
          outputRow[column] = this.blankAnsi;
          continue;
        }

        const glyphKey = terminalGlyphForCell(
          terminalFillGlyphKeys,
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

        const foregroundKey = this.foregroundKeyForCell(
          index,
          rawRed,
          rawGreen,
          rawBlue,
          fillGlyphIndex,
          glyphKey,
          terminalGlyphMode,
        );
        if (foregroundKey === lastForegroundKey && glyphKey === lastGlyphKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const foregroundRed = (foregroundKey >> 16) & 0xff;
        const foregroundGreen = (foregroundKey >> 8) & 0xff;
        const foregroundBlue = foregroundKey & 0xff;
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
    this.hasStableBackgroundInput = false;
    this.stableBackgroundInput = undefined;
    this.stableBackgroundColorRef = undefined;
    this.stableBackgroundColorRed = Number.NaN;
    this.stableBackgroundColorGreen = Number.NaN;
    this.stableBackgroundColorBlue = Number.NaN;
    this.cachedColorRawRed = new Float64Array(0);
    this.cachedColorRawGreen = new Float64Array(0);
    this.cachedColorRawBlue = new Float64Array(0);
    this.cachedColorByteKeys = new Uint32Array(0);
    this.toByte.clear();
  }

  private buildFillOnlyGrid(
    grid: string[][],
    columns: number,
    rows: number,
    fillGlyphs: ArrayLike<number>,
    colors: ArrayLike<number>,
    terminalGlyphMode: TerminalGlyphMode,
    terminalFillGlyphKeys: readonly number[],
    lastForegroundKey: number,
    lastGlyphKey: number,
    lastCell: string,
    lastRawRed: number,
    lastRawGreen: number,
    lastRawBlue: number,
  ): string[][] {
    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];
      const rowOffset = row * columns;

      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const fillGlyphIndex = Math.round(fillGlyphs[index] ?? 0);
        if (fillGlyphIndex < 5) {
          outputRow[column] = this.blankAnsi;
          continue;
        }

        const glyphKey = fillGlyphKeyForIndex(terminalFillGlyphKeys, fillGlyphIndex);
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

        const foregroundKey = this.foregroundKeyForCell(
          index,
          rawRed,
          rawGreen,
          rawBlue,
          fillGlyphIndex,
          glyphKey,
          terminalGlyphMode,
        );
        if (foregroundKey === lastForegroundKey && glyphKey === lastGlyphKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const foregroundRed = (foregroundKey >> 16) & 0xff;
        const foregroundGreen = (foregroundKey >> 8) & 0xff;
        const foregroundBlue = foregroundKey & 0xff;
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

  private foregroundKeyForCell(
    index: number,
    rawRed: number,
    rawGreen: number,
    rawBlue: number,
    fillGlyphIndex: number,
    glyphKey: number,
    terminalGlyphMode: TerminalGlyphMode,
  ): number {
    const baseForegroundKey = this.byteColorKeyForIndex(index, rawRed, rawGreen, rawBlue);
    if (
      terminalGlyphMode !== GLYPH_MODE_BLOCKS || glyphKey <= 0 || glyphKey >= GLYPH_KEY_GLYPHS_OFFSET ||
      fillGlyphIndex >= 14
    ) {
      return baseForegroundKey;
    }

    return this.mixedForegroundKeyFor(baseForegroundKey, fillGlyphIndex);
  }

  private mixedForegroundKeyFor(baseForegroundKey: number, fillGlyphIndex: number): number {
    const fillBucket = fillBucketFromGlyphIndex(fillGlyphIndex);
    const cacheKey = ((this.backgroundKey & 0xffffff) * 10 + fillBucket) * 0x1000000 + baseForegroundKey;
    const cached = this.mixedForegroundKeyCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const amount = fillBucket / 9;
    const foregroundRed = mixByteChannel(this.backgroundRed, (baseForegroundKey >> 16) & 0xff, amount);
    const foregroundGreen = mixByteChannel(this.backgroundGreen, (baseForegroundKey >> 8) & 0xff, amount);
    const foregroundBlue = mixByteChannel(this.backgroundBlue, baseForegroundKey & 0xff, amount);
    const foregroundKey = (foregroundRed << 16) | (foregroundGreen << 8) | foregroundBlue;
    this.mixedForegroundKeyCache.set(cacheKey, foregroundKey);
    return foregroundKey;
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

  private pruneCaches(): void {
    this.toByte.prune();
    if (this.foregroundAnsiCache.size > MAX_FOREGROUND_ANSI_CACHE_SIZE) {
      this.foregroundAnsiCache.clear();
      this.cellCache.clear();
      return;
    }
    if (this.cellCache.size > MAX_CELL_CACHE_SIZE) {
      this.cellCache.clear();
    }
    if (this.mixedForegroundKeyCache.size > MAX_MIXED_FOREGROUND_CACHE_SIZE) {
      this.mixedForegroundKeyCache.clear();
    }
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

  private prepareColorCache(cellCount: number): void {
    if (this.cachedColorByteKeys.length === cellCount) {
      return;
    }

    this.cachedColorRawRed = createNaNFloat64Array(cellCount);
    this.cachedColorRawGreen = createNaNFloat64Array(cellCount);
    this.cachedColorRawBlue = createNaNFloat64Array(cellCount);
    this.cachedColorByteKeys = new Uint32Array(cellCount);
  }

  private byteColorKeyForIndex(index: number, rawRed: number, rawGreen: number, rawBlue: number): number {
    if (
      this.cachedColorRawRed[index] === rawRed &&
      this.cachedColorRawGreen[index] === rawGreen &&
      this.cachedColorRawBlue[index] === rawBlue
    ) {
      return this.cachedColorByteKeys[index]!;
    }

    const foregroundRed = this.toByte(rawRed);
    const foregroundGreen = this.toByte(rawGreen);
    const foregroundBlue = this.toByte(rawBlue);
    const key = (foregroundRed << 16) | (foregroundGreen << 8) | foregroundBlue;
    this.cachedColorRawRed[index] = rawRed;
    this.cachedColorRawGreen[index] = rawGreen;
    this.cachedColorRawBlue[index] = rawBlue;
    this.cachedColorByteKeys[index] = key;
    return key;
  }

  private setBackground(backgroundColor: Color | string | number | undefined): void {
    if (!(backgroundColor instanceof Color)) {
      const stableInput = backgroundColor ?? 0;
      if (this.hasStableBackgroundInput && this.stableBackgroundInput === stableInput) {
        return;
      }
      this.hasStableBackgroundInput = true;
      this.stableBackgroundInput = stableInput;
      this.stableBackgroundColorRef = undefined;
      this.setBackgroundColor(colorValue(backgroundColor, 0x000000));
      return;
    }

    this.hasStableBackgroundInput = false;
    this.stableBackgroundInput = undefined;
    if (
      this.stableBackgroundColorRef === backgroundColor &&
      this.stableBackgroundColorRed === backgroundColor.r &&
      this.stableBackgroundColorGreen === backgroundColor.g &&
      this.stableBackgroundColorBlue === backgroundColor.b
    ) {
      return;
    }
    this.stableBackgroundColorRef = backgroundColor;
    this.stableBackgroundColorRed = backgroundColor.r;
    this.stableBackgroundColorGreen = backgroundColor.g;
    this.stableBackgroundColorBlue = backgroundColor.b;
    this.setBackgroundColor(backgroundColor);
  }

  private setBackgroundColor(backgroundColor: Color): void {
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
    this.mixedForegroundKeyCache.clear();
  }
}

/** Builds the terminal ANSI cell grid for a three Ascii frame. */
export function buildThreeAsciiAnsiGrid(input: ThreeAsciiAnsiGridInput): string[][] {
  return sharedThreeAsciiAnsiGridAssembler.build(input);
}

const sharedThreeAsciiAnsiGridAssembler = new ThreeAsciiAnsiGridAssembler();

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

function createNaNFloat64Array(length: number): Float64Array<ArrayBuffer> {
  const values = new Float64Array(length);
  values.fill(Number.NaN);
  return values;
}

function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function linearUnitToByte(value: number): number {
  return Math.round(linearToSrgb(value) * 255);
}

interface LinearByteCache {
  (value: number): number;
  clear(): void;
  prune(): void;
}

function createLinearByteCache(): LinearByteCache {
  const cache = new Map<number, number>();
  const read = ((value: number): number => {
    const cached = cache.get(value);
    if (cached !== undefined) return cached;
    const byte = linearUnitToByte(value);
    cache.set(value, byte);
    return byte;
  }) as LinearByteCache;
  read.clear = () => cache.clear();
  read.prune = () => {
    if (cache.size > MAX_LINEAR_BYTE_CACHE_SIZE) {
      cache.clear();
    }
  };
  return read;
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

function createFillGlyphKeyTable(mode: TerminalGlyphMode): number[] {
  const table = new Array<number>(FILL_GLYPHS.length + 5);
  for (let index = 0; index < table.length; index += 1) {
    const bucket = fillBucketFromGlyphIndex(index);
    if (mode === GLYPH_MODE_GLYPHS) {
      table[index] = GLYPH_KEY_GLYPHS_OFFSET + bucket;
    } else if (mode === GLYPH_MODE_MIXED) {
      table[index] = pickMixedFillGlyph(index);
    } else {
      table[index] = bucket;
    }
  }
  return table;
}

function terminalGlyphModeForStyle(style: TerminalGlyphStyle): TerminalGlyphMode {
  switch (style) {
    case "glyphs":
      return GLYPH_MODE_GLYPHS;
    case "mixed":
      return GLYPH_MODE_MIXED;
    default:
      return GLYPH_MODE_BLOCKS;
  }
}

function terminalFillGlyphKeysForMode(mode: TerminalGlyphMode): readonly number[] {
  if (mode === GLYPH_MODE_GLYPHS) return ASCII_FILL_GLYPH_KEYS_BY_INDEX;
  if (mode === GLYPH_MODE_MIXED) return MIXED_FILL_GLYPH_KEYS_BY_INDEX;
  return BLOCK_FILL_GLYPH_KEYS_BY_INDEX;
}

function fillGlyphKeyForIndex(keys: readonly number[], fillGlyphIndex: number): number {
  return keys[Math.max(0, Math.min(keys.length - 1, fillGlyphIndex))] ?? 0;
}

function terminalGlyphForCell(
  fillGlyphKeys: readonly number[],
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

  return fillGlyphKeyForIndex(fillGlyphKeys, fillGlyphIndex);
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
