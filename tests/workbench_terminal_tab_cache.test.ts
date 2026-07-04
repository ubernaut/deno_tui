import { assertEquals } from "./deps.ts";
import {
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
} from "../src/app/workbench_terminal.ts";
import { WorkbenchTerminalSessionTabBufferCache } from "../src/app/workbench_terminal_tab_cache.ts";

Deno.test("workbench terminal session tab cache keeps reusable tab storage together", () => {
  const cache = new WorkbenchTerminalSessionTabBufferCache();

  cache.sources.push(
    { id: "shell-1", title: "Shell 1", running: true },
    { id: "shell-2", title: "Shell 2", status: "stopped" },
  );
  workbenchTerminalSessionTabsInto(
    cache.placements,
    cache.sources,
    "shell-1",
    { column: 1, row: 4, width: 60, height: 1 },
  );
  workbenchTerminalSessionTabRenderCommandsInto(
    cache.commands,
    cache.placements,
    { column: 1, row: 4, width: 60, height: 1 },
  );

  assertEquals(cache.inspect(), { sources: 2, placements: 2, commands: 4 });
  assertEquals(cache.commands.map((command) => [command.kind, command.id, command.active]), [
    ["tab", "shell-1", true],
    ["gap", undefined, false],
    ["tab", "shell-2", false],
    ["gap", undefined, false],
  ]);

  cache.clear();
  assertEquals(cache.inspect(), { sources: 0, placements: 0, commands: 0 });
});
