// Copyright 2023 Im-Beast. MIT license.

import type { Rectangle } from "../../../src/types.ts";
import {
  mixMuxstoneRgb,
  type MuxstoneBackgroundAdvanceOptions,
  type MuxstoneBackgroundCell,
  type MuxstoneBackgroundPoint,
  type MuxstoneOverlayBackground,
  type MuxstoneOverlayCell,
} from "./background.ts";
import type { MuxstoneRgb, MuxstoneThemeSpec } from "./model.ts";

// ── rain constants ──────────────────────────────────────────────────────────

const FRAME_BASELINE_MS = 16.7;
const MAX_FRAME_DELTA_MS = 48;
const POINTER_LIFETIME_MS = 1_500;
const POINTER_REACH_COLUMNS = 6;
const POINTER_SPEED_MULTIPLIER = 2;
const MIN_TAIL_CELLS = 4;
const MAX_TAIL_CELLS = 18;
const CELLS_PER_GLYPH_MUTATION = 70;
const DROPS_PER_COLUMN = 1.1;
/** Speed multiplier when a drop is inside an inactive window. */
const INACTIVE_WINDOW_SPEED_FACTOR = 0.35;

const MATRIX_SPEED_CLASSES: readonly { readonly weight: number; readonly low: number; readonly high: number }[] = Object
  .freeze([
    Object.freeze({ weight: 0.28, low: 0.09, high: 0.24 }), // drifters
    Object.freeze({ weight: 0.27, low: 0.30, high: 0.62 }), // mid field
    Object.freeze({ weight: 0.45, low: 0.95, high: 1.90 }), // streakers
  ]);

const MAX_DROP_SPEED = MATRIX_SPEED_CLASSES[MATRIX_SPEED_CLASSES.length - 1]!.high;

/** Deterministic glyph pool: halfwidth katakana, digits, and sparse symbols. */
const MATRIX_GLYPHS: readonly string[] = Array.from("ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇ0123456789:･=*+-");

/**
 * Target blue used to tint theme colors into a cool rain palette. Every theme
 * gets blended toward this so the rain always reads as "blue-ish" without
 * ignoring the theme's own hues entirely.
 */
const RAIN_BLUE_TARGET: MuxstoneRgb = [80, 140, 220];

// ── splash constants ────────────────────────────────────────────────────────

const SPLASH_LIFETIME_MS = 550;

/**
 * Characters ordered by height above the surface for splash arcs.
 */
const SPLASH_HEIGHT_CHARS: readonly string[] = [".", ",", "'", '"', "`", "~"];

/**
 * Base particle arcs for a splash. Peak heights are scaled by drop speed at
 * spawn time so fast streakers throw big crowns while drifters barely ripple.
 */
const SPLASH_ARC_TEMPLATES: readonly { readonly dx: number; readonly peak: number; readonly delay: number }[] =
  Object.freeze([
    Object.freeze({ dx: 0, peak: 2.8, delay: 0 }),
    Object.freeze({ dx: -1, peak: 2.1, delay: 0.06 }),
    Object.freeze({ dx: 1, peak: 2.1, delay: 0.06 }),
    Object.freeze({ dx: -2, peak: 1.3, delay: 0.13 }),
    Object.freeze({ dx: 2, peak: 1.3, delay: 0.13 }),
    Object.freeze({ dx: -3, peak: 0.6, delay: 0.20 }),
    Object.freeze({ dx: 3, peak: 0.6, delay: 0.20 }),
  ]);

/** Minimum splash scale (for the slowest drifters). */
const SPLASH_SCALE_MIN = 0.25;

// ── 1-D fluid constants ────────────────────────────────────────────────────

/** How much water one raindrop deposits (scaled by speed). */
const RAIN_DEPOSIT_BASE = 0.55;
/**
 * Diffusion rate — fraction of height difference that flows per delta.
 * Tuned for the 125ms background frame interval (delta ≈ 2.87) so water
 * visibly pools for a few seconds before spreading to the edges.
 */
const FLOW_RATE = 0.06;
/** Constant drain per delta so standing water clears over time. */
const EVAPORATION_RATE = 0.001;
/** Water level at which the edge column starts dripping. */
const OVERFLOW_THRESHOLD = 0.15;
/** Water drained from the edge column per drip. */
const OVERFLOW_DRAIN = 0.02;
/** Maximum water level per cell. */
const MAX_WATER_LEVEL = 1.2;
/** Characters rendered on the window top edge, indexed by water depth. */
const PUDDLE_CHARS: readonly string[] = ["~", "~", "=", "#", "#"];

// ── side drizzle constants ──────────────────────────────────────────────────

const DRIZZLE_V_SPEED_LOW = 0.15;
const DRIZZLE_V_SPEED_HIGH = 0.40;
const DRIZZLE_TAIL_MIN = 3;
const DRIZZLE_TAIL_MAX = 6;

// ── interfaces ──────────────────────────────────────────────────────────────

interface RainyDrop {
  column: number;
  y: number;
  speed: number;
  tail: number;
  boost: number;
}

interface RainySplash {
  column: number;
  row: number;
  spawnedAt: number;
  /** Speed-proportional scale applied to all arc peaks. */
  scale: number;
}

interface RainyDrizzle {
  column: number;
  y: number;
  vSpeed: number;
  tail: number;
  windowBottom: number;
}

interface RainyPointer extends MuxstoneBackgroundPoint {
  readonly updatedAt: number;
}

/** Construction options. */
export interface MuxstoneRainyWindowsFieldOptions {
  readonly seed?: number;
  readonly density?: number;
}

/**
 * "Rainy windows" background: matrix rain that treats the active window as a
 * physical surface. Rain splashes on impact (bigger for faster drops),
 * accumulates as a 1-D shallow-water fluid along the top edge, and overflows
 * off the sides as drizzle streams.
 */
export class MuxstoneRainyWindowsField implements MuxstoneOverlayBackground {
  #randomState: number;
  readonly #density: number;
  #bounds?: Rectangle;
  #pointer?: RainyPointer;
  #lastFrameAt?: number;

  // Rain.
  #drops: RainyDrop[] = [];
  #glyphs = new Uint8Array();
  #cells: (MuxstoneBackgroundCell | undefined)[][] = [];

  // Window interaction.
  #activeObstacle?: Rectangle;
  #inactiveObstacles: Rectangle[] = [];
  #splashes: RainySplash[] = [];
  #drizzles: RainyDrizzle[] = [];

  // 1-D fluid along the window top edge.
  #water: Float32Array = new Float32Array(0);
  #waterScratch: Float32Array = new Float32Array(0);
  /** Column offset of the fluid array relative to the local grid. */
  #waterOffset = 0;

  constructor(options: MuxstoneRainyWindowsFieldOptions = {}) {
    this.#randomState = (options.seed ?? 0x52_41_49_4e) >>> 0;
    this.#density = clamp(finite(options.density, 1), 0.1, 4);
  }

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

    // Resolve active obstacle to local coordinates.
    const active = options.activeObstacle ? normalizeBounds(options.activeObstacle) : undefined;
    if (active) {
      this.#activeObstacle = {
        column: active.column - bounds.column,
        row: active.row - bounds.row,
        width: active.width,
        height: active.height,
      };
    } else {
      this.#activeObstacle = undefined;
    }

    // Build inactive obstacle list (all obstacles minus the active one).
    this.#inactiveObstacles = [];
    if (options.obstacles) {
      for (const raw of options.obstacles) {
        const obs = normalizeBounds(raw);
        if (!obs) continue;
        // Skip the active obstacle.
        if (active && obs.column === active.column && obs.row === active.row &&
          obs.width === active.width && obs.height === active.height) continue;
        this.#inactiveObstacles.push({
          column: obs.column - bounds.column,
          row: obs.row - bounds.row,
          width: obs.width,
          height: obs.height,
        });
      }
    }

    let changed = false;
    const obstacle = this.#activeObstacle;
    const inactives = this.#inactiveObstacles;

    // Ensure fluid array matches obstacle width.
    this.#ensureWater(obstacle);

    // ── advance rain drops ──────────────────────────────────────────────
    for (const drop of this.#drops) {
      const boosted = pointerColumn !== undefined &&
        Math.abs(drop.column - pointerColumn) <= POINTER_REACH_COLUMNS;
      drop.boost = boosted ? 1 : Math.max(0, drop.boost - 0.12 * delta);
      // Slow the drop when it is streaking over an inactive window.
      const headRow = Math.floor(drop.y);
      let speedFactor = boosted ? POINTER_SPEED_MULTIPLIER : 1;
      for (const rect of inactives) {
        if (
          drop.column >= rect.column && drop.column < rect.column + rect.width &&
          headRow >= rect.row && headRow < rect.row + rect.height
        ) {
          speedFactor *= INACTIVE_WINDOW_SPEED_FACTOR;
          break;
        }
      }
      const previousHead = headRow;
      drop.y += drop.speed * speedFactor * delta;
      const currentHead = Math.floor(drop.y);
      if (currentHead !== previousHead) changed = true;

      // Impact: head crossed the window top edge inside the window span.
      if (
        obstacle && currentHead !== previousHead &&
        previousHead < obstacle.row && currentHead >= obstacle.row &&
        drop.column >= obstacle.column && drop.column < obstacle.column + obstacle.width
      ) {
        // Splash scaled by speed.
        const scale = SPLASH_SCALE_MIN + (1 - SPLASH_SCALE_MIN) * Math.min(1, drop.speed / MAX_DROP_SPEED);
        this.#splashes.push({ column: drop.column, row: obstacle.row, spawnedAt: now, scale });
        // Deposit water into the fluid.
        const wi = drop.column - this.#waterOffset;
        if (wi >= 0 && wi < this.#water.length) {
          this.#water[wi] = Math.min(MAX_WATER_LEVEL, this.#water[wi]! + drop.speed * RAIN_DEPOSIT_BASE);
        }
        changed = true;
      }

      if (drop.y - drop.tail > bounds.height) {
        this.#respawnDrop(drop, bounds);
        changed = true;
      }
    }

    // ── 1-D fluid step ──────────────────────────────────────────────────
    if (obstacle && this.#water.length > 0) {
      const N = this.#water.length;
      const water = this.#water;
      const scratch = this.#waterScratch;

      // Copy current state.
      scratch.set(water);

      // Diffusion: water flows from high to low columns.
      for (let i = 0; i < N; i += 1) {
        let outflow = 0;
        if (i > 0) {
          const flowLeft = (scratch[i]! - scratch[i - 1]!) * FLOW_RATE * delta;
          if (flowLeft > 0) outflow += flowLeft;
        }
        if (i < N - 1) {
          const flowRight = (scratch[i]! - scratch[i + 1]!) * FLOW_RATE * delta;
          if (flowRight > 0) outflow += flowRight;
        }
        // At edges, water also flows outward (open boundary).
        if (i === 0) {
          const edgeFlow = scratch[i]! * FLOW_RATE * 0.5 * delta;
          if (edgeFlow > 0) outflow += edgeFlow;
        }
        if (i === N - 1) {
          const edgeFlow = scratch[i]! * FLOW_RATE * 0.5 * delta;
          if (edgeFlow > 0) outflow += edgeFlow;
        }
        water[i] = Math.max(0, scratch[i]! - outflow);
      }

      // Inflow from neighbours.
      for (let i = 0; i < N; i += 1) {
        if (i > 0) {
          const flowIn = (scratch[i - 1]! - scratch[i]!) * FLOW_RATE * delta;
          if (flowIn > 0) water[i] = Math.min(MAX_WATER_LEVEL, water[i]! + flowIn);
        }
        if (i < N - 1) {
          const flowIn = (scratch[i + 1]! - scratch[i]!) * FLOW_RATE * delta;
          if (flowIn > 0) water[i] = Math.min(MAX_WATER_LEVEL, water[i]! + flowIn);
        }
      }

      // Evaporation.
      for (let i = 0; i < N; i += 1) {
        water[i] = Math.max(0, water[i]! - EVAPORATION_RATE * delta);
      }

      // Edge overflow → spawn drizzle drops down the window sides.
      if (water[0]! > OVERFLOW_THRESHOLD) {
        water[0] = Math.max(0, water[0]! - OVERFLOW_DRAIN * delta);
        if (this.#random() < 0.30 * delta) {
          this.#spawnDrizzle(obstacle.column - 1, obstacle);
        }
      }
      if (water[N - 1]! > OVERFLOW_THRESHOLD) {
        water[N - 1] = Math.max(0, water[N - 1]! - OVERFLOW_DRAIN * delta);
        if (this.#random() < 0.30 * delta) {
          this.#spawnDrizzle(obstacle.column + obstacle.width, obstacle);
        }
      }

      changed = true;
    }

    // ── advance drizzle drops ───────────────────────────────────────────
    for (const drizzle of this.#drizzles) {
      const prev = Math.floor(drizzle.y);
      drizzle.y += drizzle.vSpeed * delta;
      if (Math.floor(drizzle.y) !== prev) changed = true;
    }
    const drizzleBefore = this.#drizzles.length;
    this.#drizzles = this.#drizzles.filter((d) => d.y - d.tail < d.windowBottom);
    if (this.#drizzles.length !== drizzleBefore) changed = true;
    if (this.#drizzles.length > 0) changed = true;

    // ── expire splashes ─────────────────────────────────────────────────
    const splashesBefore = this.#splashes.length;
    this.#splashes = this.#splashes.filter((s) => now - s.spawnedAt < SPLASH_LIFETIME_MS);
    if (this.#splashes.length !== splashesBefore) changed = true;
    if (this.#splashes.length > 0) changed = true;

    // ── glyph mutations ─────────────────────────────────────────────────
    const mutations = Math.max(1, Math.floor((bounds.width * bounds.height) / CELLS_PER_GLYPH_MUTATION));
    for (let i = 0; i < mutations; i += 1) {
      const cell = Math.floor(this.#random() * this.#glyphs.length);
      this.#glyphs[cell] = Math.floor(this.#random() * MATRIX_GLYPHS.length);
      changed = true;
    }
    return changed;
  }

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

    // Derive a blue-tinted rain palette that harmonizes with the current theme.
    const rainBright = mixMuxstoneRgb(mixMuxstoneRgb(theme.text, RAIN_BLUE_TARGET, 0.45), theme.accent, 0.2);
    const rainBody = mixMuxstoneRgb(theme.accent, RAIN_BLUE_TARGET, 0.5);
    const obstacle = this.#activeObstacle;

    // ── rain drops (blocked behind active window) ───────────────────────
    for (const drop of this.#drops) {
      const { column } = drop;
      if (column < 0 || column >= width) continue;
      const blocked = obstacle !== undefined &&
        column >= obstacle.column && column < obstacle.column + obstacle.width;
      const head = Math.floor(drop.y);
      for (let offset = 0; offset <= drop.tail; offset += 1) {
        const row = head - offset;
        if (row < 0 || row >= height) continue;
        if (blocked && row >= obstacle!.row) continue;
        const glyph = glyphAt(this.#glyphs, row, column, width);
        if (offset === 0) {
          const foreground = drop.boost > 0 ? mixMuxstoneRgb(rainBright, theme.text, 0.45 * drop.boost) : rainBright;
          this.#cells[row]![column] = { char: glyph, foreground, bold: true };
          continue;
        }
        const fade = (0.18 + 0.8 * (offset / drop.tail)) * (1 - 0.3 * drop.boost);
        this.#cells[row]![column] = { char: glyph, foreground: mixMuxstoneRgb(rainBody, theme.background, fade) };
      }
    }

    return this.#cells;
  }

  /**
   * Overlay cells painted AFTER windows so puddle, drizzle, and splashes
   * remain visible even when tiled windows cover the background grid.
   */
  rasterizeOverlayCells(
    bounds: Rectangle,
    theme: MuxstoneThemeSpec,
  ): readonly MuxstoneOverlayCell[] {
    const normalized = normalizeBounds(bounds);
    if (!normalized) return [];
    const { width, height } = normalized;
    const obstacle = this.#activeObstacle;
    const overlay: MuxstoneOverlayCell[] = [];

    const rainBright = mixMuxstoneRgb(mixMuxstoneRgb(theme.text, RAIN_BLUE_TARGET, 0.45), theme.accent, 0.2);
    const rainBody = mixMuxstoneRgb(theme.accent, RAIN_BLUE_TARGET, 0.5);

    // ── splash arcs (scaled by impact speed) ────────────────────────────
    const now = this.#lastFrameAt ?? 0;
    for (const splash of this.#splashes) {
      const globalLife = (now - splash.spawnedAt) / SPLASH_LIFETIME_MS;
      if (globalLife >= 1) continue;
      for (const arc of SPLASH_ARC_TEMPLATES) {
        const localT = (globalLife - arc.delay) / (1 - arc.delay);
        if (localT < 0 || localT > 1) continue;
        const scaledPeak = arc.peak * splash.scale;
        const heightCells = scaledPeak * Math.sin(Math.PI * localT);
        const cellRow = splash.row - 1 - Math.round(heightCells);
        if (cellRow < 0 || cellRow >= height) continue;
        const col = splash.column + arc.dx;
        if (col < 0 || col >= width) continue;
        const charIndex = Math.min(
          SPLASH_HEIGHT_CHARS.length - 1,
          Math.floor(heightCells / Math.max(0.1, scaledPeak) * (SPLASH_HEIGHT_CHARS.length - 0.01)),
        );
        const char = SPLASH_HEIGHT_CHARS[charIndex] ?? SPLASH_HEIGHT_CHARS[0]!;
        const arcFade = Math.sin(Math.PI * localT);
        const distanceDim = 1 - Math.abs(arc.dx) * 0.12;
        const alpha = arcFade * distanceDim;
        if (alpha <= 0.05) continue;
        const foreground = mixMuxstoneRgb(theme.background, rainBright, alpha);
        overlay.push({ column: col, row: cellRow, cell: { char, foreground, bold: alpha > 0.6 } });
      }
    }

    // ── puddle: fluid level on the row above the window title bar ──────
    if (obstacle && this.#water.length > 0) {
      const puddleRow = obstacle.row - 1;
      if (puddleRow >= 0 && puddleRow < height) {
        const puddleColor = mixMuxstoneRgb(rainBright, theme.text, 0.4);
        for (let i = 0; i < this.#water.length; i += 1) {
          const level = this.#water[i]!;
          if (level < 0.04) continue;
          const col = this.#waterOffset + i;
          if (col < 0 || col >= width) continue;
          const charIdx = Math.min(
            PUDDLE_CHARS.length - 1,
            Math.floor((level / MAX_WATER_LEVEL) * PUDDLE_CHARS.length),
          );
          const char = PUDDLE_CHARS[charIdx] ?? PUDDLE_CHARS[0]!;
          const alpha = Math.min(1, 0.4 + level / 0.6);
          const foreground = mixMuxstoneRgb(theme.background, puddleColor, alpha);
          overlay.push({ column: col, row: puddleRow, cell: { char, foreground, bold: level > 0.3 } });
        }
      }
    }

    // ── side drizzle streams along window borders ───────────────────────
    const drizzleHead: MuxstoneRgb = mixMuxstoneRgb(rainBright, theme.text, 0.3);
    const drizzleTail: MuxstoneRgb = mixMuxstoneRgb(rainBody, theme.background, 0.15);
    for (const drizzle of this.#drizzles) {
      const col = drizzle.column;
      if (col < 0 || col >= width) continue;
      const head = Math.floor(drizzle.y);
      for (let t = 0; t <= drizzle.tail; t += 1) {
        const row = head - t;
        if (row < 0 || row >= height) continue;
        const fade = t / (drizzle.tail + 1);
        const char = t === 0 ? "#" : t === 1 ? "=" : "~";
        const fg = mixMuxstoneRgb(drizzleHead, drizzleTail, fade);
        overlay.push({ column: col, row, cell: { char, foreground: fg, bold: t === 0 } });
      }
    }

    return overlay;
  }

  // ── private helpers ─────────────────────────────────────────────────────

  #ensureBounds(bounds: Rectangle): void {
    const previous = this.#bounds;
    if (previous?.width === bounds.width && previous.height === bounds.height) {
      this.#bounds = { ...bounds };
      return;
    }
    this.#bounds = { ...bounds };
    const area = bounds.width * bounds.height;
    this.#glyphs = new Uint8Array(area);
    for (let i = 0; i < area; i += 1) {
      this.#glyphs[i] = Math.floor(this.#random() * MATRIX_GLYPHS.length);
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

  /** Resize the fluid arrays when the obstacle width changes. */
  #ensureWater(obstacle: Rectangle | undefined): void {
    if (!obstacle) {
      if (this.#water.length !== 0) {
        this.#water = new Float32Array(0);
        this.#waterScratch = new Float32Array(0);
      }
      return;
    }
    if (this.#water.length === obstacle.width && this.#waterOffset === obstacle.column) return;
    this.#water = new Float32Array(obstacle.width);
    this.#waterScratch = new Float32Array(obstacle.width);
    this.#waterOffset = obstacle.column;
  }

  #createDrop(bounds: Rectangle): RainyDrop {
    const speed = this.#rollSpeed();
    return {
      column: Math.floor(this.#random() * bounds.width),
      y: -this.#random() * bounds.height,
      speed,
      tail: this.#rollTail(speed),
      boost: 0,
    };
  }

  #respawnDrop(drop: RainyDrop, bounds: Rectangle): void {
    drop.column = Math.floor(this.#random() * bounds.width);
    drop.y = -(1 + this.#random() * bounds.height * 0.6);
    drop.speed = this.#rollSpeed();
    drop.tail = this.#rollTail(drop.speed);
    drop.boost = 0;
  }

  #spawnDrizzle(column: number, obstacle: Rectangle): void {
    this.#drizzles.push({
      column,
      y: obstacle.row,
      vSpeed: DRIZZLE_V_SPEED_LOW + this.#random() * (DRIZZLE_V_SPEED_HIGH - DRIZZLE_V_SPEED_LOW),
      tail: Math.round(DRIZZLE_TAIL_MIN + this.#random() * (DRIZZLE_TAIL_MAX - DRIZZLE_TAIL_MIN)),
      windowBottom: obstacle.row + obstacle.height,
    });
  }

  #rollSpeed(): number {
    let roll = this.#random();
    for (const sc of MATRIX_SPEED_CLASSES) {
      if (roll < sc.weight) return sc.low + this.#random() * (sc.high - sc.low);
      roll -= sc.weight;
    }
    const last = MATRIX_SPEED_CLASSES[MATRIX_SPEED_CLASSES.length - 1]!;
    return last.low + this.#random() * (last.high - last.low);
  }

  #rollTail(speed: number): number {
    const span = MAX_TAIL_CELLS - MIN_TAIL_CELLS;
    const bias = Math.min(1, speed / MAX_DROP_SPEED);
    const base = MIN_TAIL_CELLS + span * bias * 0.6;
    return Math.min(MAX_TAIL_CELLS, Math.round(base + this.#random() * span * 0.4));
  }

  #random(): number {
    this.#randomState = (Math.imul(this.#randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return this.#randomState / 0x1_0000_0000;
  }
}

// ── module-level helpers ──────────────────────────────────────────────────

function glyphAt(glyphs: Uint8Array, row: number, column: number, width: number): string {
  return MATRIX_GLYPHS[glyphs[row * width + column] ?? 0] ?? MATRIX_GLYPHS[0]!;
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
