import { assertEquals } from "./deps.ts";
import { workbenchContentViewport } from "../src/app/workbench_viewport.ts";

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
