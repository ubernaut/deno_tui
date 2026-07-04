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
import { ThreeAsciiAnsiBackgroundState } from "./ansi_background.ts";
import { ThreeAsciiAnsiColorKeyCache } from "./ansi_color_cache.ts";
import { rgbToAnsiBackground, rgbToAnsiForeground } from "./colors.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";

const DEFAULT_TERMINAL_EDGE_BIAS = 1;
const RESET = "\x1b[0m";
const MAX_FOREGROUND_ANSI_CACHE_SIZE = 4096;
const MAX_CELL_CACHE_SIZE = 16384;
const MIN_VISIBLE_FILL_GLYPH_INDEX = 6;
const MIN_VISIBLE_BLOCK_FILL_VALUE = MIN_VISIBLE_FILL_GLYPH_INDEX - 0.5;
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
    let lastForegroundKey = -1;
    let lastGlyphKey = -1;
    let lastCell = "";
    let lastRawRed = Number.NaN;
    let lastRawGreen = Number.NaN;
    let lastRawBlue = Number.NaN;
    let lastFillGlyphIndex = -1;
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
        return this.buildDenseFillOnlyGrid(
          grid,
          columns,
          rows,
          fillGlyphs,
          colors,
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

    const terminalFillGlyphKeys = terminalFillGlyphKeysForMode(terminalGlyphMode);
    const terminalEdgeBias = Math.max(0.5, input.terminalEdgeBias ?? DEFAULT_TERMINAL_EDGE_BIAS);

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
          outputRow[column] = this.background.blankAnsi;
          continue;
        }

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

  private buildFillOnlyGrid(
    grid: string[][],
    columns: number,
    rows: number,
    fillGlyphs: ArrayLike<number>,
    colors: ArrayLike<number>,
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
    cell = `${rgbToAnsiBackground(foregroundRed, foregroundGreen, foregroundBlue)} ${RESET}`;
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
    grid.length = rows;
    for (let row = 0; row < rows; row += 1) {
      grid[row] ??= [];
      grid[row].length = columns;
    }
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
