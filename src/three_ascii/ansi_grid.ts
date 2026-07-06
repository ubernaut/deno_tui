// Copyright 2023 Im-Beast. MIT license.
import { Color } from "three";

import {
  ASCII_FILL_GLYPHS,
  blockFillGlyphForBucket,
  EDGE_GLYPHS,
  FILL_GLYPHS,
  type TerminalGlyphStyle,
} from "./glyphs.ts";
import {
  rgbToAnsiBackground,
  rgbToAnsiForeground,
  ThreeAsciiAnsiBackgroundState,
  ThreeAsciiAnsiColorKeyCache,
} from "./colors.ts";

const DEFAULT_TERMINAL_EDGE_BIAS = 1;
const RESET = "\x1b[0m";
const MAX_FOREGROUND_ANSI_CACHE_SIZE = 4096;
const MAX_CELL_CACHE_SIZE = 16384;
const MIN_VISIBLE_FILL_GLYPH_INDEX = 6;
const MIN_VISIBLE_BLOCK_FILL_VALUE = MIN_VISIBLE_FILL_GLYPH_INDEX - 0.5;
const SOLID_BLOCK_GLYPH_KEY = 14;
const TILE_PIXEL_COUNT = 64;
const GOHU_11_EDGE_SHAPE_MISMATCH = [0, 3, 10, 9] as const;
const GOHU_11_FILL_GLYPH_COVERAGE = [0, 2, 4, 6, 9, 11, 13, 15, 18, 18] as const;
const ASCII_FILL_GLYPH_COVERAGE = [0, 1, 2, 4, 6, 8, 10, 13, 16, 18] as const;
const MIXED_FILL_GLYPHS_BY_INDEX = createMixedFillGlyphTable();
const CELL_GLYPH_KEY_STRIDE = 64;
const GLYPH_KEY_GLYPHS_OFFSET = 16;
const GLYPH_KEY_MIXED_OFFSET = 32;
const EDGE_GLYPH_KEY_OFFSET = 48;
const GLYPHS_BY_KEY = createGlyphKeyTable();
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
  blockVisibilityFromColorAlpha?: boolean;
}

/** Reusable ANSI grid assembler that keeps color and cell string caches warm across frames. */
export class ThreeAsciiAnsiGridAssembler {
  private readonly foregroundAnsiCache = new Map<number, string>();
  private readonly cellCache = new Map<number, string>();
  private readonly background = new ThreeAsciiAnsiBackgroundState();
  private readonly colorKeyCache = new ThreeAsciiAnsiColorKeyCache();
  private readonly reuseGrid: boolean;
  private reusableGrid: string[][] = [];
  private reusableGridColumns = 0;
  private cachedCellForegroundKeys = new Int32Array(0);
  private cachedCellGlyphKeys = new Int32Array(0);
  private cachedCellStrings: string[] = [];
  private cachedCellBackgroundKey = -1;
  private cachedCellGlyphMode = -1;

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
    const cellCount = columns * rows;
    const denseFill = fillGlyphs.length >= cellCount;
    const denseColors = colors.length >= cellCount * 4;
    if (this.background.set(input.backgroundColor)) {
      this.cellCache.clear();
    }
    this.prepareFrameCaches(cellCount, terminalGlyphMode);
    this.pruneCaches();
    const grid = this.reuseGrid ? this.prepareReusableGrid(rows, columns) : createStringGrid(rows, columns);

    if (!hasEdges) {
      if (terminalGlyphMode === GLYPH_MODE_BLOCKS) {
        if (input.blockVisibilityFromColorAlpha) {
          return this.buildAlphaBlockGrid(grid, columns, rows, colors);
        }
        return denseFill && denseColors
          ? this.buildDenseBlockGrid(grid, columns, rows, fillGlyphs, colors)
          : this.buildBlockGrid(grid, columns, rows, fillGlyphs, colors);
      }
      const terminalFillGlyphKeys = terminalFillGlyphKeysForMode(terminalGlyphMode);
      if (denseFill && denseColors) {
        return this.buildDenseFillOnlyGrid(grid, columns, rows, fillGlyphs, colors, terminalFillGlyphKeys);
      }
      return this.buildFillOnlyGrid(grid, columns, rows, fillGlyphs, colors, terminalFillGlyphKeys);
    }

    const terminalFillGlyphKeys = terminalFillGlyphKeysForMode(terminalGlyphMode);
    const terminalEdgeBias = Math.max(0.5, input.terminalEdgeBias ?? DEFAULT_TERMINAL_EDGE_BIAS);
    let lastForegroundKey = -1;
    let lastGlyphKey = -1;
    let lastCell = "";
    let lastRawRed = Number.NaN;
    let lastRawGreen = Number.NaN;
    let lastRawBlue = Number.NaN;
    let lastFillGlyphIndex = -1;

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
          outputRow[column] = this.background.blankAnsi;
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

        const cell = this.cellFor(foregroundKey, glyphKey);
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
    this.reusableGridColumns = 0;
    this.background.clear();
    this.colorKeyCache.clear();
    this.cachedCellForegroundKeys = new Int32Array(0);
    this.cachedCellGlyphKeys = new Int32Array(0);
    this.cachedCellStrings = [];
    this.cachedCellBackgroundKey = -1;
    this.cachedCellGlyphMode = -1;
  }

  private buildBlockGrid(
    grid: string[][],
    columns: number,
    rows: number,
    fillGlyphs: ArrayLike<number>,
    colors: ArrayLike<number>,
  ): string[][] {
    let lastForegroundKey = -1;
    let lastCell = "";
    let lastRawRed = Number.NaN;
    let lastRawGreen = Number.NaN;
    let lastRawBlue = Number.NaN;

    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];
      const rowOffset = row * columns;

      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const fillGlyphValue = fillGlyphs[index] ?? 0;
        if (fillGlyphValue < MIN_VISIBLE_BLOCK_FILL_VALUE) {
          column = fillSparseBlockBlankRun(
            outputRow,
            fillGlyphs,
            rowOffset,
            column,
            columns,
            this.background.blankAnsi,
          );
          continue;
        }

        const colorOffset = index * 4;
        const rawRed = colors[colorOffset] ?? 0;
        const rawGreen = colors[colorOffset + 1] ?? 0;
        const rawBlue = colors[colorOffset + 2] ?? 0;
        if (rawRed === lastRawRed && rawGreen === lastRawGreen && rawBlue === lastRawBlue) {
          outputRow[column] = lastCell;
          continue;
        }

        const foregroundKey = this.byteColorKeyForIndex(index, rawRed, rawGreen, rawBlue);
        if (foregroundKey === lastForegroundKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const cachedCell = this.cachedCellForIndex(index, foregroundKey, SOLID_BLOCK_GLYPH_KEY);
        if (cachedCell !== undefined) {
          outputRow[column] = cachedCell;
          lastForegroundKey = foregroundKey;
          lastCell = cachedCell;
          lastRawRed = rawRed;
          lastRawGreen = rawGreen;
          lastRawBlue = rawBlue;
          continue;
        }

        const cell = this.blockCellFor(foregroundKey);
        this.setCachedCellForIndex(index, foregroundKey, SOLID_BLOCK_GLYPH_KEY, cell);
        lastForegroundKey = foregroundKey;
        lastCell = cell;
        lastRawRed = rawRed;
        lastRawGreen = rawGreen;
        lastRawBlue = rawBlue;

        outputRow[column] = cell;
      }
    }

    return grid;
  }

  private buildDenseBlockGrid(
    grid: string[][],
    columns: number,
    rows: number,
    fillGlyphs: ArrayLike<number>,
    colors: ArrayLike<number>,
  ): string[][] {
    let lastForegroundKey = -1;
    let lastCell = "";
    let lastRawRed = Number.NaN;
    let lastRawGreen = Number.NaN;
    let lastRawBlue = Number.NaN;

    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];
      const rowOffset = row * columns;

      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const fillGlyphValue = fillGlyphs[index] as number;
        if (fillGlyphValue < MIN_VISIBLE_BLOCK_FILL_VALUE) {
          column = fillDenseBlockBlankRun(outputRow, fillGlyphs, rowOffset, column, columns, this.background.blankAnsi);
          continue;
        }

        const colorOffset = index * 4;
        const rawRed = colors[colorOffset] as number;
        const rawGreen = colors[colorOffset + 1] as number;
        const rawBlue = colors[colorOffset + 2] as number;
        if (rawRed === lastRawRed && rawGreen === lastRawGreen && rawBlue === lastRawBlue) {
          column = fillDenseBlockColorRun(
            outputRow,
            fillGlyphs,
            colors,
            rowOffset,
            column,
            columns,
            rawRed,
            rawGreen,
            rawBlue,
            lastCell,
          );
          continue;
        }

        const foregroundKey = this.byteColorKeyForIndex(index, rawRed, rawGreen, rawBlue);
        if (foregroundKey === lastForegroundKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const cachedCell = this.cachedCellForIndex(index, foregroundKey, SOLID_BLOCK_GLYPH_KEY);
        if (cachedCell !== undefined) {
          outputRow[column] = cachedCell;
          lastForegroundKey = foregroundKey;
          lastCell = cachedCell;
          lastRawRed = rawRed;
          lastRawGreen = rawGreen;
          lastRawBlue = rawBlue;
          continue;
        }

        const cell = this.blockCellFor(foregroundKey);
        this.setCachedCellForIndex(index, foregroundKey, SOLID_BLOCK_GLYPH_KEY, cell);
        lastForegroundKey = foregroundKey;
        lastCell = cell;
        lastRawRed = rawRed;
        lastRawGreen = rawGreen;
        lastRawBlue = rawBlue;

        column = fillDenseBlockColorRun(
          outputRow,
          fillGlyphs,
          colors,
          rowOffset,
          column,
          columns,
          rawRed,
          rawGreen,
          rawBlue,
          cell,
        );
      }
    }

    return grid;
  }

  private buildAlphaBlockGrid(
    grid: string[][],
    columns: number,
    rows: number,
    colors: ArrayLike<number>,
  ): string[][] {
    let lastForegroundKey = -1;
    let lastCell = "";
    let lastRawRed = Number.NaN;
    let lastRawGreen = Number.NaN;
    let lastRawBlue = Number.NaN;

    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];
      const rowOffset = row * columns;

      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const colorOffset = index * 4;
        if ((colors[colorOffset + 3] ?? 0) < 0.5) {
          column = fillAlphaBlockBlankRun(outputRow, colors, rowOffset, column, columns, this.background.blankAnsi);
          continue;
        }

        const rawRed = colors[colorOffset] ?? 0;
        const rawGreen = colors[colorOffset + 1] ?? 0;
        const rawBlue = colors[colorOffset + 2] ?? 0;
        if (rawRed === lastRawRed && rawGreen === lastRawGreen && rawBlue === lastRawBlue) {
          column = fillAlphaBlockColorRun(
            outputRow,
            colors,
            rowOffset,
            column,
            columns,
            rawRed,
            rawGreen,
            rawBlue,
            lastCell,
          );
          continue;
        }

        const foregroundKey = this.byteColorKeyForIndex(index, rawRed, rawGreen, rawBlue);
        if (foregroundKey === lastForegroundKey) {
          outputRow[column] = lastCell;
          continue;
        }

        const cachedCell = this.cachedCellForIndex(index, foregroundKey, SOLID_BLOCK_GLYPH_KEY);
        if (cachedCell !== undefined) {
          outputRow[column] = cachedCell;
          lastForegroundKey = foregroundKey;
          lastCell = cachedCell;
          lastRawRed = rawRed;
          lastRawGreen = rawGreen;
          lastRawBlue = rawBlue;
          continue;
        }

        const cell = this.blockCellFor(foregroundKey);
        this.setCachedCellForIndex(index, foregroundKey, SOLID_BLOCK_GLYPH_KEY, cell);
        lastForegroundKey = foregroundKey;
        lastCell = cell;
        lastRawRed = rawRed;
        lastRawGreen = rawGreen;
        lastRawBlue = rawBlue;

        column = fillAlphaBlockColorRun(
          outputRow,
          colors,
          rowOffset,
          column,
          columns,
          rawRed,
          rawGreen,
          rawBlue,
          cell,
        );
      }
    }

    return grid;
  }

  private buildFillOnlyGrid(
    grid: string[][],
    columns: number,
    rows: number,
    fillGlyphs: ArrayLike<number>,
    colors: ArrayLike<number>,
    terminalFillGlyphKeys: readonly number[],
  ): string[][] {
    let lastForegroundKey = -1;
    let lastGlyphKey = -1;
    let lastCell = "";
    let lastRawRed = Number.NaN;
    let lastRawGreen = Number.NaN;
    let lastRawBlue = Number.NaN;
    let lastFillGlyphIndex = -1;

    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];
      const rowOffset = row * columns;

      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const fillGlyphIndex = Math.round(fillGlyphs[index] ?? 0);
        if (fillGlyphIndex < MIN_VISIBLE_FILL_GLYPH_INDEX) {
          column = fillSparseGlyphBlankRun(
            outputRow,
            fillGlyphs,
            rowOffset,
            column,
            columns,
            this.background.blankAnsi,
          );
          continue;
        }

        const glyphKey = fillGlyphKeyForIndex(terminalFillGlyphKeys, fillGlyphIndex);
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

        const cell = this.cellFor(foregroundKey, glyphKey);
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
    terminalFillGlyphKeys: readonly number[],
  ): string[][] {
    let lastForegroundKey = -1;
    let lastGlyphKey = -1;
    let lastCell = "";
    let lastRawRed = Number.NaN;
    let lastRawGreen = Number.NaN;
    let lastRawBlue = Number.NaN;
    let lastFillGlyphIndex = -1;

    for (let row = 0; row < rows; row += 1) {
      const outputRow = grid[row];
      const rowOffset = row * columns;

      for (let column = 0; column < columns; column += 1) {
        const index = rowOffset + column;
        const fillGlyphIndex = Math.round(fillGlyphs[index] as number);
        if (fillGlyphIndex < MIN_VISIBLE_FILL_GLYPH_INDEX) {
          column = fillDenseGlyphBlankRun(outputRow, fillGlyphs, rowOffset, column, columns, this.background.blankAnsi);
          continue;
        }

        const glyphKey = fillGlyphKeyForIndex(terminalFillGlyphKeys, fillGlyphIndex);
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

        const cell = this.cellFor(foregroundKey, glyphKey);
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
    glyphKey: number,
  ): string {
    const cellKey = foregroundKey * CELL_GLYPH_KEY_STRIDE + glyphKey;
    let cell = this.cellCache.get(cellKey);
    if (cell !== undefined) return cell;

    if (isSolidBlockFillGlyphKey(glyphKey)) {
      return this.blockCellFor(foregroundKey);
    }

    let foregroundAnsi = this.foregroundAnsiCache.get(foregroundKey);
    if (foregroundAnsi === undefined) {
      const foregroundRed = (foregroundKey >> 16) & 0xff;
      const foregroundGreen = (foregroundKey >> 8) & 0xff;
      const foregroundBlue = foregroundKey & 0xff;
      foregroundAnsi = rgbToAnsiForeground(foregroundRed, foregroundGreen, foregroundBlue);
      this.foregroundAnsiCache.set(foregroundKey, foregroundAnsi);
    }

    const glyph = glyphForKey(glyphKey);
    cell = `${this.background.ansi}${foregroundAnsi}${glyph}${RESET}`;
    this.cellCache.set(cellKey, cell);
    return cell;
  }

  private blockCellFor(foregroundKey: number) {
    const cellKey = foregroundKey * CELL_GLYPH_KEY_STRIDE + SOLID_BLOCK_GLYPH_KEY;
    let cell = this.cellCache.get(cellKey);
    if (cell !== undefined) return cell;
    const foregroundRed = (foregroundKey >> 16) & 0xff;
    const foregroundGreen = (foregroundKey >> 8) & 0xff;
    const foregroundBlue = foregroundKey & 0xff;
    const foregroundAnsi = rgbToAnsiForeground(foregroundRed, foregroundGreen, foregroundBlue);
    const backgroundAnsi = rgbToAnsiBackground(foregroundRed, foregroundGreen, foregroundBlue);
    cell = `${backgroundAnsi}${foregroundAnsi}█${RESET}`;
    this.cellCache.set(cellKey, cell);
    return cell;
  }

  private pruneCaches(): void {
    this.colorKeyCache.prune();
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
    if (grid.length === rows && this.reusableGridColumns === columns) {
      return grid;
    }
    grid.length = rows;
    for (let row = 0; row < rows; row += 1) {
      grid[row] ??= [];
      grid[row].length = columns;
    }
    this.reusableGridColumns = columns;
    return grid;
  }

  private prepareFrameCaches(cellCount: number, terminalGlyphMode: TerminalGlyphMode): void {
    this.colorKeyCache.prepare(cellCount);

    if (
      this.cachedCellForegroundKeys.length === cellCount &&
      this.cachedCellBackgroundKey === this.background.key &&
      this.cachedCellGlyphMode === terminalGlyphMode
    ) {
      return;
    }

    this.cachedCellForegroundKeys = new Int32Array(cellCount);
    this.cachedCellForegroundKeys.fill(-1);
    this.cachedCellGlyphKeys = new Int32Array(cellCount);
    this.cachedCellGlyphKeys.fill(-1);
    this.cachedCellStrings = new Array<string>(cellCount);
    this.cachedCellBackgroundKey = this.background.key;
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
    return this.colorKeyCache.keyForIndex(index, rawRed, rawGreen, rawBlue);
  }
}

function glyphForKey(key: number): string {
  return GLYPHS_BY_KEY[Math.max(0, Math.min(GLYPHS_BY_KEY.length - 1, key))] ?? " ";
}

function isSolidBlockFillGlyphKey(key: number): boolean {
  return key > 0 && key < GLYPH_KEY_GLYPHS_OFFSET;
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
      table[index] = bucket > 0 ? 14 : 0;
    }
  }
  return table;
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

/** Builds the terminal ANSI cell grid for a three Ascii frame. */
export function buildThreeAsciiAnsiGrid(input: ThreeAsciiAnsiGridInput): string[][] {
  return sharedThreeAsciiAnsiGridAssembler.build(input);
}

const sharedThreeAsciiAnsiGridAssembler = new ThreeAsciiAnsiGridAssembler();

function createStringGrid(rows: number, columns: number): string[][] {
  const grid = new Array<string[]>(rows);
  for (let row = 0; row < rows; row += 1) {
    grid[row] = new Array<string>(columns);
  }
  return grid;
}

function fillSparseBlockBlankRun(
  outputRow: string[],
  fillGlyphs: ArrayLike<number>,
  rowOffset: number,
  column: number,
  columns: number,
  blankAnsi: string,
): number {
  const blankStart = column;
  column += 1;
  while (column < columns && (fillGlyphs[rowOffset + column] ?? 0) < MIN_VISIBLE_BLOCK_FILL_VALUE) {
    column += 1;
  }
  outputRow.fill(blankAnsi, blankStart, column);
  return column - 1;
}

function fillDenseBlockBlankRun(
  outputRow: string[],
  fillGlyphs: ArrayLike<number>,
  rowOffset: number,
  column: number,
  columns: number,
  blankAnsi: string,
): number {
  const blankStart = column;
  column += 1;
  while (column < columns && (fillGlyphs[rowOffset + column] as number) < MIN_VISIBLE_BLOCK_FILL_VALUE) {
    column += 1;
  }
  outputRow.fill(blankAnsi, blankStart, column);
  return column - 1;
}

function fillDenseBlockColorRun(
  outputRow: string[],
  fillGlyphs: ArrayLike<number>,
  colors: ArrayLike<number>,
  rowOffset: number,
  column: number,
  columns: number,
  rawRed: number,
  rawGreen: number,
  rawBlue: number,
  cell: string,
): number {
  const runStart = column;
  column += 1;
  while (column < columns) {
    const index = rowOffset + column;
    if ((fillGlyphs[index] as number) < MIN_VISIBLE_BLOCK_FILL_VALUE) break;
    const colorOffset = index * 4;
    if (
      (colors[colorOffset] as number) !== rawRed ||
      (colors[colorOffset + 1] as number) !== rawGreen ||
      (colors[colorOffset + 2] as number) !== rawBlue
    ) {
      break;
    }
    column += 1;
  }
  outputRow.fill(cell, runStart, column);
  return column - 1;
}

function fillAlphaBlockBlankRun(
  outputRow: string[],
  colors: ArrayLike<number>,
  rowOffset: number,
  column: number,
  columns: number,
  blankAnsi: string,
): number {
  const blankStart = column;
  column += 1;
  while (column < columns && (colors[(rowOffset + column) * 4 + 3] ?? 0) < 0.5) {
    column += 1;
  }
  outputRow.fill(blankAnsi, blankStart, column);
  return column - 1;
}

function fillAlphaBlockColorRun(
  outputRow: string[],
  colors: ArrayLike<number>,
  rowOffset: number,
  column: number,
  columns: number,
  rawRed: number,
  rawGreen: number,
  rawBlue: number,
  cell: string,
): number {
  const runStart = column;
  column += 1;
  while (column < columns) {
    const colorOffset = (rowOffset + column) * 4;
    if ((colors[colorOffset + 3] ?? 0) < 0.5) break;
    if (
      (colors[colorOffset] ?? 0) !== rawRed ||
      (colors[colorOffset + 1] ?? 0) !== rawGreen ||
      (colors[colorOffset + 2] ?? 0) !== rawBlue
    ) {
      break;
    }
    column += 1;
  }
  outputRow.fill(cell, runStart, column);
  return column - 1;
}

function fillSparseGlyphBlankRun(
  outputRow: string[],
  fillGlyphs: ArrayLike<number>,
  rowOffset: number,
  column: number,
  columns: number,
  blankAnsi: string,
): number {
  const blankStart = column;
  column += 1;
  while (column < columns && Math.round(fillGlyphs[rowOffset + column] ?? 0) < MIN_VISIBLE_FILL_GLYPH_INDEX) {
    column += 1;
  }
  outputRow.fill(blankAnsi, blankStart, column);
  return column - 1;
}

function fillDenseGlyphBlankRun(
  outputRow: string[],
  fillGlyphs: ArrayLike<number>,
  rowOffset: number,
  column: number,
  columns: number,
  blankAnsi: string,
): number {
  const blankStart = column;
  column += 1;
  while (column < columns && Math.round(fillGlyphs[rowOffset + column] as number) < MIN_VISIBLE_FILL_GLYPH_INDEX) {
    column += 1;
  }
  outputRow.fill(blankAnsi, blankStart, column);
  return column - 1;
}
