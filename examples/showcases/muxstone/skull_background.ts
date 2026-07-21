// Copyright 2023 Im-Beast. MIT license.

import type { Rectangle } from "../../../src/types.ts";
import type { MuxstoneThemeSpec } from "./model.ts";
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
const CELL_ROW_ASPECT = 2;
const DEFAULT_POINTER_IDLE_MS = 3_000;
const GAZE_RESPONSE_MS = 150;
const GAZE_RECENTER_MS = 300;
const BLINK_GAP_MIN_MS = 6_000;
const BLINK_GAP_SPREAD_MS = 9_000;
const BLINK_DURATION_MS = 200;
const BLINK_POINTER_HOLDOFF_MS = 100;
const BREATH_PERIOD_MS = 5_000;
const BREATH_DEPTH = 0.08;
const WAVE_CELLS_PER_SECOND = 4;
const WAVE_RADIUS_CELLS = 2;
const MACHINERY_BLANK = 255;

const REGION_MACHINERY = 0;
const REGION_FILL = 1;
const REGION_SHADE = 2;
const REGION_OUTLINE = 3;
const REGION_SOCKET = 4;
const REGION_IRIS = 5;
const REGION_NASAL = 6;
const REGION_TEETH = 7;

const TOOTH_PATTERN = ["█", "▌", "█", "▐"] as const;
const CONNECTOR_GLYPHS = ["o", "▣", "◙", "╦"] as const;
const CLUSTER_GLYPHS = ["▓", "▒", "▣", "o"] as const;
/** Index order east, south, west, north; even indices are horizontal. */
const TUBE_DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

/** Construction options for the biomech skull background. */
export interface MuxstoneSkullFieldOptions {
  readonly seed?: number;
  /** Pointer-idle time before the pupils ease back to center. */
  readonly pointerIdleMs?: number;
}

/** Terse deterministic state snapshot for tests and diagnostics. */
export interface MuxstoneSkullInspection {
  readonly bounds?: Rectangle;
  readonly pointer?: MuxstoneBackgroundPoint & { readonly updatedAt: number };
  /** Shared pupil displacement from each iris center, in cell units. */
  readonly pupilOffset: { readonly x: number; readonly y: number };
  readonly blinkActive: boolean;
  readonly breathPhase: number;
  readonly tubeCount: number;
}

interface SkullPointer extends MuxstoneBackgroundPoint {
  readonly updatedAt: number;
}

interface SkullTube {
  readonly length: number;
  readonly speed: number;
  readonly waves: readonly number[];
}

interface SkullEye {
  readonly cx: number;
  readonly cy: number;
  readonly irisRadius: number;
}

interface SkullLayout {
  readonly width: number;
  readonly height: number;
  readonly mask: Uint8Array;
  /** Region-specific level byte: shade depth, or machinery texture depth (255 = blank). */
  readonly level: Uint8Array;
  readonly overlayChar: (string | undefined)[];
  /** Tube index + 1 for hose cells, 0 for clusters and empty cells. */
  readonly overlayTube: Int32Array;
  readonly overlayPos: Uint16Array;
  readonly overlayDepth: Uint8Array;
  readonly tubes: readonly SkullTube[];
  readonly eyes: readonly SkullEye[];
  readonly gazeReach: number;
  readonly maxPupilX: number;
}

/**
 * Comic-linework biomech skull: a bright cell-aspect-corrected skull with
 * glowing amber eyes stares out of a wall of dark machine tubing plugged into
 * its cranium. Pupils ease toward the pointer, eyelids blink on a seeded
 * 6-15 s cadence, and brightness waves crawl along every hose over a slow
 * whole-field breath. Owns deterministic simulation state only; palette
 * selection stays inside `rasterizeCells`.
 */
export class MuxstoneSkullField implements MuxstoneAnimatedBackground {
  readonly #seed: number;
  readonly #pointerIdleMs: number;
  #randomState: number;
  #bounds?: Rectangle;
  #layout?: SkullLayout;
  #pointer?: SkullPointer;
  #lastFrameAt?: number;
  #timeMs = 0;
  #pupilX = 0;
  #pupilY = 0;
  #blinkUntil?: number;
  #nextBlinkAt?: number;
  #cells: (MuxstoneBackgroundCell | undefined)[][] = [];

  constructor(options: MuxstoneSkullFieldOptions = {}) {
    this.#seed = (options.seed ?? 0x53_4b_55_4c) >>> 0;
    this.#pointerIdleMs = Math.max(0, finite(options.pointerIdleMs, DEFAULT_POINTER_IDLE_MS));
    this.#randomState = this.#seed;
  }

  /** Records the gaze target the pupils ease toward. */
  setPointer(point: MuxstoneBackgroundPoint, now = performance.now()): void {
    if (!Number.isFinite(point.column) || !Number.isFinite(point.row)) return;
    this.#pointer = { column: point.column, row: point.row, updatedAt: finite(now, performance.now()) };
  }

  clearPointer(): void {
    this.#pointer = undefined;
  }

  /** Advances gaze easing, the blink scheduler, and pulse clocks once. */
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
    this.#timeMs += elapsed;
    this.#advanceGaze(bounds, now, elapsed);
    this.#advanceBlink(now);
    return true;
  }

  /** Paints skull mask regions, dynamic pupils, and pulsing machinery into a reused grid. */
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
    const layout = this.#layout;
    this.#prepareCellBuffer(normalized);
    if (!layout) return this.#cells;
    const seconds = this.#timeMs / 1_000;
    const breathWave = Math.sin((TAU * this.#timeMs) / BREATH_PERIOD_MS);
    const breath = 1 + BREATH_DEPTH * breathWave;
    const blinking = this.#blinkUntil !== undefined;
    const bone = mixMuxstoneRgb(theme.text, theme.accent, 0.12);
    const fill: MuxstoneBackgroundCell = { char: "█", foreground: bone };
    const outline: MuxstoneBackgroundCell = {
      char: "█",
      foreground: mixMuxstoneRgb(theme.background, theme.border, 0.18),
    };
    const socket: MuxstoneBackgroundCell = {
      char: "█",
      foreground: mixMuxstoneRgb(theme.background, theme.muted, 0.12),
    };
    const iris: MuxstoneBackgroundCell = {
      char: "█",
      foreground: mixMuxstoneRgb(theme.warning, theme.text, 0.22),
      bold: true,
    };
    const nasal: MuxstoneBackgroundCell = {
      char: "▓",
      foreground: mixMuxstoneRgb(theme.background, theme.muted, 0.16),
    };
    const eyelid: MuxstoneBackgroundCell = { char: "▓", foreground: mixMuxstoneRgb(bone, theme.background, 0.2) };
    const toothBright: MuxstoneBackgroundCell["foreground"] = mixMuxstoneRgb(theme.text, theme.accent, 0.05);
    const toothDark: MuxstoneBackgroundCell["foreground"] = mixMuxstoneRgb(theme.background, theme.muted, 0.35);
    for (let y = 0; y < layout.height; y += 1) {
      const row = this.#cells[y]!;
      for (let x = 0; x < layout.width; x += 1) {
        const index = y * layout.width + x;
        switch (layout.mask[index]) {
          case REGION_FILL:
            row[x] = fill;
            break;
          case REGION_OUTLINE:
            row[x] = outline;
            break;
          case REGION_SHADE: {
            const depth = layout.level[index]! / 250;
            const toward = Math.min(1, (0.25 + 0.55 * depth) * (1 + 0.12 * breathWave));
            row[x] = { char: depth < 0.5 ? "▒" : "░", foreground: mixMuxstoneRgb(bone, theme.background, toward) };
            break;
          }
          case REGION_SOCKET:
            row[x] = blinking ? eyelid : socket;
            break;
          case REGION_IRIS:
            row[x] = blinking ? eyelid : iris;
            break;
          case REGION_NASAL:
            row[x] = nasal;
            break;
          case REGION_TEETH: {
            const glyph = TOOTH_PATTERN[x & 3]!;
            row[x] = { char: glyph, foreground: glyph === "█" ? toothBright : toothDark };
            break;
          }
          default:
            row[x] = this.#machineryCell(layout, index, theme, breath, seconds);
        }
      }
    }
    if (!blinking) this.#paintPupils(layout, theme);
    return this.#cells;
  }

  inspect(): MuxstoneSkullInspection {
    return {
      ...(this.#bounds ? { bounds: { ...this.#bounds } } : {}),
      ...(this.#pointer ? { pointer: { ...this.#pointer } } : {}),
      pupilOffset: { x: this.#pupilX, y: this.#pupilY },
      blinkActive: this.#blinkUntil !== undefined,
      breathPhase: (this.#timeMs % BREATH_PERIOD_MS) / BREATH_PERIOD_MS,
      tubeCount: this.#layout?.tubes.length ?? 0,
    };
  }

  #advanceGaze(bounds: Rectangle, now: number, elapsed: number): void {
    const layout = this.#layout;
    const pointer = this.#pointer;
    const attentive = pointer !== undefined && now - pointer.updatedAt <= this.#pointerIdleMs;
    let targetX = 0;
    let targetY = 0;
    if (attentive && layout && layout.eyes.length > 0) {
      const originX = bounds.column + (layout.width - 1) / 2;
      const originY = bounds.row + layout.eyes[0]!.cy;
      const dx = pointer.column - originX;
      const dy = (pointer.row - originY) * CELL_ROW_ASPECT;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.001) {
        const magnitude = Math.min(1, distance / layout.gazeReach);
        targetX = (dx / distance) * magnitude * layout.maxPupilX;
        targetY = ((dy / distance) * magnitude * layout.maxPupilX) / CELL_ROW_ASPECT;
      }
    }
    const alpha = 1 - Math.exp(-elapsed / (attentive ? GAZE_RESPONSE_MS : GAZE_RECENTER_MS));
    this.#pupilX += (targetX - this.#pupilX) * alpha;
    this.#pupilY += (targetY - this.#pupilY) * alpha;
  }

  #advanceBlink(now: number): void {
    if (this.#blinkUntil !== undefined && this.#timeMs >= this.#blinkUntil) {
      this.#blinkUntil = undefined;
      this.#nextBlinkAt = this.#timeMs + BLINK_GAP_MIN_MS + this.#random() * BLINK_GAP_SPREAD_MS;
    }
    this.#nextBlinkAt ??= this.#timeMs + BLINK_GAP_MIN_MS + this.#random() * BLINK_GAP_SPREAD_MS;
    if (this.#blinkUntil !== undefined || this.#timeMs < this.#nextBlinkAt) return;
    const pointer = this.#pointer;
    if (pointer !== undefined && now - pointer.updatedAt < BLINK_POINTER_HOLDOFF_MS) {
      this.#nextBlinkAt = this.#timeMs + BLINK_POINTER_HOLDOFF_MS * 2;
      return;
    }
    this.#blinkUntil = this.#timeMs + BLINK_DURATION_MS;
  }

  #machineryCell(
    layout: SkullLayout,
    index: number,
    theme: MuxstoneThemeSpec,
    breath: number,
    seconds: number,
  ): MuxstoneBackgroundCell | undefined {
    const glyph = layout.overlayChar[index];
    if (glyph !== undefined) {
      const depth = layout.overlayDepth[index]! / 255;
      const structure = mixMuxstoneRgb(theme.border, theme.muted, depth);
      const tubeRef = layout.overlayTube[index]!;
      if (tubeRef > 0) {
        const pulse = tubePulse(layout.tubes[tubeRef - 1]!, layout.overlayPos[index]!, seconds);
        let color = mixMuxstoneRgb(theme.background, structure, Math.min(1, (0.3 + 0.4 * depth) * breath));
        if (pulse > 0) color = mixMuxstoneRgb(color, theme.accent, 0.65 * pulse);
        return pulse > 0.75 ? { char: glyph, foreground: color, bold: true } : { char: glyph, foreground: color };
      }
      let color = mixMuxstoneRgb(theme.background, structure, Math.min(1, (0.28 + 0.42 * depth) * breath));
      if (depth > 0.88) color = mixMuxstoneRgb(color, theme.accent, 0.3);
      return { char: glyph, foreground: color };
    }
    const levelByte = layout.level[index]!;
    if (levelByte === MACHINERY_BLANK) return undefined;
    const depth = levelByte / 250;
    const structure = mixMuxstoneRgb(theme.border, theme.muted, depth);
    return {
      char: depth < 0.55 ? "░" : "▒",
      foreground: mixMuxstoneRgb(theme.background, structure, Math.min(1, (0.16 + 0.4 * depth) * breath)),
    };
  }

  #paintPupils(layout: SkullLayout, theme: MuxstoneThemeSpec): void {
    const pupil: MuxstoneBackgroundCell = {
      char: "█",
      foreground: mixMuxstoneRgb(theme.background, theme.border, 0.06),
    };
    const glint: MuxstoneBackgroundCell = {
      char: "█",
      foreground: mixMuxstoneRgb(theme.text, theme.warning, 0.08),
      bold: true,
    };
    for (const eye of layout.eyes) {
      const py = Math.round(eye.cy + this.#pupilY);
      const px = Math.round(eye.cx + this.#pupilX - 0.5);
      this.#paintIrisCell(layout, px, py, pupil);
      this.#paintIrisCell(layout, px + 1, py, pupil);
      if (!this.#paintIrisCell(layout, px - 1, py - 1, glint)) this.#paintIrisCell(layout, px - 1, py, glint);
    }
  }

  #paintIrisCell(layout: SkullLayout, x: number, y: number, cell: MuxstoneBackgroundCell): boolean {
    if (x < 0 || x >= layout.width || y < 0 || y >= layout.height) return false;
    if (layout.mask[y * layout.width + x] !== REGION_IRIS) return false;
    this.#cells[y]![x] = cell;
    return true;
  }

  #prepareCellBuffer(bounds: Rectangle): void {
    if (this.#cells.length !== bounds.height || (this.#cells[0]?.length ?? -1) !== bounds.width) {
      this.#cells = Array.from(
        { length: bounds.height },
        () => new Array<MuxstoneBackgroundCell | undefined>(bounds.width),
      );
    }
    for (const row of this.#cells) row.fill(undefined);
  }

  #ensureBounds(bounds: Rectangle): void {
    const previous = this.#bounds;
    if (
      previous?.column === bounds.column && previous.row === bounds.row &&
      previous.width === bounds.width && previous.height === bounds.height
    ) return;
    const sizeChanged = previous?.width !== bounds.width || previous.height !== bounds.height;
    this.#bounds = { ...bounds };
    if (sizeChanged || !this.#layout) this.#layout = this.#buildLayout(bounds.width, bounds.height);
  }

  /** Rebuilds masks, tubes, and clusters; keyed by seed and dimensions so resizes are deterministic. */
  #buildLayout(width: number, height: number): SkullLayout {
    const hashSeed = hashPair(this.#seed, width, height);
    let state = hashSeed === 0 ? 0x9e_37_79_b9 : hashSeed;
    const random = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const size = width * height;
    const mask = new Uint8Array(size);
    const level = new Uint8Array(size);
    const overlayChar = new Array<string | undefined>(size);
    const overlayTube = new Int32Array(size);
    const overlayPos = new Uint16Array(size);
    const overlayDepth = new Uint8Array(size);

    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const span = 0.6 * Math.min(width, height * CELL_ROW_ASPECT);
    const craniumRx = Math.max(2, span * 0.4);
    const craniumRy = Math.max(2, span * 0.34);
    const craniumCy = -span * 0.18;
    const jawRx = craniumRx * 0.6;
    const jawTop = craniumCy + craniumRy * 0.55;
    const chin = span * 0.52;
    const jawCy = (jawTop + chin) / 2;
    const jawRy = Math.max(0.5, (chin - jawTop) / 2);
    const notchX = craniumRx * 0.95;
    const notchY = craniumCy + craniumRy * 0.8;
    const notchRx = Math.max(0.5, craniumRx * 0.28);
    const notchRy = Math.max(0.5, craniumRy * 0.3);
    const eyeOffset = craniumRx * 0.42;
    const eyeY = craniumCy + craniumRy * 0.3;
    const socketRadius = craniumRx * 0.3;
    const irisRadius = socketRadius * 0.62;
    const noseTop = eyeY + craniumRy * 0.5;
    const noseBottom = noseTop + craniumRy * 0.45;
    const noseHalfWidth = Math.max(1, craniumRx * 0.16);
    const teethTop = chin - 6.5;

    for (let y = 0; y < height; y += 1) {
      const vy = (y - cy) * CELL_ROW_ASPECT;
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const vx = x - cx;
        const cranium = Math.hypot(vx / craniumRx, (vy - craniumCy) / craniumRy);
        const jaw = Math.cbrt(Math.abs(vx / jawRx) ** 3 + Math.abs((vy - jawCy) / jawRy) ** 3);
        let d = Math.min(cranium, jaw);
        const notch = Math.hypot((Math.abs(vx) - notchX) / notchRx, (vy - notchY) / notchRy);
        if (notch < 1) d = Math.max(d, 1.02 + (1 - notch) * 0.25);
        if (d > 1.14) {
          mask[index] = REGION_MACHINERY;
          level[index] = hash01(hashSeed, x, y) < 0.08
            ? MACHINERY_BLANK
            : Math.floor(hash01(hashSeed, x + 7_919, y + 104_729) * 251);
          continue;
        }
        if (d > 1) {
          mask[index] = REGION_OUTLINE;
          continue;
        }
        if (d > 0.8) {
          mask[index] = REGION_SHADE;
          level[index] = Math.round(((d - 0.8) / 0.2) * 250);
          continue;
        }
        const eyeDistance = Math.min(
          Math.hypot(vx + eyeOffset, vy - eyeY),
          Math.hypot(vx - eyeOffset, vy - eyeY),
        );
        if (eyeDistance <= irisRadius) {
          mask[index] = REGION_IRIS;
          continue;
        }
        if (eyeDistance <= socketRadius) {
          mask[index] = REGION_SOCKET;
          continue;
        }
        if (vy >= noseTop && vy <= noseBottom) {
          const half = (noseHalfWidth * (vy - noseTop)) / Math.max(0.001, noseBottom - noseTop);
          const septum = Math.abs(vx) < 0.8 && vy > noseBottom - 1.6;
          if (Math.abs(vx) <= half && !septum) {
            mask[index] = REGION_NASAL;
            continue;
          }
        }
        if (vy >= teethTop && vy < teethTop + 4 && jaw <= 0.8) {
          mask[index] = REGION_TEETH;
          continue;
        }
        mask[index] = REGION_FILL;
      }
    }

    const machineryFree = (x: number, y: number): boolean =>
      x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === REGION_MACHINERY;
    const paintTube = (x: number, y: number, glyph: string, tubeIndex: number, pos: number, depth: number): void => {
      const index = y * width + x;
      overlayChar[index] = overlayChar[index] !== undefined && overlayTube[index]! > 0 ? "╬" : glyph;
      overlayTube[index] = tubeIndex + 1;
      overlayPos[index] = Math.min(0xffff, pos);
      overlayDepth[index] = depth;
    };

    const tubes: SkullTube[] = [];
    const tubeTarget = clampInteger(Math.round(size / 130), 6, 48);
    for (let attempt = 0; attempt < tubeTarget; attempt += 1) {
      let x = -1;
      let y = -1;
      for (let tries = 0; tries < 24; tries += 1) {
        const sx = Math.floor(random() * width);
        const sy = Math.floor(random() * height);
        if (machineryFree(sx, sy) && overlayChar[sy * width + sx] === undefined) {
          x = sx;
          y = sy;
          break;
        }
      }
      if (x < 0) continue;
      const thick = random() < 0.4;
      const stair = random() < 0.2;
      const stairHorizontal = random() < 0.5 ? 0 : 2;
      const stairVertical = random() < 0.5 ? 1 : 3;
      const depth = Math.floor(80 + random() * 175);
      const tubeIndex = tubes.length;
      let direction = stair ? stairHorizontal : Math.floor(random() * 4);
      const segments = stair ? 6 + Math.floor(random() * 6) : 2 + Math.floor(random() * 3);
      let pos = 0;
      let alive = true;
      const paintStep = (px: number, py: number, dir: number): void => {
        paintTube(px, py, straightGlyph(dir, thick), tubeIndex, pos, depth);
        if (!thick) return;
        const ox = dir % 2 === 0 ? px : px + 1;
        const oy = dir % 2 === 0 ? py + 1 : py;
        if (machineryFree(ox, oy) && overlayChar[oy * width + ox] === undefined) {
          paintTube(ox, oy, dir % 2 === 0 ? "─" : "│", tubeIndex, pos, depth);
        }
      };
      paintStep(x, y, direction);
      for (let segment = 0; segment < segments && alive; segment += 1) {
        const length = stair ? 1 + Math.floor(random() * 2) : 6 + Math.floor(random() * 20);
        for (let step = 0; step < length; step += 1) {
          const [dx, dy] = TUBE_DIRECTIONS[direction]!;
          if (!machineryFree(x + dx, y + dy)) {
            paintTube(x, y, CONNECTOR_GLYPHS[Math.floor(random() * CONNECTOR_GLYPHS.length)]!, tubeIndex, pos, depth);
            alive = false;
            break;
          }
          x += dx;
          y += dy;
          pos += 1;
          paintStep(x, y, direction);
        }
        if (!alive) break;
        if (segment < segments - 1) {
          const turn = stair
            ? (direction === stairHorizontal ? stairVertical : stairHorizontal)
            : direction % 2 === 0
            ? (random() < 0.5 ? 1 : 3)
            : (random() < 0.5 ? 0 : 2);
          paintTube(x, y, cornerGlyph(direction, turn), tubeIndex, pos, depth);
          direction = turn;
        } else {
          paintTube(x, y, CONNECTOR_GLYPHS[Math.floor(random() * CONNECTOR_GLYPHS.length)]!, tubeIndex, pos, depth);
        }
      }
      const total = pos + 1;
      const waves = random() < 0.5 ? [random() * total] : [random() * total, random() * total];
      tubes.push({ length: total, speed: (0.7 + random() * 0.6) * (random() < 0.5 ? -1 : 1), waves });
    }

    const clusterTarget = clampInteger(Math.round(size / 90), 4, 80);
    for (let cluster = 0; cluster < clusterTarget; cluster += 1) {
      const baseX = Math.floor(random() * Math.max(1, width - 3));
      const baseY = Math.floor(random() * Math.max(1, height - 2));
      const blockWidth = 2 + Math.floor(random() * 2);
      for (let by = baseY; by < baseY + 2; by += 1) {
        for (let bx = baseX; bx < baseX + blockWidth; bx += 1) {
          if (!machineryFree(bx, by)) continue;
          const index = by * width + bx;
          if (overlayChar[index] !== undefined) continue;
          overlayChar[index] = CLUSTER_GLYPHS[Math.floor(random() * CLUSTER_GLYPHS.length)]!;
          overlayDepth[index] = Math.floor(60 + random() * 195);
        }
      }
    }

    const eyeRow = cy + eyeY / CELL_ROW_ASPECT;
    return {
      width,
      height,
      mask,
      level,
      overlayChar,
      overlayTube,
      overlayPos,
      overlayDepth,
      tubes,
      eyes: [
        { cx: cx - eyeOffset, cy: eyeRow, irisRadius },
        { cx: cx + eyeOffset, cy: eyeRow, irisRadius },
      ],
      gazeReach: Math.max(4, width * 0.3),
      maxPupilX: Math.max(0.8, irisRadius - 1.4),
    };
  }

  #random(): number {
    this.#randomState = (Math.imul(this.#randomState, 1_664_525) + 1_013_904_223) >>> 0;
    return this.#randomState / 0x1_0000_0000;
  }
}

/** Peak brightness contribution of the tube's traveling waves at one path cell. */
function tubePulse(tube: SkullTube, position: number, seconds: number): number {
  if (tube.length < 2) return 0;
  const travel = seconds * WAVE_CELLS_PER_SECOND * tube.speed;
  let best = 0;
  for (const offset of tube.waves) {
    const crest = (((offset + travel) % tube.length) + tube.length) % tube.length;
    const direct = Math.abs(position - crest);
    const distance = Math.min(direct, tube.length - direct);
    if (distance <= WAVE_RADIUS_CELLS) best = Math.max(best, 1 - distance / (WAVE_RADIUS_CELLS + 0.5));
  }
  return best;
}

function straightGlyph(direction: number, thick: boolean): string {
  return direction % 2 === 0 ? (thick ? "═" : "─") : (thick ? "║" : "│");
}

/** Corner joining the incoming arm (opposite of `previous`) with the outgoing `next` arm. */
function cornerGlyph(previous: number, next: number): string {
  const arms = (1 << ((previous + 2) % 4)) | (1 << next);
  switch (arms) {
    case 0b0011:
      return "╔";
    case 0b1001:
      return "╚";
    case 0b0110:
      return "╗";
    case 0b1100:
      return "╝";
    default:
      return "╬";
  }
}

function hashPair(seed: number, a: number, b: number): number {
  let value = (seed ^ Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d) >>> 0;
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39) >>> 0;
  return (value ^ (value >>> 15)) >>> 0;
}

function hash01(seed: number, a: number, b: number): number {
  return hashPair(seed, a, b) / 0x1_0000_0000;
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

function finite(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
