import { assertEquals } from "./deps.ts";
import {
  layoutWorkbenchButtonRowInto,
  workbenchButtonRowRenderCommandsInto,
} from "../src/app/workbench_control_layout.ts";
import { WorkbenchButtonRowBufferCache } from "../src/app/workbench_button_row_cache.ts";

Deno.test("workbench button row buffer cache keeps reusable row storage together", () => {
  const cache = new WorkbenchButtonRowBufferCache<"run" | "stop">();

  cache.items.push({ action: "run", label: "Run" }, { action: "stop", label: "Stop", disabled: true });
  layoutWorkbenchButtonRowInto(cache.placements, cache.items, { column: 2, row: 3, width: 40, height: 1 }, 3);
  workbenchButtonRowRenderCommandsInto(cache.commands, cache.placements);

  assertEquals(cache.inspect(), { items: 2, placements: 2, commands: 2 });
  assertEquals(cache.commands.map((command) => [command.item.action, command.state]), [
    ["run", "base"],
    ["stop", "disabled"],
  ]);

  cache.clear();
  assertEquals(cache.inspect(), { items: 0, placements: 0, commands: 0 });
});
