import { assertEquals } from "./deps.ts";
import {
  hideWorkbenchThreeRect,
  setWorkbenchThreeRect,
  WORKBENCH_THREE_HIDDEN_RECT,
  workbenchThreeBodyRect,
  workbenchThreeContentGraphicsRect,
  workbenchThreeGraphicsRect,
} from "../src/app/workbench_three_geometry.ts";
import type { Rectangle } from "../src/types.ts";

Deno.test("setWorkbenchThreeRect skips unchanged rectangle writes", () => {
  const target = new FakeRectSignal({ column: 1, row: 2, width: 3, height: 4 });

  assertEquals(setWorkbenchThreeRect(target, { column: 1, row: 2, width: 3, height: 4 }), false);
  assertEquals(target.writes, 0);

  assertEquals(setWorkbenchThreeRect(target, { column: 1, row: 2, width: 5, height: 4 }), true);
  assertEquals(target.writes, 1);
  assertEquals(target.peek(), { column: 1, row: 2, width: 5, height: 4 });
});

Deno.test("hideWorkbenchThreeRect skips unchanged hidden rectangle writes", () => {
  const target = new FakeRectSignal(WORKBENCH_THREE_HIDDEN_RECT);

  assertEquals(hideWorkbenchThreeRect(target), false);
  assertEquals(target.writes, 0);

  target.value = { column: 2, row: 3, width: 4, height: 5 };
  target.writes = 0;
  assertEquals(hideWorkbenchThreeRect(target), true);
  assertEquals(target.writes, 1);
  assertEquals(target.peek(), WORKBENCH_THREE_HIDDEN_RECT);
});

Deno.test("workbenchThreeGraphicsRect maps content through window and workspace offsets", () => {
  assertEquals(
    workbenchThreeGraphicsRect({
      rect: { column: 2, row: 3, width: 10, height: 4 },
      window: {
        viewport: { column: 20, row: 8, width: 40, height: 15 },
        offset: { columns: 1, rows: 2 },
      },
      workspace: {
        columnDelta: 5,
        rowDelta: 4,
        clip: { column: 0, row: 0, width: 80, height: 40 },
      },
    }),
    { column: 26, row: 13, width: 10, height: 4 },
  );
});

Deno.test("workbenchThreeGraphicsRect hides partially clipped image surfaces", () => {
  assertEquals(
    workbenchThreeGraphicsRect({
      rect: { column: 35, row: 2, width: 10, height: 4 },
      window: {
        viewport: { column: 0, row: 0, width: 40, height: 15 },
        offset: { columns: 0, rows: 0 },
      },
    }),
    { column: 35, row: 2, width: 0, height: 0 },
  );

  assertEquals(
    workbenchThreeGraphicsRect({
      rect: { column: 5, row: 5, width: 10, height: 4 },
      window: {
        viewport: { column: 0, row: 0, width: 40, height: 15 },
        offset: { columns: 0, rows: 0 },
      },
      workspace: {
        columnDelta: 0,
        rowDelta: 12,
        clip: { column: 0, row: 0, width: 80, height: 18 },
      },
    }),
    { column: 5, row: 17, width: 0, height: 0 },
  );
});

Deno.test("workbenchThreeContentGraphicsRect preserves content rect semantics", () => {
  assertEquals(
    workbenchThreeContentGraphicsRect(
      { column: 2, row: 3, width: 10, height: 4 },
      {
        window: {
          viewport: { column: 20, row: 8, width: 40, height: 15 },
          offset: { columns: 1, rows: 2 },
        },
        workspace: {
          columnDelta: 5,
          rowDelta: 4,
          clip: { column: 0, row: 0, width: 80, height: 40 },
        },
      },
    ),
    { column: 26, row: 13, width: 10, height: 4 },
  );
});

Deno.test("workbenchThreeBodyRect derives the render body below chrome rows", () => {
  assertEquals(
    workbenchThreeBodyRect({ column: 4, row: 6, width: 30, height: 12 }, { headerRows: 3, footerRows: 1 }),
    { column: 4, row: 9, width: 30, height: 8 },
  );
  assertEquals(
    workbenchThreeBodyRect({ column: 4, row: 6, width: 30, height: 2 }, { headerRows: 3, footerRows: 1 }),
    { column: 4, row: 9, width: 30, height: 0 },
  );
});

class FakeRectSignal {
  writes = 0;

  constructor(private current: Rectangle) {}

  peek(): Rectangle {
    return this.current;
  }

  set value(next: Rectangle) {
    this.current = next;
    this.writes += 1;
  }
}
