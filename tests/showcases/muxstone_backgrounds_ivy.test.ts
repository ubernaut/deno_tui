import { assert, assertEquals } from "../deps.ts";
import { MuxstoneIvyField } from "../../examples/showcases/muxstone/ivy_background.ts";
import { muxstoneTheme } from "../../examples/showcases/muxstone/model.ts";

const THEME = muxstoneTheme("midnight");
const ALT_THEME = muxstoneTheme("t2");
const BOUNDS = { column: 0, row: 0, width: 90, height: 28 };

function run(
  field: MuxstoneIvyField,
  frames: number,
  obstacles: readonly { column: number; row: number; width: number; height: number }[] = [],
  startAt = 0,
): number {
  let now = startAt;
  for (let frame = 0; frame < frames; frame += 1) {
    now += 16.7;
    field.advance({ bounds: BOUNDS, obstacles, now });
  }
  return now;
}

function grid(field: MuxstoneIvyField, theme = THEME): string[] {
  return field.rasterizeCells(BOUNDS, theme).map((row) => row.map((cell) => cell?.char ?? " ").join(""));
}

Deno.test("MuxstoneIvyField: same seed and advance sequence are deterministic", () => {
  const left = new MuxstoneIvyField({ seed: 21 });
  const right = new MuxstoneIvyField({ seed: 21 });
  run(left, 900);
  run(right, 900);
  assertEquals(grid(left), grid(right));

  const other = new MuxstoneIvyField({ seed: 22 });
  run(other, 900);
  assert(grid(other).join("\n") !== grid(left).join("\n"), "different seeds should diverge");
});

Deno.test("MuxstoneIvyField: matches bounds dimensions and survives resizes", () => {
  const field = new MuxstoneIvyField({ seed: 3 });
  run(field, 300);
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

Deno.test("MuxstoneIvyField: strands creep outward along curving arcs", () => {
  const field = new MuxstoneIvyField({ seed: 9 });
  run(field, 60);
  const early = field.inspect().strands.reduce((total, strand) => total + strand.cells.length, 0);
  run(field, 1_800, [], 60 * 16.7);
  const later = field.inspect().strands.reduce((total, strand) => total + strand.cells.length, 0);
  assert(later > early, `strands should extend over time, ${early} -> ${later}`);

  // Every strand is a connected path: each cell is adjacent to the previous one.
  for (const strand of field.inspect().strands) {
    for (let index = 1; index < strand.cells.length; index += 1) {
      const previous = strand.cells[index - 1]!;
      const cell = strand.cells[index]!;
      const step = Math.max(Math.abs(cell.x - previous.x), Math.abs(cell.y - previous.y));
      assertEquals(step, 1, "strand cells must be contiguous");
    }
  }

  // The path actually curves: arc glyphs appear, not just straight runs.
  const painted = grid(field).join("");
  const arcs = [...painted].filter((glyph) => "╭╮╰╯".includes(glyph)).length;
  assert(arcs > 10, `expected curving arcs, found ${arcs}`);
});

Deno.test("MuxstoneIvyField: mature strands bud and open flowers gradually", () => {
  const field = new MuxstoneIvyField({ seed: 15 });
  // Well before the bloom age nothing has budded.
  let now = run(field, 600);
  assertEquals(field.inspect().strands.some((strand) => strand.blooms.length > 0), false);

  // Past the bloom age buds appear, and they start closed rather than open.
  now = run(field, 1_400, [], now);
  const budded = field.inspect().strands.flatMap((strand) => strand.blooms);
  assert(budded.length > 0, "mature strands should set buds");
  assert(budded.some((bloom) => bloom.openness < 1), "buds should open gradually, not instantly");

  // Given enough time they reach full bloom.
  now = run(field, 1_800, [], now);
  const opened = field.inspect().strands.flatMap((strand) => strand.blooms);
  assert(opened.some((bloom) => bloom.openness >= 1), "buds should eventually reach full bloom");

  // Flowers are drawn from the opening sequence, ending in the full blossom.
  assert(grid(field).join("").includes("❁"), "an open flower should be painted");
});

Deno.test("MuxstoneIvyField: keeps clear of obstacles and creeps over them once released", () => {
  const window = { column: 30, row: 8, width: 34, height: 12 };
  const interior = {
    column: window.column + 2,
    row: window.row + 2,
    width: window.width - 4,
    height: window.height - 4,
  };
  const inside = (field: MuxstoneIvyField): number => {
    const painted = field.rasterizeCells(BOUNDS, THEME);
    let count = 0;
    for (let row = interior.row; row < interior.row + interior.height; row += 1) {
      for (let column = interior.column; column < interior.column + interior.width; column += 1) {
        if (painted[row]?.[column]) count += 1;
      }
    }
    return count;
  };

  const avoiding = new MuxstoneIvyField({ seed: 31 });
  run(avoiding, 1_500, [window]);
  assertEquals(inside(avoiding), 0, "an obstacle window must stay clear of ivy");

  // Dropping it from the obstacle list, as overgrowth does for idle windows,
  // lets the ivy creep across it.
  const covering = new MuxstoneIvyField({ seed: 31 });
  run(covering, 1_500, []);
  assert(inside(covering) > 0, "a reclaimed window should get ivy drawn across it");
});

Deno.test("MuxstoneIvyField: cell colors are valid RGB and follow the theme", () => {
  const field = new MuxstoneIvyField({ seed: 44 });
  run(field, 2_400);
  // rasterizeCells hands back a reused buffer, so snapshot before re-rendering.
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
  assert(painted > 50, "expected a populated field");

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

Deno.test("MuxstoneIvyField: 100 advance+rasterize frames at 200x60 stay under budget", () => {
  const field = new MuxstoneIvyField({ seed: 5 });
  const bounds = { column: 0, row: 0, width: 200, height: 60 };
  const started = performance.now();
  let now = 0;
  for (let frame = 0; frame < 100; frame += 1) {
    now += 16.7;
    field.advance({ bounds, obstacles: [], now });
    field.rasterizeCells(bounds, THEME);
  }
  const elapsed = performance.now() - started;
  assert(elapsed < 2_000, `ivy frames took ${elapsed.toFixed(1)}ms`);
});
