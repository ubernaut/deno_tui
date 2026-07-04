import { assertEquals, assertStrictEquals } from "./deps.ts";
import { WorkbenchTitlebarBufferCache } from "../src/app/workbench_titlebar_cache.ts";

Deno.test("WorkbenchTitlebarBufferCache reuses per-window layout and command buffers", () => {
  const cache = new WorkbenchTitlebarBufferCache<"a" | "b">();
  const layoutA = cache.layout("a");
  const commandsA = cache.renderCommands("a");

  assertStrictEquals(cache.layout("a"), layoutA);
  assertStrictEquals(cache.renderCommands("a"), commandsA);
  assertEquals(cache.inspect(), { layouts: 1, renderCommands: 1 });

  cache.layout("b");
  cache.renderCommands("b");
  assertEquals(cache.inspect(), { layouts: 2, renderCommands: 2 });
});

Deno.test("WorkbenchTitlebarBufferCache deletes and clears retained buffers", () => {
  const cache = new WorkbenchTitlebarBufferCache<string>();
  const layout = cache.layout("one");
  const commands = cache.renderCommands("one");

  cache.delete("one");
  assertEquals(cache.inspect(), { layouts: 0, renderCommands: 0 });
  assertEquals(cache.layout("one") === layout, false);
  assertEquals(cache.renderCommands("one") === commands, false);

  cache.layout("two");
  cache.renderCommands("two");
  cache.clear();
  assertEquals(cache.inspect(), { layouts: 0, renderCommands: 0 });
});
