import { assertEquals, assertStrictEquals } from "./deps.ts";
import {
  layoutWorkbenchButtonRowInto,
  workbenchButtonRowRenderCommandsInto,
} from "../src/app/workbench_control_layout.ts";
import {
  applyWorkbenchWindowSignalState,
  inspectWorkbenchWindowSignalState,
  WorkbenchController,
  workbenchWindowActionLog,
} from "../src/app/workbench/controller.ts";
import {
  WorkbenchButtonRowBufferCache,
  WorkbenchModalBufferCache,
  WorkbenchShelfBufferCache,
  WorkbenchTerminalBufferCache,
  WorkbenchTerminalSessionTabBufferCache,
  WorkbenchTitlebarBufferCache,
} from "../src/app/workbench_buffers.ts";
import {
  createWorkbenchShelfLayoutBuffers,
  layoutWorkbenchShelf,
  layoutWorkbenchShelfInto,
  layoutWorkbenchTabs,
  layoutWorkbenchTabsInto,
  workbenchShelfEntriesInto,
  workbenchShelfRenderCommandsInto,
  type WorkbenchShelfSource,
  workbenchTabEntriesInto,
  type WorkbenchTabSource,
} from "../src/app/workbench_shelf.ts";
import {
  createWorkbenchVisualizationWindowOptions,
  createWorkbenchWindowOptions,
  isWorkbenchVisualizationWindowId,
  isWorkbenchWindowOptionLoaded,
  workbenchBuiltInWindowTogglePlan,
  workbenchVisualizationIdFromWindowId,
  workbenchVisualizationWindowId,
  workbenchVisualizationWindowRegistrationPlan,
  workbenchVisualizationWindowTogglePlan,
  workbenchWindowOptionMenuLabel,
  workbenchWindowOptionMenuLabelsInto,
  workbenchWindowOptionMinimums,
  workbenchWindowOptionTogglePlan,
  workbenchWindowOptionWindowId,
} from "../src/app/workbench_window_registry.ts";
import {
  workbenchTerminalCopyRowsInto,
  workbenchTerminalPaneProjectionsInto,
  workbenchTerminalPaneTitleRenderCommandsInto,
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
  type WorkbenchTerminalToolbarAction,
} from "../src/app/workbench_terminal.ts";
import { renderApiWorkbenchTerminalOutputToolbar } from "../app/api_workbench_terminal_output_view.ts";
import {
  renderApiWorkbenchTerminalSessionTabs,
  renderApiWorkbenchTerminalShellToolbar,
} from "../app/api_workbench_terminal_shell_view.ts";
import type { TerminalShellWorkspaceInspection } from "../src/runtime/terminal_shell_workspace.ts";

Deno.test("WorkbenchController coordinates menus and window state", () => {
  const events: unknown[] = [];
  const controller = new WorkbenchController<"theme" | "new">({
    activeId: "inspector",
    menu: { onChange: (event) => events.push(event) },
    menuIndexes: { theme: 3 },
    windows: [
      { id: "explorer", title: "Explorer" },
      { id: "inspector", title: "Inspector" },
      { id: "logs", title: "Logs", state: "closed" },
    ],
  });

  assertEquals(controller.inspect().activeWindowId, "inspector");
  assertEquals(controller.inspect().closedWindowIds, ["logs"]);
  assertEquals(controller.openMenu("theme", 2), { openId: "theme", focused: true });
  assertEquals(controller.menuIndex("theme"), 1);
  assertEquals(controller.moveMenuIndex("theme", 4, "down"), 2);
  assertEquals(controller.toggleMenu("new"), { openId: "new", focused: true });
  assertEquals(controller.closeMenus(), { openId: null, focused: false });

  assertEquals(controller.focusNextWindow(), "explorer");
  assertEquals(controller.toggleFullscreenWindow(), "explorer");
  assertEquals(controller.inspect().fullscreenWindowId, "explorer");
  assertEquals(controller.minimizeWindow("explorer"), "explorer");
  assertEquals(controller.inspect().minimizedWindowIds, ["explorer"]);
  assertEquals(controller.restoreWindows("explorer"), "explorer");
  assertEquals(controller.closeWindow("explorer"), "explorer");
  assertEquals(controller.inspect().closedWindowIds, ["explorer", "logs"]);
  assertEquals(controller.inspect().visibleWindowIds, ["inspector"]);

  assertEquals(events, [
    { openId: "theme", focused: true },
    { openId: "new", focused: true },
    { openId: null, focused: false },
  ]);

  controller.dispose();
});

Deno.test("WorkbenchController keeps menu index updates bounded", () => {
  const controller = new WorkbenchController<"workspace">({
    windows: [{ id: "only", title: "Only" }],
  });

  assertEquals(controller.setMenuIndex("workspace", Number.NaN, 5), 0);
  assertEquals(controller.setMenuIndex("workspace", 99, 5), 4);
  assertEquals(controller.setMenuIndex("workspace", -4, 5), 0);
  assertEquals(controller.setMenuIndex("workspace", 2.8, 0), 0);
  assertEquals(controller.moveMenuIndex("workspace", 3, "up"), 2);

  controller.dispose();
});

Deno.test("WorkbenchController cycles focus forward and backward across open windows", () => {
  const controller = new WorkbenchController<"theme">({
    activeId: "data",
    windows: [
      { id: "explorer", title: "Explorer" },
      { id: "data", title: "Data" },
      { id: "logs", title: "Logs" },
      { id: "closed", title: "Closed", state: "closed" },
    ],
  });

  assertEquals(controller.focusNextWindow(), "logs");
  assertEquals(controller.focusNextWindow(), "explorer");
  assertEquals(controller.focusNextWindow(-1), "logs");
  assertEquals(controller.focusNextWindow(-1), "data");
  assertEquals(controller.inspect().activeWindowId, "data");

  controller.dispose();
});

Deno.test("workbench window action log helper formats standard messages", () => {
  assertEquals(workbenchWindowActionLog("focus", "Inspector"), "focus Inspector");
  assertEquals(workbenchWindowActionLog("minimize", "Logs"), "minimize Logs");
  assertEquals(workbenchWindowActionLog("maximize", "Three"), "maximize Three");
  assertEquals(workbenchWindowActionLog("restore", "Three"), "restore Three");
  assertEquals(workbenchWindowActionLog("fullscreenTab", "Data"), "fullscreen tab Data");
});

Deno.test("WorkbenchController supports matching terminal and web adapter flows", () => {
  const terminal = createAdapterController<"theme" | "newWindow" | "workspace">();
  const web = createAdapterController<"theme">();

  assertEquals(runTerminalAdapterFlow(terminal), {
    activeWindowId: "data",
    fullscreenWindowId: "data",
    menu: { openId: null, focused: false },
    menuIndexes: { newWindow: 2, theme: 1, workspace: 0 },
    windowIds: ["inspector", "data", "logs"],
    visibleWindowIds: ["inspector", "data", "logs"],
    minimizedWindowIds: [],
    closedWindowIds: [],
  });

  assertEquals(runWebAdapterFlow(web), {
    activeWindowId: "data",
    fullscreenWindowId: "data",
    menu: { openId: null, focused: false },
    menuIndexes: { theme: 1 },
    windowIds: ["inspector", "data", "logs"],
    visibleWindowIds: ["inspector", "data", "logs"],
    minimizedWindowIds: [],
    closedWindowIds: [],
  });

  terminal.dispose();
  web.dispose();
});

Deno.test("WorkbenchController close command removes windows from adapter visibility", () => {
  const terminal = createAdapterController<"theme" | "newWindow" | "workspace">();
  const web = createAdapterController<"theme">();

  assertEquals(runCloseAdapterFlow(terminal), {
    activeWindowId: "data",
    fullscreenWindowId: undefined,
    menu: { openId: null, focused: false },
    menuIndexes: {},
    windowIds: ["inspector", "data", "logs"],
    visibleWindowIds: ["data", "logs"],
    minimizedWindowIds: [],
    closedWindowIds: ["inspector"],
  });
  assertEquals(runCloseAdapterFlow(web), {
    activeWindowId: "data",
    fullscreenWindowId: undefined,
    menu: { openId: null, focused: false },
    menuIndexes: {},
    windowIds: ["inspector", "data", "logs"],
    visibleWindowIds: ["data", "logs"],
    minimizedWindowIds: [],
    closedWindowIds: ["inspector"],
  });

  terminal.dispose();
  web.dispose();
});

Deno.test("workbench window signal bridge round trips adapter state", () => {
  type Id = "inspector" | "data" | "logs";
  const controller = createAdapterController<"theme">();

  applyWorkbenchWindowSignalState<Id>(
    controller.windows,
    {
      activeId: "data",
      fullscreenId: "logs",
      minimized: { inspector: true, data: false, logs: false },
    },
    {
      windowIds: ["inspector", "data", "logs"],
      createWindow: (id, order) => ({ id, title: id, order, minWidth: 20, minHeight: 8 }),
    },
  );

  assertEquals(
    inspectWorkbenchWindowSignalState<Id>(controller.windows, {
      windowIds: ["inspector", "data", "logs"],
      defaultActiveId: "inspector",
    }),
    {
      activeId: "data",
      fullscreenId: "logs",
      minimized: { inspector: true, data: false, logs: false },
    },
  );

  controller.dispose();
});

Deno.test("workbench window signal bridge ignores stale adapter ids", () => {
  type Id = "inspector" | "data";
  const controller = new WorkbenchController<"theme">({
    windows: [
      { id: "inspector", title: "Inspector" },
      { id: "data", title: "Data" },
    ],
  });

  applyWorkbenchWindowSignalState<Id>(
    controller.windows,
    {
      activeId: "missing" as Id,
      fullscreenId: "missing" as Id,
      minimized: { inspector: false, data: true },
    },
    {
      windowIds: ["inspector", "data"],
      createWindow: (id, order) => ({ id, title: id, order }),
    },
  );

  assertEquals(
    inspectWorkbenchWindowSignalState<Id>(controller.windows, {
      windowIds: ["inspector", "data"],
      defaultActiveId: "inspector",
    }),
    {
      activeId: "inspector",
      fullscreenId: null,
      minimized: { inspector: false, data: true },
    },
  );

  controller.dispose();
});

Deno.test("workbench window registry projects visualization metadata into launcher options", () => {
  const options = createWorkbenchVisualizationWindowOptions([
    { id: "cpu-hex-grid", name: "CPU Hex Grid", description: "cores", family: "monitor" },
    { id: "magi-board", name: "MAGI Board", description: "neon", family: "neon" },
    { id: "eva-lattice", name: "Lattice", description: "3d", family: "neon3d" },
  ]);

  assertEquals(options.map((option) => option.group), ["Monitor", "Neon", "Neon 3D"]);
  assertEquals(options[0]?.label, "CPU Hex Grid");
});

Deno.test("workbench window registry keeps legacy visualization grouping fallback", () => {
  assertEquals(
    createWorkbenchVisualizationWindowOptions([
      { id: "three-lattice", name: "Lattice", description: "3d" },
      { id: "magi-board", name: "MAGI Board", description: "neon" },
    ], new Set(["magi-board"])).map((option) => option.group),
    ["Neon 3D", "Neon"],
  );
});

Deno.test("workbench window registry keeps built-ins ahead of visualization options", () => {
  const options = createWorkbenchWindowOptions({
    builtIns: [{ id: "shell", label: "Shell", group: "Terminal", description: "pty", windowId: "terminalShell" }],
    visualizations: [{ id: "network-monitor", name: "Network", description: "io" }],
  });

  assertEquals(options.map((option) => option.id), ["shell", "network-monitor"]);
  assertEquals(options[0]?.windowId, "terminalShell");
});

Deno.test("workbench window registry normalizes visualization window ids and loaded state", () => {
  const id = workbenchVisualizationWindowId("CPU Hex Grid!!");
  const option = { id: "CPU Hex Grid!!", label: "CPU", group: "Monitor" as const, description: "cores" };

  assertEquals(id, "viz:cpu-hex-grid--");
  assertEquals(isWorkbenchVisualizationWindowId(id), true);
  assertEquals(workbenchVisualizationIdFromWindowId(id), "cpu-hex-grid--");
  assertEquals(workbenchWindowOptionWindowId(option), id);
  assertEquals(workbenchWindowOptionWindowId({ ...option, windowId: "cpu" }), "cpu");
  assertEquals(isWorkbenchWindowOptionLoaded(option, [id]), true);
  assertEquals(isWorkbenchWindowOptionLoaded({ ...option, windowId: "cpu" }, ["cpu"]), true);
});

Deno.test("workbench window registry resolves selected New Window options", () => {
  const builtIn = {
    id: "terminal-shell",
    label: "Shell",
    group: "Terminal" as const,
    description: "pty",
    windowId: "terminalShell",
  };
  const visualization = {
    id: "cpu-hex-grid",
    label: "CPU Hex Grid",
    group: "Monitor" as const,
    description: "cores",
  };

  assertEquals(workbenchWindowOptionTogglePlan(undefined), { action: "none" });
  assertEquals(workbenchWindowOptionTogglePlan(builtIn), {
    action: "builtIn",
    id: "terminalShell",
    option: builtIn,
  });
  assertEquals(workbenchWindowOptionTogglePlan(visualization), {
    action: "visualization",
    option: visualization,
  });
});

Deno.test("workbench window registry formats labels and option minimums", () => {
  assertEquals(
    workbenchWindowOptionMenuLabel(
      { id: "three-lattice", label: "Lattice", group: "Neon 3D", description: "3d" },
      true,
    ),
    "[x] Neon 3D: Lattice",
  );
  assertEquals(
    workbenchWindowOptionMinimums({ id: "gpu-chip-monitor", label: "GPU", group: "Monitor", description: "gpu" }),
    { minWidth: 40, minHeight: 13 },
  );
  assertEquals(
    workbenchWindowOptionMinimums({ id: "three-lattice", label: "Lattice", group: "Neon 3D", description: "3d" }),
    { minWidth: 42, minHeight: 16 },
  );
});

Deno.test("workbench window registry plans visualization window creation and restore", () => {
  const option = {
    id: "cpu-hex-grid",
    label: "CPU Hex Grid",
    group: "Monitor" as const,
    description: "cores",
  };

  assertEquals(
    workbenchVisualizationWindowRegistrationPlan({
      option,
      existingWindowIds: ["explorer", "controls"],
      currentWindowCount: 4,
    }),
    {
      id: "viz:cpu-hex-grid",
      visualizationId: "cpu-hex-grid",
      action: "create",
      registration: {
        id: "viz:cpu-hex-grid",
        title: "CPU Hex Grid",
        minWidth: 36,
        minHeight: 12,
        closable: true,
        order: 4,
      },
    },
  );

  assertEquals(
    workbenchVisualizationWindowRegistrationPlan({
      option,
      existingWindowIds: ["viz:cpu-hex-grid"],
      currentWindowCount: 9,
    }),
    {
      id: "viz:cpu-hex-grid",
      visualizationId: "cpu-hex-grid",
      action: "restore",
    },
  );
});

Deno.test("workbench window registry plans visualization window toggles", () => {
  const option = {
    id: "cpu-hex-grid",
    label: "CPU Hex Grid",
    group: "Monitor" as const,
    description: "cores",
  };

  assertEquals(workbenchVisualizationWindowTogglePlan({ option: undefined, loadedWindowIds: [] }), {
    action: "none",
  });
  assertEquals(workbenchVisualizationWindowTogglePlan({ option, loadedWindowIds: ["explorer"] }), {
    action: "add",
    id: "viz:cpu-hex-grid",
    option,
  });
  assertEquals(workbenchVisualizationWindowTogglePlan({ option, loadedWindowIds: ["viz:cpu-hex-grid"] }), {
    action: "close",
    id: "viz:cpu-hex-grid",
    option,
  });
});

Deno.test("workbench window registry plans built-in window toggles", () => {
  assertEquals(
    workbenchBuiltInWindowTogglePlan({
      id: "logs",
      loadedWindowIds: ["logs", "controls"],
      keepMenuOpen: true,
      terminalShellWindowId: "terminalShell",
    }),
    {
      id: "logs",
      action: "close",
      keepMenuOpen: true,
      focusTopMenuAfterAction: true,
      startTerminalShell: false,
    },
  );

  assertEquals(
    workbenchBuiltInWindowTogglePlan({
      id: "data",
      loadedWindowIds: ["logs", "controls"],
      terminalShellWindowId: "terminalShell",
    }),
    {
      id: "data",
      action: "restore",
      keepMenuOpen: false,
      focusTopMenuAfterAction: false,
      startTerminalShell: false,
    },
  );

  assertEquals(
    workbenchBuiltInWindowTogglePlan({
      id: "terminalShell",
      loadedWindowIds: [],
      keepMenuOpen: true,
      terminalShellWindowId: "terminalShell",
    }),
    {
      id: "terminalShell",
      action: "restore",
      keepMenuOpen: false,
      focusTopMenuAfterAction: false,
      startTerminalShell: true,
    },
  );
});

Deno.test("workbench window registry projects menu labels into a caller buffer", () => {
  const options = [
    { id: "shell", label: "Shell", group: "Terminal" as const, description: "pty", windowId: "terminalShell" },
    { id: "cpu-hex-grid", label: "CPU Hex Grid", group: "Monitor" as const, description: "cores" },
  ];
  const target = ["stale", "rows", "trimmed"];

  assertEquals(workbenchWindowOptionMenuLabelsInto(target, options, ["terminalShell"]), [
    "[x] Terminal: Shell",
    "[ ] Monitor: CPU Hex Grid",
  ]);
  assertEquals(target.length, 2);
  assertEquals(
    workbenchWindowOptionMenuLabelsInto(target, options.slice(1), [workbenchVisualizationWindowId("cpu-hex-grid")]),
    [
      "[x] Monitor: CPU Hex Grid",
    ],
  );
  assertEquals(target.length, 1);
});

Deno.test("workbench shelf layout places minimized buttons after the prefix", () => {
  const layout = layoutWorkbenchShelf({
    row: 8,
    column: 1,
    width: 60,
    entries: [
      { id: "logs", title: "Logs" },
      { id: "three", title: "Three ASCII" },
    ],
  });

  assertEquals(layout.prefixRect, { column: 1, row: 8, width: 10, height: 1 });
  assertEquals(layout.buttons.map((button) => [button.id, button.label, button.rect, button.hidden]), [
    ["logs", "Logs", { column: 11, row: 8, width: 8, height: 1 }, true],
    ["three", "Three ASCII", { column: 20, row: 8, width: 15, height: 1 }, true],
  ]);
});

Deno.test("workbench tab layout adds fullscreen and hidden markers", () => {
  const layout = layoutWorkbenchTabs({
    row: 12,
    column: 2,
    width: 72,
    tabs: [
      { id: "data", title: "Data", selected: true },
      { id: "logs", title: "Logs", hidden: true },
      { id: "three", title: "Three" },
    ],
  });

  assertEquals(layout.prefixRect, { column: 2, row: 12, width: 8, height: 1 });
  assertEquals(layout.buttons.map((button) => [button.id, button.label, button.selected, button.hidden]), [
    ["data", "● Data", true, false],
    ["logs", "○ Logs", false, true],
    ["three", "  Three", false, false],
  ]);
});

Deno.test("workbench shelf and tab layout clip buttons to the available row width", () => {
  const shelf = layoutWorkbenchShelf({
    row: 0,
    column: 0,
    width: 17,
    entries: [{ id: "long", title: "Very Long Window" }],
  });
  const tabs = layoutWorkbenchTabs({
    row: 0,
    column: 0,
    width: 18,
    tabs: [{ id: "long", title: "Very Long Window", selected: true }],
  });

  assertEquals(shelf.buttons[0]?.rect, { column: 10, row: 0, width: 7, height: 1 });
  assertEquals(tabs.buttons[0]?.rect, { column: 8, row: 0, width: 10, height: 1 });
});

Deno.test("workbench shelf and tab layouts can reuse caller-owned buffers", () => {
  const shelfBuffers = createWorkbenchShelfLayoutBuffers<"logs" | "three">();
  const first = layoutWorkbenchShelfInto(shelfBuffers, {
    row: 8,
    column: 1,
    width: 60,
    entries: [
      { id: "logs", title: "Logs" },
      { id: "three", title: "Three ASCII" },
    ],
  });
  const firstButtons = first.buttons;
  const firstItems = shelfBuffers.items;
  const firstPlacements = shelfBuffers.placements;

  const second = layoutWorkbenchShelfInto(shelfBuffers, {
    row: 9,
    column: 2,
    width: 24,
    entries: [{ id: "three", title: "Three ASCII" }],
  });

  assertEquals(second.buttons === firstButtons, true);
  assertEquals(shelfBuffers.items === firstItems, true);
  assertEquals(shelfBuffers.placements === firstPlacements, true);
  assertEquals(second.buttons.map((button) => [button.id, button.rect]), [
    ["three", { column: 12, row: 9, width: 14, height: 1 }],
  ]);

  const tabBuffers = createWorkbenchShelfLayoutBuffers<"logs">();
  const tabs = layoutWorkbenchTabsInto(tabBuffers, {
    row: 4,
    column: 0,
    width: 30,
    tabs: [{ id: "logs", title: "Logs", selected: true }],
  });
  assertEquals(tabs.buttons, [
    {
      id: "logs",
      label: "● Logs",
      rect: { column: 8, row: 4, width: 10, height: 1 },
      selected: true,
      hidden: false,
    },
  ]);
});

Deno.test("workbench shelf projections reuse buffers for minimized windows and tabs", () => {
  const shelf: WorkbenchShelfSource<"one" | "two" | "three">[] = [{ id: "one", title: "stale" }];
  const tabs: WorkbenchTabSource<"one" | "two" | "three">[] = [];
  const windows = [
    { id: "one", minimized: true },
    { id: "two", minimized: false },
    { id: "three", minimized: true, closed: true },
  ];

  assertEquals(workbenchShelfEntriesInto(shelf, windows, (id) => `Window ${id}`), [
    { id: "one", title: "Window one" },
  ]);
  assertEquals(shelf.length, 1);

  assertEquals(
    workbenchTabEntriesInto(tabs, [
      { id: "one", fullscreen: true },
      { id: "two", minimized: true },
    ], (id) => `Window ${id}`),
    [
      { id: "one", title: "Window one", selected: true, hidden: false },
      { id: "two", title: "Window two", selected: false, hidden: true },
    ],
  );
});

Deno.test("workbench shelf render commands project prefix buttons and hit rectangles", () => {
  const layout = layoutWorkbenchShelf({
    row: 3,
    column: 1,
    width: 32,
    entries: [{ id: "logs", title: "Logs" }],
  });
  const commands = workbenchShelfRenderCommandsInto([], layout);

  assertEquals(commands, [
    {
      kind: "prefix",
      text: "minimized ",
      rect: { column: 1, row: 3, width: 10, height: 1 },
    },
    {
      kind: "button",
      id: "logs",
      label: "Logs",
      text: "[ Logs ]",
      rect: { column: 11, row: 3, width: 8, height: 1 },
      hitRect: { column: 11, row: 3, width: 8, height: 1 },
      selected: false,
      hidden: true,
      state: "base",
      tone: "muted",
    },
  ]);
});

Deno.test("workbench tab render commands map selected and hidden state", () => {
  const layout = layoutWorkbenchTabs({
    row: 5,
    column: 0,
    width: 40,
    tabs: [
      { id: "data", title: "Data", selected: true },
      { id: "logs", title: "Logs", hidden: true },
    ],
  });
  const target = workbenchShelfRenderCommandsInto([], layout);
  const firstButton = target[1];
  const secondButton = target[2];

  assertEquals(firstButton?.kind, "button");
  if (firstButton?.kind === "button") {
    assertEquals([firstButton.id, firstButton.state, firstButton.tone, firstButton.selected, firstButton.hidden], [
      "data",
      "active",
      "default",
      true,
      false,
    ]);
  }
  assertEquals(secondButton?.kind, "button");
  if (secondButton?.kind === "button") {
    assertEquals([secondButton.id, secondButton.state, secondButton.tone, secondButton.selected, secondButton.hidden], [
      "logs",
      "base",
      "muted",
      false,
      true,
    ]);
  }
});

Deno.test("workbench shelf render commands clip and reuse caller buffers", () => {
  const layout = layoutWorkbenchShelf({
    row: 2,
    column: 0,
    width: 17,
    entries: [{ id: "long", title: "Very Long Window" }],
  });
  const target = workbenchShelfRenderCommandsInto([], layout);
  const prefix = target[0];
  const button = target[1];

  assertEquals(button?.kind, "button");
  if (button?.kind === "button") {
    assertEquals(button.text, "[ Very…");
    assertEquals(button.rect, { column: 10, row: 2, width: 7, height: 1 });
    assertEquals(button.hitRect, button.rect);
  }

  const reusedPrefix = prefix;
  const reusedButton = button;
  const next = workbenchShelfRenderCommandsInto(
    target,
    layoutWorkbenchShelf({
      row: 4,
      column: 1,
      width: 20,
      entries: [{ id: "long", title: "Short" }],
    }),
  );

  assertEquals(next[0] === reusedPrefix, true);
  assertEquals(next[1] === reusedButton, true);
  assertEquals(next.length, 2);
});

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

Deno.test("renderApiWorkbenchTerminalOutputToolbar paints actions and registers enabled hits", () => {
  const cache = new WorkbenchButtonRowBufferCache<"run" | "stop" | "clear" | "raw">();
  const frame: string[][] = [[]];
  const hits: Array<{ action: string; width: number }> = [];

  const nextRow = renderApiWorkbenchTerminalOutputToolbar({
    frame,
    rect: { column: 1, row: 0, width: 48, height: 2 },
    startRow: 0,
    state: {
      running: true,
      outputLineCount: 3,
      follow: true,
      inputMode: "workbench",
    },
    buffers: cache,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    paint: (text, style) => `${style.bg}:${style.fg}:${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    addHit: (rect, action) => hits.push({ action: action.action, width: rect.width }),
  });

  assertEquals(nextRow > 0, true);
  assertEquals(cache.commands.length > 0, true);
  assertEquals(hits.some((hit) => hit.action === "stop"), true);
  assertEquals(hits.some((hit) => hit.action === "run"), false);
  assertEquals(frame[0]?.some((cell) => cell?.includes("[ Stop ]")), true);
});

Deno.test("renderApiWorkbenchTerminalShellToolbar paints shell actions and registers hits", () => {
  const cache = new WorkbenchButtonRowBufferCache<WorkbenchTerminalToolbarAction>();
  const frame: string[][] = [[]];
  const hits: Array<{ action: string; width: number }> = [];

  const nextRow = renderApiWorkbenchTerminalShellToolbar({
    frame,
    rect: { column: 1, row: 0, width: 56, height: 2 },
    startRow: 0,
    state: {
      activeId: "shell-1",
      sessionCount: 2,
      paneCount: 1,
      shellRunning: true,
      shellStarting: false,
      inputMode: "workbench",
      copyMode: false,
      scrollbackTotalRows: 10,
      scrollbackViewportRows: 4,
    },
    buffers: cache,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    paint: (text, style) => `${style.bg}:${style.fg}:${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    addHit: (rect, action) => hits.push({ action: action.action, width: rect.width }),
  });

  assertEquals(nextRow > 0, true);
  assertEquals(cache.commands.length > 0, true);
  assertEquals(hits.some((hit) => hit.action === "stop"), true);
  assertEquals(hits.some((hit) => hit.action === "start"), false);
  assertEquals(frame.some((row) => row.some((cell) => cell?.includes("[ Stop ]"))), true);
});

Deno.test("renderApiWorkbenchTerminalSessionTabs paints tabs and registers tab hits", () => {
  const cache = new WorkbenchTerminalSessionTabBufferCache();
  const frame: string[][] = [[]];
  const hits: Array<{ rect: unknown; id: string }> = [];
  const inspection = {
    activeId: "shell-2",
    sessions: [
      { id: "shell-1", title: "Shell 1", shell: { running: true, status: "running" } },
      { id: "shell-2", title: "Shell 2", shell: { running: false, status: "idle" } },
    ],
  } as TerminalShellWorkspaceInspection;

  const nextRow = renderApiWorkbenchTerminalSessionTabs({
    frame,
    rect: { column: 2, row: 0, width: 30, height: 2 },
    startRow: 0,
    inspection,
    buffers: cache,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    paint: (text, style) => `${style.bg}:${style.fg}:${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    addHit: (rect, action) => hits.push({ rect, id: action.id }),
  });

  assertEquals(nextRow, 1);
  assertEquals(cache.inspect(), { sources: 2, placements: 2, commands: 4 });
  assertEquals(hits.map((hit) => hit.id), ["shell-1", "shell-2"]);
  assertEquals(frame[0]?.some((cell) => cell?.includes("Shell 2")), true);
  assertEquals(frame[0]?.some((cell) => cell?.startsWith("#0f0:#000:")), true);
});

function testWorkbenchTheme() {
  return {
    id: "test",
    label: "Test",
    background: "#000",
    backgroundSoft: "#111",
    panel: "#111",
    panelSoft: "#222",
    surface: "#111",
    border: "#333",
    borderStrong: "#444",
    accent: "#0f0",
    accentDeep: "#080",
    text: "#fff",
    muted: "#aaa",
    soft: "#ccc",
    good: "#0f0",
    warn: "#ff0",
    danger: "#f00",
    buttonBg: "#222",
    buttonText: "#fff",
    buttonActiveBg: "#0f0",
    buttonActiveText: "#000",
    buttonMutedBg: "#111",
    buttonMutedText: "#777",
  };
}

Deno.test("workbench buffer caches reuse per-window titlebar buffers", () => {
  const cache = new WorkbenchTitlebarBufferCache<"a" | "b">();
  const layout = cache.layout("a");
  const commands = cache.renderCommands("a");

  assertStrictEquals(cache.layout("a"), layout);
  assertStrictEquals(cache.renderCommands("a"), commands);
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

function createAdapterController<MenuId extends string>(): WorkbenchController<MenuId> {
  return new WorkbenchController<MenuId>({
    activeId: "inspector",
    windows: [
      { id: "inspector", title: "Inspector" },
      { id: "data", title: "Data" },
      { id: "logs", title: "Logs" },
    ],
  });
}

function runTerminalAdapterFlow(
  controller: WorkbenchController<"theme" | "newWindow" | "workspace">,
) {
  controller.openMenu("newWindow", 4);
  controller.moveMenuIndex("newWindow", 4, "down");
  controller.moveMenuIndex("newWindow", 4, "down");
  controller.toggleMenu("workspace", 2);
  controller.openMenu("theme", 3);
  controller.moveMenuIndex("theme", 3, "down");
  controller.closeMenus();
  controller.focusWindow("data");
  controller.toggleFullscreenWindow();
  return controller.inspect();
}

function runWebAdapterFlow(controller: WorkbenchController<"theme">) {
  controller.openMenu("theme", 3);
  controller.moveMenuIndex("theme", 3, "down");
  controller.closeMenus();
  controller.focusWindow("logs");
  controller.focusNextWindow(-1);
  controller.toggleFullscreenWindow();
  return controller.inspect();
}

function runCloseAdapterFlow<MenuId extends string>(controller: WorkbenchController<MenuId>) {
  controller.closeWindow("inspector");
  return controller.inspect();
}
