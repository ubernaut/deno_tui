// Copyright 2023 Im-Beast. MIT license.

// Microphone-reactive MilkDrop desktop background.
//
// This is the ASCII port of butterchurnxr's `asciichurn`: the real MilkDrop
// preset catalog, resolved at terminal cell resolution and painted as shaded
// blocks. `asciichurn` proxies its pixels out to Butterchurn's WebGL2 renderer
// in headless Chromium; Exomux ships as a single compiled binary and runs over
// a tailnet, so the pipeline is reimplemented on the CPU instead.
//
// Each frame:
//
//   1. `ExomuxButterchurnPreset` evaluates the preset's own EEL equations and
//      produces MilkDrop's warp mesh — the source coordinate every mesh vertex
//      samples from — plus the waveform figure for this frame;
//   2. the previous frame is resampled through that mesh and attenuated by the
//      preset's decay, which is the feedback that makes MilkDrop look like
//      MilkDrop rather than like an equalizer;
//   3. the waveform is drawn over it in the preset's colour;
//   4. the accumulated field is quantized to the `░▒▓█` ramp.
//
// What the terminal cannot carry over is each preset's HLSL warp and composite
// shaders, its custom waves and shapes, and the blur chain. Those need a GPU
// and a shader translator. The motion of a preset is therefore faithful; its
// colour grading and fine texture are approximated.

import type { Rectangle } from "@ubernaut/deno-tui";
import type {
  ExomuxAnimatedBackground,
  ExomuxBackgroundAdvanceOptions,
  ExomuxBackgroundCell,
  ExomuxBackgroundPoint,
} from "./background.ts";
import { acquireExomuxAudio, type ExomuxAudioFrame, type ExomuxAudioSource } from "./audio.ts";
import { EXOMUX_BUTTERCHURN_CATALOG, type ExomuxButterchurnPresetSource } from "./butterchurn_catalog.ts";
import { EXOMUX_BUTTERCHURN_ROTATION } from "./butterchurn_rotation.ts";
import { type ExomuxButterchurnAudio, ExomuxButterchurnPreset } from "./butterchurn_preset.ts";
import { ExomuxButterchurnGpu, requestExomuxGpuDevice } from "./butterchurn_gpu.ts";
import type { ExomuxRgb, ExomuxThemeSpec } from "./model.ts";

// ── constants ───────────────────────────────────────────────────────────────

const FRAME_BASELINE_MS = 125;
const MAX_FRAME_DELTA_MS = 400;
const POINTER_LIFETIME_MS = 1_500;

/** Seconds one preset holds before the field cycles to the next. */
const PRESET_HOLD_SECONDS = 15;
/** Seconds spent crossfading between two presets, matching asciichurn. */
const PRESET_BLEND_SECONDS = 2.7;

/**
 * Frames per second the catalog's decay values were authored against.
 *
 * MilkDrop runs at 30-60 fps; the desktop advances at 8. A decay applied once
 * per 125 ms instead of once per 33 ms leaves a bright ghost that never fades,
 * so every preset's per-frame decay is raised to the frame-count ratio.
 */
const AUTHORED_FPS = 30;

/** Warp mesh resolution. Vertices are one more than this in each axis. */
const MESH_WIDTH = 24;
const MESH_HEIGHT = 18;

/** Ceiling on accumulated ink, so a loud passage cannot saturate flat. */
const MAX_INK = 1.6;
/** Cells dimmer than this show the desktop theme instead of a block. */
const MIN_INK = 0.1;
/** Shade ramp, dimmest first; the block carries what the colour cannot. */
const SHADES: readonly string[] = ["░", "▒", "▓", "█"];
/** Upper ink bound of each shade in `SHADES`; the last entry is open-ended. */
const SHADE_STOPS: readonly number[] = [0.2, 0.42, 0.75];
/** Output gamma. Below 1 it lifts midtones so dim feedback trails stay visible. */
const INK_GAMMA = 1 / 1.35;
/**
 * Output colours are snapped to this per-channel grid, bounding the palette at
 * 17³ = 4913 colours.
 *
 * The desktop painter caches one ANSI style per (foreground, background, bold)
 * triple and clears the whole cache at 8192 entries. Unquantized, this field
 * mints hundreds of new colours every frame — it would flush that cache every
 * couple of seconds and then miss on nearly every cell, which is precisely the
 * repaint saturation the painter's cache exists to prevent.
 */
const COLOR_STEP = 16;
/** Strongest pull of the theme accent, applied to the faintest ink only. */
const MAX_ACCENT_TINT = 0.45;
/** Ink level at which the accent pull has faded to nothing. */
const ACCENT_TINT_LIMIT = 0.35;

/** Ink one waveform figure deposits per frame, spread over its vertices. */
const WAVE_INK = 300;
/**
 * Floor under a preset's `wave_a`, and the only deliberate deviation from the
 * catalog's own numbers.
 *
 * Two thirds of the catalog sets `wave_a` near zero — the median is 0.001 —
 * because those presets draw with custom waves, custom shapes and their
 * composite shader, and the basic waveform is only a seed. None of that runs
 * here, so honouring `wave_a` literally leaves 202 of 293 presets rendering an
 * empty screen. The warp mesh is the faithful, strongly preset-specific part of
 * this port; it needs ink to act on, and this is where the ink comes from.
 */
const MIN_WAVE_ALPHA = 0.5;
/**
 * Ceiling on a preset's decay.
 *
 * MilkDrop presets may set `decay` to 1 and rely on their composite shader,
 * `darken`, or the blur chain to pull brightness back down. With none of those
 * present a lossless feedback loop only ever accumulates, so the field is
 * forced to forget a little each frame.
 */
const MAX_DECAY = 0.99;
/**
 * Frames without a resolved GPU frame before the field gives up on the device.
 *
 * Readback is asynchronous and skips a frame whenever the previous map is still
 * in flight, so a couple of still frames is normal. Several seconds of them is
 * not, and the alternative to noticing is a background frozen on whatever it
 * last managed to draw.
 */
const GPU_STALL_FRAMES = 12;
/**
 * Frames a preset may render almost nothing before the field moves on.
 *
 * The rotation is selected against the GPU renderer, so on the software
 * fallback a good number of its presets resolve to nothing at all — and a
 * preset that draws nothing for its fifteen-second slot is indistinguishable
 * from a frozen desktop. Skipping ahead keeps something on screen whichever
 * renderer is running, and costs nothing when the preset is fine.
 */
const DEAD_PRESET_FRAMES = 16;
/** Share of the desktop a preset must reach to count as rendering at all. */
const DEAD_PRESET_COVERAGE = 0.01;
/**
 * Mean ink the software path steers the field toward.
 *
 * MilkDrop keeps a feedback loop bounded through its composite shader, its
 * `darken` flag and the blur chain. The software path runs none of those, and
 * ten catalog presets consequently accumulate without limit until the desktop
 * is a flat white field — unreadable, and unrecoverable because the loop is
 * self-feeding. This governor pulls decay down for exactly those frames where
 * the field has run too bright, and leaves well-behaved presets untouched.
 */
const TARGET_MEAN_INK = 0.45;
/**
 * Share of full ink the wave still deposits at zero level.
 *
 * MilkDrop draws its waveform at full brightness on silence, as a flat trace.
 * A desktop background should not: a quiet room is the common case, and a
 * static figure smeared across the screen is worse than nothing.
 */
const SILENT_INK = 0.12;
/** Extra ink deposited on the frame a beat is detected. */
const BEAT_INK = 0.45;
/** Ink deposited under the pointer. */
const POINTER_INK = 0.9;

/**
 * Smoothing for the running band averages that normalize audio.
 *
 * MilkDrop's `bass`/`mid`/`treb` are relative: roughly 1.0 at a track's typical
 * level, above on a hit. Presets are written against that — `zoom = 1.01 +
 * 0.02*treb_att` barely moves if fed a raw 0..1 energy. Dividing by a slow
 * running average reproduces the scale the catalog expects.
 */
const LEVEL_AVERAGE_RATE = 0.02;
/** Attack-follower rate for the `*_att` variables. */
const ATTACK_RATE = 0.25;
/** Floor on a running average, so silence cannot divide by ~0. */
const MIN_AVERAGE = 0.02;

// ── field ───────────────────────────────────────────────────────────────────

/**
 * The presets this background cycles through: the vendored MilkDrop catalog
 * narrowed to the ones that resolve to a moving image at cell resolution.
 *
 * See `scripts/audit_butterchurn_catalog.ts` for how the rotation is chosen and
 * why the rest are excluded. The full catalog remains available as
 * `EXOMUX_BUTTERCHURN_CATALOG`.
 */
export const EXOMUX_BUTTERCHURN_PRESETS: readonly ExomuxButterchurnPresetSource[] = Object.freeze(
  ((): ExomuxButterchurnPresetSource[] => {
    const wanted = new Set(EXOMUX_BUTTERCHURN_ROTATION);
    const rotation = EXOMUX_BUTTERCHURN_CATALOG.filter((preset) => wanted.has(preset.name));
    // A rotation that failed to match anything would leave the desktop with no
    // background at all, so fall back to the whole catalog.
    return rotation.length > 0 ? rotation : [...EXOMUX_BUTTERCHURN_CATALOG];
  })(),
);

export interface ExomuxButterchurnFieldOptions {
  /**
   * Audio to visualize. Omit to share the process-wide microphone capture,
   * which is opened on the first advance and released by `dispose`.
   */
  readonly audio?: ExomuxAudioSource;
  /** Preset the field opens on, as an index into the catalog. */
  readonly presetIndex?: number;
  /** Cycle presets on a timer; off leaves the opening preset in place. */
  readonly autoCycle?: boolean;
  /** Catalog override, for tests. */
  readonly catalog?: readonly ExomuxButterchurnPresetSource[];
  /** Seed for the deterministic `rand` presets see. */
  readonly seed?: number;
  /**
   * Run preset shaders on the GPU when one is available. Off forces the CPU
   * renderer, which is what tests use so frames stay reproducible.
   */
  readonly gpu?: boolean;
}

interface ButterchurnPointer {
  readonly column: number;
  readonly row: number;
  readonly updatedAt: number;
}

/**
 * Audio-reactive MilkDrop background. Simulation state is a pair of RGB
 * accumulation buffers at cell resolution plus the active preset's variable
 * pool, so the field is deterministic for a given audio source and timeline.
 */
export class ExomuxButterchurnField implements ExomuxAnimatedBackground {
  #width = 0;
  #height = 0;
  /** Accumulated RGB ink, three floats per cell. */
  #ink = new Float32Array(0);
  /** Warp destination, swapped with `#ink` each frame. */
  #inkNext = new Float32Array(0);

  #audio: ExomuxAudioSource | undefined;
  readonly #ownsAudio: boolean;
  #audioLabel = "starting";

  readonly #catalog: readonly ExomuxButterchurnPresetSource[];
  readonly #seed: number;
  #presetIndex: number;
  #preset: ExomuxButterchurnPreset;
  /** Outgoing preset during a crossfade; both are evaluated and drawn. */
  #previous: ExomuxButterchurnPreset | undefined;
  #blend = 1;
  readonly #autoCycle: boolean;
  #heldSeconds = 0;

  // GPU path. Presets keep rendering on the CPU until a device and the
  // preset's own shaders are both ready, so a missing adapter or a shader that
  // will not compile degrades to the software renderer rather than to nothing.
  readonly #wantsGpu: boolean;
  #gpu: ExomuxButterchurnGpu | undefined;
  #gpuState: "idle" | "starting" | "ready" | "unavailable" = "idle";
  #gpuPresets = new Map<string, boolean>();
  /** Readback count last seen, and how many frames it has sat still. */
  #gpuReadbacks = -1;
  #gpuStall = 0;
  /** Consecutive frames the active preset has rendered essentially nothing. */
  #deadFrames = 0;
  readonly #q = new Float32Array(32);

  #time = 0;
  #frame = 0;
  #lastFrameAt: number | undefined;
  #pointer: ButterchurnPointer | undefined;
  #cells: (ExomuxBackgroundCell | undefined)[][] = [];

  /** Mean ink of the previous frame, feeding the brightness governor. */
  #meanInk = 0;

  // Running averages that turn raw band energy into MilkDrop's relative scale.
  #bassAverage = 0.2;
  #midAverage = 0.2;
  #trebleAverage = 0.2;
  #bassAttack = 1;
  #midAttack = 1;
  #trebleAttack = 1;
  readonly #audioInput: {
    bass: number;
    mid: number;
    treb: number;
    bassAttack: number;
    midAttack: number;
    trebleAttack: number;
    waveform: Float32Array;
  } = {
    bass: 1,
    mid: 1,
    treb: 1,
    bassAttack: 1,
    midAttack: 1,
    trebleAttack: 1,
    waveform: new Float32Array(0),
  };

  constructor(options: ExomuxButterchurnFieldOptions = {}) {
    this.#audio = options.audio;
    this.#ownsAudio = options.audio === undefined;
    this.#catalog = options.catalog ?? EXOMUX_BUTTERCHURN_PRESETS;
    if (this.#catalog.length === 0) throw new RangeError("The butterchurn catalog is empty.");
    this.#seed = Math.trunc(options.seed ?? 1);
    const requested = Math.trunc(options.presetIndex ?? 0);
    this.#presetIndex = Number.isFinite(requested)
      ? ((requested % this.#catalog.length) + this.#catalog.length) % this.#catalog.length
      : 0;
    this.#autoCycle = options.autoCycle ?? true;
    this.#wantsGpu = options.gpu ?? true;
    this.#preset = this.#load(this.#presetIndex);
  }

  /** Preset currently in front; during a blend this is the incoming one. */
  get preset(): ExomuxButterchurnPreset {
    return this.#preset;
  }

  get presetIndex(): number {
    return this.#presetIndex;
  }

  get presetName(): string {
    return this.#preset.name;
  }

  /** Number of presets in the catalog this field is cycling. */
  get presetCount(): number {
    return this.#catalog.length;
  }

  /** Status label for the audio source, e.g. `mic:parec`, `synth`. */
  get audioLabel(): string {
    return this.#audioLabel;
  }

  /** Advances to the next preset, starting a crossfade. */
  nextPreset(): void {
    this.selectPreset(this.#presetIndex + 1);
  }

  /** Selects a preset by catalog index, wrapping, and starts a crossfade. */
  selectPreset(index: number): void {
    const count = this.#catalog.length;
    const next = ((Math.trunc(index) % count) + count) % count;
    this.#previous = this.#preset;
    this.#presetIndex = next;
    this.#preset = this.#load(next);
    if (this.#width > 0) this.#preset.setSize(this.#width, this.#height);
    this.#blend = 0;
    this.#heldSeconds = 0;
    this.#deadFrames = 0;
  }

  setPointer(point: ExomuxBackgroundPoint, now = performance.now()): void {
    if (!Number.isFinite(point.column) || !Number.isFinite(point.row)) return;
    this.#pointer = { column: point.column, row: point.row, updatedAt: finite(now, performance.now()) };
  }

  clearPointer(): void {
    this.#pointer = undefined;
  }

  /** True when the active preset is being rendered by its own shaders. */
  get gpuActive(): boolean {
    return this.#gpuState === "ready" && this.#gpuPresets.get(this.#preset.name) === true;
  }

  /** Releases the shared microphone capture and any GPU resources. */
  dispose(): void {
    if (this.#ownsAudio) this.#audio?.close();
    this.#audio = undefined;
    this.#gpu?.destroy();
    this.#gpu = undefined;
    this.#gpuState = "unavailable";
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
    this.#frame += 1;
    this.#advancePreset(dt);

    const input = this.#prepareAudio(audio, dt);
    const fps = 1000 / FRAME_BASELINE_MS;
    this.#preset.advance(input, this.#time, this.#frame, fps);
    this.#previous?.advance(input, this.#time, this.#frame, fps);

    // Frames are 125 ms apart; scaling by the real delta keeps motion
    // rate-independent when the desktop stalls or the terminal resizes.
    const frames = elapsedMs / FRAME_BASELINE_MS;
    if (!this.#renderOnGpu(input, audio)) {
      this.#warpPass(frames);
      this.#drawWaves(audio, frames);
      this.#drawPointer(bounds, now, frames);
    }
    this.#skipDeadPreset();
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

  #load(index: number): ExomuxButterchurnPreset {
    const source = this.#catalog[index]!;
    // Seeded per preset so `rand` is reproducible for a given field and index,
    // which is what keeps the whole field deterministic under test.
    let state = (this.#seed * 2_654_435_761 + index * 40_503) >>> 0;
    const random = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 4_294_967_296;
    };
    return new ExomuxButterchurnPreset(source, {
      meshWidth: MESH_WIDTH,
      meshHeight: MESH_HEIGHT,
      random,
    });
  }

  #resize(width: number, height: number): void {
    if (width === this.#width && height === this.#height) return;
    this.#width = width;
    this.#height = height;
    this.#ink = new Float32Array(width * height * 3);
    this.#inkNext = new Float32Array(width * height * 3);
    this.#cells = [];
    this.#preset.setSize(width, height);
    this.#previous?.setSize(width, height);
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
      if (this.#blend >= 1) this.#previous = undefined;
      return;
    }
    if (!this.#autoCycle) return;
    this.#heldSeconds += dt;
    if (this.#heldSeconds >= PRESET_HOLD_SECONDS) this.nextPreset();
  }

  /** Converts one analyser frame into the relative scale presets expect. */
  #prepareAudio(audio: ExomuxAudioFrame, dt: number): ExomuxButterchurnAudio {
    const rate = Math.min(1, LEVEL_AVERAGE_RATE * dt * 60);
    this.#bassAverage += (audio.bass - this.#bassAverage) * rate;
    this.#midAverage += (audio.mid - this.#midAverage) * rate;
    this.#trebleAverage += (audio.treble - this.#trebleAverage) * rate;

    const bass = audio.bass / Math.max(MIN_AVERAGE, this.#bassAverage);
    const mid = audio.mid / Math.max(MIN_AVERAGE, this.#midAverage);
    const treble = audio.treble / Math.max(MIN_AVERAGE, this.#trebleAverage);

    const attack = Math.min(1, ATTACK_RATE * dt * 60);
    this.#bassAttack += (bass - this.#bassAttack) * attack;
    this.#midAttack += (mid - this.#midAttack) * attack;
    this.#trebleAttack += (treble - this.#trebleAttack) * attack;

    const input = this.#audioInput;
    input.bass = clampEnergy(bass);
    input.mid = clampEnergy(mid);
    input.treb = clampEnergy(treble);
    input.bassAttack = clampEnergy(this.#bassAttack);
    input.midAttack = clampEnergy(this.#midAttack);
    input.trebleAttack = clampEnergy(this.#trebleAttack);
    input.waveform = audio.waveform;
    return input;
  }

  /**
   * Renders this frame with the preset's own shaders, returning true when it
   * did. The GPU device is requested once, lazily, and a preset whose shaders
   * will not compile is remembered so it is not retried every frame.
   */
  #renderOnGpu(input: ExomuxButterchurnAudio, audio: ExomuxAudioFrame): boolean {
    if (!this.#wantsGpu || this.#gpuState === "unavailable") return false;
    if (this.#gpuState === "idle") {
      this.#gpuState = "starting";
      requestExomuxGpuDevice()
        .then((device) => {
          if (!device || this.#gpuState !== "starting") {
            this.#gpuState = "unavailable";
            return;
          }
          this.#gpu = new ExomuxButterchurnGpu(device, { width: this.#width, height: this.#height });
          this.#gpuState = "ready";
        })
        .catch(() => {
          this.#gpuState = "unavailable";
        });
      return false;
    }
    const gpu = this.#gpu;
    if (this.#gpuState !== "ready" || !gpu) return false;

    const preset = this.#preset;
    const source = this.#catalog[this.#presetIndex]!;
    let usable = this.#gpuPresets.get(preset.name);
    if (usable === undefined) {
      usable = gpu.prepare(preset.name, source.warp, source.comp);
      this.#gpuPresets.set(preset.name, usable);
    }
    if (!usable) return false;

    gpu.setSize(this.#width, this.#height);
    for (let index = 0; index < 32; index += 1) this.#q[index] = preset.variable(`q${index + 1}`);
    const values = preset.values;
    gpu.render(preset.name, {
      mesh: preset.mesh,
      meshWidth: preset.meshWidth,
      meshHeight: preset.meshHeight,
      wave: preset.wave,
      waveCount: preset.waveCount,
      waveColor: [
        clamp(values.waveR, 0, 1),
        clamp(values.waveG, 0, 1),
        clamp(values.waveB, 0, 1),
        Math.max(MIN_WAVE_ALPHA, clamp(values.waveAlpha, 0, 1)) * (SILENT_INK + (1 - SILENT_INK) * audio.level),
      ],
      q: this.#q,
      time: this.#time,
      frame: this.#frame,
      fps: 1000 / FRAME_BASELINE_MS,
      decay: clamp(values.decay, 0, MAX_DECAY),
      bass: input.bass,
      mid: input.mid,
      treb: input.treb,
      bassAttack: input.bassAttack,
      midAttack: input.midAttack,
      trebleAttack: input.trebleAttack,
      aspectX: this.#width / Math.max(1, this.#height * 2),
      aspectY: 1,
    });

    // The readback lands a frame late, so the ink buffer keeps the last
    // resolved image until the next one arrives. A count that stops moving
    // means no frame is ever arriving again — a lost device, a rejected map —
    // and continuing would leave a still image on the desktop indefinitely.
    // Falling back to the software renderer keeps the background alive.
    if (gpu.readbacks === this.#gpuReadbacks) {
      this.#gpuStall += 1;
      if (this.#gpuStall > GPU_STALL_FRAMES || gpu.lost) {
        this.#gpu = undefined;
        this.#gpuState = "unavailable";
        gpu.destroy();
        return false;
      }
    } else {
      this.#gpuReadbacks = gpu.readbacks;
      this.#gpuStall = 0;
    }

    const pixels = gpu.latest;
    if (pixels) this.#absorb(pixels);
    return true;
  }

  /**
   * Moves on from a preset that is drawing nothing.
   *
   * Measured on the ink buffer rather than the rendered cells so it costs one
   * pass over the field and reflects whichever renderer produced it.
   */
  #skipDeadPreset(): void {
    if (!this.#autoCycle) return;
    const ink = this.#ink;
    const cells = this.#width * this.#height;
    if (cells === 0) return;
    let lit = 0;
    for (let index = 0; index < cells; index += 1) {
      const offset = index * 3;
      if (ink[offset]! > MIN_INK || ink[offset + 1]! > MIN_INK || ink[offset + 2]! > MIN_INK) lit += 1;
    }
    if (lit / cells >= DEAD_PRESET_COVERAGE) {
      this.#deadFrames = 0;
      return;
    }
    this.#deadFrames += 1;
    if (this.#deadFrames >= DEAD_PRESET_FRAMES) this.nextPreset();
  }

  /** Copies a resolved GPU frame into the ink buffer the rasterizer reads. */
  #absorb(pixels: Uint8Array): void {
    const ink = this.#ink;
    const count = Math.min(ink.length / 3, pixels.length / 4);
    for (let index = 0; index < count; index += 1) {
      ink[index * 3] = pixels[index * 4]! / 255;
      ink[index * 3 + 1] = pixels[index * 4 + 1]! / 255;
      ink[index * 3 + 2] = pixels[index * 4 + 2]! / 255;
    }
  }

  /**
   * Resamples the previous frame through the active preset's warp mesh.
   *
   * The mesh is coarse — 25x19 vertices against up to 220x55 cells — exactly as
   * in MilkDrop, where the GPU interpolates between them. Here that
   * interpolation is done per cell in the same bilinear form.
   */
  #warpPass(frames: number): void {
    const width = this.#width;
    const height = this.#height;
    const preset = this.#preset;
    const mesh = preset.mesh;
    const gridX = preset.meshWidth;
    const gridY = preset.meshHeight;
    const rowStride = (gridX + 1) * 2;

    // A per-frame decay authored for 30 fps, re-based onto this frame's length.
    // Pulled down when the previous frame came out too bright, which is the
    // only brake the software path has without a composite shader.
    const governor = this.#meanInk > TARGET_MEAN_INK ? TARGET_MEAN_INK / this.#meanInk : 1;
    const decay = Math.pow(
      clamp(preset.values.decay, 0, MAX_DECAY) * governor,
      (AUTHORED_FPS / (1000 / FRAME_BASELINE_MS)) * frames,
    );

    const source = this.#ink;
    const target = this.#inkNext;
    const scaleX = width > 1 ? gridX / (width - 1) : 0;
    const scaleY = height > 1 ? gridY / (height - 1) : 0;
    let total = 0;

    for (let row = 0; row < height; row += 1) {
      const my = row * scaleY;
      const my0 = Math.min(gridY, Math.floor(my));
      const my1 = Math.min(gridY, my0 + 1);
      const fy = my - my0;
      const rowBase0 = my0 * rowStride;
      const rowBase1 = my1 * rowStride;
      for (let column = 0; column < width; column += 1) {
        const mx = column * scaleX;
        const mx0 = Math.min(gridX, Math.floor(mx));
        const mx1 = Math.min(gridX, mx0 + 1);
        const fx = mx - mx0;

        const a = rowBase0 + mx0 * 2;
        const b = rowBase0 + mx1 * 2;
        const c = rowBase1 + mx0 * 2;
        const d = rowBase1 + mx1 * 2;
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        const u = mesh[a]! * w00 + mesh[b]! * w10 + mesh[c]! * w01 + mesh[d]! * w11;
        const v = mesh[a + 1]! * w00 + mesh[b + 1]! * w10 + mesh[c + 1]! * w01 + mesh[d + 1]! * w11;

        const offset = (row * width + column) * 3;
        sampleBilinear(source, width, height, u * width - 0.5, v * height - 0.5, SAMPLE);
        const red = SAMPLE[0]! * decay;
        const green = SAMPLE[1]! * decay;
        const blue = SAMPLE[2]! * decay;
        target[offset] = red;
        target[offset + 1] = green;
        target[offset + 2] = blue;
        total += red > green ? (red > blue ? red : blue) : (green > blue ? green : blue);
      }
    }

    this.#meanInk = total / Math.max(1, width * height);
    this.#ink = target;
    this.#inkNext = source;
  }

  /** Draws the active preset's waveform, and the outgoing one mid-blend. */
  #drawWaves(audio: ExomuxAudioFrame, frames: number): void {
    const raw = this.#blend;
    // Smoothstep, so a cycle eases in and out instead of snapping.
    const mix = raw * raw * (3 - 2 * raw);
    if (this.#previous && mix < 1) this.#drawWave(this.#previous, audio, frames * (1 - mix));
    this.#drawWave(this.#preset, audio, frames * mix);
  }

  #drawWave(preset: ExomuxButterchurnPreset, audio: ExomuxAudioFrame, weight: number): void {
    const count = preset.waveCount;
    if (weight <= 0 || count === 0) return;
    const values = preset.values;
    const width = this.#width;
    const height = this.#height;

    // Ink is a fixed budget spread over however many vertices the mode plots,
    // so a 256-point ring and a 64-point line deposit the same total energy.
    const alpha = Math.max(MIN_WAVE_ALPHA, clamp(values.waveAlpha, 0, 1));
    const level = SILENT_INK + (1 - SILENT_INK) * audio.level;
    const beat = audio.beat ? BEAT_INK : 0;
    const gain = (WAVE_INK / count) * weight * level * (alpha + beat);
    if (gain <= 0) return;

    const red = clamp(values.waveR, 0, 1) * gain;
    const green = clamp(values.waveG, 0, 1) * gain;
    const blue = clamp(values.waveB, 0, 1) * gain;
    const wave = preset.wave;
    for (let index = 0; index < count; index += 1) {
      // Wave vertices are in [-1, 1] with y up; cells run top-down.
      const x = (wave[index * 2]! + 1) * 0.5 * width - 0.5;
      const y = (1 - (wave[index * 2 + 1]! + 1) * 0.5) * height - 0.5;
      this.#splat(x, y, red, green, blue);
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

/** Keeps a normalized band energy inside the range presets were written for. */
function clampEnergy(value: number): number {
  return Number.isFinite(value) ? Math.min(6, Math.max(0, value)) : 0;
}

function clamp(value: number, low: number, high: number): number {
  return Number.isFinite(value) ? (value < low ? low : value > high ? high : value) : low;
}

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
