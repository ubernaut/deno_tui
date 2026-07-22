import { assert, assertEquals } from "../deps.ts";
import {
  MUXSTONE_MAX_OVERGROWTH_RATIO,
  MUXSTONE_OVERGROWTH_BACKGROUND_IDS,
  muxstoneBackgroundOvergrows,
  muxstoneOvergrowthCovers,
  muxstoneOvergrowthRatio,
  muxstoneOvergrowthThreshold,
  MuxstoneOvergrowthTracker,
  muxstoneOvergrowthVisible,
} from "../../examples/showcases/muxstone/overgrowth.ts";
import { MUXSTONE_BACKGROUND_IDS } from "../../examples/showcases/muxstone/model.ts";

const RECT = { column: 10, row: 4, width: 20, height: 10 };

Deno.test("muxstone overgrowth applies only to the organic backgrounds", () => {
  assertEquals([...MUXSTONE_OVERGROWTH_BACKGROUND_IDS].sort(), ["circuit", "ivy", "jungle", "matrix"]);
  for (const id of MUXSTONE_BACKGROUND_IDS) {
    assertEquals(muxstoneBackgroundOvergrows(id), MUXSTONE_OVERGROWTH_BACKGROUND_IDS.includes(id));
  }
});

Deno.test("muxstone overgrowth ratio ramps slowly and never fully hides a window", () => {
  const full = 120_000;
  assertEquals(muxstoneOvergrowthRatio(0, full), 0);
  assertEquals(muxstoneOvergrowthRatio(-5, full), 0);

  // Monotonic, and still modest early on so the effect reads as gradual.
  let previous = 0;
  for (const elapsed of [1_000, 10_000, 30_000, 60_000, 120_000]) {
    const ratio = muxstoneOvergrowthRatio(elapsed, full);
    assert(ratio >= previous, "ratio must never go backwards");
    previous = ratio;
  }
  assert(muxstoneOvergrowthRatio(6_000, full) < 0.1, "should barely start after a few seconds");
  assertEquals(muxstoneOvergrowthRatio(full, full), MUXSTONE_MAX_OVERGROWTH_RATIO);
  // Clamped, so the centre of a window always survives.
  assertEquals(muxstoneOvergrowthRatio(full * 100, full), MUXSTONE_MAX_OVERGROWTH_RATIO);
  assert(MUXSTONE_MAX_OVERGROWTH_RATIO < 1);
});

Deno.test("muxstone overgrowth creeps inward from the window border", () => {
  // Border cells give way well before centre cells.
  const border = muxstoneOvergrowthThreshold(RECT.column, RECT.row, RECT);
  const centre = muxstoneOvergrowthThreshold(
    RECT.column + Math.floor(RECT.width / 2),
    RECT.row + Math.floor(RECT.height / 2),
    RECT,
  );
  assert(border < centre, `border ${border} should fall before centre ${centre}`);

  // Coverage grows monotonically with the ratio and starts empty.
  const covered = (ratio: number): number => {
    let count = 0;
    for (let row = RECT.row; row < RECT.row + RECT.height; row += 1) {
      for (let column = RECT.column; column < RECT.column + RECT.width; column += 1) {
        if (muxstoneOvergrowthCovers(column, row, RECT, ratio)) count += 1;
      }
    }
    return count;
  };
  assertEquals(covered(0), 0);
  const low = covered(0.2);
  const mid = covered(0.5);
  const high = covered(MUXSTONE_MAX_OVERGROWTH_RATIO);
  assert(low < mid && mid < high, `coverage should grow: ${low} < ${mid} < ${high}`);
  assert(high < RECT.width * RECT.height, "the window is never fully reclaimed");

  // Deterministic: the same cell resolves identically every call.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assertEquals(
      muxstoneOvergrowthThreshold(RECT.column + 3, RECT.row + 2, RECT),
      muxstoneOvergrowthThreshold(RECT.column + 3, RECT.row + 2, RECT),
    );
  }
  // Cells outside the rect are never reclaimed.
  assertEquals(muxstoneOvergrowthCovers(RECT.column - 1, RECT.row, RECT, 1), false);
});

Deno.test("muxstone overgrowth tracker resets the focused window and forgets closed ones", () => {
  const tracker = new MuxstoneOvergrowthTracker();
  tracker.sync(["a", "b"], "a", 1_000);
  assertEquals(tracker.idleMs("a", 5_000), 0);
  assertEquals(tracker.idleMs("b", 5_000), 4_000);

  // Focus moves: the newly active window resets, the old one starts idling.
  tracker.sync(["a", "b"], "b", 6_000);
  assertEquals(tracker.idleMs("b", 9_000), 0);
  assertEquals(tracker.idleMs("a", 9_000), 3_000);

  // Refocusing resets the clock rather than resuming it.
  tracker.sync(["a", "b"], "a", 20_000);
  assertEquals(tracker.idleMs("a", 21_000), 0);

  // Closed windows are dropped so ids cannot leak between sessions.
  tracker.sync(["a"], "a", 22_000);
  assertEquals(tracker.idleMs("b", 30_000), 0);

  tracker.clear();
  assertEquals(tracker.idleMs("a", 40_000), 0);
});

Deno.test("muxstone overgrowth is clipped by windows stacked above the reclaimed one", () => {
  // An idle window behind the focused one must not paint its reclaim over the
  // window on top, or the focused window sprouts background characters.
  const idle = { column: 0, row: 0, width: 40, height: 20 };
  const onTop = { column: 20, row: 5, width: 30, height: 10 };
  const ratio = MUXSTONE_MAX_OVERGROWTH_RATIO;

  let visibleUnderneath = 0;
  let visibleBeneathTop = 0;
  let clipped = 0;
  for (let row = idle.row; row < idle.row + idle.height; row += 1) {
    for (let column = idle.column; column < idle.column + idle.width; column += 1) {
      const covers = muxstoneOvergrowthCovers(column, row, idle, ratio);
      const visible = muxstoneOvergrowthVisible(column, row, idle, ratio, [onTop]);
      const beneath = column >= onTop.column && column < onTop.column + onTop.width &&
        row >= onTop.row && row < onTop.row + onTop.height;
      if (visible && beneath) visibleBeneathTop += 1;
      if (visible && !beneath) visibleUnderneath += 1;
      if (covers && !visible) clipped += 1;
    }
  }

  assertEquals(visibleBeneathTop, 0, "no reclaimed cell may show through the window on top");
  assert(visibleUnderneath > 0, "the exposed part of the idle window must still reclaim");
  assert(clipped > 0, "the stacked window must actually be clipping something");

  // With nothing stacked above, clipping changes nothing.
  let unclipped = 0;
  for (let row = idle.row; row < idle.row + idle.height; row += 1) {
    for (let column = idle.column; column < idle.column + idle.width; column += 1) {
      if (muxstoneOvergrowthVisible(column, row, idle, ratio, [])) unclipped += 1;
    }
  }
  assertEquals(unclipped, visibleUnderneath + clipped);
});
