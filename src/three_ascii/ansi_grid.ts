// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

import {
  CELL_GLYPH_KEY_STRIDE,
  fillGlyphKeyForIndex,
  GLYPH_MODE_BLOCKS,
  glyphForKey,
  isSolidBlockFillGlyphKey,
  terminalFillGlyphKeysForMode,
  terminalGlyphForCell,
  type TerminalGlyphMode,
  terminalGlyphModeForStyle,
} from "./ansi_glyph_keys.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";

const DEFAULT_TERMINAL_EDGE_BIAS = 1;
const RESET = "\x1b[0m";
const MAX_LINEAR_BYTE_CACHE_SIZE = 65536;
const MAX_FOREGROUND_ANSI_CACHE_SIZE = 4096;
const MAX_CELL_CACHE_SIZE = 16384;
const MIN_VISIBLE_FILL_GLYPH_INDEX = 6;
const SOLID_BLOCK_GLYPH_KEY = 14;

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
  private cachedColorRawRed = new Float64Array(0);
  private cachedColorRawGreen = new Float64Array(0);
  private cachedColorRawBlue = new Float64Array(0);
  private cachedColorByteKeys = new Uint32Array(0);
  private cachedCellForegroundKeys = new Int32Array(0);
  private cachedCellGlyphKeys = new Int32Array(0);
  private cachedCellStrings: string[] = [];
  private cachedCellBackgroundKey = -1;
  private cachedCellGlyphMode = -1;
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
    const colors = input.colors;
    const terminalGlyphStyle = input.terminalGlyphStyle ?? "blocks";
    const terminalGlyphMode = terminalGlyphModeForStyle(terminalGlyphStyle);
    const edgeGlyphs = input.edgeGlyphs;
    const hasEdges = edgeGlyphs !== undefined && terminalGlyphMode !== GLYPH_MODE_BLOCKS;
    const terminalFillGlyphKeys = terminalFillGlyphKeysForMode(terminalGlyphMode);
    const terminalEdgeBias = Math.max(0.5, input.terminalEdgeBias ?? DEFAULT_TERMINAL_EDGE_BIAS);
    const cellCount = columns * rows;
    const denseFill = fillGlyphs.length >= cellCount;
    const denseColors = colors.length >= cellCount * 4;
    this.setBackground(input.backgroundColor);
    this.prepareFrameCaches(cellCount, terminalGlyphMode);
    this.pruneCaches();
    let lastForegroundKey = -1;
    let lastGlyphKey = -1;
    let lastCell = "";
    let lastRawRed = Number.NaN;
    let lastRawGreen = Number.NaN;
    let lastRawBlue = Number.NaN;
    let lastFillGlyphIndex = -1;
    const grid = this.reuseGrid ? this.prepareReusableGrid(rows, columns) : createStringGrid(rows, columns);

    if (!hasEdges) {
      if (denseFill && denseColors) {
        return this.buildDenseFillOnlyGrid(
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
          lastFillGlyphIndex,
        );
      }
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
        lastFillGlyphIndex,
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

        if (
          fillGlyphIndex < MIN_VISIBLE_FILL_GLYPH_INDEX &&
          (edgeGlyphIndex <= 0 || dominantCount <= 0 || totalCount <= 0)
        ) {
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
          rawRed === lastRawRed && rawGreen === lastRawGreen && rawBlue === lastRawBlue && glyphKey === lastGlyphKey &&
          fillGlyphIndex === lastFillGlyphIndex
        ) {
          outputRow[column] = lastCell;
          continue;
        }

        const foregroundKey = this.byteColorKeyForIndex(index, rawRed, rawGreen, rawBlue);
        if (foregroundKey === lastForegroundKey && glyphKey === lastGlyphKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const cachedCell = this.cachedCellForIndex(index, foregroundKey, glyphKey);
        if (cachedCell !== undefined) {
          outputRow[column] = cachedCell;
          lastForegroundKey = foregroundKey;
          lastGlyphKey = glyphKey;
          lastCell = cachedCell;
          lastRawRed = rawRed;
          lastRawGreen = rawGreen;
          lastRawBlue = rawBlue;
          lastFillGlyphIndex = fillGlyphIndex;
          continue;
        }

        const foregroundRed = (foregroundKey >> 16) & 0xff;
        const foregroundGreen = (foregroundKey >> 8) & 0xff;
        const foregroundBlue = foregroundKey & 0xff;
        const cell = this.cellFor(foregroundKey, foregroundRed, foregroundGreen, foregroundBlue, glyphKey);
        this.setCachedCellForIndex(index, foregroundKey, glyphKey, cell);

        lastForegroundKey = foregroundKey;
        lastGlyphKey = glyphKey;
        lastCell = cell;
        lastRawRed = rawRed;
        lastRawGreen = rawGreen;
        lastRawBlue = rawBlue;
        lastFillGlyphIndex = fillGlyphIndex;

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
    this.cachedCellForegroundKeys = new Int32Array(0);
    this.cachedCellGlyphKeys = new Int32Array(0);
    this.cachedCellStrings = [];
    this.cachedCellBackgroundKey = -1;
    this.cachedCellGlyphMode = -1;
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
    lastFillGlyphIndex: number,
  ): string[][] {
    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];
      const rowOffset = row * columns;

      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const fillGlyphIndex = Math.round(fillGlyphs[index] ?? 0);
        if (fillGlyphIndex < MIN_VISIBLE_FILL_GLYPH_INDEX) {
          const blankStart = column;
          column += 1;
          while (
            column < columns && Math.round(fillGlyphs[rowOffset + column] ?? 0) < MIN_VISIBLE_FILL_GLYPH_INDEX
          ) {
            column += 1;
          }
          outputRow.fill(this.blankAnsi, blankStart, column);
          column -= 1;
          continue;
        }

        const glyphKey = terminalGlyphMode === GLYPH_MODE_BLOCKS
          ? SOLID_BLOCK_GLYPH_KEY
          : fillGlyphKeyForIndex(terminalFillGlyphKeys, fillGlyphIndex);
        const colorOffset = index * 4;
        const rawRed = colors[colorOffset] ?? 0;
        const rawGreen = colors[colorOffset + 1] ?? 0;
        const rawBlue = colors[colorOffset + 2] ?? 0;
        if (
          rawRed === lastRawRed && rawGreen === lastRawGreen && rawBlue === lastRawBlue && glyphKey === lastGlyphKey &&
          fillGlyphIndex === lastFillGlyphIndex
        ) {
          outputRow[column] = lastCell;
          continue;
        }

        const foregroundKey = this.byteColorKeyForIndex(index, rawRed, rawGreen, rawBlue);
        if (foregroundKey === lastForegroundKey && glyphKey === lastGlyphKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const cachedCell = this.cachedCellForIndex(index, foregroundKey, glyphKey);
        if (cachedCell !== undefined) {
          outputRow[column] = cachedCell;
          lastForegroundKey = foregroundKey;
          lastGlyphKey = glyphKey;
          lastCell = cachedCell;
          lastRawRed = rawRed;
          lastRawGreen = rawGreen;
          lastRawBlue = rawBlue;
          lastFillGlyphIndex = fillGlyphIndex;
          continue;
        }

        const foregroundRed = (foregroundKey >> 16) & 0xff;
        const foregroundGreen = (foregroundKey >> 8) & 0xff;
        const foregroundBlue = foregroundKey & 0xff;
        const cell = this.cellFor(foregroundKey, foregroundRed, foregroundGreen, foregroundBlue, glyphKey);
        this.setCachedCellForIndex(index, foregroundKey, glyphKey, cell);
        lastForegroundKey = foregroundKey;
        lastGlyphKey = glyphKey;
        lastCell = cell;
        lastRawRed = rawRed;
        lastRawGreen = rawGreen;
        lastRawBlue = rawBlue;
        lastFillGlyphIndex = fillGlyphIndex;

        outputRow[column] = cell;
      }
    }

    return grid;
  }

  private buildDenseFillOnlyGrid(
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
    lastFillGlyphIndex: number,
  ): string[][] {
    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];
      const rowOffset = row * columns;

      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const fillGlyphIndex = Math.round(fillGlyphs[index] as number);
        if (fillGlyphIndex < MIN_VISIBLE_FILL_GLYPH_INDEX) {
          const blankStart = column;
          column += 1;
          while (
            column < columns &&
            Math.round(fillGlyphs[rowOffset + column] as number) < MIN_VISIBLE_FILL_GLYPH_INDEX
          ) {
            column += 1;
          }
          outputRow.fill(this.blankAnsi, blankStart, column);
          column -= 1;
          continue;
        }

        const glyphKey = terminalGlyphMode === GLYPH_MODE_BLOCKS
          ? SOLID_BLOCK_GLYPH_KEY
          : fillGlyphKeyForIndex(terminalFillGlyphKeys, fillGlyphIndex);
        const colorOffset = index * 4;
        const rawRed = colors[colorOffset] as number;
        const rawGreen = colors[colorOffset + 1] as number;
        const rawBlue = colors[colorOffset + 2] as number;
        if (
          rawRed === lastRawRed && rawGreen === lastRawGreen && rawBlue === lastRawBlue && glyphKey === lastGlyphKey &&
          fillGlyphIndex === lastFillGlyphIndex
        ) {
          outputRow[column] = lastCell;
          continue;
        }

        const foregroundKey = this.byteColorKeyForIndex(index, rawRed, rawGreen, rawBlue);
        if (foregroundKey === lastForegroundKey && glyphKey === lastGlyphKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const cachedCell = this.cachedCellForIndex(index, foregroundKey, glyphKey);
        if (cachedCell !== undefined) {
          outputRow[column] = cachedCell;
          lastForegroundKey = foregroundKey;
          lastGlyphKey = glyphKey;
          lastCell = cachedCell;
          lastRawRed = rawRed;
          lastRawGreen = rawGreen;
          lastRawBlue = rawBlue;
          lastFillGlyphIndex = fillGlyphIndex;
          continue;
        }

        const foregroundRed = (foregroundKey >> 16) & 0xff;
        const foregroundGreen = (foregroundKey >> 8) & 0xff;
        const foregroundBlue = foregroundKey & 0xff;
        const cell = this.cellFor(foregroundKey, foregroundRed, foregroundGreen, foregroundBlue, glyphKey);
        this.setCachedCellForIndex(index, foregroundKey, glyphKey, cell);
        lastForegroundKey = foregroundKey;
        lastGlyphKey = glyphKey;
        lastCell = cell;
        lastRawRed = rawRed;
        lastRawGreen = rawGreen;
        lastRawBlue = rawBlue;
        lastFillGlyphIndex = fillGlyphIndex;

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

    if (isSolidBlockFillGlyphKey(glyphKey)) {
      cell = `${rgbToAnsiBackground(foregroundRed, foregroundGreen, foregroundBlue)} ${RESET}`;
      this.cellCache.set(cellKey, cell);
      return cell;
    }

    let foregroundAnsi = this.foregroundAnsiCache.get(foregroundKey);
    if (foregroundAnsi === undefined) {
      foregroundAnsi = rgbToAnsiForeground(foregroundRed, foregroundGreen, foregroundBlue);
      this.foregroundAnsiCache.set(foregroundKey, foregroundAnsi);
    }

    const glyph = glyphForKey(glyphKey);
    cell = `${this.backgroundAnsi}${foregroundAnsi}${glyph}${RESET}`;
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

  private prepareFrameCaches(cellCount: number, terminalGlyphMode: TerminalGlyphMode): void {
    if (this.cachedColorByteKeys.length !== cellCount) {
      this.cachedColorRawRed = createNaNFloat64Array(cellCount);
      this.cachedColorRawGreen = createNaNFloat64Array(cellCount);
      this.cachedColorRawBlue = createNaNFloat64Array(cellCount);
      this.cachedColorByteKeys = new Uint32Array(cellCount);
    }

    if (
      this.cachedCellForegroundKeys.length === cellCount &&
      this.cachedCellBackgroundKey === this.backgroundKey &&
      this.cachedCellGlyphMode === terminalGlyphMode
    ) {
      return;
    }

    this.cachedCellForegroundKeys = new Int32Array(cellCount);
    this.cachedCellForegroundKeys.fill(-1);
    this.cachedCellGlyphKeys = new Int32Array(cellCount);
    this.cachedCellGlyphKeys.fill(-1);
    this.cachedCellStrings = new Array<string>(cellCount);
    this.cachedCellBackgroundKey = this.backgroundKey;
    this.cachedCellGlyphMode = terminalGlyphMode;
  }

  private cachedCellForIndex(index: number, foregroundKey: number, glyphKey: number): string | undefined {
    if (
      this.cachedCellForegroundKeys[index] === foregroundKey &&
      this.cachedCellGlyphKeys[index] === glyphKey
    ) {
      return this.cachedCellStrings[index];
    }
    return undefined;
  }

  private setCachedCellForIndex(index: number, foregroundKey: number, glyphKey: number, cell: string): void {
    this.cachedCellForegroundKeys[index] = foregroundKey;
    this.cachedCellGlyphKeys[index] = glyphKey;
    this.cachedCellStrings[index] = cell;
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
    if (value <= 0) return 0;
    if (value >= 1) return 255;
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
