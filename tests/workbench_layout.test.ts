import { assertEquals } from "./deps.ts";
import {
  clampWorkbenchTileDensity,
  WorkbenchActiveRevealTracker,
  workbenchAdaptiveTileOptions,
  workbenchVerticalScrollbarRect,
  workbenchWindowLayout,
} from "../src/app/workbench_layout.ts";

Deno.test("clampWorkbenchTileDensity keeps density in the shared supported range", () => {
  assertEquals(clampWorkbenchTileDensity(4.8), 3);
  assertEquals(clampWorkbenchTileDensity(-9), -3);
  assertEquals(clampWorkbenchTileDensity(Number.NaN), 0);
  assertEquals(clampWorkbenchTileDensity(2.9), 2);
});

Deno.test("workbenchAdaptiveTileOptions shares density-aware tile defaults", () => {
  assertEquals(workbenchAdaptiveTileOptions({ bounds: { column: 0, row: 0, width: 120, height: 40 } }), {
    minTileWidth: 38,
    minTileHeight: 10,
    maxColumns: 3,
    targetAspectRatio: 2.25,
    allowVerticalOverflow: true,
    gap: 1,
  });

  assertEquals(
    workbenchAdaptiveTileOptions({ bounds: { column: 0, row: 0, width: 180, height: 40 }, tileDensity: 2 }),
    {
      minTileWidth: 30,
      minTileHeight: 10,
      maxColumns: 4,
      targetAspectRatio: 2.49,
      allowVerticalOverflow: true,
      gap: 1,
    },
  );
});

Deno.test("workbenchWindowLayout projects visible rects and clamps content height to viewport", () => {
  const layout = workbenchWindowLayout<"a" | "b">(
    { column: 1, row: 2, width: 80, height: 20 },
    {
      contentHeight: 12,
      visible: [
        { id: "a", rect: { column: 1, row: 2, width: 20, height: 10 } },
        { id: "b" },
      ],
    },
  );

  assertEquals(layout.bounds, { column: 1, row: 2, width: 80, height: 20 });
  assertEquals(layout.contentHeight, 20);
  assertEquals(layout.rects.get("a"), { column: 1, row: 2, width: 20, height: 10 });
  assertEquals(layout.rects.has("b"), false);
});

Deno.test("workbenchVerticalScrollbarRect locates the right-edge workspace hit region", () => {
  assertEquals(
    workbenchVerticalScrollbarRect({
      bounds: { column: 2, row: 3, width: 20, height: 9 },
      visible: true,
    }),
    { column: 21, row: 3, width: 1, height: 9 },
  );
  assertEquals(
    workbenchVerticalScrollbarRect({
      bounds: { column: 2, row: 3, width: 1, height: 9 },
      visible: true,
    }),
    undefined,
  );
  assertEquals(
    workbenchVerticalScrollbarRect({
      bounds: { column: 2, row: 3, width: 20, height: 9 },
      visible: false,
    }),
    undefined,
  );
});

Deno.test("WorkbenchActiveRevealTracker only emits offsets when active item or viewport changes", () => {
  const tracker = new WorkbenchActiveRevealTracker<"a" | "b">();
  const activeRect = { column: 0, row: 18, width: 20, height: 6 };
  const base = {
    activeId: "a" as const,
    activeRect,
    contentHeight: 40,
    viewportWidth: 80,
    viewportHeight: 12,
    offsetRows: 0,
  };

  assertEquals(tracker.revealOffset(base), 12);
  assertEquals(tracker.revealOffset(base), undefined);
  assertEquals(tracker.revealOffset({ ...base, viewportHeight: 10, offsetRows: 12 }), 14);
  assertEquals(tracker.revealOffset({ ...base, activeId: "b", offsetRows: 0 }), 12);
  tracker.reset();
  assertEquals(tracker.revealOffset(base), 12);
});
