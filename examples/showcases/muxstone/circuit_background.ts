// Copyright 2023 Im-Beast. MIT license.

import type { Rectangle } from "../../../src/types.ts";
import {
  mixMuxstoneRgb,
  type MuxstoneAnimatedBackground,
  type MuxstoneBackgroundAdvanceOptions,
  type MuxstoneBackgroundCell,
  type MuxstoneBackgroundPoint,
} from "./background.ts";
import type { MuxstoneRgb, MuxstoneThemeSpec } from "./model.ts";

const FRAME_BASELINE_MS = 16.7;
const MAX_FRAME_DELTA_MS = 48;
const POINTER_LIFETIME_MS = 1_800;
const POINTER_REACH_CELLS = 5;
const PULSE_CELLS_PER_FRAME = 0.5;
const TRACE_REWIRE_INTERVAL_MS = 7_000;
const CHIP_DRIFT_INTERVAL_MS = 18_000;
/** How often the board re-surveys itself for gaps worth populating. */
const BOARD_REASSESS_INTERVAL_MS = 9_000;
/** Upper bound on chips once the board starts filling reclaimed space. */
const MAX_BOARD_CHIPS = 18;
/** Candidate placements sampled per survey when hunting for empty board. */
const EMPTY_REGION_SAMPLES = 56;
const MIN_CHIP_SIDE = 5;
const MAX_CHIP_SIDE = 9;
const CHIP_MARGIN = 1;
const CHIP_SPACING = 2;
const CHIP_PLACE_ATTEMPTS = 40;
/** Cap on cells one wire route may explore, so a blocked route fails cheaply. */
const MAX_ROUTE_VISITS = 6_000;
/** Keep-out padding, in cells, applied around every window obstacle rect. */
const OBSTACLE_MARGIN = 1;
/** Layout-reaction jobs (relocations, regrows, taps) processed per advance. */
const LAYOUT_JOBS_PER_FRAME = 3;
const MAX_PENDING_JOBS = 128;
/** Pulses on taps of the focused window run this much faster. */
const ACTIVE_TAP_PULSE_MULTIPLIER = 2;
/** How far the base tap trace color shifts toward theme.accent when focused. */
const ACTIVE_TAP_BASE_MIX = 0.6;

const VIA_GLYPH = "o";
const CHIP_FILL_GLYPH = "▓";

/**
 * Each chip is a logic gate. The board is driven by a single power rail (always
 * high) and ground rail (always low); every chip's inputs are wired to nearby
 * chips and, seeded so the network stays anchored, to those two rails. Gates are
 * re-evaluated on a slow logic clock with a synchronous update, so feedback
 * loops between chips settle, blink, or free-run — the emergent behaviour is a
 * function of how the wires happened to connect.
 */
const GATE_TYPES = ["AND", "OR", "NAND", "NOR", "XOR", "XNOR"] as const;
type GateType = (typeof GATE_TYPES)[number];

/** One wired input: another chip's output, a free-running oscillator, or a rail. */
type LogicRef =
  | { readonly kind: "chip"; readonly id: number }
  | { readonly kind: "osc"; readonly id: number }
  | { readonly kind: "power" }
  | { readonly kind: "ground" };

/** Interval between synchronous logic evaluations. */
const LOGIC_TICK_MS = 620;
/** Inputs wired into each gate. */
const MIN_GATE_INPUTS = 2;
const MAX_GATE_INPUTS = 3;
/** Pulse-speed multiplier for a de-energized (output-low) trace; it idles slow. */
const IDLE_PULSE_MULTIPLIER = 0.22;
const POWER_LABEL = "VCC";
const GROUND_LABEL = "GND";
const OSCILLATOR_LABEL = "CLK";
/** An oscillator flips its output every this-many-to-that-many logic ticks. */
const OSC_MIN_PERIOD_TICKS = 2;
const OSC_MAX_PERIOD_TICKS = 6;
/** One signal generator per this-many-cells of board, at least one when there's room. */
const OSC_CELLS_EACH = 2_400;
const MAX_OSCILLATORS = 3;

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
  /** The logic gate this chip evaluates. */
  readonly gate: GateType;
  /** Number of wired inputs. */
  readonly inputCount: number;
  /** Current logic output. */
  readonly state: boolean;
}

/** A power or ground rail exposed for deterministic tests. */
export interface MuxstoneCircuitRailSnapshot {
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

/** A free-running oscillator (signal generator) exposed for deterministic tests. */
export interface MuxstoneCircuitOscillatorSnapshot {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  /** Logic ticks between output flips. */
  readonly periodTicks: number;
  /** Current square-wave output. */
  readonly state: boolean;
}

/** One trace snapshot with its animated pulses, exposed for deterministic tests. */
export interface MuxstoneCircuitTraceSnapshot {
  readonly chipIndex: number;
  /** Logic wires between pins versus decorative window tap traces. */
  readonly kind: "wire" | "tap";
  /** Index into `obstacles` for tap traces; absent on wires. */
  readonly obstacleIndex?: number;
  /** What drives the trace; pulses flow from it toward the sink. */
  readonly driver: "chip" | "osc" | "power" | "ground";
  /** For wires, the gate id this wire feeds. */
  readonly consumerChipId?: number;
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
  /** The power rail node, when placed. */
  readonly power?: MuxstoneCircuitRailSnapshot;
  /** The ground rail node, when placed. */
  readonly ground?: MuxstoneCircuitRailSnapshot;
  /** Free-running signal generators placed on the board. */
  readonly oscillators: readonly MuxstoneCircuitOscillatorSnapshot[];
  /** Count of chips whose output is currently high. */
  readonly liveChips: number;
  /** Count of gates whose input cone reaches both the power and ground rail. */
  readonly groundedChips: number;
}

interface CircuitChip {
  readonly id: number;
  x: number;
  y: number;
  side: number;
  label: string;
  gate: GateType;
  inputs: LogicRef[];
  /** Current logic output, committed on the previous tick. */
  state: boolean;
  /** Output computed this tick, swapped in after every gate has been read. */
  nextState: boolean;
}

/** A power or ground rail node placed on the board. */
interface CircuitRail {
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

/** A free-running oscillator: a clock/signal source powered by both rails. */
interface CircuitOscillator {
  readonly id: number;
  x: number;
  y: number;
  readonly label: string;
  /** Logic ticks between flips. */
  periodTicks: number;
  /** Ticks since the last flip. */
  phase: number;
  state: boolean;
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
  /** A logic wire between two pins, or a decorative tap onto a window border. */
  kind: "wire" | "tap";
  /**
   * What drives current onto this trace. Cells run driver → consumer, so pulses
   * always flow forward: out of the driver's output pin and into the sink pin.
   */
  driver: LogicRef;
  /** For wires: the gate this wire feeds. */
  consumerChipId?: number;
  /** Source chip index for taps; the driver's chip index for wires, else -1. */
  chipIndex: number;
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
  #reassessTimerMs = 0;
  #driftTimerMs = 0;
  #logicTimerMs = 0;
  #power?: CircuitRail;
  #ground?: CircuitRail;
  #oscillators: CircuitOscillator[] = [];
  #nextOscId = 0;
  /** Chip count the logic graph was last wired for; a change forces a rewire. */
  #logicChipCount = -1;
  /** Set when the physical wire routing no longer matches the logic or layout. */
  #wiresDirty = false;
  // Reused routing scratch: a generation stamp marks cells visited this route,
  // so no per-route array reset or allocation is needed on the hot path.
  #routeSeen = new Uint32Array();
  #routePrev = new Int32Array();
  #routeQueue = new Int32Array();
  #routeGeneration = 0;

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
    this.#reassessTimerMs += elapsed;
    this.#logicTimerMs += elapsed;

    const pointer = this.#pointer && now - this.#pointer.updatedAt <= POINTER_LIFETIME_MS ? this.#pointer : undefined;
    this.#activePointer = pointer
      ? { column: pointer.column - bounds.column, row: pointer.row - bounds.row }
      : undefined;

    let changed = false;
    if (this.#syncObstacles(options, bounds)) changed = true;
    if (this.#processLayoutJobs(bounds)) changed = true;
    // Chips added or removed by the layout must join the logic graph before the
    // next evaluation, or their inputs would reference a stale population.
    if (this.#chips.length !== this.#logicChipCount) {
      this.#rewireLogic();
      this.#wiresDirty = true;
    }

    // Slow evolution: periodically drift a chip, re-survey for space, and
    // re-wire one gate's logic. Each dirties the routing so the wires re-route.
    while (this.#driftTimerMs >= CHIP_DRIFT_INTERVAL_MS) {
      this.#driftTimerMs -= CHIP_DRIFT_INTERVAL_MS;
      if (this.#driftOneChip(bounds)) changed = true;
    }
    while (this.#reassessTimerMs >= BOARD_REASSESS_INTERVAL_MS) {
      this.#reassessTimerMs -= BOARD_REASSESS_INTERVAL_MS;
      if (this.#reassessBoard(bounds)) changed = true;
    }
    while (this.#rewireTimerMs >= TRACE_REWIRE_INTERVAL_MS) {
      this.#rewireTimerMs -= TRACE_REWIRE_INTERVAL_MS;
      if (this.#rewireOneGate()) changed = true;
    }
    // Route (or re-route) every wire once per structural change, not per frame.
    if (this.#wiresDirty) {
      this.#rebuildWires(bounds);
      changed = true;
    }

    while (this.#logicTimerMs >= LOGIC_TICK_MS) {
      this.#logicTimerMs -= LOGIC_TICK_MS;
      if (this.#tickLogic()) changed = true;
    }

    const activeIndex = this.#activeObstacleIndex;
    for (const trace of this.#traces) {
      const length = trace.cells.length;
      if (length === 0) continue;
      const activeTap = trace.kind === "tap" && activeIndex !== undefined && trace.obstacleIndex === activeIndex;
      // Current flows driver → sink along the cells, so pulses always run
      // forward. An energized trace (driver output high) runs at full speed; an
      // idle one only creeps, so the logic state reads at a glance.
      const energized = this.#driverState(trace.driver);
      const logicMultiplier = energized ? 1 : IDLE_PULSE_MULTIPLIER;
      for (const pulse of trace.pulses) {
        const cell = trace.cells[pulse.index % length]!;
        const near = this.#activePointer !== undefined &&
          Math.max(
              Math.abs(cell.x - this.#activePointer.column),
              Math.abs(cell.y - this.#activePointer.row),
            ) <= POINTER_REACH_CELLS;
        pulse.accumulator += PULSE_CELLS_PER_FRAME * (near ? 2 : 1) *
          (activeTap ? ACTIVE_TAP_PULSE_MULTIPLIER : 1) * logicMultiplier * delta;
        const steps = Math.floor(pulse.accumulator);
        if (steps > 0) {
          pulse.accumulator -= steps;
          pulse.index = (pulse.index + steps) % length;
          changed = true;
        }
      }
    }
    return changed;
  }

  /** Resolves the live output of whatever drives a trace. */
  #driverState(driver: LogicRef): boolean {
    switch (driver.kind) {
      case "power":
        return true;
      case "ground":
        return false;
      case "osc":
        return this.#oscillators.find((oscillator) => oscillator.id === driver.id)?.state ?? false;
      case "chip":
        return this.#chips.find((chip) => chip.id === driver.id)?.state ?? false;
    }
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
    // An energized (output-high) trace carries the theme accent; an idle one
    // recedes toward the board so live logic stands out from dormant logic.
    const liveTrace = mixMuxstoneRgb(traceBase, theme.accent, 0.55);
    const idleTrace = mixMuxstoneRgb(traceBase, theme.background, 0.35);
    const liveChipBody = mixMuxstoneRgb(chipBody, theme.accent, 0.5);
    const liveChipBorder = mixMuxstoneRgb(chipBorder, theme.accent, 0.55);
    const liveLabel = mixMuxstoneRgb(labelColor, theme.text, 0.6);
    const pointer = this.#activePointer;
    const activeIndex = this.#activeObstacleIndex;

    for (const trace of this.#traces) {
      const activeTap = trace.kind === "tap" && activeIndex !== undefined && trace.obstacleIndex === activeIndex;
      // Energize a wire by whatever drives it (a rail, an oscillator, or a gate).
      const energized = this.#driverState(trace.driver);
      const baseColor = activeTap ? activeTapBase : energized ? liveTrace : idleTrace;
      for (const cell of trace.cells) {
        if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) continue;
        const near = pointer !== undefined &&
          Math.max(Math.abs(cell.x - pointer.column), Math.abs(cell.y - pointer.row)) <= POINTER_REACH_CELLS;
        const foreground = near
          ? highlight
          : cell.glyph === VIA_GLYPH
          ? (activeTap ? activeTapVia : viaColor)
          : baseColor;
        this.#cells[cell.y]![cell.x] = { char: cell.glyph, foreground };
      }
      const length = trace.cells.length;
      if (length === 0) continue;
      // Current runs driver → sink (forward), so the trail lags one cell behind.
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
      // A gate that is currently outputting high lights up its body and border.
      const bodyColor = chip.state ? liveChipBody : chipBody;
      const borderColor = chip.state ? liveChipBorder : chipBorder;
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
          this.#cells[gy]![gx] = { char, foreground: edge ? borderColor : bodyColor };
        }
      }
      // Centre the gate label inside the chip interior, clipped to what fits.
      const interior = Math.max(0, chip.side - 2);
      const label = chip.label.slice(0, interior);
      const labelRow = chip.y + Math.floor(chip.side / 2);
      const labelColumn = chip.x + 1 + Math.max(0, Math.floor((interior - label.length) / 2));
      for (let index = 0; index < label.length; index += 1) {
        const gx = labelColumn + index;
        if (labelRow < 0 || labelRow >= height || gx < 0 || gx >= width) continue;
        this.#cells[labelRow]![gx] = {
          char: label[index]!,
          foreground: chip.state ? liveLabel : labelColor,
          bold: true,
        };
      }
    }

    this.#paintRail(this.#power, theme, mixMuxstoneRgb(theme.warning, theme.text, 0.3), true, width, height);
    this.#paintRail(this.#ground, theme, mixMuxstoneRgb(theme.muted, theme.background, 0.2), false, width, height);

    // Signal generators: an unboxed label that pulses bright/bold on its square
    // wave's high phase and dims on the low, blinking at its own fixed rate. The
    // last glyph carries the waveform so the state is legible when it is small.
    const oscHigh = mixMuxstoneRgb(theme.accent, theme.text, 0.4);
    const oscLow = mixMuxstoneRgb(theme.accent, theme.background, 0.35);
    for (const oscillator of this.#oscillators) {
      if (oscillator.y < 0 || oscillator.y >= height) continue;
      const color = oscillator.state ? oscHigh : oscLow;
      const glyphs = oscillator.state ? "CL^" : "CL_";
      for (let index = 0; index < glyphs.length; index += 1) {
        const gx = oscillator.x + index;
        if (gx < 0 || gx >= width) continue;
        this.#cells[oscillator.y]![gx] = { char: glyphs[index]!, foreground: color, bold: oscillator.state };
      }
    }
    return this.#cells;
  }

  /** Draws one rail node as a bold 3-cell label. */
  #paintRail(
    rail: CircuitRail | undefined,
    _theme: MuxstoneThemeSpec,
    color: MuxstoneRgb,
    bold: boolean,
    width: number,
    height: number,
  ): void {
    if (!rail || rail.y < 0 || rail.y >= height) return;
    for (let index = 0; index < rail.label.length; index += 1) {
      const gx = rail.x + index;
      if (gx < 0 || gx >= width) continue;
      this.#cells[rail.y]![gx] = { char: rail.label[index]!, foreground: color, bold };
    }
  }

  /** Deterministic state snapshot for tests. */
  inspect(): MuxstoneCircuitInspection {
    return {
      ...(this.#bounds ? { bounds: { ...this.#bounds } } : {}),
      chips: this.#chips.map((chip) => ({
        x: chip.x,
        y: chip.y,
        side: chip.side,
        label: chip.label,
        gate: chip.gate,
        inputCount: chip.inputs.length,
        state: chip.state,
      })),
      traces: this.#traces.map((trace) => ({
        chipIndex: trace.chipIndex,
        kind: trace.kind,
        ...(trace.kind === "tap" && trace.obstacleIndex !== undefined ? { obstacleIndex: trace.obstacleIndex } : {}),
        driver: trace.driver.kind,
        ...(trace.consumerChipId !== undefined ? { consumerChipId: trace.consumerChipId } : {}),
        cells: trace.cells.map((cell) => ({ ...cell })),
        pulses: trace.pulses.map((pulse) => ({ index: pulse.index })),
      })),
      obstacles: this.#obstacles.map((rectangle) => ({ ...rectangle })),
      ...(this.#activeObstacleIndex !== undefined ? { activeObstacleIndex: this.#activeObstacleIndex } : {}),
      pendingJobs: this.#pendingJobs.length,
      ...(this.#power ? { power: { ...this.#power } } : {}),
      ...(this.#ground ? { ground: { ...this.#ground } } : {}),
      oscillators: this.#oscillators.map((oscillator) => ({
        x: oscillator.x,
        y: oscillator.y,
        label: oscillator.label,
        periodTicks: oscillator.periodTicks,
        state: oscillator.state,
      })),
      liveChips: this.#chips.reduce((count, chip) => count + (chip.state ? 1 : 0), 0),
      groundedChips: this.#countGroundedGates(),
    };
  }

  /** Counts gates whose input cone reaches both the power and ground rail. */
  #countGroundedGates(): number {
    const chips = this.#chips;
    if (chips.length === 0) return 0;
    const power = new Map<number, boolean>();
    const ground = new Map<number, boolean>();
    for (const chip of chips) {
      power.set(chip.id, false);
      ground.set(chip.id, false);
    }
    for (let pass = 0; pass < chips.length + 1; pass += 1) {
      let changed = false;
      for (const chip of chips) {
        for (const input of chip.inputs) {
          const reachesPower = input.kind === "power" || input.kind === "osc" ||
            (input.kind === "chip" && power.get(input.id) === true);
          const reachesGround = input.kind === "ground" || input.kind === "osc" ||
            (input.kind === "chip" && ground.get(input.id) === true);
          if (reachesPower && !power.get(chip.id)) {
            power.set(chip.id, true);
            changed = true;
          }
          if (reachesGround && !ground.get(chip.id)) {
            ground.set(chip.id, true);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    let count = 0;
    for (const chip of chips) {
      if (power.get(chip.id) && ground.get(chip.id)) count += 1;
    }
    return count;
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
    this.#power = undefined;
    this.#ground = undefined;
    this.#oscillators = [];
    this.#logicChipCount = -1;
    this.#logicTimerMs = 0;
    this.#wiresDirty = false;
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
        this.#chips.push(this.#createChip(x, y, side));
        this.#markChip(this.#chips.length - 1, 1);
        break;
      }
    }
    this.#placeRails(bounds);
    this.#placeOscillators(bounds);
    this.#rewireLogic();
    // Route the physical wires that realize the logic graph, so they exist on
    // the very first frame rather than after the first advance.
    this.#rebuildWires(bounds);
  }

  /**
   * Free perimeter cells just outside a chip's border, clockwise from the top
   * edge. Wires anchor on these: a chip's first free port is its output pin, the
   * rest are input pins.
   */
  #chipPorts(chip: CircuitChip, bounds: Rectangle): CircuitPathPoint[] {
    const { width, height } = bounds;
    const ports: CircuitPathPoint[] = [];
    const push = (x: number, y: number): void => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const index = y * width + x;
      if (this.#occupancy[index] === 1 || this.#keepOut[index] !== 0) return;
      ports.push({ x, y });
    };
    for (let c = 0; c < chip.side; c += 1) push(chip.x + c, chip.y - 1);
    for (let r = 0; r < chip.side; r += 1) push(chip.x + chip.side, chip.y + r);
    for (let c = chip.side - 1; c >= 0; c -= 1) push(chip.x + c, chip.y + chip.side);
    for (let r = chip.side - 1; r >= 0; r -= 1) push(chip.x - 1, chip.y + r);
    return ports;
  }

  /**
   * Routes every logic edge as a physical wire from its driver's output pin to
   * the consuming gate's input pin, then keeps the window taps. Wires avoid
   * chips and keep-out zones and may cross one another, so a route always
   * exists while the endpoints share free space. Runs on any structural change.
   */
  #rebuildWires(bounds: Rectangle): void {
    this.#wiresDirty = false;
    this.#traces = this.#traces.filter((trace) => trace.kind === "tap");
    if (this.#chips.length === 0) return;

    const chipIndexById = new Map<number, number>();
    const chipOutputPin = new Map<number, CircuitPathPoint>();
    const chipPorts = new Map<number, CircuitPathPoint[]>();
    for (let index = 0; index < this.#chips.length; index += 1) {
      const chip = this.#chips[index]!;
      chipIndexById.set(chip.id, index);
      const ports = this.#chipPorts(chip, bounds);
      chipPorts.set(chip.id, ports);
      if (ports.length > 0) chipOutputPin.set(chip.id, ports[0]!);
    }

    const inputCursor = new Map<number, number>();

    for (const chip of this.#chips) {
      const ports = chipPorts.get(chip.id) ?? [];
      for (const input of chip.inputs) {
        const source = this.#driverPin(input, chipOutputPin, bounds);
        if (!source) continue;
        // Each input takes a distinct port past the output (index 0).
        const cursor = inputCursor.get(chip.id) ?? 1;
        inputCursor.set(chip.id, cursor + 1);
        const sink = ports.length > 1 ? ports[1 + ((cursor - 1) % (ports.length - 1))]! : ports[0];
        if (!sink) continue;
        const cells = this.#routeWire(source, sink, bounds);
        if (!cells) continue;
        const pulseCount = 2 + Math.floor(this.#random() * 3);
        const pulses: CircuitPulse[] = Array.from({ length: pulseCount }, () => ({
          index: Math.floor(this.#random() * cells.length),
          accumulator: 0,
        }));
        this.#traces.push({
          kind: "wire",
          driver: input,
          consumerChipId: chip.id,
          chipIndex: input.kind === "chip" ? chipIndexById.get(input.id) ?? -1 : -1,
          cells,
          pulses,
        });
      }
    }
  }

  /** The output pin of whatever drives an input: a chip port, or a rail/osc cell. */
  #driverPin(
    ref: LogicRef,
    chipOutputPin: Map<number, CircuitPathPoint>,
    bounds: Rectangle,
  ): CircuitPathPoint | undefined {
    switch (ref.kind) {
      case "chip":
        return chipOutputPin.get(ref.id);
      case "osc": {
        const oscillator = this.#oscillators.find((entry) => entry.id === ref.id);
        return oscillator ? this.#freeNear(oscillator.x, oscillator.y, bounds) : undefined;
      }
      case "power":
        return this.#power ? this.#freeNear(this.#power.x, this.#power.y, bounds) : undefined;
      case "ground":
        return this.#ground ? this.#freeNear(this.#ground.x, this.#ground.y, bounds) : undefined;
    }
  }

  /** A free cell at or beside a rail/oscillator label to anchor a wire on. */
  #freeNear(x: number, y: number, bounds: Rectangle): CircuitPathPoint | undefined {
    const { width, height } = bounds;
    const candidates: CircuitPathPoint[] = [
      { x, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
      { x: x - 1, y },
      { x: x + 3, y },
    ];
    for (const candidate of candidates) {
      if (candidate.x < 0 || candidate.x >= width || candidate.y < 0 || candidate.y >= height) continue;
      const index = candidate.y * width + candidate.x;
      if (this.#occupancy[index] !== 1 && this.#keepOut[index] === 0) return candidate;
    }
    return undefined;
  }

  /**
   * Shortest orthogonal route from one pin to another over cells that are not
   * chips or keep-out, bounded by a visit cap. Wires may cross one another, so a
   * route exists whenever the endpoints share free space. Uses a generation
   * -stamped BFS on reused buffers with a head-pointer queue, so no allocation
   * or full-array reset happens per route on the hot re-routing path.
   */
  #routeWire(source: CircuitPathPoint, sink: CircuitPathPoint, bounds: Rectangle): CircuitTraceCell[] | undefined {
    const { width, height } = bounds;
    const size = width * height;
    if (this.#routeSeen.length !== size) {
      this.#routeSeen = new Uint32Array(size);
      this.#routePrev = new Int32Array(size);
      this.#routeQueue = new Int32Array(size);
      this.#routeGeneration = 0;
    }
    const passable = (index: number): boolean => this.#occupancy[index] !== 1 && this.#keepOut[index] === 0;
    const sourceIndex = source.y * width + source.x;
    const sinkIndex = sink.y * width + sink.x;
    if (!passable(sourceIndex) || !passable(sinkIndex)) return undefined;

    const seen = this.#routeSeen;
    const previous = this.#routePrev;
    const queue = this.#routeQueue;
    const generation = ++this.#routeGeneration;
    const rotation = Math.floor(this.#random() * 4);
    let head = 0;
    let tail = 0;
    queue[tail++] = sourceIndex;
    seen[sourceIndex] = generation;
    previous[sourceIndex] = -1;
    let found = false;
    while (head < tail && head <= MAX_ROUTE_VISITS) {
      const index = queue[head++]!;
      if (index === sinkIndex) {
        found = true;
        break;
      }
      const x = index % width;
      const y = (index - x) / width;
      for (let turn = 0; turn < 4; turn += 1) {
        const direction = (turn + rotation) % 4;
        const nx = x + DIR_DX[direction]!;
        const ny = y + DIR_DY[direction]!;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighbour = ny * width + nx;
        if (seen[neighbour] === generation || !passable(neighbour)) continue;
        seen[neighbour] = generation;
        previous[neighbour] = index;
        queue[tail++] = neighbour;
      }
    }
    if (!found) return undefined;
    const path: CircuitPathPoint[] = [];
    for (let index = sinkIndex; index !== -1; index = previous[index]!) {
      path.push({ x: index % width, y: Math.floor(index / width) });
    }
    path.reverse();
    if (path.length < 2) return undefined;
    return wirePathToCells(path);
  }

  /** Periodically re-wires one gate's inputs so the circuit slowly evolves. */
  #rewireOneGate(): boolean {
    if (this.#chips.length < 2) return false;
    const chip = this.#chips[Math.floor(this.#random() * this.#chips.length)]!;
    const neighbours = this.#chips
      .filter((other) => other.id !== chip.id)
      .sort((a, b) => chipDistance(chip, a) - chipDistance(chip, b));
    const wantInputs = MIN_GATE_INPUTS + Math.floor(this.#random() * (MAX_GATE_INPUTS - MIN_GATE_INPUTS + 1));
    const inputs: LogicRef[] = [];
    const railRoll = this.#random();
    if (railRoll < 0.34) inputs.push({ kind: "power" });
    else if (railRoll < 0.62) inputs.push({ kind: "ground" });
    const osc = this.#nearestOscillator(chip);
    if (osc && inputs.length < wantInputs && this.#random() < 0.3) inputs.push({ kind: "osc", id: osc.id });
    for (const neighbour of neighbours) {
      if (inputs.length >= wantInputs) break;
      inputs.push({ kind: "chip", id: neighbour.id });
    }
    while (inputs.length < MIN_GATE_INPUTS) inputs.push({ kind: this.#random() < 0.5 ? "power" : "ground" });
    chip.inputs = inputs;
    this.#groundEveryGate();
    this.#wiresDirty = true;
    return true;
  }

  /** Places one signal generator per patch of board, up to a small cap. */
  #placeOscillators(bounds: Rectangle): void {
    const count = clampInteger(
      Math.round((bounds.width * bounds.height) / OSC_CELLS_EACH),
      bounds.width * bounds.height >= 400 ? 1 : 0,
      MAX_OSCILLATORS,
    );
    for (let index = 0; index < count; index += 1) {
      const spot = this.#placeRail(bounds, OSCILLATOR_LABEL, this.#random(), this.#random());
      if (!spot) continue;
      this.#oscillators.push({
        id: this.#nextOscId++,
        x: spot.x,
        y: spot.y,
        label: OSCILLATOR_LABEL,
        periodTicks: OSC_MIN_PERIOD_TICKS +
          Math.floor(this.#random() * (OSC_MAX_PERIOD_TICKS - OSC_MIN_PERIOD_TICKS + 1)),
        phase: Math.floor(this.#random() * OSC_MAX_PERIOD_TICKS),
        state: this.#random() < 0.5,
      });
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

  /** Rebuilds the keep-out mask, drops taps caught in it, and re-routes wires. */
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

    // A window changed shape, so every wire has to be re-routed to weave around
    // the new keep-out. Tap traces still recover in place when their route stays
    // clear, and are dropped for regrowth otherwise.
    this.#wiresDirty = true;
    for (let index = this.#traces.length - 1; index >= 0; index -= 1) {
      const trace = this.#traces[index]!;
      if (trace.kind !== "tap") continue;
      const obstacleIndex = trace.obstacleRect
        ? this.#obstacles.findIndex((rectangle) => sameRect(rectangle, trace.obstacleRect!))
        : -1;
      if (obstacleIndex >= 0 && this.#tapRouteClear(trace, bounds)) {
        trace.obstacleIndex = obstacleIndex;
        continue;
      }
      this.#clearTraceOccupancy(trace, bounds);
      this.#traces.splice(index, 1);
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
    return true;
  }

  /** Runs a bounded number of queued layout reactions so changes stagger deterministically. */
  #processLayoutJobs(bounds: Rectangle): boolean {
    let changed = false;
    for (let step = 0; step < LAYOUT_JOBS_PER_FRAME && this.#pendingJobs.length > 0; step += 1) {
      const job = this.#pendingJobs.shift()!;
      if (job.kind === "relocate-chip") {
        if (this.#relocateChip(job.chipId, bounds)) changed = true;
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
    } else {
      this.#despawnChip(chipIndex, bounds);
    }
    // The chip moved or vanished, so its wires no longer connect; re-route all.
    this.#wiresDirty = true;
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

  /**
   * Periodic survey of the board. Free space — whether it was always empty or a
   * window stopped being a keep-out zone — gets a new gate, which joins the
   * logic graph and dirties the routing so the wires re-weave to include it.
   */
  #reassessBoard(bounds: Rectangle): boolean {
    const { width, height } = bounds;
    const maxSide = Math.min(MAX_CHIP_SIDE, width - 2 * CHIP_MARGIN, height - 2 * CHIP_MARGIN);
    if (maxSide < 3) return false;
    const minSide = Math.min(MIN_CHIP_SIDE, maxSide);
    const ceiling = clampInteger(
      Math.round((3 + (width * height) / 480) * this.#density),
      3,
      MAX_BOARD_CHIPS,
    );
    if (this.#chips.length >= ceiling) return false;
    for (let attempt = 0; attempt < EMPTY_REGION_SAMPLES; attempt += 1) {
      const side = minSide + Math.floor(this.#random() * (maxSide - minSide + 1));
      const spanX = width - side - 2 * CHIP_MARGIN + 1;
      const spanY = height - side - 2 * CHIP_MARGIN + 1;
      if (spanX <= 0 || spanY <= 0) continue;
      const x = CHIP_MARGIN + Math.floor(this.#random() * spanX);
      const y = CHIP_MARGIN + Math.floor(this.#random() * spanY);
      if (!this.#chipFits(x, y, side, -1)) continue;
      this.#chips.push(this.#createChip(x, y, side));
      this.#markChip(this.#chips.length - 1, 1);
      this.#wiresDirty = true;
      return true;
    }
    return false;
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
      // A tap carries the source gate's output onto the window border.
      driver: { kind: "chip", id: chip.id },
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

  #driftOneChip(bounds: Rectangle): boolean {
    if (this.#chips.length === 0) return false;
    const chipIndex = Math.floor(this.#random() * this.#chips.length);
    const chip = this.#chips[chipIndex]!;
    const direction = Math.floor(this.#random() * 4);

    // The chip's taps must regrow from its new position; its wires re-route.
    for (let index = this.#traces.length - 1; index >= 0; index -= 1) {
      const trace = this.#traces[index]!;
      if (trace.kind !== "tap" || trace.chipIndex !== chipIndex) continue;
      if (trace.obstacleRect) this.#enqueueJob({ kind: "grow-taps", rect: { ...trace.obstacleRect } });
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
    this.#wiresDirty = true;
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

  /** Builds one chip as a randomly-typed gate with a seeded initial output. */
  #createChip(x: number, y: number, side: number): CircuitChip {
    const gate = GATE_TYPES[Math.floor(this.#random() * GATE_TYPES.length)]!;
    return {
      id: this.#nextChipId++,
      x,
      y,
      side,
      label: gate,
      gate,
      inputs: [],
      state: this.#random() < 0.5,
      nextState: false,
    };
  }

  /**
   * Places the power and ground rails at open cells, biased toward opposite
   * board corners so the network spans between them.
   */
  #placeRails(bounds: Rectangle): void {
    this.#power = this.#placeRail(bounds, POWER_LABEL, 0.15, 0.2) ??
      this.#power ?? { x: 1, y: 1, label: POWER_LABEL };
    this.#ground = this.#placeRail(bounds, GROUND_LABEL, 0.85, 0.85) ??
      this.#ground ?? { x: Math.max(0, bounds.width - 4), y: Math.max(0, bounds.height - 2), label: GROUND_LABEL };
  }

  #placeRail(bounds: Rectangle, label: string, biasX: number, biasY: number): CircuitRail | undefined {
    const targetX = Math.floor(bounds.width * biasX);
    const targetY = Math.floor(bounds.height * biasY);
    let best: CircuitRail | undefined;
    let bestScore = Infinity;
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const x = clampInteger(targetX + Math.floor((this.#random() - 0.5) * bounds.width * 0.3), 0, bounds.width - 3);
      const y = clampInteger(targetY + Math.floor((this.#random() - 0.5) * bounds.height * 0.3), 0, bounds.height - 1);
      if (!this.#railFits(x, y, bounds)) continue;
      const score = Math.abs(x - targetX) + Math.abs(y - targetY);
      if (score < bestScore) {
        bestScore = score;
        best = { x, y, label };
      }
    }
    return best;
  }

  #railFits(x: number, y: number, bounds: Rectangle): boolean {
    if (y < 0 || y >= bounds.height) return false;
    for (let column = x; column < x + 3; column += 1) {
      if (column < 0 || column >= bounds.width) return false;
      const cell = y * bounds.width + column;
      if (this.#occupancy[cell] !== 0 || this.#keepOut[cell] !== 0) return false;
    }
    return true;
  }

  /**
   * Wires every chip's inputs to its nearest neighbours and to the oscillators
   * and rails, then patches the graph so every gate's input cone reaches both
   * the power and the ground rail — a plausible circuit where nothing floats.
   * Runs when the chip population changes so new gates join and stale references
   * drop out.
   */
  #rewireLogic(): void {
    const chips = this.#chips;
    this.#logicChipCount = chips.length;
    if (chips.length === 0) return;
    for (let index = 0; index < chips.length; index += 1) {
      const chip = chips[index]!;
      // Rank other chips by proximity so wiring follows the board's geometry.
      const neighbours = chips
        .map((other, otherIndex) => ({ otherIndex, distance: chipDistance(chip, other) }))
        .filter((entry) => entry.otherIndex !== index)
        .sort((a, b) => a.distance - b.distance);
      const wantInputs = MIN_GATE_INPUTS + Math.floor(this.#random() * (MAX_GATE_INPUTS - MIN_GATE_INPUTS + 1));
      const inputs: LogicRef[] = [];
      // Seed the graph against both rails: some gates read power, some ground,
      // and the geometric wiring carries those references across the network.
      const railRoll = this.#random();
      if (railRoll < 0.34) inputs.push({ kind: "power" });
      else if (railRoll < 0.62) inputs.push({ kind: "ground" });
      // A nearby signal generator sometimes clocks the gate directly.
      const osc = this.#nearestOscillator(chip);
      if (osc && inputs.length < wantInputs && this.#random() < 0.3) inputs.push({ kind: "osc", id: osc.id });
      for (const neighbour of neighbours) {
        if (inputs.length >= wantInputs) break;
        inputs.push({ kind: "chip", id: chips[neighbour.otherIndex]!.id });
      }
      // A lone chip with no neighbours still needs a driver, so fall back to a rail.
      while (inputs.length < Math.min(wantInputs, MIN_GATE_INPUTS)) {
        inputs.push({ kind: this.#random() < 0.5 ? "power" : "ground" });
      }
      chip.inputs = inputs;
    }
    // Guarantee each oscillator drives at least its nearest gate, so no signal
    // generator sits inert on the board.
    for (const oscillator of this.#oscillators) {
      const gate = this.#nearestChipTo(oscillator.x, oscillator.y);
      if (gate && !gate.inputs.some((input) => input.kind === "osc" && input.id === oscillator.id)) {
        gate.inputs.push({ kind: "osc", id: oscillator.id });
      }
    }
    this.#groundEveryGate();
  }

  /**
   * Ensures every gate's input cone reaches both rails. Computes what each gate
   * connects to at fixpoint (rails, oscillators — which are themselves powered
   * and grounded — and transitively other gates), then adds a direct rail input
   * to any gate still missing one.
   */
  #groundEveryGate(): void {
    const chips = this.#chips;
    const power = new Map<number, boolean>();
    const ground = new Map<number, boolean>();
    for (const chip of chips) {
      power.set(chip.id, false);
      ground.set(chip.id, false);
    }
    // Fixpoint over the input graph; cycles converge because flags only ever set.
    for (let pass = 0; pass < chips.length + 1; pass += 1) {
      let changed = false;
      for (const chip of chips) {
        for (const input of chip.inputs) {
          const reachesPower = input.kind === "power" || input.kind === "osc" ||
            (input.kind === "chip" && power.get(input.id) === true);
          const reachesGround = input.kind === "ground" || input.kind === "osc" ||
            (input.kind === "chip" && ground.get(input.id) === true);
          if (reachesPower && power.get(chip.id) === false) {
            power.set(chip.id, true);
            changed = true;
          }
          if (reachesGround && ground.get(chip.id) === false) {
            ground.set(chip.id, true);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    for (const chip of chips) {
      if (power.get(chip.id) !== true) chip.inputs.push({ kind: "power" });
      if (ground.get(chip.id) !== true) chip.inputs.push({ kind: "ground" });
    }
  }

  #nearestOscillator(chip: CircuitChip): CircuitOscillator | undefined {
    let best: CircuitOscillator | undefined;
    let bestDistance = Infinity;
    for (const oscillator of this.#oscillators) {
      const distance = Math.abs(oscillator.x - (chip.x + chip.side / 2)) +
        Math.abs(oscillator.y - (chip.y + chip.side / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = oscillator;
      }
    }
    return best;
  }

  #nearestChipTo(x: number, y: number): CircuitChip | undefined {
    let best: CircuitChip | undefined;
    let bestDistance = Infinity;
    for (const chip of this.#chips) {
      const distance = Math.abs(chip.x + chip.side / 2 - x) + Math.abs(chip.y + chip.side / 2 - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = chip;
      }
    }
    return best;
  }

  /**
   * One synchronous logic step: gates read the previous tick's outputs (of other
   * gates and of the oscillators), then every output commits at once, and the
   * oscillators advance for the next tick. Reading previous state everywhere is
   * what lets feedback loops oscillate rather than race.
   */
  #tickLogic(): boolean {
    const chips = this.#chips;
    if (chips.length === 0) return false;
    const chipById = new Map<number, CircuitChip>();
    for (const chip of chips) chipById.set(chip.id, chip);
    const oscById = new Map<number, CircuitOscillator>();
    for (const oscillator of this.#oscillators) oscById.set(oscillator.id, oscillator);
    for (const chip of chips) {
      let high = 0;
      let total = 0;
      for (const input of chip.inputs) {
        total += 1;
        if (input.kind === "power") high += 1;
        else if (input.kind === "ground") continue;
        else if (input.kind === "osc") {
          if (oscById.get(input.id)?.state) high += 1;
        } else if (chipById.get(input.id)?.state) high += 1;
      }
      chip.nextState = evaluateGate(chip.gate, high, total);
    }
    let changed = false;
    for (const chip of chips) {
      if (chip.nextState !== chip.state) changed = true;
      chip.state = chip.nextState;
    }
    // Advance the free-running generators for the next tick.
    for (const oscillator of this.#oscillators) {
      oscillator.phase += 1;
      if (oscillator.phase >= oscillator.periodTicks) {
        oscillator.phase = 0;
        oscillator.state = !oscillator.state;
        changed = true;
      }
    }
    return changed;
  }

  #random(): number {
    this.#randomState = (Math.imul(this.#randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return this.#randomState / 0x1_0000_0000;
  }
}

/** Evaluates one gate from the count of high inputs out of the total wired. */
function evaluateGate(gate: GateType, high: number, total: number): boolean {
  if (total === 0) return false;
  switch (gate) {
    case "AND":
      return high === total;
    case "OR":
      return high > 0;
    case "NAND":
      return high !== total;
    case "NOR":
      return high === 0;
    case "XOR":
      return (high & 1) === 1;
    case "XNOR":
      return (high & 1) === 0;
  }
}

/** Manhattan distance between two chip centres. */
function chipDistance(a: CircuitChip, b: CircuitChip): number {
  const ax = a.x + a.side / 2;
  const ay = a.y + a.side / 2;
  const bx = b.x + b.side / 2;
  const by = b.y + b.side / 2;
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** Converts a routed wire path to drawn cells, with line glyphs at both ends. */
function wirePathToCells(path: readonly CircuitPathPoint[]): CircuitTraceCell[] {
  const cells: CircuitTraceCell[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index]!;
    const arrival = index === 0 ? pathDirection(path[0]!, path[1]!) : pathDirection(path[index - 1]!, point);
    const exit = index === path.length - 1 ? arrival : pathDirection(point, path[index + 1]!);
    cells.push({ x: point.x, y: point.y, glyph: TRACE_GLYPHS[arrival * 4 + exit]! });
  }
  return cells;
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
