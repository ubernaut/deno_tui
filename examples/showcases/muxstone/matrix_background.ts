// Copyright 2023 Im-Beast. MIT license.

import type { Rectangle } from "../../../src/types.ts";
import {
  mixMuxstoneRgb,
  type MuxstoneAnimatedBackground,
  type MuxstoneBackgroundAdvanceOptions,
  type MuxstoneBackgroundCell,
  type MuxstoneBackgroundPoint,
} from "./background.ts";
import type { MuxstoneThemeSpec } from "./model.ts";

const FRAME_BASELINE_MS = 16.7;
const MAX_FRAME_DELTA_MS = 48;
const POINTER_LIFETIME_MS = 1_500;
const POINTER_REACH_COLUMNS = 6;
const POINTER_SPEED_MULTIPLIER = 2;
const MIN_TAIL_CELLS = 4;
const MAX_TAIL_CELLS = 18;

/**
 * Speed classes for falling columns. A uniform spread made every column drift
 * at much the same rate; tiering it keeps a slow-drifting majority while a few
 * streakers tear down the screen roughly an order of magnitude faster.
 *
 * Weights are spawn probabilities, not the mix you see: a streaker clears the
 * screen in a fraction of a drifter's lifetime, so it occupies its column for
 * proportionally less time. The fast weight is skewed well above its intended
 * on-screen share to compensate.
 */
const MATRIX_SPEED_CLASSES: readonly { readonly weight: number; readonly low: number; readonly high: number }[] = Object
  .freeze([
    Object.freeze({ weight: 0.28, low: 0.09, high: 0.24 }), // drifters
    Object.freeze({ weight: 0.27, low: 0.30, high: 0.62 }), // mid field
    Object.freeze({ weight: 0.45, low: 0.95, high: 1.90 }), // streakers
  ]);
const DROPS_PER_COLUMN = 1.1;
const CELLS_PER_GLYPH_MUTATION = 70;

/** Deterministic glyph pool: halfwidth katakana, digits, and sparse symbols. */
const MATRIX_GLYPHS: readonly string[] = Array.from("ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇ0123456789:・=*+-");

/** Construction options shared by the Muxstone animated background catalog. */
export interface MuxstoneMatrixRainFieldOptions {
  readonly seed?: number;
  /** Scales the active drop count; 1 keeps roughly one drop per two columns. */
  readonly density?: number;
}

/** One falling glyph column snapshot exposed for deterministic tests. */
export interface MuxstoneMatrixRainDropSnapshot {
  readonly column: number;
  readonly y: number;
  readonly speed: number;
  readonly tail: number;
  readonly boost: number;
}

/** Inspection payload mirroring the metaball field's test hook. */
export interface MuxstoneMatrixRainInspection {
  readonly bounds?: Rectangle;
  readonly drops: readonly MuxstoneMatrixRainDropSnapshot[];
}

interface MatrixDrop {
  column: number;
  y: number;
  speed: number;
  tail: number;
  boost: number;
}

interface MatrixPointer extends MuxstoneBackgroundPoint {
  readonly updatedAt: number;
}

/**
 * Classic "digital rain" background: independent glyph columns fall at seeded
 * speeds with bright heads and fading tails. All state derives from one LCG so
 * identical seeds and timestamps reproduce identical grids.
 */
export class MuxstoneMatrixRainField implements MuxstoneAnimatedBackground {
  #randomState: number;
  readonly #density: number;
  #bounds?: Rectangle;
  #pointer?: MatrixPointer;
  #lastFrameAt?: number;
  #drops: MatrixDrop[] = [];
  #glyphs = new Uint8Array();
  #cells: (MuxstoneBackgroundCell | undefined)[][] = [];

  constructor(options: MuxstoneMatrixRainFieldOptions = {}) {
    this.#randomState = (options.seed ?? 0x4d_41_54_52) >>> 0;
    this.#density = clamp(finite(options.density, 1), 0.1, 4);
  }

  /** Updates the transient acceleration point without coupling it to input routing. */
  setPointer(point: MuxstoneBackgroundPoint, now = performance.now()): void {
    if (!Number.isFinite(point.column) || !Number.isFinite(point.row)) return;
    this.#pointer = {
      column: point.column,
      row: point.row,
      updatedAt: finite(now, performance.now()),
    };
  }

  clearPointer(): void {
    this.#pointer = undefined;
  }

  /** Advances every drop once; returns true when a head crossed a cell or a glyph mutated. */
  advance(options: MuxstoneBackgroundAdvanceOptions): boolean {
    const bounds = normalizeBounds(options.bounds);
    if (!bounds) return false;
    this.#ensureBounds(bounds);
    const now = finite(options.now, performance.now());
    const elapsed = this.#lastFrameAt === undefined
      ? FRAME_BASELINE_MS
      : Math.min(MAX_FRAME_DELTA_MS, Math.max(0, now - this.#lastFrameAt));
    this.#lastFrameAt = now;
    if (elapsed <= 0) return false;
    const delta = elapsed / FRAME_BASELINE_MS;
    const pointer = this.#pointer && now - this.#pointer.updatedAt <= POINTER_LIFETIME_MS ? this.#pointer : undefined;
    const pointerColumn = pointer ? pointer.column - bounds.column : undefined;

    let changed = false;
    for (const drop of this.#drops) {
      const boosted = pointerColumn !== undefined &&
        Math.abs(drop.column - pointerColumn) <= POINTER_REACH_COLUMNS;
      drop.boost = boosted ? 1 : Math.max(0, drop.boost - 0.12 * delta);
      const previousHead = Math.floor(drop.y);
      drop.y += drop.speed * (boosted ? POINTER_SPEED_MULTIPLIER : 1) * delta;
      if (Math.floor(drop.y) !== previousHead) changed = true;
      if (drop.y - drop.tail > bounds.height) {
        this.#respawnDrop(drop, bounds);
        changed = true;
      }
    }

    const mutations = Math.max(1, Math.floor((bounds.width * bounds.height) / CELLS_PER_GLYPH_MUTATION));
    for (let index = 0; index < mutations; index += 1) {
      const cell = Math.floor(this.#random() * this.#glyphs.length);
      this.#glyphs[cell] = Math.floor(this.#random() * MATRIX_GLYPHS.length);
      changed = true;
    }
    return changed;
  }

  /** Paints heads and fading tails into a reused row-major cell buffer. */
  rasterizeCells(
    bounds: Rectangle,
    theme: MuxstoneThemeSpec,
  ): ReadonlyArray<ReadonlyArray<MuxstoneBackgroundCell | undefined>> {
    const normalized = normalizeBounds(bounds);
    if (!normalized) {
      this.#cells = [];
      return this.#cells;
    }
    this.#ensureBounds(normalized);
    const { width, height } = normalized;
    this.#ensureCellBuffer(width, height);

    const headBase = mixMuxstoneRgb(theme.text, theme.accent, 0.35);
    for (const drop of this.#drops) {
      const { column } = drop;
      if (column < 0 || column >= width) continue;
      const head = Math.floor(drop.y);
      for (let offset = 0; offset <= drop.tail; offset += 1) {
        const row = head - offset;
        if (row < 0 || row >= height) continue;
        const glyph = MATRIX_GLYPHS[this.#glyphs[row * width + column] ?? 0] ?? MATRIX_GLYPHS[0]!;
        if (offset === 0) {
          const foreground = drop.boost > 0 ? mixMuxstoneRgb(headBase, theme.text, 0.45 * drop.boost) : headBase;
          this.#cells[row]![column] = { char: glyph, foreground, bold: true };
          continue;
        }
        const fade = (0.18 + 0.8 * (offset / drop.tail)) * (1 - 0.3 * drop.boost);
        this.#cells[row]![column] = { char: glyph, foreground: mixMuxstoneRgb(theme.accent, theme.background, fade) };
      }
    }
    return this.#cells;
  }

  /** Deterministic state snapshot for tests. */
  inspect(): MuxstoneMatrixRainInspection {
    return {
      ...(this.#bounds ? { bounds: { ...this.#bounds } } : {}),
      drops: this.#drops.map((drop) => ({ ...drop })),
    };
  }

  #ensureBounds(bounds: Rectangle): void {
    const previous = this.#bounds;
    if (previous?.width === bounds.width && previous.height === bounds.height) {
      this.#bounds = { ...bounds };
      return;
    }
    this.#bounds = { ...bounds };
    const area = bounds.width * bounds.height;
    this.#glyphs = new Uint8Array(area);
    for (let index = 0; index < area; index += 1) {
      this.#glyphs[index] = Math.floor(this.#random() * MATRIX_GLYPHS.length);
    }
    const count = Math.max(1, Math.round(bounds.width * DROPS_PER_COLUMN * this.#density));
    this.#drops = Array.from({ length: count }, () => this.#createDrop(bounds));
  }

  #ensureCellBuffer(width: number, height: number): void {
    if (this.#cells.length === height && (this.#cells[0]?.length ?? -1) === width) {
      for (const row of this.#cells) row.fill(undefined);
      return;
    }
    this.#cells = Array.from(
      { length: height },
      () => new Array<MuxstoneBackgroundCell | undefined>(width).fill(undefined),
    );
  }

  #createDrop(bounds: Rectangle): MatrixDrop {
    const speed = this.#rollSpeed();
    return {
      column: Math.floor(this.#random() * bounds.width),
      y: -this.#random() * bounds.height,
      speed,
      tail: this.#rollTail(speed),
      boost: 0,
    };
  }

  #respawnDrop(drop: MatrixDrop, bounds: Rectangle): void {
    drop.column = Math.floor(this.#random() * bounds.width);
    drop.y = -(1 + this.#random() * bounds.height * 0.6);
    drop.speed = this.#rollSpeed();
    drop.tail = this.#rollTail(drop.speed);
    drop.boost = 0;
  }

  /** Draws a fall rate from the weighted speed classes. */
  #rollSpeed(): number {
    let roll = this.#random();
    for (const speedClass of MATRIX_SPEED_CLASSES) {
      if (roll < speedClass.weight) {
        return speedClass.low + this.#random() * (speedClass.high - speedClass.low);
      }
      roll -= speedClass.weight;
    }
    const last = MATRIX_SPEED_CLASSES[MATRIX_SPEED_CLASSES.length - 1]!;
    return last.low + this.#random() * (last.high - last.low);
  }

  /** Faster columns stretch longer tails, so streaks read as motion not noise. */
  #rollTail(speed: number): number {
    const span = MAX_TAIL_CELLS - MIN_TAIL_CELLS;
    const bias = Math.min(1, speed / MATRIX_SPEED_CLASSES[MATRIX_SPEED_CLASSES.length - 1]!.high);
    const base = MIN_TAIL_CELLS + span * bias * 0.6;
    return Math.min(MAX_TAIL_CELLS, Math.round(base + this.#random() * span * 0.4));
  }

  #random(): number {
    this.#randomState = (Math.imul(this.#randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return this.#randomState / 0x1_0000_0000;
  }
}

function normalizeBounds(value: Rectangle): Rectangle | undefined {
  if (
    !Number.isFinite(value.column) || !Number.isFinite(value.row) ||
    !Number.isFinite(value.width) || !Number.isFinite(value.height)
  ) return undefined;
  const width = Math.floor(value.width);
  const height = Math.floor(value.height);
  if (width <= 0 || height <= 0) return undefined;
  return { column: Math.floor(value.column), row: Math.floor(value.row), width, height };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
