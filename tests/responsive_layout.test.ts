import { assertEquals } from "./deps.ts";
import { dockRect, insetRect, resolveBreakpoint, splitRect } from "../src/layout/mod.ts";

Deno.test("resolveBreakpoint picks the largest matching breakpoint", () => {
  const bounds = { column: 0, row: 0, width: 100, height: 30 };
  assertEquals(
    resolveBreakpoint(bounds, [
      { id: "mobile" },
      { id: "wide", minWidth: 90 },
      { id: "huge", minWidth: 120 },
    ]),
    "wide",
  );
});

Deno.test("insetRect clamps dimensions", () => {
  assertEquals(insetRect({ column: 1, row: 2, width: 5, height: 4 }, 2), {
    column: 3,
    row: 4,
    width: 1,
    height: 0,
  });
});

Deno.test("splitRect returns stable row slices", () => {
  assertEquals(splitRect({ column: 0, row: 0, width: 10, height: 4 }, "row", 3, 1), {
    first: { column: 0, row: 0, width: 3, height: 4 },
    second: { column: 4, row: 0, width: 6, height: 4 },
  });
});

Deno.test("dockRect returns dock and remaining body", () => {
  assertEquals(dockRect({ column: 0, row: 0, width: 10, height: 4 }, "bottom", 1, 1), {
    first: { column: 0, row: 3, width: 10, height: 1 },
    second: { column: 0, row: 0, width: 10, height: 2 },
  });
});
