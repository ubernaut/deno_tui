import { assertEquals, assertStrictEquals } from "./deps.ts";
import {
  layoutWorkbenchButtonRowInto,
  workbenchButtonRowRenderCommandsInto,
} from "../src/app/workbench_control_layout.ts";
import {
  WorkbenchButtonRowBufferCache,
  WorkbenchModalBufferCache,
  WorkbenchShelfBufferCache,
  WorkbenchTerminalBufferCache,
  WorkbenchTerminalSessionTabBufferCache,
  WorkbenchTitlebarBufferCache,
} from "../src/app/workbench_buffers.ts";
import { layoutWorkbenchShelfInto, workbenchShelfRenderCommandsInto } from "../src/app/workbench_shelf.ts";
import {
  workbenchTerminalCopyRowsInto,
  workbenchTerminalPaneProjectionsInto,
  workbenchTerminalPaneTitleRenderCommandsInto,
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
} from "../src/app/workbench_terminal.ts";

Deno.test("workbench buffer caches keep reusable shelf and tab storage together", () => {
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

Deno.test("workbench buffer caches keep reusable button row storage together", () => {
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

Deno.test("workbench buffer caches expose stable modal buffers", () => {
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

Deno.test("workbench buffer caches keep terminal pane and copy storage together", () => {
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
  workbenchTerminalPaneTitleRenderCommandsInto(
    cache.paneTitleCommands,
    cache.paneProjections,
    { background: "#000", text: "#fff", soft: "#aaa", panelSoft: "#111", accentDeep: "#090" },
    () => "#fff",
  );

  assertEquals(cache.inspect(), { paneProjections: 1, paneTitleCommands: 1, copyRows: 2 });
  assertEquals(cache.paneProjections[0]?.sessionId, "shell-a");
  assertEquals(cache.paneTitleCommands[0]?.paneId, "pane-a");
  assertEquals(cache.copyRows.map((row) => [row.rowIndex, row.selected]), [[4, true], [5, false]]);

  cache.clear();
  assertEquals(cache.inspect(), { paneProjections: 0, paneTitleCommands: 0, copyRows: 0 });
});

Deno.test("workbench buffer caches keep terminal session tab storage together", () => {
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

Deno.test("workbench buffer caches reuse per-window titlebar buffers", () => {
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

Deno.test("workbench buffer caches delete and clear retained titlebar buffers", () => {
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
