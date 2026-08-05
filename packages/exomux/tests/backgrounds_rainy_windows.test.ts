import { assert, assertEquals } from "./deps.ts";
import { ExomuxRainyWindowsField } from "../rainy_windows_background.ts";
import { EXOMUX_BACKGROUND_IDS, exomuxTheme } from "../model.ts";
import { exomuxOvergrowthCovers, exomuxOvergrowthEdges } from "../overgrowth.ts";

const THEME = exomuxTheme("midnight");
const BOUNDS = { column: 4, row: 3, width: 60, height: 20 };
const WINDOW = { column: BOUNDS.column + 10, row: BOUNDS.row + 6, width: 24, height: 7 };

/** Local coordinates of the plug fixture's centre cell. */
const PLUG_COLUMN = Math.floor(BOUNDS.width / 2);
const PLUG_ROW = BOUNDS.height - 1;

function run(
  field: ExomuxRainyWindowsField,
  frames: number,
  options: {
    readonly obstacles?: readonly { column: number; row: number; width: number; height: number }[];
    readonly startAt?: number;
  } = {},
): number {
  const obstacles = options.obstacles ?? [];
  let now = options.startAt ?? 0;
  for (let frame = 0; frame < frames; frame += 1) {
    now += 125;
    field.advance({ bounds: BOUNDS, obstacles, solidObstacles: obstacles, now });
  }
  return now;
}

function overlayChars(field: ExomuxRainyWindowsField): Map<string, string> {
  const cells = new Map<string, string>();
  for (const entry of field.rasterizeOverlayCells(BOUNDS, THEME)) {
    cells.set(`${entry.column},${entry.row}`, entry.cell.char);
  }
  return cells;
}

Deno.test("ExomuxRainyWindowsField: rain is drawn as vertical streaks, not glyph columns", () => {
  const field = new ExomuxRainyWindowsField({ seed: 11 });
  run(field, 40);
  const chars = new Set<string>();
  for (const row of field.rasterizeCells(BOUNDS, THEME)) {
    for (const cell of row) {
      if (cell) chars.add(cell.char);
    }
  }

  assert(chars.size > 0, "the field must paint something");
  // Naming the whole permitted alphabet rather than spot-checking keeps a stray
  // katakana glyph from sneaking back in behind a passing assertion.
  const streakGlyphs = new Set(["╷", "│", "┃", "┆", "┊", "╵", ".", "'"]);
  for (const char of chars) {
    assert(streakGlyphs.has(char), `unexpected rain glyph ${JSON.stringify(char)}`);
  }
  assert(chars.has("┃") || chars.has("│"), "fast drops should pull a solid streak");
});

Deno.test("ExomuxRainyWindowsField: rain pools on the floor and climbs", () => {
  const field = new ExomuxRainyWindowsField({ seed: 5 });
  assertEquals(field.waterVolume, 0);

  run(field, 30);
  const early = field.waterVolume;
  assert(early > 0, "rain should have started wetting the floor");

  run(field, 200);
  const later = field.waterVolume;
  assert(later > early * 2, `the pool should keep rising: ${early} -> ${later}`);

  // The pool is a surface, not scattered damp: the bottom row is wet edge to
  // edge and every wet cell sits below the one above it in the same column.
  let bottomWet = 0;
  for (let column = 0; column < BOUNDS.width; column += 1) {
    if (field.waterAt(column, BOUNDS.height - 1) > 0.5) bottomWet += 1;
    let sawDry = false;
    for (let row = BOUNDS.height - 1; row >= 0; row -= 1) {
      const wet = field.waterAt(column, row) > 0.5;
      if (!wet) sawDry = true;
      else assert(!sawDry, `column ${column} has water floating above a gap at row ${row}`);
    }
  }
  assertEquals(bottomWet, BOUNDS.width, "the whole floor should be under water");
});

Deno.test("ExomuxRainyWindowsField: windows stay dry and collect a puddle on the roof", () => {
  const field = new ExomuxRainyWindowsField({ seed: 9 });
  // Long enough that the pool climbs past the window's lower rows, which is the
  // case where a splash beside the window could arc across its face.
  run(field, 1400, { obstacles: [WINDOW] });
  assert(field.waterAt(0, WINDOW.row - BOUNDS.row + WINDOW.height - 1) > 0.5, "the flood should reach the window");

  const localColumn = WINDOW.column - BOUNDS.column;
  const localRow = WINDOW.row - BOUNDS.row;
  for (let row = localRow; row < localRow + WINDOW.height; row += 1) {
    for (let column = localColumn; column < localColumn + WINDOW.width; column += 1) {
      assertEquals(field.waterAt(column, row), 0, `water leaked into the window at ${column},${row}`);
    }
  }

  let roof = 0;
  for (let column = localColumn; column < localColumn + WINDOW.width; column += 1) {
    roof += field.waterAt(column, localRow - 1);
  }
  assert(roof > 1, `rain should collect on the window roof, got ${roof}`);

  // Nothing is painted over the window either, or the overlay would scribble on
  // terminal text the moment the desktop flooded.
  const overlay = overlayChars(field);
  for (let row = localRow; row < localRow + WINDOW.height; row += 1) {
    for (let column = localColumn; column < localColumn + WINDOW.width; column += 1) {
      assertEquals(overlay.get(`${column},${row}`), undefined, `overlay painted inside the window at ${column},${row}`);
    }
  }
});

Deno.test("ExomuxRainyWindowsField: a window opening over water lifts it instead of eating it", () => {
  const field = new ExomuxRainyWindowsField({ seed: 17 });
  const now = run(field, 200);
  const before = field.waterVolume;
  assert(before > 0);

  // Drop a window straight onto the pool.
  const submerged = { column: BOUNDS.column + 8, row: BOUNDS.row + BOUNDS.height - 4, width: 20, height: 4 };
  field.advance({ bounds: BOUNDS, obstacles: [submerged], solidObstacles: [submerged], now: now + 125 });

  const localColumn = submerged.column - BOUNDS.column;
  const localRow = submerged.row - BOUNDS.row;
  for (let row = localRow; row < BOUNDS.height; row += 1) {
    for (let column = localColumn; column < localColumn + submerged.width; column += 1) {
      assertEquals(field.waterAt(column, row), 0);
    }
  }
  // One frame of rain and evaporation of traces cannot account for a big loss.
  assert(field.waterVolume > before * 0.9, `displaced water was deleted: ${before} -> ${field.waterVolume}`);
});

Deno.test("ExomuxRainyWindowsField: the drain plug is painted bottom-centre and toggles on click", () => {
  const field = new ExomuxRainyWindowsField({ seed: 2 });
  run(field, 10);

  const overlay = overlayChars(field);
  assertEquals(overlay.get(`${PLUG_COLUMN},${PLUG_ROW}`), "▣");
  assertEquals(overlay.get(`${PLUG_COLUMN - 1},${PLUG_ROW}`), "[");
  assertEquals(overlay.get(`${PLUG_COLUMN + 1},${PLUG_ROW}`), "]");
  assertEquals(field.drainOpen, false);

  // Absolute desktop coordinates, the way the mouse router reports them.
  const plugX = BOUNDS.column + PLUG_COLUMN;
  const plugY = BOUNDS.row + PLUG_ROW;
  assertEquals(field.pick(plugX, plugY), true);
  assertEquals(field.drainOpen, true);
  assertEquals(overlayChars(field).get(`${PLUG_COLUMN},${PLUG_ROW}`) === "▣", false, "the open plug shows a swirl");
  assertEquals(field.pick(plugX, plugY), true, "a second click is claimed too");
  assertEquals(field.drainOpen, false, "and closes the plug again");

  // Bare desktop clicks fall through so the window host still sees them.
  assertEquals(field.pick(plugX, plugY - 1), false);
  assertEquals(field.pick(plugX + 3, plugY), false);
  assertEquals(field.drainOpen, false);

  // The plug is reachable through a window because it is painted over one.
  assertEquals(field.picksOverWindows(plugX, plugY), true);
  assertEquals(field.picksOverWindows(plugX, plugY - 1), false);
  assertEquals(field.picksOverWindows(plugX - 2, plugY), false);
});

Deno.test("ExomuxRainyWindowsField: pulling the plug drains a flooded desktop", () => {
  const field = new ExomuxRainyWindowsField({ seed: 13 });
  run(field, 400);
  const flooded = field.waterVolume;
  assert(flooded > 100, `expected a deep pool before draining, got ${flooded}`);
  assertEquals(field.drainedVolume, 0);

  assertEquals(field.pick(BOUNDS.column + PLUG_COLUMN, BOUNDS.row + PLUG_ROW), true);
  run(field, 120, { startAt: 400 * 125 });

  assert(field.drainedVolume > 0, "the sump should have swallowed something");
  // Rain keeps falling, so this is a net figure: the pool has to lose ground
  // against the storm, not merely stop growing.
  assert(
    field.waterVolume < flooded * 0.4,
    `the pool should be mostly gone: ${flooded} -> ${field.waterVolume}`,
  );

  // Closing it again lets the desktop refill.
  const drained = field.waterVolume;
  field.pick(BOUNDS.column + PLUG_COLUMN, BOUNDS.row + PLUG_ROW);
  assertEquals(field.drainOpen, false);
  run(field, 200, { startAt: 520 * 125 });
  assert(field.waterVolume > drained, "a closed plug should let the pool rise again");
});

Deno.test("ExomuxRainyWindowsField: same seed and frame sequence are deterministic", () => {
  const left = new ExomuxRainyWindowsField({ seed: 31 });
  const right = new ExomuxRainyWindowsField({ seed: 31 });
  run(left, 300, { obstacles: [WINDOW] });
  run(right, 300, { obstacles: [WINDOW] });
  assertEquals(left.waterVolume, right.waterVolume);
  assertEquals(
    left.rasterizeCells(BOUNDS, THEME).map((row) => row.map((cell) => cell?.char ?? " ").join("")),
    right.rasterizeCells(BOUNDS, THEME).map((row) => row.map((cell) => cell?.char ?? " ").join("")),
  );

  const other = new ExomuxRainyWindowsField({ seed: 32 });
  run(other, 300, { obstacles: [WINDOW] });
  assert(other.waterVolume !== left.waterVolume, "different seeds should diverge");
});

Deno.test("exomux rain reclaims an idle window from the top only", () => {
  assertEquals(exomuxOvergrowthEdges("rainy windows"), "top");
  for (const id of EXOMUX_BACKGROUND_IDS) {
    if (id !== "rainy windows") assertEquals(exomuxOvergrowthEdges(id), "all", id);
  }

  const rect = { column: 0, row: 0, width: 40, height: 14 };
  const ratio = 0.5;
  const covered = (row: number): number => {
    let count = 0;
    for (let column = rect.column; column < rect.column + rect.width; column += 1) {
      if (exomuxOvergrowthCovers(column, row, rect, ratio, "top")) count += 1;
    }
    return count;
  };

  // The bottom border holds while the top is gone, which is the whole point:
  // the default profile would have reclaimed both equally.
  assertEquals(covered(rect.row), rect.width);
  assertEquals(covered(rect.row + rect.height - 1), 0);
  assert(
    exomuxOvergrowthCovers(rect.column, rect.row + rect.height - 1, rect, ratio) !==
      exomuxOvergrowthCovers(rect.column, rect.row + rect.height - 1, rect, ratio, "top"),
    "the top profile must actually differ from the default at the bottom border",
  );

  // Each column is one unbroken run from the top, so the reclaim reads as a
  // streak running down the glass rather than as speckle.
  let ragged = 0;
  for (let column = rect.column; column < rect.column + rect.width; column += 1) {
    let depth = 0;
    while (
      depth < rect.height &&
      exomuxOvergrowthCovers(column, rect.row + depth, rect, ratio, "top")
    ) depth += 1;
    for (let row = rect.row + depth; row < rect.row + rect.height; row += 1) {
      assert(
        !exomuxOvergrowthCovers(column, row, rect, ratio, "top"),
        `column ${column} reclaims again below its frontier at row ${row}`,
      );
    }
    if (depth !== 0 && depth !== rect.height) ragged += 1;
  }
  assert(ragged > 4, `streak lengths should vary between columns, got ${ragged} partial columns`);
});
