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

  // The path actually curves: strands change direction rather than running straight.
  let turns = 0;
  for (const strand of field.inspect().strands) {
    for (let index = 2; index < strand.cells.length; index += 1) {
      const a = strand.cells[index - 2]!;
      const b = strand.cells[index - 1]!;
      const c = strand.cells[index]!;
      if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) turns += 1;
    }
  }
  assert(turns > 10, `expected curving strands, found ${turns} direction changes`);
});

Deno.test("MuxstoneIvyField: sections mature through stalk, leaves, flowers, then fruit", () => {
  const field = new MuxstoneIvyField({ seed: 15 });
  const ornaments = (): Record<string, number> => {
    const counts: Record<string, number> = { none: 0, leaf: 0, flower: 0, fruit: 0 };
    for (const strand of field.inspect().strands) {
      for (const cell of strand.cells) counts[cell.ornament] = (counts[cell.ornament] ?? 0) + 1;
    }
    return counts;
  };

  // Fresh growth is bare stalk only.
  let now = run(field, 200);
  const young = ornaments();
  assertEquals(young.leaf, 0);
  assertEquals(young.flower, 0);
  assertEquals(young.fruit, 0);
  assert(young.none > 0, "expected stalk to exist");

  // Leaves arrive first.
  now = run(field, 900, [], now);
  const leafy = ornaments();
  assert(leafy.leaf > 0, "leaves should appear before flowers");
  assertEquals(leafy.fruit, 0, "fruit must not precede flowers");

  // Then flowers, then fruit, with every stage still represented.
  now = run(field, 25_000, [], now);
  const mature = ornaments();
  assert(mature.flower > 0, "flowers should follow leaves");
  assert(mature.fruit > 0, "fruit should follow flowers");
  assert(mature.none > 0, "bare stalk should remain visible between growth");
  assert(mature.leaf > 0, "leaves should persist on mature growth");

  // Older sections carry more than young ones.
  const byAge = field.inspect().strands.flatMap((strand) => strand.cells);
  const old = byAge.filter((cell) => cell.ageMs >= 60_000);
  const fresh = byAge.filter((cell) => cell.ageMs < 10_000);
  if (old.length > 20 && fresh.length > 20) {
    const density = (cells: typeof byAge) => cells.filter((cell) => cell.ornament !== "none").length / cells.length;
    assert(
      density(old) > density(fresh),
      `older sections should carry more growth: ${density(old)} vs ${density(fresh)}`,
    );
  }

  // Flowers open gradually through the ASCII sequence rather than snapping open.
  const painted = grid(field).join("");
  assert(/[.:+*]/.test(painted), "an opening flower should be painted");
});

Deno.test("MuxstoneIvyField: ripe fruit is pickable and bursts into confetti", () => {
  const field = new MuxstoneIvyField({ seed: 15 });
  // Long enough for fruit to set and then hang until ripe.
  run(field, 26_000);
  const ripe = field.inspect().strands.flatMap((strand) => strand.cells).find((cell) => cell.ripe);
  assert(ripe, "expected ripe fruit after a long run");
  assertEquals(field.inspect().confetti, 0);

  // Empty ground and unripe fruit are not pickable, so ordinary clicks fall through.
  assertEquals(field.pick(-50, -50), false);
  // Strands overlap, so only consider a cell that carries no ripe fruit at all.
  const cells = field.inspect().strands.flatMap((strand) => strand.cells);
  const ripeAt = new Set(cells.filter((cell) => cell.ripe).map((cell) => `${cell.x},${cell.y}`));
  const unripe = cells.find((cell) => cell.ornament === "fruit" && !ripeAt.has(`${cell.x},${cell.y}`));
  if (unripe) assertEquals(field.pick(unripe.x, unripe.y), false, "unripe fruit must not be pickable");

  // Picking ripe fruit consumes it and throws confetti.
  assertEquals(field.pick(ripe.x, ripe.y), true);
  assert(field.inspect().confetti > 0, "picking should throw confetti");
  const stillThere = field.inspect().strands.flatMap((strand) => strand.cells)
    .some((cell) => cell.x === ripe.x && cell.y === ripe.y && cell.ornament === "fruit");
  assertEquals(stillThere, false, "picked fruit should be gone");
  // The same cell cannot be picked twice.
  assertEquals(field.pick(ripe.x, ripe.y), false);

  // Confetti is drawn, then settles away on its own.
  assert(/[*+x'.]/.test(grid(field).join("")), "confetti should be painted");
  run(field, 400, [], 26_000 * 16.7);
  assertEquals(field.inspect().confetti, 0, "confetti should expire");
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
