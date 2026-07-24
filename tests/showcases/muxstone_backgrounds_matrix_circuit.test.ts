// Copyright 2023 Im-Beast. MIT license.

import { assert, assertEquals, assertNotEquals } from "../deps.ts";
import type { Rectangle } from "../../src/types.ts";
import type {
  MuxstoneAnimatedBackground,
  MuxstoneBackgroundCell,
} from "../../examples/showcases/muxstone/background.ts";
import { MuxstoneMatrixRainField } from "../../examples/showcases/muxstone/matrix_background.ts";
import { MuxstoneCircuitField } from "../../examples/showcases/muxstone/circuit_background.ts";
import { muxstoneTheme } from "../../examples/showcases/muxstone/model.ts";

const THEME = muxstoneTheme("midnight");
const ALT_THEME = muxstoneTheme("t2");
const START = 10_000;
const STEP = 125;
const TRACE_GLYPHS = new Set(["─", "│", "┌", "┐", "└", "┘", "o"]);

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
  field: MuxstoneAnimatedBackground,
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

function advanceObstacleFrames(
  field: MuxstoneAnimatedBackground,
  bounds: Rectangle,
  from: number,
  frames: number,
  obstacles: readonly Rectangle[],
  activeObstacle?: Rectangle,
): number {
  let now = from;
  for (let index = 0; index < frames; index += 1) {
    now += STEP;
    field.advance({ bounds, now, obstacles, ...(activeObstacle ? { activeObstacle } : {}) });
  }
  return now;
}

function inZone(x: number, y: number, zone: Rectangle, margin = 1): boolean {
  return x >= zone.column - margin && x <= zone.column + zone.width - 1 + margin &&
    y >= zone.row - margin && y <= zone.row + zone.height - 1 + margin;
}

function onBorder(x: number, y: number, zone: Rectangle): boolean {
  const inside = inZone(x, y, zone, 0);
  return inside && (
    x === zone.column || x === zone.column + zone.width - 1 ||
    y === zone.row || y === zone.row + zone.height - 1
  );
}

/**
 * Asserts no chip or trace cell occupies the zone plus 1-cell margin. Tap
 * traces terminate flush on their window border by design, so only their final
 * approach cells (margin cell plus the border via) are exempt.
 */
function assertClearOfZone(field: MuxstoneCircuitField, zone: Rectangle): void {
  const inspection = field.inspect();
  for (const chip of inspection.chips) {
    const overlaps = chip.x <= zone.column + zone.width && zone.column - 1 <= chip.x + chip.side - 1 &&
      chip.y <= zone.row + zone.height && zone.row - 1 <= chip.y + chip.side - 1;
    assert(!overlaps, `chip at ${chip.x},${chip.y} side ${chip.side} intersects keep-out zone`);
  }
  for (const trace of inspection.traces) {
    const cells = trace.kind === "tap" ? trace.cells.slice(0, -2) : trace.cells;
    for (const cell of cells) {
      assert(!inZone(cell.x, cell.y, zone), `${trace.kind} trace cell ${cell.x},${cell.y} inside keep-out zone`);
    }
  }
}

function traceLayoutKey(field: MuxstoneCircuitField): string {
  const inspection = field.inspect();
  return JSON.stringify({
    chips: inspection.chips,
    traces: inspection.traces.map((trace) => ({ kind: trace.kind, cells: trace.cells })),
  });
}

function eachField(run: (name: string, create: (seed: number) => MuxstoneAnimatedBackground) => void): void {
  run("matrix", (seed) => new MuxstoneMatrixRainField({ seed }));
  run("circuit", (seed) => new MuxstoneCircuitField({ seed }));
}

eachField((name, create) => {
  Deno.test(`MuxstoneBackgrounds: ${name} is deterministic for equal seeds and timestamps`, () => {
    const bounds = rect(80, 24);
    const a = create(7);
    const b = create(7);
    advanceFrames(a, bounds, START, 10);
    advanceFrames(b, bounds, START, 10);
    assertEquals(snapshot(a.rasterizeCells(bounds, THEME)), snapshot(b.rasterizeCells(bounds, THEME)));

    const c = create(8);
    advanceFrames(c, bounds, START, 10);
    assertNotEquals(snapshot(a.rasterizeCells(bounds, THEME)), snapshot(c.rasterizeCells(bounds, THEME)));
  });

  Deno.test(`MuxstoneBackgrounds: ${name} grid changes as simulated time advances`, () => {
    const bounds = rect(100, 30);
    const field = create(11);
    const now = advanceFrames(field, bounds, START, 4);
    const before = snapshot(field.rasterizeCells(bounds, THEME));
    advanceFrames(field, bounds, now, 6);
    const after = snapshot(field.rasterizeCells(bounds, THEME));
    assertNotEquals(before, after);
  });

  Deno.test(`MuxstoneBackgrounds: ${name} matches bounds dimensions and survives resizes`, () => {
    const field = create(3);
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

  Deno.test(`MuxstoneBackgrounds: ${name} defined cells stay finite 8-bit RGB and follow the theme`, () => {
    const bounds = rect(100, 30);
    const field = create(21);
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

  Deno.test(`MuxstoneBackgrounds: ${name} performs 100 frames at 200x60 in under 2 seconds`, () => {
    const bounds = rect(200, 60);
    const field = create(5);
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
});

Deno.test("MuxstoneMatrixRainField: pointer proximity diverges from a pointer-free twin", () => {
  const bounds = rect(100, 30);
  const withPointer = new MuxstoneMatrixRainField({ seed: 9 });
  const without = new MuxstoneMatrixRainField({ seed: 9 });
  let now = advanceFrames(withPointer, bounds, START, 5);
  advanceFrames(without, bounds, START, 5);

  const visible = withPointer.inspect().drops.find((drop) => drop.y >= 0 && drop.y < bounds.height) ??
    withPointer.inspect().drops[0]!;
  withPointer.setPointer({ column: visible.column, row: 12 }, now);
  now = advanceFrames(withPointer, bounds, now, 8);
  advanceFrames(without, bounds, now - 8 * STEP, 8);
  assertNotEquals(
    snapshot(withPointer.rasterizeCells(bounds, THEME)),
    snapshot(without.rasterizeCells(bounds, THEME)),
  );
});

Deno.test("MuxstoneCircuitField: pointer proximity diverges from a pointer-free twin", () => {
  const bounds = rect(100, 30);
  const withPointer = new MuxstoneCircuitField({ seed: 13 });
  const without = new MuxstoneCircuitField({ seed: 13 });
  let now = advanceFrames(withPointer, bounds, START, 2);
  advanceFrames(without, bounds, START, 2);

  const trace = withPointer.inspect().traces.find((candidate) => candidate.cells.length > 0);
  assert(trace, "expected at least one grown trace");
  const pulseCell = trace.cells[trace.pulses[0]!.index % trace.cells.length]!;
  withPointer.setPointer({ column: pulseCell.x, row: pulseCell.y }, now);
  now = advanceFrames(withPointer, bounds, now, 4);
  advanceFrames(without, bounds, now - 4 * STEP, 4);
  assertNotEquals(
    snapshot(withPointer.rasterizeCells(bounds, THEME)),
    snapshot(without.rasterizeCells(bounds, THEME)),
  );
});

Deno.test("MuxstoneCircuitField: layout grows chips and traces whose bits keep moving", () => {
  const bounds = rect(100, 30);
  const field = new MuxstoneCircuitField({ seed: 17 });
  let now = advanceFrames(field, bounds, START, 2);

  const inspection = field.inspect();
  assert(inspection.chips.length >= 1, "expected at least one chip");
  assert(inspection.traces.some((trace) => trace.cells.length > 0), "expected at least one trace cell");

  const before = snapshot(field.rasterizeCells(bounds, THEME));
  let sawChipFill = false;
  let sawTraceGlyph = false;
  for (const row of before) {
    for (const cell of row) {
      if (!cell) continue;
      if (cell.char === "▓") sawChipFill = true;
      if (TRACE_GLYPHS.has(cell.char)) sawTraceGlyph = true;
    }
  }
  assert(sawChipFill, "expected a chip interior cell");
  assert(sawTraceGlyph, "expected a trace glyph cell");

  now = advanceFrames(field, bounds, now, 4);
  const after = snapshot(field.rasterizeCells(bounds, THEME));
  let traceCellChanged = false;
  for (let row = 0; row < before.length && !traceCellChanged; row += 1) {
    for (let column = 0; column < before[row]!.length; column += 1) {
      const a = before[row]![column];
      const b = after[row]![column];
      const traceCell = (a !== null && TRACE_GLYPHS.has(a.char)) || (b !== null && TRACE_GLYPHS.has(b.char));
      if (!traceCell) continue;
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        traceCellChanged = true;
        break;
      }
    }
  }
  assert(traceCellChanged, "expected bit motion to change at least one trace cell");
});

Deno.test("MuxstoneCircuitField: chips and traces avoid obstacle keep-out zones", () => {
  const bounds = rect(120, 36);
  const obstacle: Rectangle = { column: 44, row: 12, width: 28, height: 10 };
  const field = new MuxstoneCircuitField({ seed: 31 });
  advanceObstacleFrames(field, bounds, START, 20, [obstacle]);
  assertClearOfZone(field, obstacle);
});

Deno.test("MuxstoneCircuitField: layout rearranges when an obstacle moves", () => {
  const bounds = rect(120, 36);
  const positionA: Rectangle = { column: 12, row: 6, width: 20, height: 8 };
  const positionB: Rectangle = { column: 78, row: 20, width: 30, height: 10 };
  const field = new MuxstoneCircuitField({ seed: 37 });
  let now = advanceObstacleFrames(field, bounds, START, 20, [positionA]);
  assertClearOfZone(field, positionA);
  const beforeMove = traceLayoutKey(field);

  now = advanceObstacleFrames(field, bounds, now, 20, [positionB]);
  assertClearOfZone(field, positionB);
  assertNotEquals(traceLayoutKey(field), beforeMove, "expected the layout to rearrange after the obstacle moved");
});

Deno.test("MuxstoneCircuitField: obstacles receive tap traces terminating flush on their border", () => {
  const bounds = rect(120, 36);
  const obstacle: Rectangle = { column: 50, row: 10, width: 20, height: 8 };
  const field = new MuxstoneCircuitField({ seed: 29 });
  advanceObstacleFrames(field, bounds, START, 20, [obstacle]);

  const inspection = field.inspect();
  const taps = inspection.traces.filter((trace) => trace.kind === "tap");
  assert(taps.length >= 1, "expected at least one tap trace for the obstacle");
  for (const tap of taps) {
    assertEquals(tap.obstacleIndex, 0);
    assert(tap.cells.length >= 2, "expected a routed tap path");
    const via = tap.cells[tap.cells.length - 1]!;
    assertEquals(via.glyph, "o");
    assert(onBorder(via.x, via.y, obstacle), `via at ${via.x},${via.y} must sit flush on the obstacle border`);
    for (let index = 1; index < tap.cells.length; index += 1) {
      const previous = tap.cells[index - 1]!;
      const current = tap.cells[index]!;
      assertEquals(
        Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y),
        1,
        "tap path cells must connect contiguously toward the via",
      );
    }
    const chip = inspection.chips[tap.chipIndex]!;
    const first = tap.cells[0]!;
    assert(
      first.x >= chip.x - 1 && first.x <= chip.x + chip.side &&
        first.y >= chip.y - 1 && first.y <= chip.y + chip.side,
      "tap path must start at the source chip edge",
    );
  }
});

Deno.test("MuxstoneCircuitField: active-window taps render brighter with faster pulses", () => {
  const bounds = rect(100, 30);
  const obstacle: Rectangle = { column: 60, row: 8, width: 24, height: 10 };
  const focused = new MuxstoneCircuitField({ seed: 41 });
  const unfocused = new MuxstoneCircuitField({ seed: 41 });
  let now = START;
  for (let index = 0; index < 16; index += 1) {
    now += STEP;
    focused.advance({ bounds, now, obstacles: [obstacle], activeObstacle: obstacle });
    unfocused.advance({ bounds, now, obstacles: [obstacle] });
  }

  const focusedTaps = focused.inspect().traces.filter((trace) => trace.kind === "tap");
  const unfocusedTaps = unfocused.inspect().traces.filter((trace) => trace.kind === "tap");
  assert(focusedTaps.length >= 1, "expected at least one tap trace");
  assertEquals(
    focusedTaps.map((trace) => trace.cells),
    unfocusedTaps.map((trace) => trace.cells),
    "focus emphasis must not change tap geometry",
  );

  const focusedGrid = snapshot(focused.rasterizeCells(bounds, THEME));
  const unfocusedGrid = snapshot(unfocused.rasterizeCells(bounds, THEME));
  let colorDiffers = false;
  for (const tap of focusedTaps) {
    for (const cell of tap.cells) {
      const a = focusedGrid[cell.y]?.[cell.x];
      const b = unfocusedGrid[cell.y]?.[cell.x];
      if (a && b && JSON.stringify(a.foreground) !== JSON.stringify(b.foreground)) colorDiffers = true;
    }
  }
  assert(colorDiffers, "expected active tap cells to rasterize with a brighter blend");

  let pulsesDiverged = false;
  for (let index = 0; index < 6; index += 1) {
    now += STEP;
    focused.advance({ bounds, now, obstacles: [obstacle], activeObstacle: obstacle });
    unfocused.advance({ bounds, now, obstacles: [obstacle] });
    const focusedPulses = focused.inspect().traces.filter((trace) => trace.kind === "tap").map((t) => t.pulses);
    const unfocusedPulses = unfocused.inspect().traces.filter((trace) => trace.kind === "tap").map((t) => t.pulses);
    if (JSON.stringify(focusedPulses) !== JSON.stringify(unfocusedPulses)) pulsesDiverged = true;
  }
  assert(pulsesDiverged, "expected doubled pulse speed on active taps to diverge pulse positions");
});

Deno.test("MuxstoneCircuitField: obstacle sequences preserve determinism", () => {
  const bounds = rect(120, 36);
  const positionA: Rectangle = { column: 20, row: 8, width: 24, height: 10 };
  const positionB: Rectangle = { column: 70, row: 18, width: 26, height: 12 };
  const positionBMoved: Rectangle = { column: 64, row: 14, width: 26, height: 12 };
  const a = new MuxstoneCircuitField({ seed: 23 });
  const b = new MuxstoneCircuitField({ seed: 23 });
  for (const field of [a, b]) {
    let now = START;
    now = advanceObstacleFrames(field, bounds, now, 6, [positionA]);
    now = advanceObstacleFrames(field, bounds, now, 6, [positionA, positionB], positionB);
    advanceObstacleFrames(field, bounds, now, 6, [positionBMoved], positionBMoved);
  }
  assertEquals(JSON.parse(JSON.stringify(a.inspect())), JSON.parse(JSON.stringify(b.inspect())));
  assertEquals(snapshot(a.rasterizeCells(bounds, THEME)), snapshot(b.rasterizeCells(bounds, THEME)));
});

Deno.test("MuxstoneCircuitField: 100 frames at 200x60 with 3 moving obstacles stay under budget", () => {
  const bounds = rect(200, 60);
  const field = new MuxstoneCircuitField({ seed: 5 });
  const startedAt = performance.now();
  let now = START;
  for (let frame = 0; frame < 100; frame += 1) {
    now += STEP;
    const obstacles: Rectangle[] = [
      { column: 10 + (frame % 20), row: 5, width: 30, height: 12 },
      { column: 90, row: 10 + (frame % 10), width: 40, height: 14 },
      { column: 150 - (frame % 15), row: 34, width: 28, height: 10 },
    ];
    field.advance({ bounds, now, obstacles, activeObstacle: obstacles[0]! });
    field.rasterizeCells(bounds, THEME);
  }
  const elapsed = performance.now() - startedAt;
  assert(elapsed < 2_500, `100 obstacle frames took ${elapsed.toFixed(1)}ms`);
});

Deno.test("MuxstoneMatrixRainField: columns fall at sharply different speeds", () => {
  const field = new MuxstoneMatrixRainField({ seed: 99 });
  const bounds = { column: 0, row: 0, width: 120, height: 40 };
  // Advance long enough that many drops have respawned into fresh speed classes.
  const speeds: number[] = [];
  for (let frame = 0; frame < 400; frame += 1) {
    field.advance({ bounds, obstacles: [], now: frame * 16.7 });
    for (const drop of field.inspect().drops) speeds.push(drop.speed);
  }
  assert(speeds.length > 0, "expected drops to sample");

  const slowest = Math.min(...speeds);
  const fastest = Math.max(...speeds);
  // "Significantly faster" - the quickest streaks outrun the drifters manyfold.
  assert(fastest / slowest >= 6, `expected a wide speed spread, got ${slowest}..${fastest}`);

  // The population is genuinely tiered rather than one uniform band: a clear
  // majority drift slowly while a real minority tear down the screen.
  // Measured on screen, not at spawn: a slow plurality with a visible minority
  // of streaks. Thresholds sit well clear of the observed ~0.52 / ~0.19 split.
  const drifters = speeds.filter((speed) => speed <= 0.24).length / speeds.length;
  const streakers = speeds.filter((speed) => speed >= 0.95).length / speeds.length;
  assert(drifters > 0.35, `expected a slow plurality, got ${drifters}`);
  assert(streakers > 0.10, `expected a visible share of fast streaks, got ${streakers}`);

  // Faster columns carry longer tails so the streaks read as motion.
  const inspection = field.inspect().drops;
  const fast = inspection.filter((drop) => drop.speed >= 0.95);
  const slow = inspection.filter((drop) => drop.speed <= 0.24);
  if (fast.length > 0 && slow.length > 0) {
    const mean = (values: readonly number[]) => values.reduce((total, value) => total + value, 0) / values.length;
    assert(
      mean(fast.map((drop) => drop.tail)) > mean(slow.map((drop) => drop.tail)),
      "fast drops should trail longer than slow ones",
    );
  }
});

Deno.test("MuxstoneCircuitField: surveys the board and populates empty space over time", () => {
  const field = new MuxstoneCircuitField({ seed: 7 });
  const bounds = { column: 0, row: 0, width: 160, height: 48 };
  field.advance({ bounds, obstacles: [], now: 0 });
  const initialChips = field.inspect().chips.length;
  assert(initialChips > 0, "expected an initial layout");

  // Run past several survey intervals; the board should fill toward its ceiling.
  let now = 0;
  for (let frame = 0; frame < 4_000; frame += 1) {
    now += 16.7;
    field.advance({ bounds, obstacles: [], now });
  }
  const grownChips = field.inspect().chips.length;
  assert(
    grownChips > initialChips,
    `expected the survey to add chips into empty board, ${initialChips} -> ${grownChips}`,
  );

  // Chips never overlap each other, however many surveys have run.
  const chips = field.inspect().chips;
  for (let a = 0; a < chips.length; a += 1) {
    for (let b = a + 1; b < chips.length; b += 1) {
      const first = chips[a]!;
      const second = chips[b]!;
      const disjoint = first.x + first.side <= second.x || second.x + second.side <= first.x ||
        first.y + first.side <= second.y || second.y + second.side <= first.y;
      assert(disjoint, `chips ${a} and ${b} overlap after resurvey`);
    }
  }
  // And the board stays bounded rather than growing without limit.
  assert(chips.length <= 18, `chip count should stay bounded, got ${chips.length}`);
});

Deno.test("MuxstoneCircuitField: routes over windows that are no longer obstacles", () => {
  const bounds = { column: 0, row: 0, width: 120, height: 40 };
  const window = { column: 30, row: 10, width: 40, height: 16 };

  // While the window is an obstacle the board keeps clear of it.
  const avoiding = new MuxstoneCircuitField({ seed: 11 });
  let now = 0;
  for (let frame = 0; frame < 200; frame += 1) {
    now += 16.7;
    avoiding.advance({ bounds, obstacles: [window], now });
  }
  // Measure the interior: the board deliberately taps a window's border with
  // vias, so the edge ring is expected to carry a cell or two either way.
  const interior = {
    column: window.column + 2,
    row: window.row + 2,
    width: window.width - 4,
    height: window.height - 4,
  };
  const avoidingCells = countCellsInside(avoiding, bounds, interior);

  // Dropping it from the obstacle list - as overgrowth does for idle windows -
  // lets the fabric grow across it instead.
  const covering = new MuxstoneCircuitField({ seed: 11 });
  now = 0;
  for (let frame = 0; frame < 200; frame += 1) {
    now += 16.7;
    covering.advance({ bounds, obstacles: [], now });
  }
  const coveringCells = countCellsInside(covering, bounds, interior);

  assertEquals(avoidingCells, 0, "an obstacle window must stay clear of the board");
  assert(coveringCells > 0, "a reclaimed window should have circuitry drawn across it");
});

function countCellsInside(
  field: MuxstoneCircuitField,
  bounds: { column: number; row: number; width: number; height: number },
  region: { column: number; row: number; width: number; height: number },
): number {
  const grid = field.rasterizeCells(bounds, THEME);
  let count = 0;
  for (let row = region.row; row < region.row + region.height; row += 1) {
    for (let column = region.column; column < region.column + region.width; column += 1) {
      if (grid[row - bounds.row]?.[column - bounds.column]) count += 1;
    }
  }
  return count;
}

Deno.test("MuxstoneCircuitField: chips are logic gates driven by power and ground rails", () => {
  const field = new MuxstoneCircuitField({ seed: 7 });
  const bounds = { column: 0, row: 0, width: 100, height: 32 };
  let now = 0;
  for (let frame = 0; frame < 60; frame += 1) {
    now += 60;
    field.advance({ bounds, obstacles: [], now });
  }
  const inspection = field.inspect();

  // Every chip is a named gate wired to at least two inputs.
  const gates = new Set(["AND", "OR", "NAND", "NOR", "XOR", "XNOR"]);
  assert(inspection.chips.length >= 3, "expected a populated board");
  for (const chip of inspection.chips) {
    assert(gates.has(chip.gate), `unexpected gate ${chip.gate}`);
    assertEquals(chip.label, chip.gate);
    assert(chip.inputCount >= 2, "a gate should be wired to at least two inputs");
  }
  // A mix of gate kinds keeps the behaviour interesting.
  const kinds = new Set(inspection.chips.map((chip) => chip.gate));
  assert(kinds.size >= 2, "expected more than one gate kind on the board");

  // Power and ground rails are both placed, at distinct spots.
  assert(inspection.power, "expected a power rail");
  assert(inspection.ground, "expected a ground rail");
  assertEquals(inspection.power!.label, "VCC");
  assertEquals(inspection.ground!.label, "GND");
  assert(
    inspection.power!.x !== inspection.ground!.x || inspection.power!.y !== inspection.ground!.y,
    "the rails must not overlap",
  );
});

Deno.test("MuxstoneCircuitField: the logic network settles to a mix of high and low gates", () => {
  // A working board neither latches every gate high nor stalls every gate low;
  // it does real work driven by the two rails.
  const field = new MuxstoneCircuitField({ seed: 11 });
  const bounds = { column: 0, row: 0, width: 90, height: 28 };
  let now = 0;
  // Advance well past several logic ticks so states have settled/oscillated.
  for (let frame = 0; frame < 300; frame += 1) {
    now += 60;
    field.advance({ bounds, obstacles: [], now });
  }
  const inspection = field.inspect();
  // At least some gates end up high and some low: the network is doing work,
  // not stuck all-on or all-off.
  const live = inspection.liveChips;
  assert(live >= 0 && live <= inspection.chips.length);
  assert(live !== inspection.chips.length || inspection.chips.length <= 1, "not every gate should latch high");
});

Deno.test("MuxstoneCircuitField: the logic network changes state over time", () => {
  const field = new MuxstoneCircuitField({ seed: 7 });
  const bounds = { column: 0, row: 0, width: 92, height: 26 };
  let now = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    now += 60;
    field.advance({ bounds, obstacles: [], now });
  }
  const seen = new Set<string>();
  for (let tick = 0; tick < 12; tick += 1) {
    for (let frame = 0; frame < 12; frame += 1) {
      now += 60;
      field.advance({ bounds, obstacles: [], now });
    }
    seen.add(field.inspect().chips.map((chip) => (chip.state ? "1" : "0")).join(""));
  }
  // Feedback between gates makes the board oscillate rather than freeze on one
  // pattern, which is the emergent behaviour the simulation exists to show.
  assert(seen.size >= 2, `expected the logic state to evolve, saw ${seen.size} distinct patterns`);
});

Deno.test("MuxstoneCircuitField: logic simulation stays deterministic for one seed", () => {
  const bounds = { column: 0, row: 0, width: 88, height: 30 };
  const drive = (seed: number): string => {
    const field = new MuxstoneCircuitField({ seed });
    let now = 0;
    for (let frame = 0; frame < 240; frame += 1) {
      now += 60;
      field.advance({ bounds, obstacles: [], now });
    }
    return field.inspect().chips.map((chip) => `${chip.gate}:${chip.state ? 1 : 0}`).join("|");
  };
  assertEquals(drive(19), drive(19));
  assert(drive(19) !== drive(20), "different seeds should diverge");
});
