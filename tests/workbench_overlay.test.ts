import { assertEquals } from "./deps.ts";
import { layoutWorkbenchModal, layoutWorkbenchPopover } from "../src/app/workbench_overlay.ts";

Deno.test("workbench modal layout centers within desktop bounds", () => {
  const layout = layoutWorkbenchModal({
    bounds: { column: 0, row: 0, width: 120, height: 40 },
    contentHeight: 12,
    maxWidth: 72,
  });

  assertEquals(layout.rect, { column: 24, row: 14, width: 72, height: 12 });
  assertEquals(layout.inner, { column: 25, row: 15, width: 70, height: 10 });
  assertEquals(layout.shadow, { column: 26, row: 15, width: 72, height: 12 });
});

Deno.test("workbench modal layout remains inside cramped bounds", () => {
  const layout = layoutWorkbenchModal({
    bounds: { column: 2, row: 1, width: 30, height: 8 },
    contentHeight: 20,
    minWidth: 38,
    minHeight: 9,
  });

  assertEquals(layout.rect, { column: 2, row: 2, width: 30, height: 7 });
  assertEquals(layout.inner, { column: 3, row: 3, width: 28, height: 5 });
  assertEquals(layout.shadow, { column: 4, row: 3, width: 28, height: 6 });
});

Deno.test("workbench popover layout clips or hides too-small overlays", () => {
  assertEquals(
    layoutWorkbenchPopover({
      rect: { column: 8, row: 3, width: 20, height: 6 },
      bounds: { column: 0, row: 0, width: 24, height: 8 },
    }),
    { column: 8, row: 3, width: 16, height: 5 },
  );

  assertEquals(
    layoutWorkbenchPopover({
      rect: { column: 22, row: 2, width: 4, height: 5 },
      bounds: { column: 0, row: 0, width: 24, height: 8 },
    }),
    undefined,
  );
});
