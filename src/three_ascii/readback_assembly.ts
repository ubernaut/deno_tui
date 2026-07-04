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

export interface ThreeAsciiReadbackGridAssemblyResult {
  grid: string[][];
  assemblyMs: number;
}

/** Resolves packed GPU readback views and assembles a terminal ANSI grid. */
export function assembleThreeAsciiReadbackGrid(
  input: ThreeAsciiReadbackGridAssemblyInput,
): ThreeAsciiReadbackGridAssemblyResult {
  const now = input.now ?? (() => performance.now());
  const assemblyStart = now();
  const views = input.viewCache.resolve(input.source, input.layout);
  const grid = input.assembler.build({
    columns: input.columns,
    rows: input.rows,
    fillGlyphs: views.fillGlyphs,
    edgeGlyphs: views.edgeGlyphs,
    colors: views.colors,
    terminalGlyphStyle: input.terminalGlyphStyle,
    terminalEdgeBias: input.terminalEdgeBias,
    backgroundColor: input.backgroundColor,
  });

  return {
    grid,
    assemblyMs: now() - assemblyStart,
  };
}
