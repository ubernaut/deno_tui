// Copyright 2023 Im-Beast. MIT license.

// Microphone-reactive MilkDrop-style desktop background.
//
// This is the ASCII port of butterchurnxr's `asciichurn` rendered natively: the
// same idea — an audio-driven frame-feedback visualizer resolved at terminal
// cell resolution and painted as colored blocks — with the MilkDrop pipeline
// reimplemented on the CPU instead of proxied out to Butterchurn's WebGL2
// renderer in headless Chromium. Exomux ships as a single compiled binary and
// runs over a tailnet, so a browser dependency is not available to it.
//
// The pipeline per frame is MilkDrop's:
//
//   1. resample the previous frame through a warp mesh (zoom, rotate, drift,
//      and a separable sine warp), attenuated by the preset's decay and tint;
//   2. draw this frame's waveform and spectrum on top as fresh ink;
//   3. quantize the accumulated RGB field to shaded block glyphs.
//
// Step 1 is what makes the output read as MilkDrop rather than as an equalizer:
// every frame's ink is dragged, spun and faded by all subsequent frames, so a
// single drum hit leaves a spiral behind it.

import type { Rectangle } from "@ubernaut/deno-tui";
import type {
  ExomuxAnimatedBackground,
  ExomuxBackgroundAdvanceOptions,
  ExomuxBackgroundCell,
  ExomuxBackgroundPoint,
} from "./background.ts";
import { acquireExomuxAudio, type ExomuxAudioFrame, type ExomuxAudioSource } from "./audio.ts";
import type { ExomuxRgb, ExomuxThemeSpec } from "./model.ts";

// ── constants ───────────────────────────────────────────────────────────────

const FRAME_BASELINE_MS = 125;
const MAX_FRAME_DELTA_MS = 400;
const POINTER_LIFETIME_MS = 1_500;

/** Seconds one preset holds before the field cycles to the next. */
const PRESET_HOLD_SECONDS = 15;
/** Seconds spent crossfading between two presets, matching asciichurn. */
const PRESET_BLEND_SECONDS = 2.7;

/** Terminal cells are about twice as tall as they are wide. */
const CELL_ASPECT = 2;
/** Ceiling on accumulated ink, so a sustained loud passage cannot saturate flat. */
const MAX_INK = 1.6;
/** Cells dimmer than this show the desktop theme instead of a block. */
const MIN_INK = 0.1;
/** Shade ramp, dimmest first; the block carries what the color cannot. */
const SHADES: readonly string[] = ["░", "▒", "▓", "█"];
/** Upper ink bound of each shade in `SHADES`; the last entry is open-ended. */
const SHADE_STOPS: readonly number[] = [0.2, 0.42, 0.75];
/** Output gamma. Below 1 it lifts midtones so dim feedback trails stay visible. */
const INK_GAMMA = 1 / 1.35;
/**
 * Output colors are snapped to this per-channel grid, bounding the palette at
 * 17³ = 4913 colors.
 *
 * The desktop painter caches one ANSI style per (foreground, background, bold)
 * triple and clears the whole cache at 8192 entries. Unquantized, this field
 * mints roughly 490 new colors every frame — it would flush that cache every
 * couple of seconds and then miss on nearly every cell, which is precisely the
 * repaint saturation the painter's cache exists to prevent. A step of 16 is
 * about 6% of range; the shade ramp breaks up what banding is left.
 */
const COLOR_STEP = 16;
/** Strongest pull of the theme accent, applied to the faintest ink only. */
const MAX_ACCENT_TINT = 0.45;
/** Ink level at which the accent pull has faded to nothing. */
const ACCENT_TINT_LIMIT = 0.35;

/** Samples plotted along a closed wave figure. */
const WAVE_SAMPLES = 240;
/**
 * Ink deposited by the waveform before per-preset color and mode density.
 *
 * The field runs at 8 Hz, so both this and the preset decays are an order of
 * magnitude away from MilkDrop's own numbers: a frame here is worth roughly
 * four of MilkDrop's, and a feedback loop that deposits faster than it fades
 * fills the whole desktop with white inside a few seconds.
 */
const WAVE_INK = 0.5;
/**
 * Share of full ink the wave still deposits at zero level.
 *
 * MilkDrop draws its waveform at full brightness on silence, as a flat trace.
 * A desktop background should not: a quiet room is the common case, and a
 * static ring smeared across a third of the screen is worse than nothing. This
 * floor keeps the figure faintly alive so the field has something to react
 * from, without lighting up an idle desktop.
 */
const SILENT_INK = 0.12;
/** Extra ink deposited on the frame a beat is detected. */
const BEAT_INK = 0.45;
/** Ink deposited under the pointer. */
const POINTER_INK = 0.9;

/**
 * Per-mode deposit scale. Modes differ by more than an order of magnitude in
 * how many cells they touch — a waveform line plots one point per column, a
 * spectrum fills bars — so without this the dense modes wash out.
 */
const WAVE_DENSITY: Readonly<Record<ExomuxButterchurnWave, number>> = Object.freeze({
  line: 1,
  dual: 0.6,
  circle: 1,
  figure: 0.9,
  radial: 0.55,
  spectrum: 0.7,
});

/** Ink a spike or bar lays along its length, relative to its tip. */
const STEM_INK = 0.08;

// ── presets ─────────────────────────────────────────────────────────────────

/** How a preset lays this frame's audio onto the canvas. */
export type ExomuxButterchurnWave = "circle" | "line" | "dual" | "spectrum" | "radial" | "figure";

/** One MilkDrop-style parameter set. Every numeric field crossfades on cycle. */
export interface ExomuxButterchurnPreset {
  readonly name: string;
  /** Fraction of the previous frame that survives resampling. */
  readonly decay: number;
  /** Per-frame channel multiplier on the feedback; unequal values drift hue. */
  readonly tint: readonly [number, number, number];
  /** Feedback scale per frame. Above 1 the image flows outward. */
  readonly zoom: number;
  /** Feedback scale added per unit of bass energy. */
  readonly zoomBass: number;
  /** Feedback rotation per frame, in radians. */
  readonly rotate: number;
  /** Rotation added per unit of treble energy. */
  readonly rotateTreble: number;
  /** Feedback translation per frame, in normalized screen units. */
  readonly driftX: number;
  readonly driftY: number;
  /** Amplitude of the sine warp mesh. */
  readonly warp: number;
  /** Amplitude added per unit of mid energy. */
  readonly warpMid: number;
  /** Spatial frequency of the warp mesh. */
  readonly warpScale: number;
  /** Angular speed of the warp mesh. */
  readonly warpSpeed: number;
  readonly wave: ExomuxButterchurnWave;
  /** Waveform ink color, linear 0..1 per channel. */
  readonly waveColor: readonly [number, number, number];
  /** Ink color flashed on a detected beat. */
  readonly beatColor: readonly [number, number, number];
  /** Radius of the wave figure, in normalized screen units. */
  readonly waveSize: number;
}

/**
 * The shipped preset catalog. These are hand-written rather than imported: the
 * real Butterchurn catalog is 293 MilkDrop presets of compiled EEL equations,
 * which needs the engine this field deliberately does without.
 */
export const EXOMUX_BUTTERCHURN_PRESETS: readonly ExomuxButterchurnPreset[] = Object.freeze([
  Object.freeze({
    name: "Geiss — Reaction Diffusion",
    decay: 0.855,
    tint: [1.0, 0.985, 0.96] as const,
    zoom: 1.035,
    zoomBass: 0.05,
    rotate: 0.012,
    rotateTreble: 0.03,
    driftX: 0,
    driftY: 0,
    warp: 0.02,
    warpMid: 0.05,
    warpScale: 4.2,
    warpSpeed: 0.9,
    wave: "circle",
    waveColor: [0.25, 0.85, 1.0] as const,
    beatColor: [1.0, 0.75, 0.35] as const,
    waveSize: 0.42,
  }),
  Object.freeze({
    name: "Rovastar — Hyperspace Tunnel",
    decay: 0.880,
    tint: [0.99, 0.97, 1.0] as const,
    zoom: 1.06,
    zoomBass: 0.09,
    rotate: -0.008,
    rotateTreble: -0.05,
    driftX: 0,
    driftY: 0,
    warp: 0.006,
    warpMid: 0.02,
    warpScale: 2.1,
    warpSpeed: 0.4,
    wave: "radial",
    waveColor: [0.95, 0.35, 0.9] as const,
    beatColor: [0.4, 1.0, 0.95] as const,
    waveSize: 0.22,
  }),
  Object.freeze({
    name: "Flexi — Bass Kick Mandala",
    decay: 0.815,
    tint: [1.0, 0.95, 0.9] as const,
    zoom: 0.985,
    zoomBass: 0.14,
    rotate: 0.04,
    rotateTreble: 0.02,
    driftX: 0,
    driftY: 0,
    warp: 0.03,
    warpMid: 0.04,
    warpScale: 6.5,
    warpSpeed: 1.4,
    wave: "figure",
    waveColor: [1.0, 0.6, 0.2] as const,
    beatColor: [1.0, 1.0, 0.9] as const,
    waveSize: 0.5,
  }),
  Object.freeze({
    name: "Aderrasi — Undersea Drift",
    decay: 0.900,
    tint: [0.95, 1.0, 0.99] as const,
    zoom: 1.012,
    zoomBass: 0.03,
    rotate: 0.004,
    rotateTreble: 0.008,
    driftX: 0.004,
    driftY: -0.006,
    warp: 0.045,
    warpMid: 0.06,
    warpScale: 2.8,
    warpSpeed: 0.35,
    wave: "dual",
    waveColor: [0.2, 0.95, 0.65] as const,
    beatColor: [0.85, 1.0, 0.4] as const,
    waveSize: 0.55,
  }),
  Object.freeze({
    name: "Krash — Spectrum Comb",
    decay: 0.720,
    tint: [1.0, 0.98, 1.0] as const,
    zoom: 1.0,
    zoomBass: 0.02,
    rotate: 0,
    rotateTreble: 0,
    driftX: 0,
    driftY: -0.035,
    warp: 0.012,
    warpMid: 0.03,
    warpScale: 8.0,
    warpSpeed: 2.2,
    wave: "spectrum",
    waveColor: [0.55, 0.35, 1.0] as const,
    beatColor: [1.0, 0.35, 0.55] as const,
    waveSize: 0.55,
  }),
  Object.freeze({
    name: "Idiot — Slow Rotor",
    decay: 0.918,
    tint: [1.0, 0.93, 0.97] as const,
    zoom: 1.004,
    zoomBass: 0.06,
    rotate: 0.055,
    rotateTreble: -0.04,
    driftX: 0,
    driftY: 0,
    warp: 0.008,
    warpMid: 0.015,
    warpScale: 3.3,
    warpSpeed: 0.18,
    wave: "line",
    waveColor: [1.0, 0.25, 0.35] as const,
    beatColor: [0.3, 0.6, 1.0] as const,
    waveSize: 0.6,
  }),
  Object.freeze({
    name: "Unchained — Electric Sheep",
    decay: 0.835,
    tint: [0.97, 1.0, 0.94] as const,
    zoom: 1.055,
    zoomBass: 0.09,
    rotate: 0.022,
    rotateTreble: 0.06,
    driftX: -0.008,
    driftY: 0,
    warp: 0.055,
    warpMid: 0.09,
    warpScale: 5.1,
    warpSpeed: 1.1,
    wave: "circle",
    waveColor: [0.85, 1.0, 0.3] as const,
    beatColor: [1.0, 0.2, 0.8] as const,
    waveSize: 0.3,
  }),
  Object.freeze({
    name: "Fvese — Quiet Nebula",
    decay: 0.945,
    tint: [0.99, 0.99, 1.0] as const,
    zoom: 1.018,
    zoomBass: 0.04,
    rotate: -0.006,
    rotateTreble: 0.012,
    driftX: 0.003,
    driftY: 0.004,
    warp: 0.035,
    warpMid: 0.04,
    warpScale: 1.6,
    warpSpeed: 0.22,
    wave: "figure",
    waveColor: [0.45, 0.55, 1.0] as const,
    beatColor: [1.0, 0.9, 0.6] as const,
    waveSize: 0.45,
  }),
]) as readonly ExomuxButterchurnPreset[];

/** Every numeric knob crossfaded between two presets during a blend. */
interface BlendedPreset {
  decay: number;
  tint: [number, number, number];
  zoom: number;
  zoomBass: number;
  rotate: number;
  rotateTreble: number;
  driftX: number;
  driftY: number;
  warp: number;
  warpMid: number;
  warpScale: number;
  warpSpeed: number;
  waveSize: number;
}

export interface ExomuxButterchurnFieldOptions {
  /**
   * Audio to visualize. Omit to share the process-wide microphone capture,
   * which is opened on the first advance and released by `dispose`.
   */
  readonly audio?: ExomuxAudioSource;
  /** Preset the field opens on. */
  readonly presetIndex?: number;
  /** Cycle presets on a timer; off leaves the opening preset in place. */
  readonly autoCycle?: boolean;
}

interface ButterchurnPointer {
  readonly column: number;
  readonly row: number;
  readonly updatedAt: number;
}

/**
 * Audio-reactive MilkDrop-style background. Simulation state is a pair of RGB
 * accumulation buffers at cell resolution; everything else is derived, so the
 * field is deterministic for a given audio source and frame timeline.
 */
export class ExomuxButterchurnField implements ExomuxAnimatedBackground {
  #width = 0;
  #height = 0;
  /** Accumulated RGB ink, three floats per cell. */
  #ink = new Float32Array(0);
  /** Warp destination, swapped with `#ink` each frame. */
  #inkNext = new Float32Array(0);
  /** Per-row and per-column warp offsets; the mesh is separable by design. */
  #warpRows = new Float32Array(0);
  #warpColumns = new Float32Array(0);

  #audio: ExomuxAudioSource | undefined;
  readonly #ownsAudio: boolean;
  #audioLabel = "starting";

  #presetIndex: number;
  #previousIndex: number;
  #blend = 1;
  readonly #autoCycle: boolean;
  #heldSeconds = 0;
  readonly #blended: BlendedPreset = {
    decay: 0,
    tint: [1, 1, 1],
    zoom: 1,
    zoomBass: 0,
    rotate: 0,
    rotateTreble: 0,
    driftX: 0,
    driftY: 0,
    warp: 0,
    warpMid: 0,
    warpScale: 1,
    warpSpeed: 0,
    waveSize: 0.5,
  };

  #time = 0;
  #lastFrameAt: number | undefined;
  #pointer: ButterchurnPointer | undefined;
  #cells: (ExomuxBackgroundCell | undefined)[][] = [];

  constructor(options: ExomuxButterchurnFieldOptions = {}) {
    this.#audio = options.audio;
    this.#ownsAudio = options.audio === undefined;
    const count = EXOMUX_BUTTERCHURN_PRESETS.length;
    const requested = Math.trunc(options.presetIndex ?? 0);
    this.#presetIndex = Number.isFinite(requested) ? ((requested % count) + count) % count : 0;
    this.#previousIndex = this.#presetIndex;
    this.#autoCycle = options.autoCycle ?? true;
  }

  /** Preset currently in front; during a blend this is the incoming one. */
  get preset(): ExomuxButterchurnPreset {
    return EXOMUX_BUTTERCHURN_PRESETS[this.#presetIndex]!;
  }

  get presetIndex(): number {
    return this.#presetIndex;
  }

  /** Status label for the audio source, e.g. `mic:parec`, `synth`. */
  get audioLabel(): string {
    return this.#audioLabel;
  }

  /** Advances to the next preset, starting a crossfade. */
  nextPreset(): void {
    this.#previousIndex = this.#presetIndex;
    this.#presetIndex = (this.#presetIndex + 1) % EXOMUX_BUTTERCHURN_PRESETS.length;
    this.#blend = 0;
    this.#heldSeconds = 0;
  }

  setPointer(point: ExomuxBackgroundPoint, now = performance.now()): void {
    if (!Number.isFinite(point.column) || !Number.isFinite(point.row)) return;
    this.#pointer = { column: point.column, row: point.row, updatedAt: finite(now, performance.now()) };
  }

  clearPointer(): void {
    this.#pointer = undefined;
  }

  /** Releases the shared microphone capture, if this field opened it. */
  dispose(): void {
    if (this.#ownsAudio) this.#audio?.close();
    this.#audio = undefined;
  }

  advance(options: ExomuxBackgroundAdvanceOptions): boolean {
    const bounds = normalizeBounds(options.bounds);
    if (!bounds) return false;
    const now = finite(options.now, performance.now());
    const elapsedMs = this.#lastFrameAt === undefined
      ? FRAME_BASELINE_MS
      : Math.min(MAX_FRAME_DELTA_MS, Math.max(0, now - this.#lastFrameAt));
    this.#lastFrameAt = now;
    if (elapsedMs <= 0) return false;
    const dt = elapsedMs / 1000;

    this.#resize(bounds.width, bounds.height);
    if (this.#width === 0 || this.#height === 0) return false;

    if (!this.#audio && this.#ownsAudio) this.#audio = acquireExomuxAudio();
    const audio = this.#audio?.frame(now) ?? SILENCE;
    this.#audioLabel = this.#audio?.label() ?? "silent";

    this.#time += dt;
    this.#advancePreset(dt);
    this.#resolvePreset();

    // Frames are 125 ms apart, so per-frame deltas are scaled to keep motion
    // rate-independent when the desktop stalls or the terminal resizes.
    const frames = elapsedMs / FRAME_BASELINE_MS;
    this.#warpPass(audio, frames);
    this.#drawWave(audio, frames);
    this.#drawPointer(bounds, now, frames);
    return true;
  }

  rasterizeCells(
    bounds: Rectangle,
    theme: ExomuxThemeSpec,
  ): ReadonlyArray<ReadonlyArray<ExomuxBackgroundCell | undefined>> {
    const normalized = normalizeBounds(bounds);
    if (!normalized || normalized.width !== this.#width || normalized.height !== this.#height) {
      this.#cells = [];
      return this.#cells;
    }
    const { width, height } = normalized;
    this.#ensureCellBuffer(width, height);

    const ink = this.#ink;
    const accent = theme.accent;
    for (let row = 0; row < height; row += 1) {
      const cells = this.#cells[row]!;
      for (let column = 0; column < width; column += 1) {
        const offset = (row * width + column) * 3;
        const red = ink[offset]!;
        const green = ink[offset + 1]!;
        const blue = ink[offset + 2]!;
        const peak = red > green ? (red > blue ? red : blue) : (green > blue ? green : blue);
        if (!(peak > MIN_INK)) {
          cells[column] = undefined;
          continue;
        }
        // Presets own their palette, the way MilkDrop presets do, but the
        // faintest trailing ink is pulled toward the desktop accent so a
        // dissolving frame settles into the theme instead of onto grey.
        const tint = Math.max(0, MAX_ACCENT_TINT * (1 - peak / ACCENT_TINT_LIMIT));
        const foreground: ExomuxRgb = [
          channel(red, accent[0], tint),
          channel(green, accent[1], tint),
          channel(blue, accent[2], tint),
        ];
        cells[column] = { char: shadeFor(peak), foreground, bold: peak > 0.9 };
      }
    }
    return this.#cells;
  }

  // ── simulation ────────────────────────────────────────────────────────────

  #resize(width: number, height: number): void {
    if (width === this.#width && height === this.#height) return;
    this.#width = width;
    this.#height = height;
    this.#ink = new Float32Array(width * height * 3);
    this.#inkNext = new Float32Array(width * height * 3);
    this.#warpRows = new Float32Array(height);
    this.#warpColumns = new Float32Array(width);
    this.#cells = [];
  }

  #ensureCellBuffer(width: number, height: number): void {
    if (this.#cells.length === height && (this.#cells[0]?.length ?? -1) === width) return;
    this.#cells = Array.from(
      { length: height },
      () => new Array<ExomuxBackgroundCell | undefined>(width).fill(undefined),
    );
  }

  #advancePreset(dt: number): void {
    if (this.#blend < 1) {
      this.#blend = Math.min(1, this.#blend + dt / PRESET_BLEND_SECONDS);
      return;
    }
    if (!this.#autoCycle) return;
    this.#heldSeconds += dt;
    if (this.#heldSeconds >= PRESET_HOLD_SECONDS) this.nextPreset();
  }

  /** Crossfades every numeric knob into `#blended` for this frame. */
  #resolvePreset(): void {
    const to = EXOMUX_BUTTERCHURN_PRESETS[this.#presetIndex]!;
    const from = EXOMUX_BUTTERCHURN_PRESETS[this.#previousIndex]!;
    // Smoothstep, so a cycle eases in and out instead of snapping to a new
    // rotation rate at both ends of the blend.
    const raw = this.#blend;
    const mix = raw * raw * (3 - 2 * raw);
    const blended = this.#blended;
    blended.decay = lerp(from.decay, to.decay, mix);
    blended.tint[0] = lerp(from.tint[0], to.tint[0], mix);
    blended.tint[1] = lerp(from.tint[1], to.tint[1], mix);
    blended.tint[2] = lerp(from.tint[2], to.tint[2], mix);
    blended.zoom = lerp(from.zoom, to.zoom, mix);
    blended.zoomBass = lerp(from.zoomBass, to.zoomBass, mix);
    blended.rotate = lerp(from.rotate, to.rotate, mix);
    blended.rotateTreble = lerp(from.rotateTreble, to.rotateTreble, mix);
    blended.driftX = lerp(from.driftX, to.driftX, mix);
    blended.driftY = lerp(from.driftY, to.driftY, mix);
    blended.warp = lerp(from.warp, to.warp, mix);
    blended.warpMid = lerp(from.warpMid, to.warpMid, mix);
    blended.warpScale = lerp(from.warpScale, to.warpScale, mix);
    blended.warpSpeed = lerp(from.warpSpeed, to.warpSpeed, mix);
    blended.waveSize = lerp(from.waveSize, to.waveSize, mix);
  }

  /**
   * MilkDrop's per-pixel motion pass: every destination cell pulls its color
   * from a warped, rotated, zoomed position in the previous frame. The warp
   * mesh is separable — horizontal displacement depends only on the row and
   * vertical only on the column — which keeps two sine calls per row/column
   * instead of three per cell.
   */
  #warpPass(audio: ExomuxAudioFrame, frames: number): void {
    const width = this.#width;
    const height = this.#height;
    const preset = this.#blended;
    const aspect = width / (height * CELL_ASPECT);
    const time = this.#time;

    const warp = preset.warp + preset.warpMid * audio.mid;
    const scale = preset.warpScale;
    const speed = preset.warpSpeed * time;
    for (let row = 0; row < height; row += 1) {
      const v = (row + 0.5) / height * 2 - 1;
      this.#warpRows[row] = warp * (Math.sin(v * scale + speed) + 0.5 * Math.sin(v * scale * 2.13 - speed * 0.7));
    }
    for (let column = 0; column < width; column += 1) {
      const u = ((column + 0.5) / width * 2 - 1) * aspect;
      this.#warpColumns[column] = warp *
        (Math.sin(u * scale * 0.93 - speed * 1.1) + 0.5 * Math.sin(u * scale * 1.77 + speed * 0.6));
    }

    const zoom = Math.max(0.5, preset.zoom + preset.zoomBass * audio.bass);
    const angle = (preset.rotate + preset.rotateTreble * audio.treble) * frames;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const driftX = preset.driftX * frames;
    const driftY = preset.driftY * frames;
    // Per-frame constants raised to the elapsed frame count keep decay honest
    // across a stalled tick instead of leaving a bright ghost behind.
    const decay = Math.pow(preset.decay, frames);
    const tintRed = Math.pow(preset.tint[0], frames) * decay;
    const tintGreen = Math.pow(preset.tint[1], frames) * decay;
    const tintBlue = Math.pow(preset.tint[2], frames) * decay;

    const source = this.#ink;
    const target = this.#inkNext;
    const toPixelX = 0.5 * width;
    const toPixelY = 0.5 * height;

    for (let row = 0; row < height; row += 1) {
      const v = (row + 0.5) / height * 2 - 1;
      const warpU = this.#warpRows[row]!;
      for (let column = 0; column < width; column += 1) {
        const u = ((column + 0.5) / width * 2 - 1) * aspect;
        const su = u + warpU;
        const sv = v + this.#warpColumns[column]!;
        const ru = su * cos - sv * sin;
        const rv = su * sin + sv * cos;
        const sampleU = ru / zoom + driftX;
        const sampleV = rv / zoom + driftY;

        const x = (sampleU / aspect + 1) * toPixelX - 0.5;
        const y = (sampleV + 1) * toPixelY - 0.5;
        const offset = (row * width + column) * 3;
        sampleBilinear(source, width, height, x, y, SAMPLE);
        target[offset] = SAMPLE[0]! * tintRed;
        target[offset + 1] = SAMPLE[1]! * tintGreen;
        target[offset + 2] = SAMPLE[2]! * tintBlue;
      }
    }

    this.#ink = target;
    this.#inkNext = source;
  }

  /** Lays this frame's audio onto the canvas in the preset's wave mode. */
  #drawWave(audio: ExomuxAudioFrame, frames: number): void {
    const to = EXOMUX_BUTTERCHURN_PRESETS[this.#presetIndex]!;
    const from = EXOMUX_BUTTERCHURN_PRESETS[this.#previousIndex]!;
    const raw = this.#blend;
    const mix = raw * raw * (3 - 2 * raw);
    // Both figures are drawn during a blend, each at its own weight, which is
    // what makes a cycle read as one shape dissolving into another.
    if (mix < 1) this.#drawWaveMode(from, audio, frames * (1 - mix));
    if (mix > 0) this.#drawWaveMode(to, audio, frames * mix);
  }

  #drawWaveMode(preset: ExomuxButterchurnPreset, audio: ExomuxAudioFrame, weight: number): void {
    if (weight <= 0) return;
    const density = WAVE_DENSITY[preset.wave];
    const gain = WAVE_INK * density * weight * (SILENT_INK + (1 - SILENT_INK) * audio.level);
    const beat = audio.beat ? BEAT_INK * density * weight : 0;
    const red = preset.waveColor[0] * gain + preset.beatColor[0] * beat;
    const green = preset.waveColor[1] * gain + preset.beatColor[1] * beat;
    const blue = preset.waveColor[2] * gain + preset.beatColor[2] * beat;
    const size = this.#blended.waveSize;
    const wave = audio.waveform;
    const bands = audio.bands;

    switch (preset.wave) {
      case "line":
        this.#plotLine(wave, 0, size, red, green, blue);
        break;
      case "dual":
        this.#plotLine(wave, -0.35, size * 0.6, red, green, blue);
        this.#plotLine(wave, 0.35, -size * 0.6, red, green, blue);
        break;
      case "circle":
        this.#plotRing(wave, size, 1, red, green, blue);
        break;
      case "figure":
        // A Lissajous knot: the waveform modulates radius on one harmonic and
        // angle on another, which is MilkDrop's "custom shape" look.
        this.#plotRing(wave, size, 3, red, green, blue);
        break;
      case "radial":
        this.#plotRadial(bands, size, red, green, blue);
        break;
      case "spectrum":
        this.#plotSpectrum(bands, size, red, green, blue);
        break;
    }
  }

  /** Horizontal waveform trace at `centre` (normalized), scaled by `amplitude`. */
  #plotLine(wave: Float32Array, centre: number, amplitude: number, red: number, green: number, blue: number): void {
    const width = this.#width;
    const height = this.#height;
    for (let column = 0; column < width; column += 1) {
      const sample = wave[Math.min(wave.length - 1, Math.floor(column / width * wave.length))]!;
      const v = centre + sample * amplitude;
      this.#splat(column, (v + 1) * 0.5 * height - 0.5, red, green, blue);
    }
  }

  /** Closed figure around the centre; `harmonic` folds the waveform into it. */
  #plotRing(
    wave: Float32Array,
    size: number,
    harmonic: number,
    red: number,
    green: number,
    blue: number,
  ): void {
    const width = this.#width;
    const height = this.#height;
    const aspect = width / (height * CELL_ASPECT);
    for (let i = 0; i < WAVE_SAMPLES; i += 1) {
      const t = i / WAVE_SAMPLES;
      const sample = wave[Math.min(wave.length - 1, Math.floor(t * wave.length))]!;
      const angle = t * Math.PI * 2 * harmonic;
      const radius = size * (1 + sample * 0.85);
      const u = Math.cos(angle) * radius;
      const v = Math.sin(angle) * radius;
      this.#splat((u / aspect + 1) * 0.5 * width - 0.5, (v + 1) * 0.5 * height - 0.5, red, green, blue);
    }
  }

  /**
   * Spikes radiating from the centre, one per spectrum band, mirrored so the
   * figure is symmetric. Ink is concentrated at each spike's tip: a spoke drawn
   * at even weight fills a solid disc that the feedback pass then smears into a
   * flat wash, which is the one failure mode a feedback visualizer cannot
   * recover from.
   */
  #plotRadial(bands: Float32Array, size: number, red: number, green: number, blue: number): void {
    const width = this.#width;
    const height = this.#height;
    const aspect = width / (height * CELL_ASPECT);
    const spokes = bands.length * 2;
    for (let spoke = 0; spoke < spokes; spoke += 1) {
      const band = spoke < bands.length ? spoke : spokes - 1 - spoke;
      const energy = bands[Math.max(0, band)]!;
      const angle = spoke / spokes * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const reach = size * (1 + energy * 2.2);
      const steps = Math.max(2, Math.round(reach * height));
      for (let step = 0; step <= steps; step += 1) {
        const along = step / steps;
        const weight = energy * (STEM_INK + (1 - STEM_INK) * Math.pow(along, 6));
        const radius = reach * along;
        this.#splat(
          (radius * cos / aspect + 1) * 0.5 * width - 0.5,
          (radius * sin + 1) * 0.5 * height - 0.5,
          red * weight,
          green * weight,
          blue * weight,
        );
      }
    }
  }

  /** Spectrum bars rising from the bottom edge, brightest at the bar tip. */
  #plotSpectrum(bands: Float32Array, size: number, red: number, green: number, blue: number): void {
    const width = this.#width;
    const height = this.#height;
    for (let column = 0; column < width; column += 1) {
      const energy = bands[Math.min(bands.length - 1, Math.floor(column / width * bands.length))]!;
      const bar = Math.round(energy * size * height);
      for (let step = 0; step <= bar; step += 1) {
        const weight = bar === 0 ? 1 : STEM_INK + (1 - STEM_INK) * Math.pow(step / bar, 6);
        this.#splat(column, height - 1 - step, red * weight, green * weight, blue * weight);
      }
    }
  }

  #drawPointer(bounds: Rectangle, now: number, frames: number): void {
    const pointer = this.#pointer;
    if (!pointer || now - pointer.updatedAt > POINTER_LIFETIME_MS) return;
    const fade = 1 - (now - pointer.updatedAt) / POINTER_LIFETIME_MS;
    const ink = POINTER_INK * fade * frames;
    // The router reports the pointer in desktop coordinates; the ink buffer is
    // indexed from the bounds origin.
    this.#splat(pointer.column - bounds.column, pointer.row - bounds.row, ink, ink, ink);
  }

  /** Bilinear ink deposit, so wave figures move smoothly between cells. */
  #splat(x: number, y: number, red: number, green: number, blue: number): void {
    const width = this.#width;
    const height = this.#height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const ink = this.#ink;
    for (let dy = 0; dy < 2; dy += 1) {
      const row = y0 + dy;
      if (row < 0 || row >= height) continue;
      const wy = dy === 0 ? 1 - fy : fy;
      if (wy <= 0) continue;
      for (let dx = 0; dx < 2; dx += 1) {
        const column = x0 + dx;
        if (column < 0 || column >= width) continue;
        const weight = wy * (dx === 0 ? 1 - fx : fx);
        if (weight <= 0) continue;
        const offset = (row * width + column) * 3;
        ink[offset] = Math.min(MAX_INK, ink[offset]! + red * weight);
        ink[offset + 1] = Math.min(MAX_INK, ink[offset + 1]! + green * weight);
        ink[offset + 2] = Math.min(MAX_INK, ink[offset + 2]! + blue * weight);
      }
    }
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Scratch RGB triple for `sampleBilinear`; the warp pass runs per cell. */
const SAMPLE = new Float32Array(3);

const SILENT_BANDS = new Float32Array(24);
const SILENT_WAVE = new Float32Array(256);
const SILENCE: ExomuxAudioFrame = Object.freeze({
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  bands: SILENT_BANDS,
  waveform: SILENT_WAVE,
  beat: false,
  source: "starting",
});

/** Clamp-to-edge bilinear read of a three-channel field, written into `out`. */
function sampleBilinear(
  field: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  out: Float32Array,
): void {
  const clampedX = x < 0 ? 0 : x > width - 1 ? width - 1 : x;
  const clampedY = y < 0 ? 0 : y > height - 1 ? height - 1 : y;
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = x0 + 1 < width ? x0 + 1 : x0;
  const y1 = y0 + 1 < height ? y0 + 1 : y0;
  const fx = clampedX - x0;
  const fy = clampedY - y0;
  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;
  const o00 = (y0 * width + x0) * 3;
  const o10 = (y0 * width + x1) * 3;
  const o01 = (y1 * width + x0) * 3;
  const o11 = (y1 * width + x1) * 3;
  for (let channel = 0; channel < 3; channel += 1) {
    out[channel] = field[o00 + channel]! * w00 + field[o10 + channel]! * w10 +
      field[o01 + channel]! * w01 + field[o11 + channel]! * w11;
  }
}

/** Block glyph for an ink level; brighter ink fills more of the cell. */
function shadeFor(peak: number): string {
  for (let index = 0; index < SHADE_STOPS.length; index += 1) {
    if (peak < SHADE_STOPS[index]!) return SHADES[index]!;
  }
  return SHADES[SHADES.length - 1]!;
}

/**
 * One output channel, gamma-lifted so faded feedback trails keep their hue,
 * blended `tint` of the way toward the theme's accent channel, then snapped to
 * the quantization grid.
 */
function channel(value: number, accent: number, tint: number): number {
  const lifted = Math.pow(Math.min(1, Math.max(0, value)), INK_GAMMA) * 255;
  const blended = lifted + (accent - lifted) * tint;
  return Math.min(255, Math.round(blended / COLOR_STEP) * COLOR_STEP);
}

function lerp(from: number, to: number, mix: number): number {
  return from + (to - from) * mix;
}

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function normalizeBounds(bounds: Rectangle | undefined): Rectangle | undefined {
  if (!bounds) return undefined;
  const width = Math.max(0, Math.floor(bounds.width));
  const height = Math.max(0, Math.floor(bounds.height));
  if (width <= 0 || height <= 0) return undefined;
  return { column: Math.floor(bounds.column), row: Math.floor(bounds.row), width, height };
}
