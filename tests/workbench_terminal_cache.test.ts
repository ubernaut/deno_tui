import { assertEquals } from "./deps.ts";
import { workbenchTerminalCopyRowsInto, workbenchTerminalPaneProjectionsInto } from "../src/app/workbench_terminal.ts";
import { WorkbenchTerminalBufferCache } from "../src/app/workbench_terminal_cache.ts";

Deno.test("workbench terminal buffer cache keeps pane and copy storage together", () => {
  const cache = new WorkbenchTerminalBufferCache();

  workbenchTerminalPaneProjectionsInto(
    cache.paneProjections,
    {
      root: {
        kind: "pane",
        id: "pane-a",
        sessionId: "shell-a",
        title: "Shell A",
      },
      activePaneId: "pane-a",
    },
    { column: 2, row: 3, width: 40, height: 10 },
  );
  workbenchTerminalCopyRowsInto(cache.copyRows, {
    visibleRows: ["alpha", "beta"],
    offset: 4,
    height: 2,
    selection: { anchor: 4, focus: 4 },
  });

  assertEquals(cache.inspect(), { paneProjections: 1, copyRows: 2 });
  assertEquals(cache.paneProjections[0]?.sessionId, "shell-a");
  assertEquals(cache.copyRows.map((row) => [row.rowIndex, row.selected]), [[4, true], [5, false]]);

  cache.clear();
  assertEquals(cache.inspect(), { paneProjections: 0, copyRows: 0 });
});
