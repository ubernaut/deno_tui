// Copyright 2023 Im-Beast. MIT license.
import type { Color } from "npm:three@0.183.2";

import type { ThreeAsciiAnsiGridInput } from "./ansi_grid.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";
import type { ThreeAsciiReadbackLayout, ThreeAsciiReadbackViews } from "./readback.ts";

export interface ThreeAsciiReadbackViewResolver {
  resolve(source: ArrayBuffer, layout: ThreeAsciiReadbackLayout): ThreeAsciiReadbackViews;
}

export interface ThreeAsciiGridAssembler {
  build(input: ThreeAsciiAnsiGridInput): string[][];
}

export interface ThreeAsciiReadbackGridAssemblyInput {
  source: ArrayBuffer;
  layout: ThreeAsciiReadbackLayout;
  viewCache: ThreeAsciiReadbackViewResolver;
  assembler: ThreeAsciiGridAssembler;
  columns: number;
  rows: number;
  terminalGlyphStyle: TerminalGlyphStyle;
  terminalEdgeBias: number;
  backgroundColor: Color;
  now?: () => number;
}

export interface ThreeAsciiReadbackGridAssemblyContext {
  viewCache: ThreeAsciiReadbackViewResolver;
  assembler: ThreeAsciiGridAssembler;
  now?: () => number;
}

export interface ThreeAsciiReadbackGridAssemblyFrame {
  source: ArrayBuffer;
  layout: ThreeAsciiReadbackLayout;
  columns: number;
  rows: number;
  terminalGlyphStyle: TerminalGlyphStyle;
  terminalEdgeBias: number;
  backgroundColor: Color;
}

export interface ThreeAsciiReadbackGridAssemblyResult {
  grid: string[][];
  assemblyMs: number;
}

/** Resolves packed GPU readback views and assembles a terminal ANSI grid. */
export function assembleThreeAsciiReadbackGrid(
  input: ThreeAsciiReadbackGridAssemblyInput,
): ThreeAsciiReadbackGridAssemblyResult {
  return assembleThreeAsciiReadbackGridWithContext({
    viewCache: input.viewCache,
    assembler: input.assembler,
    now: input.now,
  }, input);
}

/** Resolves packed GPU readback views using retained renderer context. */
export function assembleThreeAsciiReadbackGridWithContext(
  context: ThreeAsciiReadbackGridAssemblyContext,
  frame: ThreeAsciiReadbackGridAssemblyFrame,
): ThreeAsciiReadbackGridAssemblyResult {
  const now = context.now ?? (() => performance.now());
  const assemblyStart = now();
  const views = context.viewCache.resolve(frame.source, frame.layout);
  const grid = context.assembler.build({
    columns: frame.columns,
    rows: frame.rows,
    fillGlyphs: views.fillGlyphs,
    edgeGlyphs: views.edgeGlyphs,
    colors: views.colors,
    terminalGlyphStyle: frame.terminalGlyphStyle,
    terminalEdgeBias: frame.terminalEdgeBias,
    backgroundColor: frame.backgroundColor,
    blockVisibilityFromColorAlpha: frame.layout.fillFloatLength === 0 && frame.terminalGlyphStyle === "blocks",
  });

  return {
    grid,
    assemblyMs: now() - assemblyStart,
  };
}
