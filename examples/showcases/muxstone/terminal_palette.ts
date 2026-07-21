// Copyright 2023 Im-Beast. MIT license.

import type { MuxstoneRgb } from "./model.ts";
import { decodeTerminalColor } from "../../../src/runtime/terminal_color.ts";

/** Resolves compact TerminalScreen SGR values through the xterm color palette. */
export function muxstoneTerminalRgb(code: number | undefined, background: boolean): MuxstoneRgb | undefined {
  if (code === undefined) return undefined;
  const decoded = decodeTerminalColor(code, background);
  if (!decoded) return undefined;
  if (decoded.kind === "ansi") return xtermPaletteRgb(decoded.index);
  if (decoded.kind === "indexed") return xtermPaletteRgb(decoded.index);
  return [decoded.red, decoded.green, decoded.blue];
}

/** Resolves theme-remappable ANSI text and raises it to readable contrast. */
export function muxstoneTerminalForegroundRgb(
  code: number | undefined,
  background: MuxstoneRgb,
  preferredText: MuxstoneRgb,
): MuxstoneRgb | undefined {
  if (code === undefined) return undefined;
  const color = muxstoneTerminalRgb(code, false);
  const decoded = decodeTerminalColor(code, false);
  if (!color || decoded?.kind !== "ansi" || contrastRatio(color, background) >= 4.5) return color;
  if (contrastRatio(preferredText, background) < 4.5) {
    const black: MuxstoneRgb = [0, 0, 0];
    const white: MuxstoneRgb = [255, 255, 255];
    return contrastRatio(black, background) >= contrastRatio(white, background) ? black : white;
  }
  for (let step = 1; step <= 256; step += 1) {
    const ratio = step / 256;
    const candidate: MuxstoneRgb = [
      blendChannel(color[0], preferredText[0], ratio),
      blendChannel(color[1], preferredText[1], ratio),
      blendChannel(color[2], preferredText[2], ratio),
    ];
    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }
  return preferredText;
}

function xtermPaletteRgb(index: number): MuxstoneRgb {
  if (index < 8) return ANSI_NORMAL[index]!;
  if (index < 16) return ANSI_BRIGHT[index - 8]!;
  if (index < 232) {
    const cube = index - 16;
    const red = Math.floor(cube / 36);
    const green = Math.floor((cube % 36) / 6);
    const blue = cube % 6;
    return [XTERM_CUBE_LEVELS[red]!, XTERM_CUBE_LEVELS[green]!, XTERM_CUBE_LEVELS[blue]!];
  }
  const level = 8 + (index - 232) * 10;
  return [level, level, level];
}

const ANSI_NORMAL: readonly MuxstoneRgb[] = Object.freeze([
  [0, 0, 0],
  [205, 49, 49],
  [13, 188, 121],
  [229, 229, 16],
  [36, 114, 200],
  [188, 63, 188],
  [17, 168, 205],
  [229, 229, 229],
]);
const ANSI_BRIGHT: readonly MuxstoneRgb[] = Object.freeze([
  [102, 102, 102],
  [241, 76, 76],
  [35, 209, 139],
  [245, 245, 67],
  [59, 142, 234],
  [214, 112, 214],
  [41, 184, 219],
  [255, 255, 255],
]);
const XTERM_CUBE_LEVELS = [0, 95, 135, 175, 215, 255] as const;

function blendChannel(source: number, target: number, ratio: number): number {
  return Math.round(source + (target - source) * ratio);
}

function contrastRatio(left: MuxstoneRgb, right: MuxstoneRgb): number {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05);
}

function relativeLuminance(color: MuxstoneRgb): number {
  const [red, green, blue] = color.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}
