import { assertEquals } from "./deps.ts";
import { resizeSplitPane, resizeSplitPaneRatio, SplitPaneController, splitPaneRects } from "../src/layout/mod.ts";
import type { Rectangle } from "../src/types.ts";

const bounds: Rectangle = {
  column: 2,
  row: 4,
  width: 40,
  height: 12,
};

Deno.test("splitPaneRects returns horizontal panes and separator", () => {
  assertEquals(splitPaneRects(bounds, { direction: "row", firstSize: 14, gap: 2 }), {
    first: { column: 2, row: 4, width: 14, height: 12 },
    separator: { column: 16, row: 4, width: 2, height: 12 },
    second: { column: 18, row: 4, width: 24, height: 12 },
    firstSize: 14,
    ratio: 14 / 38,
  });
});

Deno.test("splitPaneRects returns vertical panes from ratio", () => {
  assertEquals(splitPaneRects(bounds, { direction: "column", ratio: 0.25, gap: 1 }), {
    first: { column: 2, row: 4, width: 40, height: 2 },
    separator: { column: 2, row: 6, width: 40, height: 1 },
    second: { column: 2, row: 7, width: 40, height: 9 },
    firstSize: 2,
    ratio: 2 / 11,
  });
});

Deno.test("splitPaneRects clamps first pane by minimum second pane", () => {
  const result = splitPaneRects(bounds, {
    direction: "row",
    firstSize: 38,
    minFirst: 8,
    minSecond: 12,
    gap: 1,
  });

  assertEquals(result.first.width, 27);
  assertEquals(result.second.width, 12);
});

Deno.test("resizeSplitPane returns constrained options for the next solve", () => {
  const resized = resizeSplitPane(bounds, {
    direction: "row",
    firstSize: 12,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
  }, 30);

  assertEquals(resized.firstSize, 29);
  assertEquals(splitPaneRects(bounds, resized).first.width, 29);
});

Deno.test("resizeSplitPaneRatio persists a responsive ratio", () => {
  const resized = resizeSplitPaneRatio(bounds, {
    direction: "row",
    ratio: 0.5,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
  }, 4);

  assertEquals(resized.firstSize, undefined);
  assertEquals(resized.ratio, 23 / 39);
  assertEquals(splitPaneRects({ ...bounds, width: 80 }, resized).first.width, 46);
});

Deno.test("SplitPaneController resizes and snapshots size-based panes", () => {
  const controller = new SplitPaneController({
    direction: "row",
    firstSize: 12,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
  });
  const snapshots: number[] = [];
  controller.options.subscribe((options) => snapshots.push(options.firstSize ?? -1));

  const rects = controller.resize(bounds, 4);

  assertEquals(rects.first.width, 16);
  assertEquals(controller.snapshot(), {
    direction: "row",
    firstSize: 16,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
    resizeMode: "size",
  });
  assertEquals(snapshots, [16]);
  controller.dispose();
});

Deno.test("SplitPaneController can preserve ratios across resizes", () => {
  const controller = new SplitPaneController({
    direction: "row",
    ratio: 0.5,
    minFirst: 8,
    minSecond: 10,
    gap: 1,
    resizeMode: "ratio",
  });

  controller.resize(bounds, 4);
  assertEquals(controller.snapshot().firstSize, undefined);
  assertEquals(controller.snapshot().ratio, 23 / 39);
  assertEquals(controller.rects({ ...bounds, width: 80 }).first.width, 46);

  controller.setRatio(2);
  assertEquals(controller.snapshot().ratio, 1);
  controller.setFirstSize(10);
  controller.setDirection("column");
  controller.update({ gap: 2, resizeMode: "size" });
  assertEquals(controller.snapshot(), {
    direction: "column",
    ratio: 1,
    firstSize: 10,
    minFirst: 8,
    minSecond: 10,
    gap: 2,
    resizeMode: "size",
  });
  controller.dispose();
});
