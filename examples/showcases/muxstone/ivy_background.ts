// Copyright 2023 Im-Beast. MIT license.

import type { Rectangle } from "../../../src/types.ts";
import type { MuxstoneRgb, MuxstoneThemeSpec } from "./model.ts";
import {
  mixMuxstoneRgb,
  type MuxstoneAnimatedBackground,
  type MuxstoneBackgroundAdvanceOptions,
  type MuxstoneBackgroundCell,
  type MuxstoneBackgroundPoint,
} from "./background.ts";

const TAU = Math.PI * 2;
const FRAME_BASELINE_MS = 16.7;
const MAX_FRAME_DELTA_MS = 48;
const POINTER_LIFETIME_MS = 1_600;
const POINTER_REACH_CELLS = 6;

/** Cells a strand extends per baseline frame while it is still growing. */
const GROWTH_CELLS_PER_FRAME = 0.16;
/** How sharply a strand may turn per cell, in radians. */
const MAX_TURN_PER_CELL = 0.34;
/** Cells a strand must reach before it stops extending. */
const MIN_STRAND_LENGTH = 18;
const STRAND_LENGTH_SPREAD = 70;
/** How often the field surveys itself for bare ground worth seeding. */
const SURVEY_INTERVAL_MS = 6_000;
/** Strands live this long before their trailing cells begin to wither. */
const STRAND_LIFETIME_MS = 150_000;
/** A strand only starts budding once it has been growing this long. */
const BLOOM_AGE_MS = 22_000;
/** A bud takes this long to open from first swell to full flower. */
const BLOOM_OPEN_MS = 14_000;
/** Cells between bud sites along a mature strand. */
const BLOOM_SPACING_CELLS = 11;
const MAX_STRANDS = 40;
const SURVEY_SAMPLES = 40;
const OBSTACLE_MARGIN = 1;

/** Vine glyphs chosen by the direction the strand is travelling. */
const VINE_HORIZONTAL = "─";
const VINE_VERTICAL = "│";
const VINE_DIAGONAL_DOWN = "╲";
const VINE_DIAGONAL_UP = "╱";
/** Arc glyphs used where a strand changes quadrant, giving the curling look. */
const ARC_GLYPHS = ["╭", "╮", "╰", "╯"] as const;
/** Leaves scattered along a strand. */
const LEAF_GLYPHS = ["·", "•", "¤", "☘"] as const;
/** Bud opening sequence: swell, part, open, full bloom. */
const BLOOM_STAGES = ["·", "∘", "○", "❁"] as const;

/** One flower on a strand, keyed to the cell index it sits on. */
export interface MuxstoneIvyBloomSnapshot {
  readonly cellIndex: number;
  /** 0 at first swell through 1 at full bloom. */
  readonly openness: number;
  /** Index into the theme's flower palette. */
  readonly hue: number;
}

/** One ivy strand exposed for deterministic tests. */
export interface MuxstoneIvyStrandSnapshot {
  readonly cells: readonly { readonly x: number; readonly y: number }[];
  readonly ageMs: number;
  readonly growing: boolean;
  readonly blooms: readonly MuxstoneIvyBloomSnapshot[];
}

/** Serializable ivy inspection for tests and diagnostics. */
export interface MuxstoneIvyInspection {
  readonly strands: readonly MuxstoneIvyStrandSnapshot[];
  readonly obstacles: readonly Rectangle[];
}

/** Construction options for the ivy field. */
export interface MuxstoneIvyFieldOptions {
  readonly seed?: number;
  /** Scales strand population; 1 keeps a comfortable spread. */
  readonly density?: number;
}

interface IvyCell {
  x: number;
  y: number;
  /** Heading, in radians, the strand held when it entered this cell. */
  heading: number;
  /** True where the strand changed quadrant, so an arc glyph is drawn. */
  arc: boolean;
  leaf: boolean;
}

interface IvyBloom {
  cellIndex: number;
  openedMs: number;
  hue: number;
}

interface IvyStrand {
  cells: IvyCell[];
  heading: number;
  /** Signed curl applied every cell, re-rolled occasionally for a wandering arc. */
  curl: number;
  curlHoldCells: number;
  targetLength: number;
  growthAccumulator: number;
  ageMs: number;
  blooms: IvyBloom[];
  nextBloomCell: number;
  hue: number;
}

interface IvyPointer extends MuxstoneBackgroundPoint {
  readonly updatedAt: number;
}

/**
 * Creeping ivy background. Strands seed at the board edges and extend along
 * gently curving arcs, hugging keep-out zones the way the circuit field routes
 * around windows, so the fabric grows over reclaimed windows and leaves the
 * focused one clear. Mature strands set buds along their length that open into
 * flowers over the following few seconds; the palette is taken entirely from
 * the active theme so the bloom stays in key with the desktop.
 */
export class MuxstoneIvyField implements MuxstoneAnimatedBackground {
  readonly #density: number;
  #randomState: number;
  #bounds?: Rectangle;
  #strands: IvyStrand[] = [];
  #keepOut = new Uint8Array();
  #obstacles: Rectangle[] = [];
  #obstacleKey?: string;
  #pointer?: IvyPointer;
  #activePointer?: { column: number; row: number };
  #lastFrameAt?: number;
  #surveyTimerMs = 0;
  #cells: (MuxstoneBackgroundCell | undefined)[][] = [];

  constructor(options: MuxstoneIvyFieldOptions = {}) {
    this.#density = Math.min(3, Math.max(0.25, options.density ?? 1));
    this.#randomState = (options.seed ?? 0x49_56_59_31) >>> 0;
  }

  setPointer(point: MuxstoneBackgroundPoint, now = performance.now()): void {
    if (!Number.isFinite(point.column) || !Number.isFinite(point.row)) return;
    this.#pointer = { column: point.column, row: point.row, updatedAt: finite(now, 0) };
  }

  clearPointer(): void {
    this.#pointer = undefined;
  }

  /** Extends strands, ages blooms, and reseeds bare ground; true when anything moved. */
  advance(options: MuxstoneBackgroundAdvanceOptions): boolean {
    const bounds = normalizeBounds(options.bounds);
    if (!bounds) return false;
    this.#ensureLayout(bounds);
    const now = finite(options.now, performance.now());
    const elapsed = this.#lastFrameAt === undefined
      ? FRAME_BASELINE_MS
      : Math.min(MAX_FRAME_DELTA_MS, Math.max(0, now - this.#lastFrameAt));
    this.#lastFrameAt = now;
    if (elapsed <= 0) return false;
    const delta = elapsed / FRAME_BASELINE_MS;
    this.#surveyTimerMs += elapsed;

    const pointer = this.#pointer && now - this.#pointer.updatedAt <= POINTER_LIFETIME_MS ? this.#pointer : undefined;
    this.#activePointer = pointer
      ? { column: pointer.column - bounds.column, row: pointer.row - bounds.row }
      : undefined;

    let changed = this.#syncObstacles(options, bounds);

    for (let index = this.#strands.length - 1; index >= 0; index -= 1) {
      const strand = this.#strands[index]!;
      strand.ageMs += elapsed;
      if (this.#extendStrand(strand, bounds, delta)) changed = true;
      if (this.#advanceBlooms(strand, elapsed)) changed = true;
      // Old strands wither from the tail so the board keeps turning over.
      if (strand.ageMs > STRAND_LIFETIME_MS) {
        strand.cells.shift();
        for (const bloom of strand.blooms) bloom.cellIndex -= 1;
        strand.blooms = strand.blooms.filter((bloom) => bloom.cellIndex >= 0);
        strand.nextBloomCell = Math.max(0, strand.nextBloomCell - 1);
        changed = true;
        if (strand.cells.length === 0) this.#strands.splice(index, 1);
      }
    }

    while (this.#surveyTimerMs >= SURVEY_INTERVAL_MS) {
      this.#surveyTimerMs -= SURVEY_INTERVAL_MS;
      if (this.#seedIntoOpenGround(bounds)) changed = true;
    }
    return changed;
  }

  /** Paints vines, leaves, and blooms into a reused row-major cell buffer. */
  rasterizeCells(
    bounds: Rectangle,
    theme: MuxstoneThemeSpec,
  ): ReadonlyArray<ReadonlyArray<MuxstoneBackgroundCell | undefined>> {
    const normalized = normalizeBounds(bounds);
    if (!normalized) return [];
    this.#ensureLayout(normalized);
    const { width, height } = normalized;
    this.#ensureCellBuffer(width, height);
    for (const row of this.#cells) row.fill(undefined);

    const vineDeep = mixMuxstoneRgb(theme.background, theme.success, 0.45);
    const vineLit = mixMuxstoneRgb(theme.success, theme.text, 0.3);
    const flowerPalette: readonly MuxstoneRgb[] = [
      theme.accent,
      theme.warning,
      theme.danger,
      mixMuxstoneRgb(theme.accent, theme.text, 0.4),
    ];

    for (const strand of this.#strands) {
      const length = strand.cells.length;
      if (length === 0) continue;
      const bloomAt = new Map<number, IvyBloom>();
      for (const bloom of strand.blooms) bloomAt.set(bloom.cellIndex, bloom);

      for (let index = 0; index < length; index += 1) {
        const cell = strand.cells[index]!;
        if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) continue;
        const bloom = bloomAt.get(index);
        if (bloom) {
          const stage = Math.min(
            BLOOM_STAGES.length - 1,
            Math.floor(bloom.openedMs / BLOOM_OPEN_MS * BLOOM_STAGES.length),
          );
          const openness = Math.min(1, bloom.openedMs / BLOOM_OPEN_MS);
          const petal = flowerPalette[bloom.hue % flowerPalette.length]!;
          this.#cells[cell.y]![cell.x] = {
            char: BLOOM_STAGES[stage]!,
            // A bud starts near the vine's own green and saturates as it opens.
            foreground: mixMuxstoneRgb(vineLit, petal, 0.35 + openness * 0.65),
            ...(openness > 0.6 ? { bold: true } : {}),
          };
          continue;
        }
        // Tip cells read brightest so a growing strand shows its leading edge.
        const tipness = length <= 1 ? 1 : index / (length - 1);
        const near = this.#activePointer !== undefined &&
          Math.max(Math.abs(cell.x - this.#activePointer.column), Math.abs(cell.y - this.#activePointer.row)) <=
            POINTER_REACH_CELLS;
        const shade = mixMuxstoneRgb(vineDeep, vineLit, tipness * 0.75 + (near ? 0.25 : 0));
        this.#cells[cell.y]![cell.x] = {
          char: cell.leaf ? LEAF_GLYPHS[(cell.x + cell.y) % LEAF_GLYPHS.length]! : ivyGlyph(cell),
          foreground: shade,
          ...(near || tipness > 0.94 ? { bold: true } : {}),
        };
      }
    }
    return this.#cells;
  }

  /** Serializable snapshot for deterministic tests. */
  inspect(): MuxstoneIvyInspection {
    return {
      strands: this.#strands.map((strand) => ({
        cells: strand.cells.map((cell) => ({ x: cell.x, y: cell.y })),
        ageMs: strand.ageMs,
        growing: strand.cells.length < strand.targetLength,
        blooms: strand.blooms.map((bloom) => ({
          cellIndex: bloom.cellIndex,
          openness: Math.min(1, bloom.openedMs / BLOOM_OPEN_MS),
          hue: bloom.hue,
        })),
      })),
      obstacles: this.#obstacles.map((rectangle) => ({ ...rectangle })),
    };
  }

  #ensureLayout(bounds: Rectangle): void {
    const previous = this.#bounds;
    if (previous?.width === bounds.width && previous.height === bounds.height) {
      this.#bounds = { ...bounds };
      return;
    }
    this.#bounds = { ...bounds };
    this.#keepOut = new Uint8Array(bounds.width * bounds.height);
    this.#obstacles = [];
    this.#obstacleKey = undefined;
    this.#strands = [];
    const target = clampInteger(Math.round((4 + (bounds.width * bounds.height) / 380) * this.#density), 3, MAX_STRANDS);
    for (let index = 0; index < target; index += 1) this.#seedStrand(bounds);
  }

  #ensureCellBuffer(width: number, height: number): void {
    if (this.#cells.length === height && this.#cells[0]?.length === width) return;
    this.#cells = Array.from(
      { length: height },
      () => new Array<MuxstoneBackgroundCell | undefined>(width).fill(undefined),
    );
  }

  /** Seeds one strand at a board edge, heading inward. */
  #seedStrand(bounds: Rectangle, origin?: { x: number; y: number }): boolean {
    const { width, height } = bounds;
    let x: number;
    let y: number;
    let heading: number;
    if (origin) {
      x = origin.x;
      y = origin.y;
      heading = this.#random() * TAU;
    } else {
      const edge = Math.floor(this.#random() * 4);
      if (edge === 0) {
        x = Math.floor(this.#random() * width);
        y = 0;
        heading = TAU / 4;
      } else if (edge === 1) {
        x = width - 1;
        y = Math.floor(this.#random() * height);
        heading = TAU / 2;
      } else if (edge === 2) {
        x = Math.floor(this.#random() * width);
        y = height - 1;
        heading = -TAU / 4;
      } else {
        x = 0;
        y = Math.floor(this.#random() * height);
        heading = 0;
      }
    }
    if (!this.#passable(x, y, bounds)) return false;
    this.#strands.push({
      cells: [{ x, y, heading, arc: false, leaf: false }],
      heading,
      curl: (this.#random() - 0.5) * MAX_TURN_PER_CELL,
      curlHoldCells: 3 + Math.floor(this.#random() * 8),
      targetLength: MIN_STRAND_LENGTH + Math.floor(this.#random() * STRAND_LENGTH_SPREAD),
      growthAccumulator: 0,
      ageMs: 0,
      blooms: [],
      nextBloomCell: BLOOM_SPACING_CELLS,
      hue: Math.floor(this.#random() * 4),
    });
    return true;
  }

  /** Extends one strand along its curving heading; true when it gained a cell. */
  #extendStrand(strand: IvyStrand, bounds: Rectangle, delta: number): boolean {
    if (strand.cells.length >= strand.targetLength) return false;
    strand.growthAccumulator += GROWTH_CELLS_PER_FRAME * delta;
    let grew = false;
    while (strand.growthAccumulator >= 1) {
      strand.growthAccumulator -= 1;
      const head = strand.cells[strand.cells.length - 1]!;
      // Re-roll the curl now and then so the arc wanders instead of spiralling.
      strand.curlHoldCells -= 1;
      if (strand.curlHoldCells <= 0) {
        strand.curl = (this.#random() - 0.5) * MAX_TURN_PER_CELL * 2;
        strand.curlHoldCells = 3 + Math.floor(this.#random() * 8);
      }
      const previousHeading = strand.heading;
      strand.heading += strand.curl;
      const step = headingStep(strand.heading);
      let nextX = head.x + step.dx;
      let nextY = head.y + step.dy;
      if (!this.#passable(nextX, nextY, bounds)) {
        // Hug the obstruction: try turning either way before giving up.
        let deflected = false;
        for (const turn of [TAU / 8, -TAU / 8, TAU / 4, -TAU / 4]) {
          const candidate = headingStep(strand.heading + turn);
          if (!this.#passable(head.x + candidate.dx, head.y + candidate.dy, bounds)) continue;
          strand.heading += turn;
          nextX = head.x + candidate.dx;
          nextY = head.y + candidate.dy;
          deflected = true;
          break;
        }
        if (!deflected) {
          strand.targetLength = strand.cells.length;
          return grew;
        }
      }
      const arc = quadrant(strand.heading) !== quadrant(previousHeading);
      strand.cells.push({
        x: nextX,
        y: nextY,
        heading: strand.heading,
        arc,
        leaf: this.#random() < 0.18,
      });
      grew = true;
    }
    return grew;
  }

  /** Sets new buds on mature strands and opens the ones already set. */
  #advanceBlooms(strand: IvyStrand, elapsed: number): boolean {
    let changed = false;
    if (strand.ageMs >= BLOOM_AGE_MS) {
      while (strand.nextBloomCell < strand.cells.length) {
        strand.blooms.push({
          cellIndex: strand.nextBloomCell,
          openedMs: 0,
          hue: (strand.hue + strand.blooms.length) % 4,
        });
        strand.nextBloomCell += BLOOM_SPACING_CELLS;
        changed = true;
      }
    }
    for (const bloom of strand.blooms) {
      if (bloom.openedMs >= BLOOM_OPEN_MS) continue;
      const before = Math.floor(bloom.openedMs / BLOOM_OPEN_MS * BLOOM_STAGES.length);
      bloom.openedMs = Math.min(BLOOM_OPEN_MS, bloom.openedMs + elapsed);
      if (Math.floor(bloom.openedMs / BLOOM_OPEN_MS * BLOOM_STAGES.length) !== before) changed = true;
    }
    return changed;
  }

  /** Periodic survey: seeds a strand into whatever bare ground it can find. */
  #seedIntoOpenGround(bounds: Rectangle): boolean {
    const ceiling = clampInteger(
      Math.round((4 + (bounds.width * bounds.height) / 380) * this.#density),
      3,
      MAX_STRANDS,
    );
    if (this.#strands.length >= ceiling) return false;
    const occupied = new Set<number>();
    for (const strand of this.#strands) {
      for (const cell of strand.cells) occupied.add(cell.y * bounds.width + cell.x);
    }
    for (let attempt = 0; attempt < SURVEY_SAMPLES; attempt += 1) {
      const x = Math.floor(this.#random() * bounds.width);
      const y = Math.floor(this.#random() * bounds.height);
      if (!this.#passable(x, y, bounds)) continue;
      if (this.#crowded(x, y, bounds, occupied)) continue;
      if (this.#seedStrand(bounds, { x, y })) return true;
    }
    return false;
  }

  /** True when the neighbourhood already carries vine, so seeds spread out. */
  #crowded(x: number, y: number, bounds: Rectangle, occupied: ReadonlySet<number>): boolean {
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= bounds.width || ny >= bounds.height) continue;
        if (occupied.has(ny * bounds.width + nx)) return true;
      }
    }
    return false;
  }

  #passable(x: number, y: number, bounds: Rectangle): boolean {
    if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return false;
    return this.#keepOut[y * bounds.width + x] !== 1;
  }

  /** Applies the frame's obstacle list; prunes strands caught in a new keep-out. */
  #syncObstacles(options: MuxstoneBackgroundAdvanceOptions, bounds: Rectangle): boolean {
    const local: Rectangle[] = [];
    for (const rectangle of options.obstacles ?? []) {
      const normalized = normalizeBounds(rectangle);
      if (!normalized) continue;
      local.push({
        column: normalized.column - bounds.column,
        row: normalized.row - bounds.row,
        width: normalized.width,
        height: normalized.height,
      });
    }
    const key = local
      .map((rectangle) => `${rectangle.column},${rectangle.row},${rectangle.width},${rectangle.height}`)
      .join(";");
    if (key === this.#obstacleKey) return false;
    this.#obstacleKey = key;
    this.#obstacles = local;

    const { width, height } = bounds;
    if (this.#keepOut.length !== width * height) this.#keepOut = new Uint8Array(width * height);
    else this.#keepOut.fill(0);
    for (const rectangle of this.#obstacles) {
      const x0 = Math.max(0, rectangle.column - OBSTACLE_MARGIN);
      const y0 = Math.max(0, rectangle.row - OBSTACLE_MARGIN);
      const x1 = Math.min(width - 1, rectangle.column + rectangle.width - 1 + OBSTACLE_MARGIN);
      const y1 = Math.min(height - 1, rectangle.row + rectangle.height - 1 + OBSTACLE_MARGIN);
      if (x1 < x0 || y1 < y0) continue;
      for (let y = y0; y <= y1; y += 1) this.#keepOut.fill(1, y * width + x0, y * width + x1 + 1);
    }

    // Trim any strand that a window has just grown over; it regrows elsewhere.
    for (let index = this.#strands.length - 1; index >= 0; index -= 1) {
      const strand = this.#strands[index]!;
      const keep = strand.cells.findIndex((cell) => !this.#passable(cell.x, cell.y, bounds));
      if (keep < 0) continue;
      strand.cells.length = keep;
      strand.blooms = strand.blooms.filter((bloom) => bloom.cellIndex < keep);
      strand.targetLength = Math.min(strand.targetLength, keep);
      if (strand.cells.length === 0) this.#strands.splice(index, 1);
    }
    return true;
  }

  #random(): number {
    this.#randomState = (Math.imul(this.#randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return this.#randomState / 0x1_0000_0000;
  }
}

/** Chooses the vine glyph for one cell from the heading it was entered on. */
function ivyGlyph(cell: IvyCell): string {
  if (cell.arc) return ARC_GLYPHS[quadrant(cell.heading)]!;
  const step = headingStep(cell.heading);
  if (step.dx !== 0 && step.dy !== 0) return step.dx === step.dy ? VINE_DIAGONAL_DOWN : VINE_DIAGONAL_UP;
  return step.dy === 0 ? VINE_HORIZONTAL : VINE_VERTICAL;
}

/** Quantizes a heading to one of eight cell steps. */
function headingStep(heading: number): { dx: number; dy: number } {
  const normalized = ((heading % TAU) + TAU) % TAU;
  const octant = Math.round(normalized / (TAU / 8)) % 8;
  switch (octant) {
    case 0:
      return { dx: 1, dy: 0 };
    case 1:
      return { dx: 1, dy: 1 };
    case 2:
      return { dx: 0, dy: 1 };
    case 3:
      return { dx: -1, dy: 1 };
    case 4:
      return { dx: -1, dy: 0 };
    case 5:
      return { dx: -1, dy: -1 };
    case 6:
      return { dx: 0, dy: -1 };
    default:
      return { dx: 1, dy: -1 };
  }
}

function quadrant(heading: number): 0 | 1 | 2 | 3 {
  const normalized = ((heading % TAU) + TAU) % TAU;
  return Math.floor(normalized / (TAU / 4)) as 0 | 1 | 2 | 3;
}

function clampInteger(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.max(low, Math.min(high, Math.round(value)));
}

function finite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value! : fallback;
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
