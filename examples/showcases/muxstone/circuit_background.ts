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
const POINTER_LIFETIME_MS = 1_800;
const POINTER_REACH_CELLS = 5;
const PULSE_CELLS_PER_FRAME = 0.5;
const TRACE_REWIRE_INTERVAL_MS = 7_000;
const CHIP_DRIFT_INTERVAL_MS = 18_000;
const MIN_CHIP_SIDE = 5;
const MAX_CHIP_SIDE = 9;
const CHIP_MARGIN = 1;
const CHIP_SPACING = 2;
const MAX_TRACE_STEPS = 80;
const TRACE_GROW_ATTEMPTS = 6;
const CHIP_PLACE_ATTEMPTS = 40;
/** Keep-out padding, in cells, applied around every window obstacle rect. */
const OBSTACLE_MARGIN = 1;
/** Layout-reaction jobs (relocations, regrows, taps) processed per advance. */
const LAYOUT_JOBS_PER_FRAME = 3;
const MAX_PENDING_JOBS = 128;
/** Pulses on taps of the focused window run this much faster. */
const ACTIVE_TAP_PULSE_MULTIPLIER = 2;
/** How far the base tap trace color shifts toward theme.accent when focused. */
const ACTIVE_TAP_BASE_MIX = 0.6;

const CHIP_LABEL_LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";
const VIA_GLYPH = "o";
const CHIP_FILL_GLYPH = "▓";

/** Direction order: up, right, down, left. */
const DIR_DX = [0, 1, 0, -1] as const;
const DIR_DY = [-1, 0, 1, 0] as const;

/** Glyph for a trace cell indexed by `arrivalDirection * 4 + exitDirection`. */
const TRACE_GLYPHS = [
  "│",
  "┌",
  "│",
  "┐",
  "┘",
  "─",
  "┐",
  "─",
  "│",
  "└",
  "│",
  "┘",
  "└",
  "─",
  "┌",
  "─",
] as const;

/** Construction options shared by the Muxstone animated background catalog. */
export interface MuxstoneCircuitFieldOptions {
  readonly seed?: number;
  /** Scales chip and trace counts; 1 keeps the default board population. */
  readonly density?: number;
}

/** One placed chip snapshot exposed for deterministic tests. */
export interface MuxstoneCircuitChipSnapshot {
  readonly x: number;
  readonly y: number;
  readonly side: number;
  readonly label: string;
}

/** One trace snapshot with its animated pulses, exposed for deterministic tests. */
export interface MuxstoneCircuitTraceSnapshot {
  readonly chipIndex: number;
  /** Ordinary board traces versus window tap traces. */
  readonly kind: "board" | "tap";
  /** Index into `obstacles` for tap traces; absent on board traces. */
  readonly obstacleIndex?: number;
  readonly cells: readonly Readonly<{ x: number; y: number; glyph: string }>[];
  readonly pulses: readonly Readonly<{ index: number }>[];
}

/** Inspection payload mirroring the metaball field's test hook. */
export interface MuxstoneCircuitInspection {
  readonly bounds?: Rectangle;
  readonly chips: readonly MuxstoneCircuitChipSnapshot[];
  readonly traces: readonly MuxstoneCircuitTraceSnapshot[];
  /** Window keep-out rects in field-local coordinates. */
  readonly obstacles: readonly Rectangle[];
  /** Index into `obstacles` of the focused window, when one matched. */
  readonly activeObstacleIndex?: number;
  /** Queued layout-reaction jobs still waiting to run. */
  readonly pendingJobs: number;
}

interface CircuitChip {
  readonly id: number;
  x: number;
  y: number;
  side: number;
  label: string;
}

interface CircuitTraceCell {
  readonly x: number;
  readonly y: number;
  readonly glyph: string;
}

interface CircuitPulse {
  index: number;
  accumulator: number;
}

interface CircuitTrace {
  chipIndex: number;
  kind: "board" | "tap";
  /** Index into the current obstacle list; only meaningful on tap traces. */
  obstacleIndex?: number;
  /** Local rect of the window this tap terminates on; identity across moves. */
  obstacleRect?: Rectangle;
  cells: CircuitTraceCell[];
  pulses: CircuitPulse[];
}

/** Deferred, deterministic layout reaction executed a few per frame. */
type CircuitLayoutJob =
  | { readonly kind: "relocate-chip"; readonly chipId: number }
  | { readonly kind: "grow-trace"; readonly chipId: number }
  | { readonly kind: "grow-taps"; readonly rect: Rectangle };

interface CircuitPathPoint {
  readonly x: number;
  readonly y: number;
}

interface CircuitPointer extends MuxstoneBackgroundPoint {
  readonly updatedAt: number;
}

/**
 * Procedural PCB background: seeded square chips joined by orthogonal snaking
 * traces that carry bright wrapping pulses. Window rects passed as obstacles
 * become keep-out zones (rect plus a 1-cell margin): chips relocate out of
 * them, crossing traces are torn down and re-grown around them over a few
 * staggered deterministic frames, and every window receives 1-3 "tap" traces
 * routed from the nearest chip flush onto its border via `o`. Taps to the
 * focused window render brighter with double-speed bold pulses. The layout
 * slowly rewires one trace every ~12s and drifts one chip every ~30s of
 * simulated time; all randomness flows through one LCG so equal seeds,
 * timestamps, and obstacle sequences reproduce equal grids.
 */
export class MuxstoneCircuitField implements MuxstoneAnimatedBackground {
  #randomState: number;
  readonly #density: number;
  #bounds?: Rectangle;
  #pointer?: CircuitPointer;
  #activePointer?: MuxstoneBackgroundPoint;
  #lastFrameAt?: number;
  #chips: CircuitChip[] = [];
  #traces: CircuitTrace[] = [];
  #occupancy = new Uint8Array();
  #keepOut = new Uint8Array();
  #obstacles: Rectangle[] = [];
  #obstacleKey?: string;
  #activeObstacleIndex?: number;
  #pendingJobs: CircuitLayoutJob[] = [];
  #nextChipId = 0;
  #cells: (MuxstoneBackgroundCell | undefined)[][] = [];
  #rewireTimerMs = 0;
  #driftTimerMs = 0;

  constructor(options: MuxstoneCircuitFieldOptions = {}) {
    this.#randomState = (options.seed ?? 0x50_43_42_31) >>> 0;
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
    this.#activePointer = undefined;
  }

  /** Advances pulses, obstacle reactions, and slow layout shifts once; returns true when anything changed. */
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
    this.#rewireTimerMs += elapsed;
    this.#driftTimerMs += elapsed;

    const pointer = this.#pointer && now - this.#pointer.updatedAt <= POINTER_LIFETIME_MS ? this.#pointer : undefined;
    this.#activePointer = pointer
      ? { column: pointer.column - bounds.column, row: pointer.row - bounds.row }
      : undefined;

    let changed = false;
    if (this.#syncObstacles(options, bounds)) changed = true;
    if (this.#processLayoutJobs(bounds)) changed = true;

    const activeIndex = this.#activeObstacleIndex;
    for (const trace of this.#traces) {
      const length = trace.cells.length;
      if (length === 0) continue;
      const activeTap = trace.kind === "tap" && activeIndex !== undefined && trace.obstacleIndex === activeIndex;
      for (const pulse of trace.pulses) {
        const cell = trace.cells[pulse.index % length]!;
        const near = this.#activePointer !== undefined &&
          Math.max(
              Math.abs(cell.x - this.#activePointer.column),
              Math.abs(cell.y - this.#activePointer.row),
            ) <= POINTER_REACH_CELLS;
        pulse.accumulator += PULSE_CELLS_PER_FRAME * (near ? 2 : 1) *
          (activeTap ? ACTIVE_TAP_PULSE_MULTIPLIER : 1) * delta;
        const steps = Math.floor(pulse.accumulator);
        if (steps > 0) {
          pulse.accumulator -= steps;
          pulse.index = (pulse.index + steps) % length;
          changed = true;
        }
      }
    }

    while (this.#rewireTimerMs >= TRACE_REWIRE_INTERVAL_MS) {
      this.#rewireTimerMs -= TRACE_REWIRE_INTERVAL_MS;
      if (this.#rewireOneTrace(bounds)) changed = true;
    }
    while (this.#driftTimerMs >= CHIP_DRIFT_INTERVAL_MS) {
      this.#driftTimerMs -= CHIP_DRIFT_INTERVAL_MS;
      if (this.#driftOneChip(bounds)) changed = true;
    }
    return changed;
  }

  /** Paints chips, traces, vias, and pulses into a reused row-major cell buffer. */
  rasterizeCells(
    bounds: Rectangle,
    theme: MuxstoneThemeSpec,
  ): ReadonlyArray<ReadonlyArray<MuxstoneBackgroundCell | undefined>> {
    const normalized = normalizeBounds(bounds);
    if (!normalized) {
      this.#cells = [];
      return this.#cells;
    }
    this.#ensureLayout(normalized);
    const { width, height } = normalized;
    this.#ensureCellBuffer(width, height);

    const traceBase = mixMuxstoneRgb(theme.border, theme.background, 0.35);
    const viaColor = mixMuxstoneRgb(theme.border, theme.text, 0.15);
    const chipBorder = mixMuxstoneRgb(theme.border, theme.text, 0.25);
    const chipBody = mixMuxstoneRgb(theme.surfaceStrong, theme.text, 0.2);
    const labelColor = mixMuxstoneRgb(theme.muted, theme.text, 0.1);
    const pulseHead = mixMuxstoneRgb(theme.accent, theme.text, 0.2);
    const pulseTrail = mixMuxstoneRgb(theme.accent, traceBase, 0.5);
    const highlight = mixMuxstoneRgb(traceBase, theme.accent, 0.45);
    const activeTapBase = mixMuxstoneRgb(traceBase, theme.accent, ACTIVE_TAP_BASE_MIX);
    const activeTapVia = mixMuxstoneRgb(viaColor, theme.accent, 0.5);
    const activeTapHead = mixMuxstoneRgb(pulseHead, theme.text, 0.35);
    const activeTapTrail = mixMuxstoneRgb(pulseTrail, theme.accent, 0.5);
    const pointer = this.#activePointer;
    const activeIndex = this.#activeObstacleIndex;

    for (const trace of this.#traces) {
      const activeTap = trace.kind === "tap" && activeIndex !== undefined && trace.obstacleIndex === activeIndex;
      for (const cell of trace.cells) {
        if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) continue;
        const near = pointer !== undefined &&
          Math.max(Math.abs(cell.x - pointer.column), Math.abs(cell.y - pointer.row)) <= POINTER_REACH_CELLS;
        const foreground = near
          ? highlight
          : cell.glyph === VIA_GLYPH
          ? (activeTap ? activeTapVia : viaColor)
          : (activeTap ? activeTapBase : traceBase);
        this.#cells[cell.y]![cell.x] = { char: cell.glyph, foreground };
      }
      const length = trace.cells.length;
      if (length === 0) continue;
      for (const pulse of trace.pulses) {
        const headCell = trace.cells[pulse.index % length]!;
        const trailCell = trace.cells[(pulse.index - 1 + length) % length]!;
        if (trailCell.y >= 0 && trailCell.y < height && trailCell.x >= 0 && trailCell.x < width) {
          this.#cells[trailCell.y]![trailCell.x] = activeTap
            ? { char: trailCell.glyph, foreground: activeTapTrail, bold: true }
            : { char: trailCell.glyph, foreground: pulseTrail };
        }
        if (headCell.y >= 0 && headCell.y < height && headCell.x >= 0 && headCell.x < width) {
          this.#cells[headCell.y]![headCell.x] = {
            char: headCell.glyph,
            foreground: activeTap ? activeTapHead : pulseHead,
            bold: true,
          };
        }
      }
    }

    for (const chip of this.#chips) {
      const last = chip.side - 1;
      for (let r = 0; r < chip.side; r += 1) {
        const gy = chip.y + r;
        if (gy < 0 || gy >= height) continue;
        for (let c = 0; c < chip.side; c += 1) {
          const gx = chip.x + c;
          if (gx < 0 || gx >= width) continue;
          const edge = r === 0 || r === last || c === 0 || c === last;
          const char = !edge
            ? CHIP_FILL_GLYPH
            : r === 0
            ? (c === 0 ? "╔" : c === last ? "╗" : "═")
            : r === last
            ? (c === 0 ? "╚" : c === last ? "╝" : "═")
            : "║";
          this.#cells[gy]![gx] = { char, foreground: edge ? chipBorder : chipBody };
        }
      }
      const labelRow = chip.y + Math.floor(chip.side / 2);
      const labelColumn = chip.x + Math.floor((chip.side - 2) / 2);
      for (let index = 0; index < chip.label.length; index += 1) {
        const gx = labelColumn + index;
        if (labelRow < 0 || labelRow >= height || gx < 0 || gx >= width) continue;
        this.#cells[labelRow]![gx] = { char: chip.label[index]!, foreground: labelColor, bold: true };
      }
    }
    return this.#cells;
  }

  /** Deterministic state snapshot for tests. */
  inspect(): MuxstoneCircuitInspection {
    return {
      ...(this.#bounds ? { bounds: { ...this.#bounds } } : {}),
      chips: this.#chips.map((chip) => ({ x: chip.x, y: chip.y, side: chip.side, label: chip.label })),
      traces: this.#traces.map((trace) => ({
        chipIndex: trace.chipIndex,
        kind: trace.kind,
        ...(trace.kind === "tap" && trace.obstacleIndex !== undefined ? { obstacleIndex: trace.obstacleIndex } : {}),
        cells: trace.cells.map((cell) => ({ ...cell })),
        pulses: trace.pulses.map((pulse) => ({ index: pulse.index })),
      })),
      obstacles: this.#obstacles.map((rectangle) => ({ ...rectangle })),
      ...(this.#activeObstacleIndex !== undefined ? { activeObstacleIndex: this.#activeObstacleIndex } : {}),
      pendingJobs: this.#pendingJobs.length,
    };
  }

  #ensureLayout(bounds: Rectangle): void {
    const previous = this.#bounds;
    if (previous?.width === bounds.width && previous.height === bounds.height) {
      this.#bounds = { ...bounds };
      return;
    }
    this.#bounds = { ...bounds };
    this.#generateLayout(bounds);
  }

  #generateLayout(bounds: Rectangle): void {
    const { width, height } = bounds;
    this.#occupancy = new Uint8Array(width * height);
    this.#keepOut = new Uint8Array(width * height);
    this.#obstacles = [];
    this.#obstacleKey = undefined;
    this.#activeObstacleIndex = undefined;
    this.#pendingJobs = [];
    this.#chips = [];
    this.#traces = [];
    const maxSide = Math.min(MAX_CHIP_SIDE, width - 2 * CHIP_MARGIN, height - 2 * CHIP_MARGIN);
    if (maxSide < 3) return;
    const minSide = Math.min(MIN_CHIP_SIDE, maxSide);
    const target = clampInteger(Math.round((3 + (width * height) / 600) * this.#density), 3, 12);

    for (let index = 0; index < target; index += 1) {
      for (let attempt = 0; attempt < CHIP_PLACE_ATTEMPTS; attempt += 1) {
        const side = minSide + Math.floor(this.#random() * (maxSide - minSide + 1));
        const spanX = width - side - 2 * CHIP_MARGIN + 1;
        const spanY = height - side - 2 * CHIP_MARGIN + 1;
        if (spanX <= 0 || spanY <= 0) continue;
        const x = CHIP_MARGIN + Math.floor(this.#random() * spanX);
        const y = CHIP_MARGIN + Math.floor(this.#random() * spanY);
        if (!this.#chipFits(x, y, side, -1)) continue;
        this.#chips.push({ id: this.#nextChipId++, x, y, side, label: this.#createLabel() });
        this.#markChip(this.#chips.length - 1, 1);
        break;
      }
    }
    for (let chipIndex = 0; chipIndex < this.#chips.length; chipIndex += 1) {
      this.#growChipTraces(chipIndex, bounds);
    }
  }

  /** Applies the frame's obstacle list; tears down anything newly in a keep-out zone. */
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

    this.#activeObstacleIndex = undefined;
    const active = options.activeObstacle ? normalizeBounds(options.activeObstacle) : undefined;
    if (active) {
      const target: Rectangle = {
        column: active.column - bounds.column,
        row: active.row - bounds.row,
        width: active.width,
        height: active.height,
      };
      const index = local.findIndex((rectangle) => sameRect(rectangle, target));
      if (index >= 0) this.#activeObstacleIndex = index;
    }

    const key = local
      .map((rectangle) => `${rectangle.column},${rectangle.row},${rectangle.width},${rectangle.height}`)
      .join(";");
    if (key === this.#obstacleKey) return false;
    this.#obstacleKey = key;
    this.#obstacles = local;
    return this.#applyObstacleChange(bounds);
  }

  /** Rebuilds the keep-out mask and queues staggered relocations, taps, and regrows. */
  #applyObstacleChange(bounds: Rectangle): boolean {
    const { width, height } = bounds;
    if (this.#keepOut.length !== width * height) this.#keepOut = new Uint8Array(width * height);
    else this.#keepOut.fill(0);
    for (const rectangle of this.#obstacles) {
      const x0 = Math.max(0, rectangle.column - OBSTACLE_MARGIN);
      const y0 = Math.max(0, rectangle.row - OBSTACLE_MARGIN);
      const x1 = Math.min(width - 1, rectangle.column + rectangle.width - 1 + OBSTACLE_MARGIN);
      const y1 = Math.min(height - 1, rectangle.row + rectangle.height - 1 + OBSTACLE_MARGIN);
      for (let y = y0; y <= y1; y += 1) this.#keepOut.fill(1, y * width + x0, y * width + x1 + 1);
    }

    let changed = false;
    const regrowChipIds: number[] = [];
    for (let index = this.#traces.length - 1; index >= 0; index -= 1) {
      const trace = this.#traces[index]!;
      if (trace.kind === "tap") {
        const obstacleIndex = trace.obstacleRect
          ? this.#obstacles.findIndex((rectangle) => sameRect(rectangle, trace.obstacleRect!))
          : -1;
        if (obstacleIndex >= 0 && this.#tapRouteClear(trace, bounds)) {
          trace.obstacleIndex = obstacleIndex;
          continue;
        }
      } else if (!this.#traceHitsKeepOut(trace, bounds)) {
        continue;
      }
      this.#clearTraceOccupancy(trace, bounds);
      this.#traces.splice(index, 1);
      changed = true;
      if (trace.kind === "board") {
        const chip = this.#chips[trace.chipIndex];
        if (chip) regrowChipIds.push(chip.id);
      }
    }

    for (const chip of this.#chips) {
      if (this.#chipHitsKeepOut(chip, bounds)) this.#enqueueJob({ kind: "relocate-chip", chipId: chip.id });
    }
    for (const rectangle of this.#obstacles) {
      const hasTap = this.#traces.some((trace) =>
        trace.kind === "tap" && trace.obstacleRect !== undefined && sameRect(trace.obstacleRect, rectangle)
      );
      if (!hasTap) this.#enqueueJob({ kind: "grow-taps", rect: { ...rectangle } });
    }
    for (let index = regrowChipIds.length - 1; index >= 0; index -= 1) {
      this.#enqueueJob({ kind: "grow-trace", chipId: regrowChipIds[index]! });
    }
    return changed;
  }

  /** Runs a bounded number of queued layout reactions so changes stagger deterministically. */
  #processLayoutJobs(bounds: Rectangle): boolean {
    let changed = false;
    for (let step = 0; step < LAYOUT_JOBS_PER_FRAME && this.#pendingJobs.length > 0; step += 1) {
      const job = this.#pendingJobs.shift()!;
      if (job.kind === "relocate-chip") {
        if (this.#relocateChip(job.chipId, bounds)) changed = true;
      } else if (job.kind === "grow-trace") {
        const chipIndex = this.#chips.findIndex((chip) => chip.id === job.chipId);
        if (chipIndex >= 0 && this.#growTrace(chipIndex, bounds)) changed = true;
      } else {
        const obstacleIndex = this.#obstacles.findIndex((rectangle) => sameRect(rectangle, job.rect));
        if (obstacleIndex < 0) continue;
        const hasTap = this.#traces.some((trace) =>
          trace.kind === "tap" && trace.obstacleRect !== undefined && sameRect(trace.obstacleRect, job.rect)
        );
        if (!hasTap && this.#growTapsForObstacle(obstacleIndex, bounds)) changed = true;
      }
    }
    return changed;
  }

  #enqueueJob(job: CircuitLayoutJob): void {
    if (this.#pendingJobs.length >= MAX_PENDING_JOBS) return;
    for (const pending of this.#pendingJobs) {
      if (pending.kind !== job.kind) continue;
      if (job.kind === "grow-taps" && pending.kind === "grow-taps" && sameRect(pending.rect, job.rect)) return;
      if (job.kind === "relocate-chip" && pending.kind === "relocate-chip" && pending.chipId === job.chipId) return;
    }
    this.#pendingJobs.push(job);
  }

  /** Moves a chip caught inside a keep-out zone to free space, or despawns it. */
  #relocateChip(chipId: number, bounds: Rectangle): boolean {
    const chipIndex = this.#chips.findIndex((chip) => chip.id === chipId);
    if (chipIndex < 0) return false;
    const chip = this.#chips[chipIndex]!;
    if (!this.#chipHitsKeepOut(chip, bounds)) return false;

    const tapRects: Rectangle[] = [];
    for (let index = this.#traces.length - 1; index >= 0; index -= 1) {
      const trace = this.#traces[index]!;
      if (trace.chipIndex !== chipIndex) continue;
      if (trace.kind === "tap" && trace.obstacleRect) tapRects.push({ ...trace.obstacleRect });
      this.#clearTraceOccupancy(trace, bounds);
      this.#traces.splice(index, 1);
    }
    this.#markChip(chipIndex, 0);

    let placed = false;
    const spanX = bounds.width - chip.side - 2 * CHIP_MARGIN + 1;
    const spanY = bounds.height - chip.side - 2 * CHIP_MARGIN + 1;
    if (spanX > 0 && spanY > 0) {
      for (let attempt = 0; attempt < CHIP_PLACE_ATTEMPTS; attempt += 1) {
        const x = CHIP_MARGIN + Math.floor(this.#random() * spanX);
        const y = CHIP_MARGIN + Math.floor(this.#random() * spanY);
        if (!this.#chipFits(x, y, chip.side, chipIndex)) continue;
        chip.x = x;
        chip.y = y;
        placed = true;
        break;
      }
    }
    if (placed) {
      this.#markChip(chipIndex, 1);
      this.#growChipTraces(chipIndex, bounds);
    } else {
      this.#despawnChip(chipIndex, bounds);
    }
    for (const rectangle of tapRects) this.#enqueueJob({ kind: "grow-taps", rect: rectangle });
    return true;
  }

  /** Removes a chip that has nowhere to go; surviving trace indices are re-pointed. */
  #despawnChip(chipIndex: number, bounds: Rectangle): void {
    for (let index = this.#traces.length - 1; index >= 0; index -= 1) {
      const trace = this.#traces[index]!;
      if (trace.chipIndex === chipIndex) {
        this.#clearTraceOccupancy(trace, bounds);
        this.#traces.splice(index, 1);
      } else if (trace.chipIndex > chipIndex) {
        trace.chipIndex -= 1;
      }
    }
    this.#chips.splice(chipIndex, 1);
  }

  #growChipTraces(chipIndex: number, bounds: Rectangle): void {
    const count = clampInteger(Math.round((3 + Math.floor(this.#random() * 3)) * this.#density), 2, 8);
    for (let index = 0; index < count; index += 1) {
      this.#growTrace(chipIndex, bounds);
    }
  }

  #growTrace(chipIndex: number, bounds: Rectangle): boolean {
    const chip = this.#chips[chipIndex];
    if (!chip) return false;
    for (let attempt = 0; attempt < TRACE_GROW_ATTEMPTS; attempt += 1) {
      const edge = Math.floor(this.#random() * 4);
      const offset = 1 + Math.floor(this.#random() * Math.max(1, chip.side - 2));
      let x: number, y: number;
      if (edge === 0) {
        x = chip.x + offset;
        y = chip.y - 1;
      } else if (edge === 1) {
        x = chip.x + chip.side;
        y = chip.y + offset;
      } else if (edge === 2) {
        x = chip.x + offset;
        y = chip.y + chip.side;
      } else {
        x = chip.x - 1;
        y = chip.y + offset;
      }
      const trace = this.#walkTrace(chipIndex, x, y, edge, bounds);
      if (trace) {
        this.#traces.push(trace);
        return true;
      }
    }
    return false;
  }

  #walkTrace(
    chipIndex: number,
    startX: number,
    startY: number,
    startDirection: number,
    bounds: Rectangle,
  ): CircuitTrace | undefined {
    const { width, height } = bounds;
    const xs: number[] = [];
    const ys: number[] = [];
    const arrivals: number[] = [];
    const exits: number[] = [];
    let x = startX;
    let y = startY;
    let direction = startDirection;
    let arrival = startDirection;
    let run = 3 + Math.floor(this.#random() * 8);
    let endsAtVia = true;

    for (let step = 0; step < MAX_TRACE_STEPS; step += 1) {
      if (x < 0 || x >= width || y < 0 || y >= height) {
        endsAtVia = false;
        break;
      }
      const cellIndex = y * width + x;
      if (this.#occupancy[cellIndex] !== 0 || this.#keepOut[cellIndex] !== 0) break;
      xs.push(x);
      ys.push(y);
      arrivals.push(arrival);
      this.#occupancy[cellIndex] = 2;
      run -= 1;
      let exitDirection = direction;
      if (run <= 0) {
        exitDirection = (direction + (this.#random() < 0.5 ? 1 : 3)) % 4;
        direction = exitDirection;
        run = 3 + Math.floor(this.#random() * 8);
      }
      exits.push(exitDirection);
      x += DIR_DX[exitDirection]!;
      y += DIR_DY[exitDirection]!;
      arrival = exitDirection;
    }

    if (xs.length < 2) {
      for (let index = 0; index < xs.length; index += 1) {
        this.#occupancy[ys[index]! * width + xs[index]!] = 0;
      }
      return undefined;
    }

    const cells: CircuitTraceCell[] = [];
    for (let index = 0; index < xs.length; index += 1) {
      const lastCell = index === xs.length - 1;
      const glyph = lastCell
        ? (endsAtVia ? VIA_GLYPH : (arrivals[index]! % 2 === 0 ? "│" : "─"))
        : TRACE_GLYPHS[arrivals[index]! * 4 + exits[index]!]!;
      cells.push({ x: xs[index]!, y: ys[index]!, glyph });
    }
    const pulseCount = 2 + Math.floor(this.#random() * 3);
    const pulses: CircuitPulse[] = Array.from({ length: pulseCount }, () => ({
      index: Math.floor(this.#random() * cells.length),
      accumulator: 0,
    }));
    return { chipIndex, kind: "board", cells, pulses };
  }

  /** Grows the 1-3 deterministic tap traces owed to one window obstacle. */
  #growTapsForObstacle(obstacleIndex: number, bounds: Rectangle): boolean {
    const count = 1 + Math.floor(this.#random() * 3);
    let grown = false;
    for (let index = 0; index < count; index += 1) {
      if (this.#growTap(obstacleIndex, bounds)) grown = true;
    }
    return grown;
  }

  /**
   * Routes one tap from the nearest chip edge flush onto the window border via
   * a deterministic BFS over free cells: seeds are the free cells around the
   * chip perimeter, the goal is any free cell of the window's 1-cell margin
   * ring, and the trace terminates on the adjacent border cell with a via.
   */
  #growTap(obstacleIndex: number, bounds: Rectangle): boolean {
    const obstacle = this.#obstacles[obstacleIndex];
    if (!obstacle || this.#chips.length === 0) return false;
    const obstacleCenterX = obstacle.column + obstacle.width / 2;
    const obstacleCenterY = obstacle.row + obstacle.height / 2;
    let chipIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < this.#chips.length; index += 1) {
      const candidate = this.#chips[index]!;
      const distance = Math.abs(candidate.x + candidate.side / 2 - obstacleCenterX) +
        Math.abs(candidate.y + candidate.side / 2 - obstacleCenterY);
      if (distance < bestDistance) {
        bestDistance = distance;
        chipIndex = index;
      }
    }
    if (chipIndex < 0) return false;
    const chip = this.#chips[chipIndex]!;
    const { width, height } = bounds;

    const inOwnRect = (x: number, y: number): boolean =>
      x >= obstacle.column && x <= obstacle.column + obstacle.width - 1 &&
      y >= obstacle.row && y <= obstacle.row + obstacle.height - 1;
    const inOwnRing = (x: number, y: number): boolean =>
      !inOwnRect(x, y) &&
      x >= obstacle.column - OBSTACLE_MARGIN && x <= obstacle.column + obstacle.width - 1 + OBSTACLE_MARGIN &&
      y >= obstacle.row - OBSTACLE_MARGIN && y <= obstacle.row + obstacle.height - 1 + OBSTACLE_MARGIN;

    const rotation = Math.floor(this.#random() * 4);
    const previous = new Int32Array(width * height).fill(-2);
    const queue: number[] = [];
    const trySeed = (x: number, y: number): void => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const index = y * width + x;
      if (previous[index] !== -2 || this.#occupancy[index] !== 0) return;
      if (this.#keepOut[index] !== 0 && !inOwnRing(x, y)) return;
      previous[index] = -1;
      queue.push(index);
    };
    for (let x = chip.x; x < chip.x + chip.side; x += 1) {
      trySeed(x, chip.y - 1);
      trySeed(x, chip.y + chip.side);
    }
    for (let y = chip.y; y < chip.y + chip.side; y += 1) {
      trySeed(chip.x - 1, y);
      trySeed(chip.x + chip.side, y);
    }

    let goal = -1;
    let viaIndex = -1;
    for (let head = 0; head < queue.length && goal < 0; head += 1) {
      const index = queue[head]!;
      const x = index % width;
      const y = Math.floor(index / width);
      if (inOwnRing(x, y)) {
        for (let turn = 0; turn < 4; turn += 1) {
          const direction = (turn + rotation) % 4;
          const nx = x + DIR_DX[direction]!;
          const ny = y + DIR_DY[direction]!;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height || !inOwnRect(nx, ny)) continue;
          const neighborIndex = ny * width + nx;
          if (this.#occupancy[neighborIndex] !== 0) continue;
          goal = index;
          viaIndex = neighborIndex;
          break;
        }
        continue;
      }
      for (let turn = 0; turn < 4; turn += 1) {
        const direction = (turn + rotation) % 4;
        const nx = x + DIR_DX[direction]!;
        const ny = y + DIR_DY[direction]!;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighborIndex = ny * width + nx;
        if (previous[neighborIndex] !== -2 || this.#occupancy[neighborIndex] !== 0) continue;
        if (this.#keepOut[neighborIndex] !== 0 && !inOwnRing(nx, ny)) continue;
        previous[neighborIndex] = index;
        queue.push(neighborIndex);
      }
    }
    if (goal < 0 || viaIndex < 0) return false;

    const reversed: number[] = [];
    for (let index = goal; index !== -1; index = previous[index]!) reversed.push(index);
    const path: CircuitPathPoint[] = [];
    for (let index = reversed.length - 1; index >= 0; index -= 1) {
      const cellIndex = reversed[index]!;
      path.push({ x: cellIndex % width, y: Math.floor(cellIndex / width) });
    }
    path.push({ x: viaIndex % width, y: Math.floor(viaIndex / width) });
    if (path.length < 2) return false;

    for (const point of path) this.#occupancy[point.y * width + point.x] = 2;
    const cells = pathToTraceCells(path);
    const pulseCount = 2 + Math.floor(this.#random() * 3);
    const pulses: CircuitPulse[] = Array.from({ length: pulseCount }, () => ({
      index: Math.floor(this.#random() * cells.length),
      accumulator: 0,
    }));
    this.#traces.push({
      chipIndex,
      kind: "tap",
      obstacleIndex,
      obstacleRect: { ...obstacle },
      cells,
      pulses,
    });
    return true;
  }

  /** True while every non-terminal tap cell stays outside foreign keep-out zones. */
  #tapRouteClear(trace: CircuitTrace, bounds: Rectangle): boolean {
    const own = trace.obstacleRect;
    if (!own) return false;
    const { width } = bounds;
    for (const cell of trace.cells) {
      if (this.#keepOut[cell.y * width + cell.x] === 0) continue;
      if (
        cell.x >= own.column - OBSTACLE_MARGIN && cell.x <= own.column + own.width - 1 + OBSTACLE_MARGIN &&
        cell.y >= own.row - OBSTACLE_MARGIN && cell.y <= own.row + own.height - 1 + OBSTACLE_MARGIN
      ) continue;
      return false;
    }
    return true;
  }

  #traceHitsKeepOut(trace: CircuitTrace, bounds: Rectangle): boolean {
    const { width, height } = bounds;
    for (const cell of trace.cells) {
      if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) continue;
      if (this.#keepOut[cell.y * width + cell.x] !== 0) return true;
    }
    return false;
  }

  #chipHitsKeepOut(chip: CircuitChip, bounds: Rectangle): boolean {
    const { width, height } = bounds;
    for (let row = chip.y; row < chip.y + chip.side; row += 1) {
      if (row < 0 || row >= height) continue;
      for (let column = chip.x; column < chip.x + chip.side; column += 1) {
        if (column < 0 || column >= width) continue;
        if (this.#keepOut[row * width + column] !== 0) return true;
      }
    }
    return false;
  }

  #rewireOneTrace(bounds: Rectangle): boolean {
    if (this.#chips.length === 0) return false;
    const boardIndices: number[] = [];
    for (let index = 0; index < this.#traces.length; index += 1) {
      if (this.#traces[index]!.kind === "board") boardIndices.push(index);
    }
    if (boardIndices.length === 0) return false;
    const traceIndex = boardIndices[Math.floor(this.#random() * boardIndices.length)]!;
    const removed = this.#traces[traceIndex]!;
    this.#clearTraceOccupancy(removed, bounds);
    this.#traces.splice(traceIndex, 1);
    const chipIndex = this.#chips.length > 1
      ? (removed.chipIndex + 1 + Math.floor(this.#random() * (this.#chips.length - 1))) % this.#chips.length
      : 0;
    this.#growTrace(chipIndex, bounds);
    return true;
  }

  #driftOneChip(bounds: Rectangle): boolean {
    if (this.#chips.length === 0) return false;
    const chipIndex = Math.floor(this.#random() * this.#chips.length);
    const chip = this.#chips[chipIndex]!;
    const direction = Math.floor(this.#random() * 4);

    for (let index = this.#traces.length - 1; index >= 0; index -= 1) {
      const trace = this.#traces[index]!;
      if (trace.chipIndex !== chipIndex) continue;
      if (trace.kind === "tap" && trace.obstacleRect) {
        this.#enqueueJob({ kind: "grow-taps", rect: { ...trace.obstacleRect } });
      }
      this.#clearTraceOccupancy(trace, bounds);
      this.#traces.splice(index, 1);
    }
    this.#markChip(chipIndex, 0);
    const nextX = chip.x + DIR_DX[direction]!;
    const nextY = chip.y + DIR_DY[direction]!;
    if (this.#chipFits(nextX, nextY, chip.side, chipIndex)) {
      chip.x = nextX;
      chip.y = nextY;
    }
    this.#markChip(chipIndex, 1);
    this.#growChipTraces(chipIndex, bounds);
    return true;
  }

  #chipFits(x: number, y: number, side: number, ignoreChipIndex: number): boolean {
    const bounds = this.#bounds;
    if (!bounds) return false;
    if (
      x < CHIP_MARGIN || y < CHIP_MARGIN ||
      x + side > bounds.width - CHIP_MARGIN || y + side > bounds.height - CHIP_MARGIN
    ) return false;
    for (let index = 0; index < this.#chips.length; index += 1) {
      if (index === ignoreChipIndex) continue;
      const other = this.#chips[index]!;
      if (
        x < other.x + other.side + CHIP_SPACING && other.x < x + side + CHIP_SPACING &&
        y < other.y + other.side + CHIP_SPACING && other.y < y + side + CHIP_SPACING
      ) return false;
    }
    for (let row = y; row < y + side; row += 1) {
      for (let column = x; column < x + side; column += 1) {
        const cellIndex = row * bounds.width + column;
        if (this.#occupancy[cellIndex] !== 0 || this.#keepOut[cellIndex] !== 0) return false;
      }
    }
    return true;
  }

  #markChip(chipIndex: number, value: number): void {
    const bounds = this.#bounds;
    const chip = this.#chips[chipIndex];
    if (!bounds || !chip) return;
    for (let row = chip.y; row < chip.y + chip.side; row += 1) {
      if (row < 0 || row >= bounds.height) continue;
      for (let column = chip.x; column < chip.x + chip.side; column += 1) {
        if (column < 0 || column >= bounds.width) continue;
        this.#occupancy[row * bounds.width + column] = value;
      }
    }
  }

  #clearTraceOccupancy(trace: CircuitTrace, bounds: Rectangle): void {
    for (const cell of trace.cells) {
      if (cell.x < 0 || cell.x >= bounds.width || cell.y < 0 || cell.y >= bounds.height) continue;
      this.#occupancy[cell.y * bounds.width + cell.x] = 0;
    }
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

  #createLabel(): string {
    const letter = CHIP_LABEL_LETTERS[Math.floor(this.#random() * CHIP_LABEL_LETTERS.length)]!;
    const digit = Math.floor(this.#random() * 10);
    return `${letter}${digit}`;
  }

  #random(): number {
    this.#randomState = (Math.imul(this.#randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return this.#randomState / 0x1_0000_0000;
  }
}

function pathToTraceCells(path: readonly CircuitPathPoint[]): CircuitTraceCell[] {
  const cells: CircuitTraceCell[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index]!;
    const arrival = index === 0 ? pathDirection(path[0]!, path[1]!) : pathDirection(path[index - 1]!, point);
    const lastCell = index === path.length - 1;
    const exit = lastCell ? arrival : pathDirection(point, path[index + 1]!);
    const glyph = lastCell ? VIA_GLYPH : TRACE_GLYPHS[arrival * 4 + exit]!;
    cells.push({ x: point.x, y: point.y, glyph });
  }
  return cells;
}

function pathDirection(from: CircuitPathPoint, to: CircuitPathPoint): number {
  if (to.y < from.y) return 0;
  if (to.x > from.x) return 1;
  if (to.y > from.y) return 2;
  return 3;
}

function sameRect(a: Rectangle, b: Rectangle): boolean {
  return a.column === b.column && a.row === b.row && a.width === b.width && a.height === b.height;
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

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.floor(finite(value, minimum))));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
