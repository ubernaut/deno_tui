// Copyright 2023 Im-Beast. MIT license.
import {
  ASCII_FILL_GLYPHS,
  blockFillGlyphForBucket,
  EDGE_GLYPHS,
  FILL_GLYPHS,
  type TerminalGlyphStyle,
} from "./glyphs.ts";

const TILE_PIXEL_COUNT = 64;
const DEFAULT_TERMINAL_EDGE_BIAS = 1;
const GOHU_11_EDGE_SHAPE_MISMATCH = [0, 3, 10, 9] as const;
const GOHU_11_FILL_GLYPH_COVERAGE = [0, 2, 4, 6, 9, 11, 13, 15, 18, 18] as const;
const ASCII_FILL_GLYPH_COVERAGE = [0, 1, 2, 4, 6, 8, 10, 13, 16, 18] as const;
const MIXED_FILL_GLYPHS_BY_INDEX = createMixedFillGlyphTable();
export const CELL_GLYPH_KEY_STRIDE = 64;
const GLYPH_KEY_GLYPHS_OFFSET = 16;
const GLYPH_KEY_MIXED_OFFSET = 32;
const EDGE_GLYPH_KEY_OFFSET = 48;
const GLYPHS_BY_KEY = createGlyphKeyTable();
export const GLYPH_MODE_BLOCKS = 0;
const GLYPH_MODE_GLYPHS = 1;
const GLYPH_MODE_MIXED = 2;

export type TerminalGlyphMode = typeof GLYPH_MODE_BLOCKS | typeof GLYPH_MODE_GLYPHS | typeof GLYPH_MODE_MIXED;

const BLOCK_FILL_GLYPH_KEYS_BY_INDEX = createFillGlyphKeyTable(GLYPH_MODE_BLOCKS);
const ASCII_FILL_GLYPH_KEYS_BY_INDEX = createFillGlyphKeyTable(GLYPH_MODE_GLYPHS);
const MIXED_FILL_GLYPH_KEYS_BY_INDEX = createFillGlyphKeyTable(GLYPH_MODE_MIXED);

export function glyphForKey(key: number): string {
  return GLYPHS_BY_KEY[Math.max(0, Math.min(GLYPHS_BY_KEY.length - 1, key))] ?? " ";
}

export function isSolidBlockFillGlyphKey(key: number): boolean {
  return key > 0 && key < GLYPH_KEY_GLYPHS_OFFSET;
}

export function terminalGlyphModeForStyle(style: TerminalGlyphStyle): TerminalGlyphMode {
  switch (style) {
    case "glyphs":
      return GLYPH_MODE_GLYPHS;
    case "mixed":
      return GLYPH_MODE_MIXED;
    default:
      return GLYPH_MODE_BLOCKS;
  }
}

export function terminalFillGlyphKeysForMode(mode: TerminalGlyphMode): readonly number[] {
  if (mode === GLYPH_MODE_GLYPHS) return ASCII_FILL_GLYPH_KEYS_BY_INDEX;
  if (mode === GLYPH_MODE_MIXED) return MIXED_FILL_GLYPH_KEYS_BY_INDEX;
  return BLOCK_FILL_GLYPH_KEYS_BY_INDEX;
}

export function fillGlyphKeyForIndex(keys: readonly number[], fillGlyphIndex: number): number {
  return keys[Math.max(0, Math.min(keys.length - 1, fillGlyphIndex))] ?? 0;
}

export function terminalGlyphForCell(
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
