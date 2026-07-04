import { assertEquals } from "./deps.ts";
import { layoutWorkbenchShelfInto, workbenchShelfRenderCommandsInto } from "../src/app/workbench_shelf.ts";
import { WorkbenchShelfBufferCache } from "../src/app/workbench_shelf_cache.ts";

Deno.test("workbench shelf buffer cache keeps reusable shelf and tab storage together", () => {
  const cache = new WorkbenchShelfBufferCache<"logs" | "three">();

  cache.entries.push({ id: "logs", title: "Logs" });
  const layout = layoutWorkbenchShelfInto(cache.shelfLayout, {
    row: 2,
    column: 1,
    width: 40,
    entries: cache.entries,
  });
  workbenchShelfRenderCommandsInto(cache.shelfCommands, layout);

  assertEquals(cache.inspect(), {
    entries: 1,
    tabs: 0,
    shelfButtons: 1,
    shelfItems: 1,
    shelfPlacements: 1,
    tabButtons: 0,
    tabItems: 0,
    tabPlacements: 0,
    shelfCommands: 2,
    tabCommands: 0,
  });

  cache.clear();

  assertEquals(cache.inspect(), {
    entries: 0,
    tabs: 0,
    shelfButtons: 0,
    shelfItems: 0,
    shelfPlacements: 0,
    tabButtons: 0,
    tabItems: 0,
    tabPlacements: 0,
    shelfCommands: 0,
    tabCommands: 0,
  });
});
