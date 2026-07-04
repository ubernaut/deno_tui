import { Color } from "npm:three@0.183.2";

import { assertEquals } from "./deps.ts";
import type { ThreeAsciiAnsiGridInput } from "../src/three_ascii/ansi_grid.ts";
import {
  assembleThreeAsciiReadbackGrid,
  assembleThreeAsciiReadbackGridWithContext,
} from "../src/three_ascii/readback_assembly.ts";
import type { ThreeAsciiReadbackLayout, ThreeAsciiReadbackViews } from "../src/three_ascii/readback.ts";

Deno.test("assembleThreeAsciiReadbackGrid resolves views and delegates assembler input", () => {
  const source = new ArrayBuffer(64);
  const layout: ThreeAsciiReadbackLayout = {
    fillOffset: 0,
    edgeOffset: 4,
    colorOffset: 20,
    byteLength: 36,
    fillFloatLength: 1,
    edgeFloatLength: 4,
    colorFloatLength: 4,
  };
  const views: ThreeAsciiReadbackViews = {
    fillGlyphs: new Float32Array([14]),
    edgeGlyphs: new Float32Array([0, 0, 0, 0]),
    colors: new Float32Array([1, 0.5, 0.25, 1]),
  };
  const backgroundColor = new Color("#102030");
  const grid = [["\x1b[38;2;255;128;64m█\x1b[0m"]];
  const calls: string[] = [];
  let resolvedSource: ArrayBuffer | undefined;
  let resolvedLayout: ThreeAsciiReadbackLayout | undefined;
  let assemblerInput: ThreeAsciiAnsiGridInput | undefined;
  const times = [20, 27];

  const result = assembleThreeAsciiReadbackGrid({
    source,
    layout,
    viewCache: {
      resolve(actualSource, actualLayout) {
        calls.push("resolve");
        resolvedSource = actualSource;
        resolvedLayout = actualLayout;
        return views;
      },
    },
    assembler: {
      build(input) {
        calls.push("build");
        assemblerInput = input;
        return grid;
      },
    },
    columns: 1,
    rows: 1,
    terminalGlyphStyle: "blocks",
    terminalEdgeBias: 2,
    backgroundColor,
    now: () => times.shift() ?? 27,
  });

  assertEquals(calls, ["resolve", "build"]);
  assertEquals(resolvedSource, source);
  assertEquals(resolvedLayout, layout);
  assertEquals(assemblerInput, {
    columns: 1,
    rows: 1,
    fillGlyphs: views.fillGlyphs,
    edgeGlyphs: views.edgeGlyphs,
    colors: views.colors,
    terminalGlyphStyle: "blocks",
    terminalEdgeBias: 2,
    backgroundColor,
  });
  assertEquals(result, {
    grid,
    assemblyMs: 7,
  });
});

Deno.test("assembleThreeAsciiReadbackGridWithContext reuses retained assembly dependencies", () => {
  const source = new ArrayBuffer(64);
  const layout: ThreeAsciiReadbackLayout = {
    fillOffset: 0,
    edgeOffset: 4,
    colorOffset: 20,
    byteLength: 36,
    fillFloatLength: 1,
    edgeFloatLength: 4,
    colorFloatLength: 4,
  };
  const views: ThreeAsciiReadbackViews = {
    fillGlyphs: new Float32Array([1]),
    edgeGlyphs: new Float32Array([2, 3, 4, 5]),
    colors: new Float32Array([0, 0, 0, 1]),
  };
  const backgroundColor = new Color("#000000");
  const grid = [[" "]];
  const calls: string[] = [];
  const times = [100, 104.5];

  const context = {
    viewCache: {
      resolve(actualSource: ArrayBuffer, actualLayout: ThreeAsciiReadbackLayout) {
        calls.push(actualSource === source && actualLayout === layout ? "resolve" : "bad-resolve");
        return views;
      },
    },
    assembler: {
      build(input: ThreeAsciiAnsiGridInput) {
        calls.push(input.terminalGlyphStyle === "glyphs" ? "build" : "bad-build");
        return grid;
      },
    },
    now: () => times.shift() ?? 104.5,
  };

  const result = assembleThreeAsciiReadbackGridWithContext(context, {
    source,
    layout,
    columns: 1,
    rows: 1,
    terminalGlyphStyle: "glyphs",
    terminalEdgeBias: 0.5,
    backgroundColor,
  });

  assertEquals(calls, ["resolve", "build"]);
  assertEquals(result, {
    grid,
    assemblyMs: 4.5,
  });
});
