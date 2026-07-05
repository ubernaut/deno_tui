// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

const MAX_LINEAR_BYTE_CACHE_SIZE = 65536;
const RESET = "\x1b[0m";

export interface LinearByteCache {
  (value: number): number;
  clear(): void;
  prune(): void;
}

export function colorValue(input: Color | string | number | undefined, fallback: number): Color {
  return input instanceof Color ? input : new Color(input ?? fallback);
}

export function colorToBytes(color: Color): [number, number, number] {
  return [
    linearUnitToByte(color.r),
    linearUnitToByte(color.g),
    linearUnitToByte(color.b),
  ];
}

export function createLinearByteCache(): LinearByteCache {
  const cache = new Map<number, number>();
  const read = ((value: number): number => {
    if (value <= 0) return 0;
    if (value >= 1) return 255;
    const cached = cache.get(value);
    if (cached !== undefined) return cached;
    const byte = linearUnitToByte(value);
    cache.set(value, byte);
    return byte;
  }) as LinearByteCache;
  read.clear = () => cache.clear();
  read.prune = () => {
    if (cache.size > MAX_LINEAR_BYTE_CACHE_SIZE) {
      cache.clear();
    }
  };
  return read;
}

/** Caches raw linear RGB inputs and their terminal byte-color keys by cell index. */
export class ThreeAsciiAnsiColorKeyCache {
  private readonly toByte = createLinearByteCache();
  private rawRed = new Float64Array(0);
  private rawGreen = new Float64Array(0);
  private rawBlue = new Float64Array(0);
  private byteKeys = new Uint32Array(0);

  prepare(cellCount: number): void {
    if (this.byteKeys.length === cellCount) return;
    this.rawRed = createNaNFloat64Array(cellCount);
    this.rawGreen = createNaNFloat64Array(cellCount);
    this.rawBlue = createNaNFloat64Array(cellCount);
    this.byteKeys = new Uint32Array(cellCount);
  }

  keyForIndex(index: number, rawRed: number, rawGreen: number, rawBlue: number): number {
    if (
      this.rawRed[index] === rawRed &&
      this.rawGreen[index] === rawGreen &&
      this.rawBlue[index] === rawBlue
    ) {
      return this.byteKeys[index]!;
    }

    const foregroundRed = this.toByte(rawRed);
    const foregroundGreen = this.toByte(rawGreen);
    const foregroundBlue = this.toByte(rawBlue);
    const key = (foregroundRed << 16) | (foregroundGreen << 8) | foregroundBlue;
    this.rawRed[index] = rawRed;
    this.rawGreen[index] = rawGreen;
    this.rawBlue[index] = rawBlue;
    this.byteKeys[index] = key;
    return key;
  }

  prune(): void {
    this.toByte.prune();
  }

  clear(): void {
    this.toByte.clear();
    this.rawRed = new Float64Array(0);
    this.rawGreen = new Float64Array(0);
    this.rawBlue = new Float64Array(0);
    this.byteKeys = new Uint32Array(0);
  }
}

/** Tracks terminal background ANSI state for Three ASCII grid assembly. */
export class ThreeAsciiAnsiBackgroundState {
  key = -1;
  ansi = "";
  blankAnsi = "";
  red = 0;
  green = 0;
  blue = 0;

  private stableInput: string | number | undefined;
  private hasStableInput = false;
  private stableColorRef?: Color;
  private stableColorRed = Number.NaN;
  private stableColorGreen = Number.NaN;
  private stableColorBlue = Number.NaN;

  set(backgroundColor: Color | string | number | undefined): boolean {
    if (!(backgroundColor instanceof Color)) {
      const stableInput = backgroundColor ?? 0;
      if (this.hasStableInput && this.stableInput === stableInput) {
        return false;
      }
      this.hasStableInput = true;
      this.stableInput = stableInput;
      this.stableColorRef = undefined;
      return this.setColor(colorValue(backgroundColor, 0x000000));
    }

    this.hasStableInput = false;
    this.stableInput = undefined;
    if (
      this.stableColorRef === backgroundColor &&
      this.stableColorRed === backgroundColor.r &&
      this.stableColorGreen === backgroundColor.g &&
      this.stableColorBlue === backgroundColor.b
    ) {
      return false;
    }
    this.stableColorRef = backgroundColor;
    this.stableColorRed = backgroundColor.r;
    this.stableColorGreen = backgroundColor.g;
    this.stableColorBlue = backgroundColor.b;
    return this.setColor(backgroundColor);
  }

  clear(): void {
    this.key = -1;
    this.ansi = "";
    this.blankAnsi = "";
    this.red = 0;
    this.green = 0;
    this.blue = 0;
    this.hasStableInput = false;
    this.stableInput = undefined;
    this.stableColorRef = undefined;
    this.stableColorRed = Number.NaN;
    this.stableColorGreen = Number.NaN;
    this.stableColorBlue = Number.NaN;
  }

  private setColor(backgroundColor: Color): boolean {
    const [red, green, blue] = colorToBytes(backgroundColor);
    const key = (red << 16) | (green << 8) | blue;
    if (key === this.key) {
      return false;
    }

    this.key = key;
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.ansi = rgbToAnsiBackground(red, green, blue);
    this.blankAnsi = `${this.ansi} ${RESET}`;
    return true;
  }
}

export function linearUnitToByte(value: number): number {
  return Math.round(linearToSrgb(value) * 255);
}

export function rgbToAnsiForeground(red: number, green: number, blue: number): string {
  return `\x1b[38;2;${red};${green};${blue}m`;
}

export function rgbToAnsiBackground(red: number, green: number, blue: number): string {
  return `\x1b[48;2;${red};${green};${blue}m`;
}

function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function createNaNFloat64Array(length: number): Float64Array<ArrayBuffer> {
  const values = new Float64Array(length);
  values.fill(Number.NaN);
  return values;
}
