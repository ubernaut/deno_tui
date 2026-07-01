import { assertEquals } from "./deps.ts";
import { workbenchAdaptiveTileOptions, workbenchWindowLayout } from "../src/app/workbench_layout.ts";

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
