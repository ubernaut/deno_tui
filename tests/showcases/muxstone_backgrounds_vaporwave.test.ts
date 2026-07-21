// Copyright 2023 Im-Beast. MIT license.

import { assert, assertEquals, assertNotEquals } from "../deps.ts";
import type { Rectangle } from "../../src/types.ts";
import type { MuxstoneBackgroundCell } from "../../examples/showcases/muxstone/background.ts";
import { MuxstoneVaporwaveField } from "../../examples/showcases/muxstone/vaporwave_background.ts";
import { muxstoneTheme } from "../../examples/showcases/muxstone/model.ts";

const THEME = muxstoneTheme("midnight");
const ALT_THEME = muxstoneTheme("t2");
const START = 10_000;
const STEP = 40;
const SUN_GLYPHS = new Set(["█", "▓", "▀", "▄"]);

type CellSnapshot = { char: string; foreground: readonly number[]; bold: boolean } | null;

function rect(width: number, height: number): Rectangle {
  return { column: 0, row: 0, width, height };
}

function snapshot(
  grid: ReadonlyArray<ReadonlyArray<MuxstoneBackgroundCell | undefined>>,
): CellSnapshot[][] {
  return grid.map((row) =>
    row.map((cell) => cell ? { char: cell.char, foreground: [...cell.foreground], bold: cell.bold ?? false } : null)
  );
}

function advanceFrames(
  field: MuxstoneVaporwaveField,
  bounds: Rectangle,
  from: number,
  frames: number,
): number {
  let now = from;
  for (let index = 0; index < frames; index += 1) {
    now += STEP;
    field.advance({ bounds, now });
  }
  return now;
}

function topmostSunRow(grid: CellSnapshot[][], horizonRow: number): number {
  for (let row = 0; row < horizonRow; row += 1) {
    if (grid[row]!.some((cell) => cell !== null && SUN_GLYPHS.has(cell.char))) return row;
  }
  return -1;
}

Deno.test("MuxstoneVaporwaveField: deterministic for equal seeds; different seeds diverge", () => {
  const bounds = rect(80, 24);
  const a = new MuxstoneVaporwaveField({ seed: 7 });
  const b = new MuxstoneVaporwaveField({ seed: 7 });
  advanceFrames(a, bounds, START, 12);
  advanceFrames(b, bounds, START, 12);
  assertEquals(snapshot(a.rasterizeCells(bounds, THEME)), snapshot(b.rasterizeCells(bounds, THEME)));

  const c = new MuxstoneVaporwaveField({ seed: 8 });
  advanceFrames(c, bounds, START, 12);
  assertNotEquals(snapshot(a.rasterizeCells(bounds, THEME)), snapshot(c.rasterizeCells(bounds, THEME)));
});

Deno.test("MuxstoneVaporwaveField: grid floor moves over ~500ms of simulated time", () => {
  const bounds = rect(100, 30);
  const field = new MuxstoneVaporwaveField({ seed: 11 });
  const now = advanceFrames(field, bounds, START, 4);
  const horizonRow = field.inspect().horizonRow!;
  const before = snapshot(field.rasterizeCells(bounds, THEME)).slice(horizonRow + 1);
  advanceFrames(field, bounds, now, 13);
  const after = snapshot(field.rasterizeCells(bounds, THEME)).slice(horizonRow + 1);
  assertNotEquals(before, after);
});

Deno.test("MuxstoneVaporwaveField: sun rises or sets across ~20s of simulated time", () => {
  const bounds = rect(80, 24);
  const field = new MuxstoneVaporwaveField({ seed: 5 });
  const now = advanceFrames(field, bounds, START, 3);
  const horizonRow = field.inspect().horizonRow!;
  const beforeTop = topmostSunRow(snapshot(field.rasterizeCells(bounds, THEME)), horizonRow);
  assert(beforeTop >= 0, "expected sun glyphs above the horizon");
  advanceFrames(field, bounds, now, 500);
  const afterTop = topmostSunRow(snapshot(field.rasterizeCells(bounds, THEME)), horizonRow);
  assertNotEquals(beforeTop, afterTop);
});

Deno.test("MuxstoneVaporwaveField: matches bounds dimensions and survives resizes", () => {
  const field = new MuxstoneVaporwaveField({ seed: 3 });
  const small = rect(80, 24);
  let now = advanceFrames(field, small, START, 3);
  const smallGrid = field.rasterizeCells(small, THEME);
  assertEquals(smallGrid.length, 24);
  for (const row of smallGrid) assertEquals(row.length, 80);

  const large = rect(120, 40);
  now = advanceFrames(field, large, now, 3);
  const largeGrid = field.rasterizeCells(large, THEME);
  assertEquals(largeGrid.length, 40);
  for (const row of largeGrid) assertEquals(row.length, 120);
});

Deno.test("MuxstoneVaporwaveField: pointer parallax diverges from a pointer-free twin", () => {
  const bounds = rect(100, 30);
  const withPointer = new MuxstoneVaporwaveField({ seed: 9 });
  const without = new MuxstoneVaporwaveField({ seed: 9 });
  let now = advanceFrames(withPointer, bounds, START, 5);
  advanceFrames(without, bounds, START, 5);

  withPointer.setPointer({ column: 88, row: 20 }, now);
  now = advanceFrames(withPointer, bounds, now, 12);
  advanceFrames(without, bounds, now - 12 * STEP, 12);

  const horizonRow = withPointer.inspect().horizonRow!;
  assertNotEquals(
    snapshot(withPointer.rasterizeCells(bounds, THEME)).slice(horizonRow + 1),
    snapshot(without.rasterizeCells(bounds, THEME)).slice(horizonRow + 1),
  );
});

Deno.test("MuxstoneVaporwaveField: defined cells stay finite 8-bit RGB and follow the theme", () => {
  const bounds = rect(100, 30);
  const field = new MuxstoneVaporwaveField({ seed: 21 });
  advanceFrames(field, bounds, START, 8);
  const midnight = snapshot(field.rasterizeCells(bounds, THEME));
  const neuralSteel = snapshot(field.rasterizeCells(bounds, ALT_THEME));

  let defined = 0;
  for (const grid of [midnight, neuralSteel]) {
    for (const row of grid) {
      for (const cell of row) {
        if (!cell) continue;
        defined += 1;
        assertEquals(cell.foreground.length, 3);
        for (const channel of cell.foreground) {
          assert(Number.isInteger(channel), `channel ${channel} must be an integer`);
          assert(channel >= 0 && channel <= 255, `channel ${channel} out of range`);
        }
      }
    }
  }
  assert(defined > 0, "expected at least one painted cell");
  assertNotEquals(midnight, neuralSteel);
});

Deno.test("MuxstoneVaporwaveField: covers at least 55% of a 100x30 desktop", () => {
  const bounds = rect(100, 30);
  const field = new MuxstoneVaporwaveField({ seed: 13 });
  advanceFrames(field, bounds, START, 6);
  const grid = snapshot(field.rasterizeCells(bounds, THEME));
  let defined = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell) defined += 1;
    }
  }
  assert(defined >= 0.55 * 100 * 30, `expected >=55% coverage, got ${defined} of 3000 cells`);
});

Deno.test("MuxstoneVaporwaveField: performs 100 frames at 200x60 in under 2 seconds", () => {
  const bounds = rect(200, 60);
  const field = new MuxstoneVaporwaveField({ seed: 5 });
  const startedAt = performance.now();
  let now = START;
  for (let index = 0; index < 100; index += 1) {
    now += STEP;
    field.advance({ bounds, now });
    field.rasterizeCells(bounds, THEME);
  }
  const elapsed = performance.now() - startedAt;
  assert(elapsed < 2_000, `100 frames took ${elapsed.toFixed(1)}ms`);
});
