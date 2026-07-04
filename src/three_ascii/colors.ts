// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

const MAX_LINEAR_BYTE_CACHE_SIZE = 65536;

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
