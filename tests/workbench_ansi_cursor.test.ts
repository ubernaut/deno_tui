import { assertEquals, assertStrictEquals } from "./deps.ts";
import { WorkbenchAnsiCursorCache } from "../src/app/workbench_ansi_cursor.ts";

Deno.test("WorkbenchAnsiCursorCache reuses cursor escape strings", () => {
  const cache = new WorkbenchAnsiCursorCache();
  const first = cache.move(2, 4);
  const second = cache.move(2, 4);

  assertEquals(first, "\x1b[3;5H");
  assertStrictEquals(second, first);
});

Deno.test("WorkbenchAnsiCursorCache normalizes invalid positions and can clear", () => {
  const cache = new WorkbenchAnsiCursorCache();
  assertEquals(cache.move(-1, 1.9), "\x1b[1;2H");
  const before = cache.move(1, 1);
  cache.clear();
  const after = cache.move(1, 1);

  assertEquals(after, "\x1b[2;2H");
  assertEquals(before, after);
});
