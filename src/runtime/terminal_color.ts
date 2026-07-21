// Copyright 2023 Im-Beast. MIT license.

const COLOR_KIND_MASK = 0xff000000;
const COLOR_PAYLOAD_MASK = 0x00ffffff;
const INDEXED_COLOR_TAG = 0x01000000;
const RGB_COLOR_TAG = 0x02000000;

export type DecodedTerminalColor =
  | { readonly kind: "ansi"; readonly code: number; readonly index: number }
  | { readonly kind: "indexed"; readonly index: number }
  | { readonly kind: "rgb"; readonly red: number; readonly green: number; readonly blue: number };

/** Encodes an extended SGR palette index without colliding with basic SGR codes. */
export function encodeTerminalIndexedColor(index: number): number {
  return INDEXED_COLOR_TAG | clampByte(index);
}

/** Encodes SGR truecolor without colliding with palette indices or basic SGR codes. */
export function encodeTerminalRgbColor(red: number, green: number, blue: number): number {
  return RGB_COLOR_TAG | (clampByte(red) << 16) | (clampByte(green) << 8) | clampByte(blue);
}

/** Decodes tagged colors plus legacy untagged values created by older callers. */
export function decodeTerminalColor(value: number, background: boolean): DecodedTerminalColor | undefined {
  if (!Number.isInteger(value) || value < 0) return undefined;
  const tag = value & COLOR_KIND_MASK;
  if (tag === INDEXED_COLOR_TAG) return { kind: "indexed", index: value & 0xff };
  if (tag === RGB_COLOR_TAG) {
    const packed = value & COLOR_PAYLOAD_MASK;
    return {
      kind: "rgb",
      red: (packed >> 16) & 0xff,
      green: (packed >> 8) & 0xff,
      blue: packed & 0xff,
    };
  }

  const normalBase = background ? 40 : 30;
  const brightBase = background ? 100 : 90;
  if (value >= normalBase && value <= normalBase + 7) {
    return { kind: "ansi", code: value, index: value - normalBase };
  }
  if (value >= brightBase && value <= brightBase + 7) {
    return { kind: "ansi", code: value, index: value - brightBase + 8 };
  }

  // Compatibility for cells manually constructed before tagged encodings.
  if (value <= 255) return { kind: "indexed", index: value };
  if (value <= COLOR_PAYLOAD_MASK) {
    return {
      kind: "rgb",
      red: (value >> 16) & 0xff,
      green: (value >> 8) & 0xff,
      blue: value & 0xff,
    };
  }
  return undefined;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.floor(Number.isFinite(value) ? value : 0)));
}
