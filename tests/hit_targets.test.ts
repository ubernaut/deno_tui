import { assertEquals } from "./deps.ts";
import { clipRect, contains, HitTargetStack, inset, intersects, translateHitTargets } from "../src/app/hit_targets.ts";

Deno.test("HitTargetStack finds the topmost matching target", () => {
  const stack = new HitTargetStack<string>();
  stack.add({ column: 0, row: 0, width: 4, height: 4 }, "bottom");
  stack.add({ column: 1, row: 1, width: 2, height: 2 }, "top");

  assertEquals(stack.length, 2);
  assertEquals(stack.find(1, 1)?.action, "top");
  assertEquals(stack.find(3, 3)?.action, "bottom");
  assertEquals(stack.find(4, 4), undefined);
});

Deno.test("HitTargetStack supports indexed update remove clear and cloned inspection", () => {
  const stack = new HitTargetStack<{ id: string }>();
  const action = { id: "a" };
  stack.add({ column: 0, row: 0, width: 2, height: 2 }, action);
  stack.updateRect(0, { column: 4, row: 4, width: 1, height: 1 });

  const entries = stack.entries();
  entries[0]!.rect.column = 99;
  assertEquals(stack.find(4, 4)?.action, action);

  stack.remove(0);
  assertEquals(stack.length, 0);
  stack.add({ column: 0, row: 0, width: 1, height: 1 }, { id: "b" });
  stack.clear();
  assertEquals(stack.length, 0);
});

Deno.test("HitTargetStack finds expanded targets without cloning the whole stack", () => {
  const stack = new HitTargetStack<string>();
  stack.add({ column: 0, row: 0, width: 1, height: 1 }, "bottom");
  stack.add({ column: 4, row: 0, width: 1, height: 1 }, "top");

  const hit = stack.findExpanded(3, 0, (rect) => ({
    column: rect.column - 1,
    row: rect.row,
    width: rect.width + 2,
    height: rect.height,
  }));

  assertEquals(hit, { rect: { column: 3, row: 0, width: 3, height: 1 }, action: "top" });
  hit!.rect.column = 99;
  assertEquals(stack.find(4, 0), { rect: { column: 4, row: 0, width: 1, height: 1 }, action: "top" });
});

Deno.test("translateHitTargets translates clips and removes a stack suffix", () => {
  const stack = new HitTargetStack<string>();
  stack.add({ column: 0, row: 0, width: 2, height: 2 }, "before");
  const startIndex = stack.length;
  stack.add({ column: 0, row: 0, width: 4, height: 2 }, "visible");
  stack.add({ column: 7, row: 4, width: 4, height: 2 }, "clipped");
  stack.add({ column: 20, row: 20, width: 2, height: 2 }, "removed");

  translateHitTargets(stack, {
    startIndex,
    columnDelta: 2,
    rowDelta: 1,
    clip: { column: 0, row: 0, width: 10, height: 6 },
  });

  assertEquals(stack.entries(), [
    { rect: { column: 0, row: 0, width: 2, height: 2 }, action: "before" },
    { rect: { column: 2, row: 1, width: 4, height: 2 }, action: "visible" },
    { rect: { column: 9, row: 5, width: 1, height: 1 }, action: "clipped" },
  ]);
});

Deno.test("hit target rectangle helpers handle containment intersection clipping and inset", () => {
  const rect = { column: 2, row: 3, width: 5, height: 4 };
  assertEquals(contains(rect, 2, 3), true);
  assertEquals(contains(rect, 7, 3), false);
  assertEquals(intersects(rect, { column: 6, row: 6, width: 2, height: 2 }), true);
  assertEquals(intersects(rect, { column: 7, row: 7, width: 2, height: 2 }), false);
  assertEquals(clipRect(rect, { column: 4, row: 4, width: 4, height: 2 }), {
    column: 4,
    row: 4,
    width: 3,
    height: 2,
  });
  assertEquals(inset(rect, 2), { column: 4, row: 5, width: 1, height: 0 });
});
