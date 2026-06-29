import { assertEquals } from "./deps.ts";
import { detectViewportMode, resolveResponsiveLayout, slotRect, visibleSlotIds } from "../app/layout.ts";
import type { Rect } from "../app/types.ts";

const bounds: Rect = {
  column: 1,
  row: 2,
  width: 80,
  height: 24,
};

Deno.test("single layout shows the selected slot only", () => {
  assertEquals(visibleSlotIds("single", "processes"), ["processes"]);
  assertEquals(slotRect("single", bounds, "processes", "processes"), bounds);
  assertEquals(slotRect("single", bounds, "cpu", "processes"), {
    column: 0,
    row: 0,
    width: 0,
    height: 0,
  });
});

Deno.test("vertical layout keeps cpu and memory side by side", () => {
  assertEquals(visibleSlotIds("vertical", "network"), ["cpu", "memory"]);
  assertEquals(slotRect("vertical", bounds, "cpu", "network"), {
    column: 1,
    row: 2,
    width: 39,
    height: 24,
  });
  assertEquals(slotRect("vertical", bounds, "memory", "network"), {
    column: 41,
    row: 2,
    width: 40,
    height: 24,
  });
});

Deno.test("quad layout places network and processes on the bottom row", () => {
  assertEquals(visibleSlotIds("quad", "disk"), ["cpu", "memory", "network", "processes"]);
  assertEquals(slotRect("quad", bounds, "network", "disk"), {
    column: 1,
    row: 14,
    width: 39,
    height: 12,
  });
  assertEquals(slotRect("quad", bounds, "processes", "disk"), {
    column: 41,
    row: 14,
    width: 40,
    height: 12,
  });
});

Deno.test("monitor layout hides slots not present in the wall", () => {
  assertEquals(visibleSlotIds("monitor", "memory"), [
    "cpu",
    "cpuLegend",
    "gpu",
    "gpuChip",
    "gpuMemory",
    "memory",
    "temperature",
    "disk",
    "network",
    "processes",
  ]);
  assertEquals(slotRect("monitor", { column: 0, row: 0, width: 0, height: 0 }, "cpu", "memory"), {
    column: 0,
    row: 0,
    width: 0,
    height: 0,
  });
  assertEquals(slotRect("monitor", { column: 0, row: 0, width: 160, height: 48 }, "gpu", "memory"), {
    column: 0,
    row: 12,
    width: 90,
    height: 12,
  });
});

Deno.test("responsive layout collapses the monitor wall on compact and mobile screens", () => {
  assertEquals(
    detectViewportMode({ column: 0, row: 0, width: 120, height: 30 }),
    "compact",
  );
  assertEquals(
    resolveResponsiveLayout("monitor", { column: 0, row: 0, width: 120, height: 30 }),
    "quad",
  );
  assertEquals(
    detectViewportMode({ column: 0, row: 0, width: 78, height: 24 }),
    "mobile",
  );
  assertEquals(
    resolveResponsiveLayout("monitor", { column: 0, row: 0, width: 78, height: 24 }),
    "single",
  );
  assertEquals(
    resolveResponsiveLayout("vertical", { column: 0, row: 0, width: 78, height: 24 }),
    "vertical",
  );
});
