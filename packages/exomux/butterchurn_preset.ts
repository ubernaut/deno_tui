// Copyright 2023 Im-Beast. MIT license.

// Runtime for one MilkDrop preset: evaluates its equations and produces the
// warp mesh and waveform geometry a frame needs.
//
// This follows Butterchurn's own pipeline (`src/rendering/renderer.js` and
// `src/equations/presetEquationRunner.js` in the ButterchurnXR tree) so preset
// motion matches upstream rather than approximating it:
//
//   * base values are restored before every frame, which is what makes the
//     ubiquitous `wave_r = wave_r + 0.35*sin(time)` idiom oscillate instead of
//     running away;
//   * `q1..q32` reset to their post-init values each frame, while `reg00..reg99`
//     and any variable the preset invents persist, so accumulators work;
//   * per-vertex values reset from the frame values before `pixel_eqs`, and the
//     warp UV is MilkDrop's exact zoom/rotate/stretch/translate composition.
//
// What is deliberately not carried over: the HLSL warp and composite shaders,
// custom waves, custom shapes, motion vectors and the blur chain. Those need a
// GPU and a shader translator. Their absence shows up as missing colour grading
// and texture detail — the motion is the preset's, the palette is approximate.

import { type EelProgram, EelScope, tryCompileEel } from "./eel.ts";
import type { ExomuxButterchurnPresetSource } from "./butterchurn_catalog.ts";

/**
 * MilkDrop's default base values, from Butterchurn's `blankPreset`. Presets
 * store only the values they change, so everything else comes from here.
 */
export const MILKDROP_DEFAULTS: Readonly<Record<string, number>> = Object.freeze({
  gammaadj: 1.25,
  wave_g: 0.5,
  mv_x: 12,
  warpscale: 1,
  brighten: 0,
  mv_y: 9,
  wave_scale: 1,
  echo_alpha: 0,
  additivewave: 0,
  sx: 1,
  sy: 1,
  warp: 0.01,
  red_blue: 0,
  wave_mode: 0,
  wave_brighten: 0,
  wrap: 0,
  zoomexp: 1,
  fshader: 0,
  wave_r: 0.5,
  echo_zoom: 1,
  wave_smoothing: 0.75,
  warpanimspeed: 1,
  wave_dots: 0,
  wave_x: 0.5,
  wave_y: 0.5,
  zoom: 1,
  solarize: 0,
  modwavealphabyvolume: 0,
  dx: 0,
  cx: 0.5,
  dy: 0,
  darken_center: 0,
  cy: 0.5,
  invert: 0,
  bmotionvectorson: 0,
  rot: 0,
  modwavealphaend: 0.95,
  wave_mystery: -0.2,
  decay: 0.9,
  wave_a: 1,
  wave_b: 0.5,
  rating: 5,
  modwavealphastart: 0.75,
  darken: 0,
  echo_orient: 0,
  ib_r: 0.5,
  ib_g: 0.5,
  ib_b: 0.5,
  ib_a: 0,
  ib_size: 0,
  ob_r: 0.5,
  ob_g: 0.5,
  ob_b: 0.5,
  ob_a: 0,
  ob_size: 0,
  mv_dx: 0,
  mv_dy: 0,
  mv_a: 0,
  mv_r: 0.5,
  mv_g: 0.5,
  mv_b: 0.5,
  mv_l: 0,
});

/** Per-vertex values `pixel_eqs` may change, reset from the frame each vertex. */
const VERTEX_VARIABLES: readonly string[] = Object.freeze([
  "zoom",
  "zoomexp",
  "rot",
  "warp",
  "cx",
  "cy",
  "dx",
  "dy",
  "sx",
  "sy",
]);

/** Runtime values the host writes before each frame. */
const RUNTIME_VARIABLES: readonly string[] = Object.freeze([
  "time",
  "frame",
  "fps",
  "bass",
  "mid",
  "treb",
  "bass_att",
  "mid_att",
  "treb_att",
  "vol",
  "meshx",
  "meshy",
  "aspectx",
  "aspecty",
  "pixelsx",
  "pixelsy",
  "x",
  "y",
  "rad",
  "ang",
]);

/** `q1`..`q32`, reset to their post-init values before every frame. */
const Q_VARIABLES: readonly string[] = Object.freeze(
  Array.from({ length: 32 }, (_unused, index) => `q${index + 1}`),
);

/** Audio energies driving one frame; each is roughly 0..1 with peaks above. */
export interface ExomuxButterchurnAudio {
  readonly bass: number;
  readonly mid: number;
  readonly treb: number;
  readonly bassAttack: number;
  readonly midAttack: number;
  readonly trebleAttack: number;
  /** Time-domain samples in -1..1 driving the waveform figure. */
  readonly waveform: Float32Array;
}

export interface ExomuxButterchurnPresetOptions {
  /** Warp mesh resolution; vertices are one more than this in each axis. */
  readonly meshWidth?: number;
  readonly meshHeight?: number;
  /** Deterministic replacement for `rand`. */
  readonly random?: () => number;
}

/** Frame values the renderer reads after `advance`. */
export interface ExomuxButterchurnFrameValues {
  readonly decay: number;
  readonly waveMode: number;
  readonly waveR: number;
  readonly waveG: number;
  readonly waveB: number;
  readonly waveAlpha: number;
  readonly waveScale: number;
  readonly waveMystery: number;
  readonly waveX: number;
  readonly waveY: number;
  readonly waveDots: boolean;
  readonly additiveWave: boolean;
  readonly darkenCenter: boolean;
  readonly invert: boolean;
  readonly solarize: boolean;
  readonly brighten: boolean;
  readonly darken: boolean;
  readonly gammaAdjust: number;
  readonly echoAlpha: number;
}

const DEFAULT_MESH_WIDTH = 24;
const DEFAULT_MESH_HEIGHT = 18;
/** Samples plotted along a waveform figure. */
export const BUTTERCHURN_WAVE_SAMPLES = 256;

/**
 * One preset, compiled and ready to evaluate.
 *
 * Construction compiles the equations and runs `init_eqs`, which is the only
 * expensive step; `advance` is then a frame-equation run plus one pixel-equation
 * run per mesh vertex.
 */
export class ExomuxButterchurnPreset {
  readonly name: string;
  readonly meshWidth: number;
  readonly meshHeight: number;

  readonly #scope: EelScope;
  readonly #frameProgram: EelProgram | undefined;
  readonly #pixelProgram: EelProgram | undefined;
  /** Slot/value pairs restored before each frame: base values, then q inits. */
  readonly #frameResets: { slot: number; value: number }[] = [];
  /** Slots of the per-vertex variables, paired with their frame-level values. */
  readonly #vertexSlots: number[] = [];
  readonly #vertexValues: Float64Array;
  readonly #slots = new Map<string, number>();

  /** Warped source coordinates per mesh vertex, as (u, v) in texture space. */
  readonly mesh: Float32Array;
  /** Waveform figure vertices as (x, y) pairs in [-1, 1], y up. */
  readonly wave = new Float32Array(BUTTERCHURN_WAVE_SAMPLES * 2);
  #waveCount = 0;

  #aspectX = 1;
  #aspectY = 1;
  #values: ExomuxButterchurnFrameValues = ZERO_VALUES;

  constructor(source: ExomuxButterchurnPresetSource, options: ExomuxButterchurnPresetOptions = {}) {
    this.name = source.name;
    this.meshWidth = Math.max(2, Math.floor(options.meshWidth ?? DEFAULT_MESH_WIDTH));
    this.meshHeight = Math.max(2, Math.floor(options.meshHeight ?? DEFAULT_MESH_HEIGHT));
    this.mesh = new Float32Array((this.meshWidth + 1) * (this.meshHeight + 1) * 2);

    const scope = new EelScope(options.random ?? Math.random);
    this.#scope = scope;

    // Allocate every slot the host touches up front. Slot allocation can grow
    // the backing array, and compiled programs must not race that.
    const baseValues: Record<string, number> = { ...MILKDROP_DEFAULTS, ...source.baseVals };
    for (const name of RUNTIME_VARIABLES) scope.slot(name);
    for (const name of Q_VARIABLES) scope.slot(name);
    for (const name of Object.keys(baseValues)) scope.slot(name);
    for (const name of VERTEX_VARIABLES) scope.slot(name);

    // Compiled before init runs so a preset whose frame equations mention a new
    // variable has its slot allocated before any evaluation.
    const init = tryCompileEel(source.init, scope);
    this.#frameProgram = tryCompileEel(source.frame, scope);
    this.#pixelProgram = tryCompileEel(source.pixel, scope);

    for (const [name, value] of Object.entries(baseValues)) scope.set(name, value);
    scope.set("meshx", this.meshWidth);
    scope.set("meshy", this.meshHeight);
    init?.run();

    // Base values are restored every frame; `q` variables are restored to what
    // init left them at. Everything else the preset writes persists.
    for (const [name, value] of Object.entries(baseValues)) {
      this.#frameResets.push({ slot: scope.slot(name), value });
    }
    for (const name of Q_VARIABLES) {
      this.#frameResets.push({ slot: scope.slot(name), value: scope.get(name) });
    }
    for (const name of VERTEX_VARIABLES) this.#vertexSlots.push(scope.slot(name));
    this.#vertexValues = new Float64Array(VERTEX_VARIABLES.length);
    for (const name of [...RUNTIME_VARIABLES, ...Q_VARIABLES, ...Object.keys(baseValues)]) {
      this.#slots.set(name, scope.slot(name));
    }
  }

  /** True when the preset's frame equations compiled; false means it is static. */
  get animated(): boolean {
    return this.#frameProgram !== undefined;
  }

  get values(): ExomuxButterchurnFrameValues {
    return this.#values;
  }

  /** Number of valid (x, y) pairs in `wave`. */
  get waveCount(): number {
    return this.#waveCount;
  }

  /** Reads any variable by name, for tests and diagnostics. */
  variable(name: string): number {
    return this.#scope.get(name);
  }

  /**
   * Sets the render aspect. `width` and `height` are in cells; terminal cells
   * are about twice as tall as they are wide, which is folded in here so a
   * preset's circles come out round.
   */
  setSize(width: number, height: number): void {
    const pixelsX = Math.max(1, width);
    const pixelsY = Math.max(1, height * 2);
    if (pixelsX > pixelsY) {
      this.#aspectX = pixelsY / pixelsX;
      this.#aspectY = 1;
    } else {
      this.#aspectX = 1;
      this.#aspectY = pixelsX / pixelsY;
    }
    this.#scope.set("pixelsx", pixelsX);
    this.#scope.set("pixelsy", pixelsY);
    this.#scope.set("aspectx", 1 / this.#aspectX);
    this.#scope.set("aspecty", 1 / this.#aspectY);
  }

  /** Evaluates one frame: frame equations, then the warp mesh and waveform. */
  advance(audio: ExomuxButterchurnAudio, time: number, frame: number, fps: number): void {
    const scope = this.#scope;
    const memory = scope.memory;
    for (const reset of this.#frameResets) memory[reset.slot] = reset.value;

    this.#set("time", time);
    this.#set("frame", frame);
    this.#set("fps", fps);
    this.#set("bass", audio.bass);
    this.#set("mid", audio.mid);
    this.#set("treb", audio.treb);
    this.#set("bass_att", audio.bassAttack);
    this.#set("mid_att", audio.midAttack);
    this.#set("treb_att", audio.trebleAttack);
    this.#set("vol", (audio.bass + audio.mid + audio.treb) / 3);

    this.#frameProgram?.run();
    this.#readValues();
    this.#buildMesh(time);
    this.#buildWave(audio, time);
  }

  #set(name: string, value: number): void {
    const slot = this.#slots.get(name);
    if (slot === undefined) return;
    this.#scope.memory[slot] = Number.isFinite(value) ? value : 0;
  }

  #get(name: string): number {
    const slot = this.#slots.get(name);
    return slot === undefined ? 0 : this.#scope.memory[slot]!;
  }

  #readValues(): void {
    this.#values = {
      decay: this.#get("decay"),
      waveMode: ((Math.floor(this.#get("wave_mode")) % 8) + 8) % 8,
      waveR: this.#get("wave_r"),
      waveG: this.#get("wave_g"),
      waveB: this.#get("wave_b"),
      waveAlpha: this.#get("wave_a"),
      waveScale: this.#get("wave_scale"),
      waveMystery: this.#get("wave_mystery"),
      waveX: this.#get("wave_x"),
      waveY: this.#get("wave_y"),
      waveDots: this.#get("wave_dots") > 0,
      additiveWave: this.#get("additivewave") > 0,
      darkenCenter: this.#get("darken_center") > 0,
      invert: this.#get("invert") > 0,
      solarize: this.#get("solarize") > 0,
      brighten: this.#get("brighten") > 0,
      darken: this.#get("darken") > 0,
      gammaAdjust: this.#get("gammaadj"),
      echoAlpha: this.#get("echo_alpha"),
    };
  }

  /**
   * Fills `mesh` with the source coordinate each vertex samples from.
   *
   * This is MilkDrop's warp composition in order: radial zoom, stretch about
   * the centre, the four-term sine warp, rotation, then translation. Ported
   * from Butterchurn's `Renderer.runPixelEquations`.
   */
  #buildMesh(time: number): void {
    const scope = this.#scope;
    const memory = scope.memory;
    const gridX = this.meshWidth;
    const gridY = this.meshHeight;
    const aspectX = this.#aspectX;
    const aspectY = this.#aspectY;

    const warpTime = time * this.#get("warpanimspeed");
    const warpScale = this.#get("warpscale");
    const warpScaleInv = warpScale === 0 ? 1 : 1 / warpScale;
    const warpF0 = 11.68 + 4 * Math.cos(warpTime * 1.413 + 10);
    const warpF1 = 8.77 + 3 * Math.cos(warpTime * 1.113 + 7);
    const warpF2 = 10.54 + 3 * Math.cos(warpTime * 1.233 + 3);
    const warpF3 = 11.49 + 4 * Math.cos(warpTime * 0.933 + 5);

    // Frame-level values every vertex resets to before `pixel_eqs` runs.
    const slots = this.#vertexSlots;
    const values = this.#vertexValues;
    for (let index = 0; index < slots.length; index += 1) values[index] = memory[slots[index]!]!;

    const pixel = this.#pixelProgram;
    const xSlot = this.#slots.get("x")!;
    const ySlot = this.#slots.get("y")!;
    const radSlot = this.#slots.get("rad")!;
    const angSlot = this.#slots.get("ang")!;

    let offset = 0;
    for (let iy = 0; iy <= gridY; iy += 1) {
      // Butterchurn walks the mesh bottom-up in normalized coordinates. Flipped
      // here so mesh row 0 is the top of the screen and the renderer can index
      // the mesh in the same order it walks cells; the warp math is symmetric
      // in y, so nothing else changes.
      const y = 1 - (iy / gridY) * 2;
      for (let ix = 0; ix <= gridX; ix += 1) {
        const x = (ix / gridX) * 2 - 1;
        const rad = Math.sqrt(x * x * aspectX * aspectX + y * y * aspectY * aspectY);

        if (pixel) {
          for (let index = 0; index < slots.length; index += 1) memory[slots[index]!] = values[index]!;
          memory[xSlot] = x * 0.5 * aspectX + 0.5;
          memory[ySlot] = y * -0.5 * aspectY + 0.5;
          memory[radSlot] = rad;
          // The exact centre has no angle; MilkDrop pins it to zero.
          memory[angSlot] = ix * 2 === gridX && iy * 2 === gridY ? 0 : Math.atan2(y * aspectY, x * aspectX);
          pixel.run();
        }

        const zoom = memory[slots[0]!]!;
        const zoomExp = memory[slots[1]!]!;
        const rot = memory[slots[2]!]!;
        const warp = memory[slots[3]!]!;
        const cx = memory[slots[4]!]!;
        const cy = memory[slots[5]!]!;
        const dx = memory[slots[6]!]!;
        const dy = memory[slots[7]!]!;
        const sx = memory[slots[8]!]!;
        const sy = memory[slots[9]!]!;

        const zoom2 = Math.pow(zoom, Math.pow(zoomExp, rad * 2 - 1));
        const zoomInv = zoom2 === 0 ? 1 : 1 / zoom2;

        let u = x * 0.5 * aspectX * zoomInv + 0.5;
        let v = -y * 0.5 * aspectY * zoomInv + 0.5;
        u = sx === 0 ? cx : (u - cx) / sx + cx;
        v = sy === 0 ? cy : (v - cy) / sy + cy;

        if (warp !== 0) {
          u += warp * 0.0035 * Math.sin(warpTime * 0.333 + warpScaleInv * (x * warpF0 - y * warpF3));
          v += warp * 0.0035 * Math.cos(warpTime * 0.375 - warpScaleInv * (x * warpF2 + y * warpF1));
          u += warp * 0.0035 * Math.cos(warpTime * 0.753 - warpScaleInv * (x * warpF1 - y * warpF2));
          v += warp * 0.0035 * Math.sin(warpTime * 0.825 + warpScaleInv * (x * warpF0 + y * warpF3));
        }

        const u2 = u - cx;
        const v2 = v - cy;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        u = u2 * cos - v2 * sin + cx - dx;
        v = u2 * sin + v2 * cos + cy - dy;

        u = (u - 0.5) / aspectX + 0.5;
        v = (v - 0.5) / aspectY + 0.5;

        this.mesh[offset] = Number.isFinite(u) ? u : 0.5;
        this.mesh[offset + 1] = Number.isFinite(v) ? v : 0.5;
        offset += 2;
      }
    }
  }

  /**
   * Fills `wave` with the preset's waveform figure in [-1, 1], y up.
   *
   * Ported from Butterchurn's `BasicWaveform`. The eight modes are the
   * difference between a preset that draws a ring, an oscilloscope, a Lissajous
   * knot and a scrolling line, so they carry a lot of a preset's identity even
   * at cell resolution. The source is mono, so the "right" channel is a
   * phase-shifted copy — enough for the X-Y modes to open into a figure rather
   * than collapse onto a diagonal.
   */
  #buildWave(audio: ExomuxButterchurnAudio, time: number): void {
    const values = this.#values;
    const samples = audio.waveform;
    const length = samples.length;
    if (length === 0) {
      this.#waveCount = 0;
      return;
    }
    const scale = values.waveScale * 0.5;
    const shift = Math.min(32, length >> 2);
    const left = (index: number): number => samples[((index % length) + length) % length]! * scale;
    const right = (index: number): number => left(index + shift);

    const posX = values.waveX * 2 - 1;
    const posY = values.waveY * 2 - 1;
    let mystery = values.waveMystery;
    const mode = values.waveMode;
    if ((mode === 0 || mode === 1 || mode === 4) && (mystery < -1 || mystery > 1)) {
      mystery = mystery * 0.5 + 0.5;
      mystery -= Math.floor(mystery);
      mystery = Math.abs(mystery) * 2 - 1;
    }

    const aspectX = this.#aspectX;
    const aspectY = this.#aspectY;
    const wave = this.wave;
    const total = Math.min(BUTTERCHURN_WAVE_SAMPLES, length);
    let count = 0;
    const push = (x: number, y: number): void => {
      if (count >= BUTTERCHURN_WAVE_SAMPLES) return;
      wave[count * 2] = Number.isFinite(x) ? x : 0;
      wave[count * 2 + 1] = Number.isFinite(y) ? y : 0;
      count += 1;
    };

    switch (mode) {
      case 0: {
        // Ring whose radius is modulated by the waveform.
        for (let i = 0; i < total; i += 1) {
          const radius = 0.5 + 0.4 * right(i) + mystery;
          const angle = (i / total) * 2 * Math.PI + time * 0.2;
          push(radius * Math.cos(angle) * aspectY + posX, radius * Math.sin(angle) * aspectX + posY);
        }
        break;
      }
      case 1: {
        // Radius from one channel, angle from the other.
        for (let i = 0; i < total; i += 1) {
          const radius = 0.53 + 0.43 * right(i) + mystery;
          const angle = left(i + 32) * 0.5 * Math.PI + time * 2.3;
          push(radius * Math.cos(angle) * aspectY + posX, radius * Math.sin(angle) * aspectX + posY);
        }
        break;
      }
      case 2:
      case 3: {
        // Straight X-Y oscilloscope; mode 3 differs only in brightness upstream.
        for (let i = 0; i < total; i += 1) {
          push(right(i) * aspectY + posX, left(i + 32) * aspectX + posY);
        }
        break;
      }
      case 4: {
        // Scrolling line with momentum, which is what gives it its whip.
        const weight = 0.45 + 0.5 * (mystery * 0.5 + 0.5);
        const rest = 1 - weight;
        for (let i = 0; i < total; i += 1) {
          let x = (2 * i) / total + (posX - 1) + right(i + 25) * 0.44;
          let y = left(i) * 0.47 + posY;
          if (i > 1) {
            x = x * rest + weight * (wave[(i - 1) * 2]! * 2 - wave[(i - 2) * 2]!);
            y = y * rest + weight * (wave[(i - 1) * 2 + 1]! * 2 - wave[(i - 2) * 2 + 1]!);
          }
          push(x, y);
        }
        break;
      }
      case 5: {
        // Rotating complex square of the signal — the "explosive hash" figure.
        const cos = Math.cos(time * 0.3);
        const sin = Math.sin(time * 0.3);
        for (let i = 0; i < total; i += 1) {
          const a = right(i) * left(i + 32) + left(i) * right(i + 32);
          const b = right(i) * right(i) - left(i + 32) * left(i + 32);
          push((a * cos - b * sin) * (aspectY + posX), (a * sin + b * cos) * (aspectX + posY));
        }
        break;
      }
      default: {
        // Modes 6 and 7: one or two straight lines at an angle set by mystery,
        // displaced perpendicular by the waveform.
        const angle = Math.PI * 0.5 * mystery;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const lines = mode === 7 ? 2 : 1;
        const perLine = Math.max(2, Math.floor(total / lines));
        for (let line = 0; line < lines; line += 1) {
          const separation = mode === 7 ? (line === 0 ? -0.05 : 0.05) : 0;
          for (let i = 0; i < perLine; i += 1) {
            const along = (i / (perLine - 1)) * 2 - 1;
            const displace = left(i + line * 64) * 0.5 + separation + posY * 0.5;
            push(dirX * along - dirY * displace + posX * 0.5, dirY * along + dirX * displace);
          }
        }
        break;
      }
    }
    this.#waveCount = count;
  }
}

const ZERO_VALUES: ExomuxButterchurnFrameValues = Object.freeze({
  decay: 0.9,
  waveMode: 0,
  waveR: 0.5,
  waveG: 0.5,
  waveB: 0.5,
  waveAlpha: 1,
  waveScale: 1,
  waveMystery: -0.2,
  waveX: 0.5,
  waveY: 0.5,
  waveDots: false,
  additiveWave: false,
  darkenCenter: false,
  invert: false,
  solarize: false,
  brighten: false,
  darken: false,
  gammaAdjust: 1.25,
  echoAlpha: 0,
});
