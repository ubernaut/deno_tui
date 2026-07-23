import { assert, assertEquals } from "../deps.ts";
import { MuxstoneFireField } from "../../examples/showcases/muxstone/fire_background.ts";
import { muxstoneTheme } from "../../examples/showcases/muxstone/model.ts";

const THEME = muxstoneTheme("midnight");
const ALT_THEME = muxstoneTheme("t2");
const BOUNDS = { column: 0, row: 0, width: 90, height: 28 };

function run(
  field: MuxstoneFireField,
  frames: number,
  obstacles: readonly { column: number; row: number; width: number; height: number }[] = [],
  startAt = 0,
): number {
  let now = startAt;
  for (let frame = 0; frame < frames; frame += 1) {
    now += 60;
    field.advance({ bounds: BOUNDS, obstacles, now });
  }
  return now;
}

function grid(field: MuxstoneFireField, theme = THEME): string[] {
  return field.rasterizeCells(BOUNDS, theme).map((row) => row.map((cell) => cell?.char ?? " ").join(""));
}

Deno.test("MuxstoneFireField: same seed and advance sequence are deterministic", () => {
  const left = new MuxstoneFireField({ seed: 21 });
  const right = new MuxstoneFireField({ seed: 21 });
  run(left, 200);
  run(right, 200);
  assertEquals(grid(left), grid(right));

  const other = new MuxstoneFireField({ seed: 22 });
  run(other, 200);
  assert(grid(other).join("\n") !== grid(left).join("\n"), "different seeds should diverge");
});

Deno.test("MuxstoneFireField: matches bounds dimensions and survives resizes", () => {
  const field = new MuxstoneFireField({ seed: 3 });
  run(field, 120);
  const rows = field.rasterizeCells(BOUNDS, THEME);
  assertEquals(rows.length, BOUNDS.height);
  for (const row of rows) assertEquals(row.length, BOUNDS.width);

  for (const size of [{ width: 20, height: 8 }, { width: 200, height: 60 }, { width: 1, height: 1 }]) {
    const resized = { column: 0, row: 0, ...size };
    field.advance({ bounds: resized, obstacles: [], now: 99_000 });
    const painted = field.rasterizeCells(resized, THEME);
    assertEquals(painted.length, size.height);
    for (const row of painted) assertEquals(row.length, size.width);
  }
});

Deno.test("MuxstoneFireField: burns hottest at the base and cools toward the top", () => {
  const field = new MuxstoneFireField({ seed: 9 });
  run(field, 200);
  const cells = field.rasterizeCells(BOUNDS, THEME);
  const rowHeat = (row: number): number => cells[row]!.filter((cell) => cell !== undefined).length / BOUNDS.width;

  const base = rowHeat(BOUNDS.height - 1);
  const top = rowHeat(0);
  assert(base > top, `the base should burn denser than the top: ${base} vs ${top}`);
  assert(base > 0.2, "the ember band should be well alight");

  // The whole field is warm, not just the base, so flames reach up the screen.
  const inspection = field.inspect();
  assert(inspection.meanHeat > 0.05, "flames should rise, not just smoulder at the base");
  assert(inspection.maxHeat > 0.7, "the core should reach full heat");
});

Deno.test("MuxstoneFireField: flickers between frames rather than sitting still", () => {
  const field = new MuxstoneFireField({ seed: 4 });
  run(field, 120);
  const before = grid(field).join("\n");
  run(field, 8, [], 120 * 60);
  const after = grid(field).join("\n");
  assert(before !== after, "the fire should keep moving frame to frame");
});

Deno.test("MuxstoneFireField: keeps obstacle windows as cold voids the flames avoid", () => {
  const window = { column: 30, row: 10, width: 30, height: 10 };
  const interior = {
    column: window.column + 2,
    row: window.row + 2,
    width: window.width - 4,
    height: window.height - 4,
  };
  const litInside = (field: MuxstoneFireField): number => {
    const cells = field.rasterizeCells(BOUNDS, THEME);
    let count = 0;
    for (let row = interior.row; row < interior.row + interior.height; row += 1) {
      for (let column = interior.column; column < interior.column + interior.width; column += 1) {
        if (cells[row]?.[column]) count += 1;
      }
    }
    return count;
  };

  const avoiding = new MuxstoneFireField({ seed: 31 });
  run(avoiding, 200, [window]);
  assertEquals(litInside(avoiding), 0, "an obstacle window must stay a cold void");

  // Dropping it from the obstacle list, as overgrowth does for idle windows,
  // lets the flames burn across it.
  const covering = new MuxstoneFireField({ seed: 31 });
  run(covering, 200, []);
  assert(litInside(covering) > 0, "a reclaimed window should catch fire");
});

Deno.test("MuxstoneFireField: the pointer fans a hot bloom into the flames", () => {
  // A cool upper region carries only faint sparks; the bloom turns it to solid
  // block flame, so count the hot (block-glyph) cells rather than any-lit cells,
  // which saturate in a dense blaze.
  const region = { column: 6, row: 2, width: 9, height: 5 };
  const hotIn = (field: MuxstoneFireField): number => {
    const rows = grid(field);
    let count = 0;
    for (let row = region.row; row < region.row + region.height; row += 1) {
      for (let column = region.column; column < region.column + region.width; column += 1) {
        if ("░▒▓█".includes(rows[row]?.[column] ?? " ")) count += 1;
      }
    }
    return count;
  };

  const cold = new MuxstoneFireField({ seed: 5 });
  run(cold, 120);
  const baseline = hotIn(cold);

  const fanned = new MuxstoneFireField({ seed: 5 });
  run(fanned, 120);
  let now = 120 * 60;
  for (let frame = 0; frame < 6; frame += 1) {
    now += 60;
    fanned.setPointer({ column: 10, row: 4 }, now);
    fanned.advance({ bounds: BOUNDS, obstacles: [], now });
  }
  assert(hotIn(fanned) > baseline, `the pointer should heat its neighbourhood: ${baseline} -> ${hotIn(fanned)}`);
  assertEquals(fanned.inspect().pointer, { column: 10, row: 4 });

  fanned.clearPointer();
  assertEquals(fanned.inspect().pointer, undefined);
});

Deno.test("MuxstoneFireField: cell colors are valid RGB and follow the theme", () => {
  const field = new MuxstoneFireField({ seed: 44 });
  run(field, 200);
  const midnight = field.rasterizeCells(BOUNDS, THEME).map((row) =>
    row.map((cell) => (cell ? { char: cell.char, foreground: [...cell.foreground] } : undefined))
  );
  let painted = 0;
  for (const row of midnight) {
    for (const cell of row) {
      if (!cell) continue;
      painted += 1;
      assertEquals(cell.foreground.length, 3);
      for (const channel of cell.foreground) {
        assert(Number.isInteger(channel) && channel >= 0 && channel <= 255, `bad channel ${channel}`);
      }
    }
  }
  assert(painted > 100, "expected a populated blaze");

  const themed = field.rasterizeCells(BOUNDS, ALT_THEME);
  let differs = false;
  for (let row = 0; row < midnight.length && !differs; row += 1) {
    for (let column = 0; column < midnight[row]!.length; column += 1) {
      const a = midnight[row]?.[column];
      const b = themed[row]?.[column];
      if (a && b && a.foreground.join(",") !== b.foreground.join(",")) {
        differs = true;
        break;
      }
    }
  }
  assert(differs, "colors must derive from the active theme");
});

Deno.test("MuxstoneFireField: 100 advance+rasterize frames at 200x60 stay under budget", () => {
  const field = new MuxstoneFireField({ seed: 5 });
  const bounds = { column: 0, row: 0, width: 200, height: 60 };
  const started = performance.now();
  let now = 0;
  for (let frame = 0; frame < 100; frame += 1) {
    now += 60;
    field.advance({ bounds, obstacles: [], now });
    field.rasterizeCells(bounds, THEME);
  }
  const elapsed = performance.now() - started;
  assert(elapsed < 2_000, `fire frames took ${elapsed.toFixed(1)}ms`);
});
