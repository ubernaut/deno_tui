import { assertEquals } from "./deps.ts";
import { clipRect, contains, HitTargetStack, inset, intersects } from "../src/app/hit_targets.ts";

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
