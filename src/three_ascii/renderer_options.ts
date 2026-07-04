import type { TerminalGlyphStyle } from "./glyphs.ts";

export type ThreeAsciiReadbackStrategy = "blocking" | "deferred";

export interface ThreeAsciiRenderSize {
  columns: number;
  rows: number;
}

export interface ThreeAsciiRendererOptionSource {
  columns: number;
  rows: number;
  pixelAspectRatio?: number;
  terminalEdgeBias?: number;
  terminalGlyphStyle?: TerminalGlyphStyle;
  readbackStrategy?: ThreeAsciiReadbackStrategy;
  deferredReadbackSlots?: number;
}

export interface NormalizedThreeAsciiRendererOptions extends ThreeAsciiRenderSize {
  pixelAspectRatio: number;
  terminalEdgeBias: number;
  terminalGlyphStyle: TerminalGlyphStyle;
  readbackStrategy: ThreeAsciiReadbackStrategy;
  deferredReadbackSlots: number;
}

export const DEFAULT_THREE_ASCII_PIXEL_ASPECT_RATIO = 0.5;
export const DEFAULT_THREE_ASCII_TERMINAL_EDGE_BIAS = 1;
export const DEFAULT_THREE_ASCII_DEFERRED_READBACK_SLOTS = 6;

export function normalizeThreeAsciiRenderSize(columns: number, rows: number): ThreeAsciiRenderSize {
  return {
    columns: Math.max(1, Math.floor(columns)),
    rows: Math.max(1, Math.floor(rows)),
  };
}

export function normalizeThreeAsciiTerminalEdgeBias(value?: number): number {
  return Math.max(0.5, value ?? DEFAULT_THREE_ASCII_TERMINAL_EDGE_BIAS);
}

export function normalizeThreeAsciiRendererOptions(
  options: ThreeAsciiRendererOptionSource,
): NormalizedThreeAsciiRendererOptions {
  const size = normalizeThreeAsciiRenderSize(options.columns, options.rows);
  return {
    ...size,
    pixelAspectRatio: options.pixelAspectRatio ?? DEFAULT_THREE_ASCII_PIXEL_ASPECT_RATIO,
    terminalEdgeBias: normalizeThreeAsciiTerminalEdgeBias(options.terminalEdgeBias),
    terminalGlyphStyle: options.terminalGlyphStyle ?? "blocks",
    readbackStrategy: options.readbackStrategy ?? "blocking",
    deferredReadbackSlots: options.deferredReadbackSlots ?? DEFAULT_THREE_ASCII_DEFERRED_READBACK_SLOTS,
  };
}
