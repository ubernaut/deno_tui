import { assertEquals, assertStrictEquals } from "./deps.ts";
import { WorkbenchModalBufferCache } from "../src/app/workbench_modal_cache.ts";

Deno.test("WorkbenchModalBufferCache exposes stable retained buffers", () => {
  const cache = new WorkbenchModalBufferCache<string>();
  const rows = cache.rowCommands;
  const items = cache.actionItems;
  const placements = cache.actionPlacements;
  const commands = cache.actionCommands;

  cache.rowCommands.push({ kind: "title", text: "Modal", rect: { column: 0, row: 0, width: 5, height: 1 } });
  cache.actionItems.push({ label: "OK", action: "ok" });
  cache.actionPlacements.push({
    item: cache.actionItems[0]!,
    rect: { column: 0, row: 1, width: 4, height: 1 },
    state: "base",
  });
  cache.actionCommands.push({
    item: cache.actionItems[0]!,
    rect: { column: 0, row: 1, width: 4, height: 1 },
    hitRect: { column: 0, row: 1, width: 4, height: 1 },
    text: "[OK]",
    state: "base",
  });

  assertEquals(cache.inspect(), { rowCommands: 1, actionItems: 1, actionPlacements: 1, actionCommands: 1 });
  cache.clear();
  assertEquals(cache.inspect(), { rowCommands: 0, actionItems: 0, actionPlacements: 0, actionCommands: 0 });
  assertStrictEquals(cache.rowCommands, rows);
  assertStrictEquals(cache.actionItems, items);
  assertStrictEquals(cache.actionPlacements, placements);
  assertStrictEquals(cache.actionCommands, commands);
});
