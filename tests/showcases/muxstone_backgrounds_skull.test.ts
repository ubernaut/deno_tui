// Copyright 2023 Im-Beast. MIT license.

import { assert, assertEquals, assertNotEquals } from "../deps.ts";
import type { Rectangle } from "../../src/types.ts";
import type { MuxstoneBackgroundCell } from "../../examples/showcases/muxstone/background.ts";
import { MuxstoneSkullField } from "../../examples/showcases/muxstone/skull_background.ts";
import { muxstoneTheme } from "../../examples/showcases/muxstone/model.ts";

type Grid = ReadonlyArray<ReadonlyArray<MuxstoneBackgroundCell | undefined>>;

const BOUNDS: Rectangle = { column: 0, row: 0, width: 80, height: 24 };
const RESIZED: Rectangle = { column: 0, row: 0, width: 120, height: 40 };
const COVERAGE: Rectangle = { column: 0, row: 0, width: 120, height: 36 };
const MIDNIGHT = muxstoneTheme("midnight");
const T2 = muxstoneTheme("t2");
const STEP_MS = 40;

function advanceFor(field: MuxstoneSkullField, bounds: Rectangle, startAt: number, durationMs: number): number {
  let now = startAt;
  for (let elapsed = 0; elapsed < durationMs; elapsed += STEP_MS) {
    now += STEP_MS;
    field.advance({ bounds, now });
  }
  return now;
}

function snapshot(grid: Grid): string {
  return JSON.stringify(grid);
}

function definedCells(grid: Grid): MuxstoneBackgroundCell[] {
  const cells: MuxstoneBackgroundCell[] = [];
  for (const row of grid) {
    for (const cell of row) if (cell) cells.push(cell);
  }
  return cells;
}

function machineryRows(grid: Grid, rows: number): string {
  return JSON.stringify(grid.slice(0, rows));
}

function brightness(cell: MuxstoneBackgroundCell): number {
  return cell.foreground[0] + cell.foreground[1] + cell.foreground[2];
}

Deno.test("muxstone skull background: same seed and advance sequence are deterministic", () => {
  const first = new MuxstoneSkullField({ seed: 7 });
  const second = new MuxstoneSkullField({ seed: 7 });
  assert(first.advance({ bounds: BOUNDS, now: 1_000 }), "positive-delta frames must report change");
  assert(second.advance({ bounds: BOUNDS, now: 1_000 }));
  advanceFor(first, BOUNDS, 1_000, 2_000);
  advanceFor(second, BOUNDS, 1_000, 2_000);
  assertEquals(
    snapshot(first.rasterizeCells(BOUNDS, MIDNIGHT)),
    snapshot(second.rasterizeCells(BOUNDS, MIDNIGHT)),
    "same seed must match",
  );
  const different = new MuxstoneSkullField({ seed: 99 });
  different.advance({ bounds: BOUNDS, now: 1_000 });
  advanceFor(different, BOUNDS, 1_000, 2_000);
  assertNotEquals(
    snapshot(first.rasterizeCells(BOUNDS, MIDNIGHT)),
    snapshot(different.rasterizeCells(BOUNDS, MIDNIGHT)),
    "different seeds must diverge",
  );
});

Deno.test("muxstone skull background: exact grid dimensions and resize safety", () => {
  const field = new MuxstoneSkullField({ seed: 3 });
  const now = advanceFor(field, BOUNDS, 200, 400);
  const grid = field.rasterizeCells(BOUNDS, MIDNIGHT);
  assertEquals(grid.length, BOUNDS.height, "row count");
  for (const row of grid) assertEquals(row.length, BOUNDS.width, "column count");
  advanceFor(field, RESIZED, now, 400);
  const resized = field.rasterizeCells(RESIZED, MIDNIGHT);
  assertEquals(resized.length, RESIZED.height, "resized row count");
  for (const row of resized) assertEquals(row.length, RESIZED.width, "resized column count");
  assert(definedCells(resized).length > 0, "resized field still paints cells");
});

Deno.test("muxstone skull background: pupils track the pointer and recenter after idling", () => {
  const field = new MuxstoneSkullField({ seed: 11 });
  let now = advanceFor(field, BOUNDS, 100, 200);
  field.setPointer({ column: 1, row: 12 }, now);
  now = advanceFor(field, BOUNDS, now, 800);
  const left = field.inspect().pupilOffset;
  assert(left.x < -0.25, `far-left pointer must pull pupils left, got ${left.x}`);
  field.setPointer({ column: 78, row: 12 }, now);
  now = advanceFor(field, BOUNDS, now, 800);
  const right = field.inspect().pupilOffset;
  assert(right.x > 0.25, `far-right pointer must pull pupils right, got ${right.x}`);
  advanceFor(field, BOUNDS, now, 5_600);
  const idle = field.inspect().pupilOffset;
  assert(Math.abs(idle.x) < 0.15, `pupils must ease back toward center, got ${idle.x}`);
  assert(Math.abs(idle.x) < Math.abs(right.x), "idle offset must shrink");
});

Deno.test("muxstone skull background: seeded blinks close and reopen within twenty seconds", () => {
  const field = new MuxstoneSkullField({ seed: 5 });
  let now = 500;
  let sawBlink = false;
  let sawReopen = false;
  for (let elapsed = 0; elapsed < 20_000; elapsed += STEP_MS) {
    now += STEP_MS;
    field.advance({ bounds: BOUNDS, now });
    if (field.inspect().blinkActive) sawBlink = true;
    else if (sawBlink) sawReopen = true;
  }
  assert(sawBlink, "a blink must trigger within 20s of simulated time");
  assert(sawReopen, "eyes must reopen after blinking");
});

Deno.test("muxstone skull background: tube pulses move machinery cells between frames", () => {
  const field = new MuxstoneSkullField({ seed: 13 });
  const now = advanceFor(field, BOUNDS, 100, 1_000);
  assert(field.inspect().tubeCount > 0, "layout must contain tubes");
  assertEquals(field.inspect().blinkActive, false, "no blink at the first sample");
  const before = machineryRows(field.rasterizeCells(BOUNDS, MIDNIGHT), 3);
  advanceFor(field, BOUNDS, now, 1_000);
  assertEquals(field.inspect().blinkActive, false, "no blink at the second sample");
  const after = machineryRows(field.rasterizeCells(BOUNDS, MIDNIGHT), 3);
  assertNotEquals(before, after, "machinery cells must pulse while the pointer is unset");
});

Deno.test("muxstone skull background: dense coverage with a bright skull at the center", () => {
  const field = new MuxstoneSkullField({ seed: 9 });
  advanceFor(field, COVERAGE, 300, 400);
  const grid = field.rasterizeCells(COVERAGE, MIDNIGHT);
  const defined = definedCells(grid).length;
  const total = COVERAGE.width * COVERAGE.height;
  assert(defined >= total * 0.8, `coverage ${defined}/${total}`);
  const center = grid[Math.floor(COVERAGE.height / 2)]?.[Math.floor(COVERAGE.width / 2)];
  assert(center, "central cell must be painted");
  const machinery = grid.slice(0, 3).flatMap((row) =>
    row.filter((cell): cell is MuxstoneBackgroundCell => cell !== undefined)
  );
  assert(machinery.length > 0, "top rows must contain machinery cells");
  const machineryMean = machinery.reduce((sum, cell) => sum + brightness(cell), 0) / machinery.length;
  assert(
    brightness(center) > machineryMean + 60,
    `central skull cell must outshine machinery: ${brightness(center)} vs ${machineryMean.toFixed(1)}`,
  );
});

Deno.test("muxstone skull background: eye sockets sit in shadow deeper than the surrounding cheekbone", () => {
  const field = new MuxstoneSkullField({ seed: 21 });
  let now = advanceFor(field, COVERAGE, 200, 600);
  while (field.inspect().blinkActive) now = advanceFor(field, COVERAGE, now, STEP_MS);
  const grid = field.rasterizeCells(COVERAGE, MIDNIGHT);
  const eye = field.inspect().eyes[0];
  assert(eye, "layout must expose eye sockets");
  const row = Math.round(eye.row);
  const col = Math.round(eye.column);
  // Sample inside the socket but clear of the bright iris at its center.
  const socketCell = grid[row]?.[col - Math.round(eye.socketRadius * 0.55)];
  // Sample the bright cheekbone bone just below the socket.
  const cheekRow = row + Math.max(2, Math.round(eye.socketRadius * 0.6));
  const cheekCell = grid[cheekRow]?.[col];
  assert(socketCell, "socket-interior cell must be painted");
  assert(cheekCell, "cheek cell must be painted");
  assert(
    brightness(socketCell) < brightness(cheekCell),
    `deep-set socket must be darker than cheek: ${brightness(socketCell)} vs ${brightness(cheekCell)}`,
  );
});

Deno.test("muxstone skull background: cell colors are valid RGB and theme-dependent", () => {
  const field = new MuxstoneSkullField({ seed: 5 });
  advanceFor(field, BOUNDS, 900, 1_200);
  const midnightGrid = field.rasterizeCells(BOUNDS, MIDNIGHT);
  const cells = definedCells(midnightGrid);
  assert(cells.length > 0, "field paints at least one cell");
  for (const cell of cells) {
    assertEquals(cell.foreground.length, 3, "rgb tuple");
    for (const channel of cell.foreground) {
      assert(Number.isInteger(channel), "integer channel");
      assert(channel >= 0 && channel <= 255, "channel in range");
    }
  }
  const midnightSnapshot = snapshot(midnightGrid);
  assertNotEquals(midnightSnapshot, snapshot(field.rasterizeCells(BOUNDS, T2)), "theme must recolor the field");
});

Deno.test("muxstone skull background: 100 advance+rasterize frames at 200x60 stay under budget", () => {
  const large: Rectangle = { column: 0, row: 0, width: 200, height: 60 };
  const field = new MuxstoneSkullField({ seed: 29 });
  const startedAt = performance.now();
  let now = 1_000;
  for (let frame = 0; frame < 100; frame += 1) {
    now += STEP_MS;
    field.advance({ bounds: large, now });
    field.rasterizeCells(large, MIDNIGHT);
  }
  const elapsed = performance.now() - startedAt;
  assert(elapsed < 2_000, `100 frames took ${elapsed.toFixed(1)}ms`);
});
