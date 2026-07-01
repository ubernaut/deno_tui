import { assertEquals } from "./deps.ts";
import { workbenchContentViewport, workbenchRevealActiveRowOffset } from "../src/app/workbench_viewport.ts";

Deno.test("workbench content viewport keeps full inner rect when content fits", () => {
  assertEquals(
    workbenchContentViewport({
      inner: { column: 2, row: 3, width: 20, height: 10 },
      contentWidth: 20,
      contentHeight: 10,
    }),
    { column: 2, row: 3, width: 20, height: 10 },
  );
});

Deno.test("workbench content viewport reserves one column or row for direct overflow", () => {
  assertEquals(
    workbenchContentViewport({
      inner: { column: 0, row: 0, width: 20, height: 10 },
      contentWidth: 19,
      contentHeight: 11,
    }),
    { column: 0, row: 0, width: 19, height: 10 },
  );
  assertEquals(
    workbenchContentViewport({
      inner: { column: 0, row: 0, width: 20, height: 10 },
      contentWidth: 21,
      contentHeight: 9,
    }),
    { column: 0, row: 0, width: 20, height: 9 },
  );
});

Deno.test("workbench content viewport handles scrollbar coupling in a second pass", () => {
  assertEquals(
    workbenchContentViewport({
      inner: { column: 0, row: 0, width: 20, height: 10 },
      contentWidth: 20,
      contentHeight: 11,
    }),
    { column: 0, row: 0, width: 19, height: 9 },
  );
  assertEquals(
    workbenchContentViewport({
      inner: { column: 0, row: 0, width: 20, height: 10 },
      contentWidth: 21,
      contentHeight: 10,
    }),
    { column: 0, row: 0, width: 19, height: 9 },
  );
});

Deno.test("workbench reveal active row returns no change when active content is visible", () => {
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 12, width: 10, height: 4 },
      contentHeight: 40,
      viewportHeight: 10,
      offsetRows: 10,
    }),
    undefined,
  );
});

Deno.test("workbench reveal active row scrolls up or down to show the active rectangle", () => {
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 4, width: 10, height: 4 },
      contentHeight: 40,
      viewportHeight: 10,
      offsetRows: 12,
    }),
    4,
  );
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 24, width: 10, height: 8 },
      contentHeight: 40,
      viewportHeight: 10,
      offsetRows: 10,
    }),
    22,
  );
});

Deno.test("workbench reveal active row resets fitting content and clamps large offsets", () => {
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 4, width: 10, height: 4 },
      contentHeight: 8,
      viewportHeight: 10,
      offsetRows: 5,
    }),
    0,
  );
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 38, width: 10, height: 6 },
      contentHeight: 40,
      viewportHeight: 10,
      offsetRows: 0,
    }),
    30,
  );
});
