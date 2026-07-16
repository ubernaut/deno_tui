import { assertEquals, assertStrictEquals } from "./deps.ts";
import type { DataColumn, DataTableView } from "../src/components/data_table.ts";
import type { ModalInspection } from "../src/components/modal.ts";
import { ScrollAreaController } from "../src/components/scroll_area.ts";
import {
  createDefaultWorkbenchAsciiOptions,
  defaultWorkbenchAsciiConfigRows,
  formatWorkbenchAsciiConfigRowText,
  type WorkbenchAsciiConfigRow,
} from "../src/app/workbench_ascii.ts";
import { WorkbenchAsciiConfigModalBufferCache } from "../src/app/workbench_ascii_modal.ts";
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
  type WorkbenchTerminalOutputWindowRow,
  workbenchTerminalPaneProjectionsInto,
  workbenchTerminalPaneTitleRenderCommandsInto,
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
  type WorkbenchTerminalShellHeaderRow,
  type WorkbenchTerminalToolbarAction,
} from "../src/app/workbench_terminal.ts";
import { WorkbenchThreeGridProjectionCache } from "../src/app/workbench_three_grid.ts";
import {
  addApiWorkbenchCpuHexTileHits,
  ApiWorkbenchControlsViewBufferCache,
  renderApiWorkbenchControls,
  renderApiWorkbenchDataPanel,
  renderApiWorkbenchExplorerPanel,
  renderApiWorkbenchInspectorPanel,
  renderApiWorkbenchLogsPanel,
  renderApiWorkbenchVisualizationMissing,
  renderApiWorkbenchVisualizationTextWindow,
  renderApiWorkbenchVisualizationThreeChrome,
} from "../app/workbench_panels.ts";
import {
  ApiWorkbenchWindowShellBufferCache,
  renderApiWorkbenchChromeHeader,
  renderApiWorkbenchDropdownOverlay,
  renderApiWorkbenchModalOverlay,
  renderApiWorkbenchShelf,
  renderApiWorkbenchStatus,
  renderApiWorkbenchTerminalOutputBody,
  renderApiWorkbenchTerminalOutputToolbar,
  renderApiWorkbenchTerminalSessionTabs,
  renderApiWorkbenchTerminalShellHeader,
  renderApiWorkbenchTerminalShellPanes,
  renderApiWorkbenchTerminalShellToolbar,
  renderApiWorkbenchThreeConfigModal,
  renderApiWorkbenchThreeFallback,
  renderApiWorkbenchThreeHeader,
  renderApiWorkbenchThreeSurface,
  renderApiWorkbenchWindowShell,
  renderApiWorkbenchWindowTabs,
} from "../app/api_workbench_window_view.ts";
import type { ProcessSessionInspection } from "../src/runtime/process_session.ts";
import type { TerminalShellController, TerminalShellInspection } from "../src/runtime/terminal_shell.ts";
import type { TerminalShellWorkspaceInspection } from "../src/runtime/terminal_shell_workspace.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";
import type { PanelRender } from "../app/types.ts";

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
  assertEquals(controller.inspect().menuIndexes, { theme: 2 });
  assertEquals(controller.toggleMenu("new"), { openId: "new", focused: true });
  assertEquals(controller.closeMenus(), { openId: null, focused: false });

  assertEquals(controller.focusNextWindow(), "explorer");
  assertEquals(controller.moveWindow("explorer", 1), "explorer");
  assertEquals(controller.windows.ids(), ["inspector", "explorer"]);
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

Deno.test("renderApiWorkbenchShelf paints minimized windows and registers restore hits", () => {
  const cache = new WorkbenchShelfBufferCache<"logs" | "three">();
  const frame: string[][] = [[]];
  const buttons: Array<{ label: string; state?: string; tone?: string; width?: number }> = [];
  const hits: Array<{ id: string; width: number }> = [];

  renderApiWorkbenchShelf({
    frame,
    row: 0,
    column: 1,
    width: 40,
    windows: [
      { id: "logs", minimized: true },
      { id: "three", minimized: false },
    ],
    buffers: cache,
    theme: testWorkbenchTheme(),
    titleForId: (id) => id === "logs" ? "Logs" : "Three",
    paint: (text, style) => `${style.bg}:${style.fg}:${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    writeButton: (_target, _row, _column, label, options) => {
      buttons.push({ label, state: options?.state, tone: options?.tone, width: options?.maxWidth });
      return options?.maxWidth ?? 0;
    },
    addHit: (rect, action) => hits.push({ id: action.id, width: rect.width }),
  });

  assertEquals(frame[0]?.[1], "#111:#aaa:minimized ");
  assertEquals(buttons, [{ label: "Logs", state: "base", tone: "muted", width: 8 }]);
  assertEquals(hits, [{ id: "logs", width: 8 }]);
});

Deno.test("renderApiWorkbenchWindowTabs paints tab strip and registers tab hits", () => {
  const cache = new WorkbenchShelfBufferCache<"logs" | "three">();
  const frame: string[][] = [[]];
  const fills: Array<{ row: number; bg: string }> = [];
  const buttons: Array<{ label: string; state?: string; tone?: string }> = [];
  const hits: Array<{ id: string; width: number }> = [];

  renderApiWorkbenchWindowTabs({
    frame,
    row: 0,
    column: 1,
    width: 42,
    tabs: [
      { id: "logs", fullscreen: false, minimized: true },
      { id: "three", fullscreen: true },
    ],
    buffers: cache,
    theme: testWorkbenchTheme(),
    titleForId: (id) => id === "logs" ? "Logs" : "Three",
    paint: (text, style) => `${style.bg}:${style.fg}:${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    fillRow: (_target, row, bg) => fills.push({ row, bg }),
    writeButton: (_target, _row, _column, label, options) => {
      buttons.push({ label, state: options?.state, tone: options?.tone });
      return options?.maxWidth ?? 0;
    },
    addHit: (rect, action) => hits.push({ id: action.id, width: rect.width }),
  });

  assertEquals(fills, [{ row: 0, bg: "#111" }]);
  assertEquals(frame[0]?.[1], "#111:#aaa:windows ");
  assertEquals(buttons, [
    { label: "○ Logs", state: "base", tone: "muted" },
    { label: "● Three", state: "active", tone: "default" },
  ]);
  assertEquals(hits.map((hit) => hit.id), ["logs", "three"]);
});

Deno.test("renderApiWorkbenchWindowShell paints frame content titlebar and scrollbars", () => {
  type TestWindowAction =
    | { type: "focus"; id: "logs" }
    | { type: "drag"; id: "logs" }
    | { type: "titlebar"; id: "logs"; kind: string }
    | { type: "scrollbar"; id: "logs"; axis: "vertical" | "horizontal" };

  const frame: string[][] = [];
  const contentFrame: string[][] = [];
  const fills: Array<{ row: number; width: number; bg: string }> = [];
  const buttons: Array<{ label: string; tone?: string; accessibilityLabel?: string; shortcut?: string }> = [];
  const hits: Array<TestWindowAction & { width: number }> = [];
  const hints: number[] = [];
  let contentRows = 0;
  let contentContext:
    | {
      viewport: { column: number; row: number; width: number; height: number };
      offset: { columns: number; rows: number };
    }
    | undefined;
  let translatedHitStart = -1;

  const fillRect = (
    target: string[][],
    rect: { column: number; row: number; width: number; height: number },
    bg: string,
  ) => {
    fills.push({ row: rect.row, width: rect.width, bg });
    for (let row = 0; row < rect.height; row += 1) {
      const targetRow = target[rect.row + row] ??= [];
      for (let column = 0; column < rect.width; column += 1) {
        targetRow[rect.column + column] = `${bg}: `;
      }
    }
  };

  const rendered = renderApiWorkbenchWindowShell<"logs", TestWindowAction>({
    frame,
    id: "logs",
    rect: { column: 0, row: 0, width: 28, height: 8 },
    minimized: false,
    active: true,
    maximized: false,
    title: "Logs",
    showConfig: true,
    theme: testWorkbenchTheme(),
    buffers: new ApiWorkbenchWindowShellBufferCache<"logs">(),
    scroll: new ScrollAreaController({ showScrollbar: true }),
    contentSizeForInner: () => ({ width: 34, height: 12 }),
    contentFrameForRows: (rows) => {
      contentRows = rows;
      contentFrame.length = rows;
      return contentFrame;
    },
    setFrameWidthHint: (_target, width) => hints.push(width),
    hitTargetCount: () => hits.length,
    renderContent: (target, _rect, context) => {
      contentContext = context;
      target[0] ??= [];
      target[0]![0] = "BODY";
    },
    afterRenderContent: (context) => {
      translatedHitStart = context.contentHitStart;
    },
    focusAction: (id) => ({ type: "focus", id }),
    titlebarAction: (id, kind) => ({ type: "titlebar", id, kind }),
    titlebarDragAction: (id) => ({ type: "drag", id }),
    scrollbarAction: (id, axis) => ({ type: "scrollbar", id, axis }),
    paint: (text, style) => `${style.bg ?? ""}:${style.fg ?? ""}:${style.bold ? "b:" : ""}${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    fillRect,
    writeButton: (_target, _row, _column, label, options) => {
      buttons.push({
        label,
        tone: options?.tone,
        accessibilityLabel: options?.accessibilityLabel,
        shortcut: options?.shortcut,
      });
      return label.length;
    },
    addHit: (rect, action) => hits.push({ ...action, width: rect.width }),
  });

  assertEquals(rendered, true);
  assertEquals(contentRows, 12);
  assertEquals(hints, [34]);
  assertEquals(contentContext?.viewport, { column: 1, row: 1, width: 25, height: 5 });
  assertEquals(translatedHitStart, 5);
  assertEquals(frame[1]?.[1], "BODY");
  assertEquals(buttons.some((button) => button.label === "x" && button.tone === "danger"), true);
  assertEquals(
    buttons.some((button) =>
      button.label === "x" && button.accessibilityLabel === "Close window" && button.shortcut === "C"
    ),
    true,
  );
  assertEquals(hits.some((hit) => hit.type === "focus" && hit.width === 28), true);
  assertEquals(hits.some((hit) => hit.type === "titlebar" && hit.kind === "close"), true);
  assertEquals(hits.some((hit) => hit.type === "drag"), true);
  assertEquals(hits.some((hit) => hit.type === "scrollbar" && hit.axis === "vertical"), true);
  assertEquals(fills.some((fill) => fill.row === 0 && fill.width === 28), true);
});

Deno.test("renderApiWorkbenchChromeHeader paints header hits and top menu overlay", () => {
  const frame: string[][] = [];
  const fills: Array<{ row: number; bg: string }> = [];
  const buttons: Array<{ label: string; row: number; tone?: string }> = [];
  const hits: Array<{ type: string; index?: number; width: number }> = [];

  const overlay = renderApiWorkbenchChromeHeader({
    frame,
    width: 80,
    menuItems: [
      { id: "theme", label: "Theme" },
      { id: "new", label: "New" },
      { id: "workspace", label: "Workspace" },
    ],
    menuActiveIndex: 0,
    openMenuId: "theme",
    dropdownEntries: {
      theme: {
        visible: { items: [], indexes: [] },
        labels: ["Light", "Dark"],
        selectedIndex: 1,
        preferredWidth: 18,
      },
    },
    headerLayout: { menu: { column: 0, row: 0, width: 0, height: 1 } },
    menuHitLayouts: [],
    theme: testWorkbenchTheme(),
    paint: (text, style) => `${style.bg}:${style.fg}:${style.bold ? "b:" : ""}${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    fillRow: (_target, row, bg) => fills.push({ row, bg }),
    writeButton: (_target, row, _column, label, options) => {
      buttons.push({ label, row, tone: options?.tone });
      return 0;
    },
    addHit: (rect, action) =>
      hits.push({ type: action.type, index: "index" in action ? action.index : undefined, width: rect.width }),
  });

  assertEquals(fills, [{ row: 0, bg: "#111" }]);
  assertEquals(frame[0]?.[0], "#0f0:#000:b: API WORKBENCH ");
  assertEquals(frame[0]?.[17]?.includes("[Theme]"), true);
  assertEquals(buttons, [{ label: "x", row: 0, tone: "danger" }]);
  assertEquals(hits.some((hit) => hit.type === "menu" && hit.index === 0), true);
  assertEquals(hits.some((hit) => hit.type === "quit"), true);
  assertEquals(overlay?.kind, "theme");
  assertEquals(overlay?.items, ["Light", "Dark"]);
  assertEquals(overlay?.selectedIndex, 1);
});

Deno.test("renderApiWorkbenchStatus paints current status snapshot", () => {
  const frame: string[][] = [];

  renderApiWorkbenchStatus({
    frame,
    row: 3,
    width: 72,
    focus: "Three",
    themeLabel: "Test",
    tileDensity: 6,
    diagnostics: "ok",
    theme: testWorkbenchTheme(),
    paint: (text, style) => `${style.bg}:${style.fg}:${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
  });

  assertEquals(frame[3]?.[0]?.includes("Three"), true);
  assertEquals(frame[3]?.[0]?.includes("Test"), true);
});

Deno.test("renderApiWorkbenchDropdownOverlay paints overlay rows and maps item hits", () => {
  const frame: string[][] = [];
  const fills: Array<{ row: number; width: number; bg: string }> = [];
  const hits: Array<{ type: string; index: number; width: number }> = [];

  renderApiWorkbenchDropdownOverlay({
    frame,
    overlay: {
      kind: "workspace",
      coordinate: "screen",
      rect: { column: 2, row: 2, width: 18, height: 4 },
      items: ["Open", "Rename"],
      itemIndexes: [3, 4],
      selectedIndex: 1,
    },
    workspaceBounds: { column: 0, row: 3, width: 80, height: 20 },
    screenBounds: { column: 0, row: 0, width: 80, height: 24 },
    workspaceOffsetRows: 0,
    commands: [],
    theme: testWorkbenchTheme(),
    paint: (text, style) => `${style.bg}:${style.fg}:${style.bold ? "b:" : ""}${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    fillRect: (_target, rect, bg) => fills.push({ row: rect.row, width: rect.width, bg }),
    addHit: (rect, action) => hits.push({ type: action.type, index: action.index, width: rect.width }),
  });

  assertEquals(fills, [{ row: 2, width: 18, bg: "#222" }]);
  assertEquals(frame[3]?.[2]?.includes("Open"), true);
  assertEquals(frame[4]?.[2]?.includes("Rename"), true);
  assertEquals(hits, [
    { type: "workspace", index: 3, width: 16 },
    { type: "workspace", index: 4, width: 16 },
  ]);
});

Deno.test("renderApiWorkbenchThreeHeader paints title rows from retained buffers", () => {
  const frame: string[][] = [];
  const writes: Array<{ row: number; texts: string[] }> = [];

  renderApiWorkbenchThreeHeader({
    frame,
    rect: { column: 0, row: 2, width: 40, height: 4 },
    mode: "BLOCKS",
    theme: testWorkbenchTheme(),
    rows: [],
    performanceTarget: {
      totalMs: 0,
      initMs: 0,
      sceneMs: 0,
      readbackMs: 0,
      assemblyMs: 0,
      cells: 0,
    },
    sourceMaxCells: 120,
    frameIntervalMs: 50,
    pressure: {
      currentCells: 120,
      highFrames: 0,
      lowFrames: 0,
      lastBytes: 0,
      lastByteRate: 0,
      lastScoped: false,
      lastChangedRows: 0,
      lastRenderedGrids: 0,
      lastRenderedRows: 0,
    },
    writeRows: (_target, rect, rows) => writes.push({ row: rect.row, texts: rows.map((row) => row.text) }),
  });

  assertEquals(writes[0]?.row, 2);
  assertEquals(writes[0]?.texts[0], " THREE ASCII · BLOCKS ");
  assertEquals(writes[0]?.texts[1]?.includes("torus"), true);
});

Deno.test("renderApiWorkbenchThreeFallback paints renderer fallback rows", () => {
  const writes: string[][] = [];

  renderApiWorkbenchThreeFallback({
    frame: [],
    rect: { column: 0, row: 0, width: 48, height: 7 },
    terminalGlyphStyle: "blocks",
    rendererAvailable: false,
    rows: [],
    theme: testWorkbenchTheme(),
    center: (text) => text,
    writeRows: (_target, _rect, rows) => writes.push(rows.map((row) => row.text)),
  });

  assertEquals(writes[0]?.[0], " THREE ASCII FALLBACK · BLOCKS ");
  assertEquals(writes[0]?.[1]?.includes("backend unavailable"), true);
});

Deno.test("renderApiWorkbenchThreeSurface paints grids and preserves pressure accounting", () => {
  const frame: string[][] = [];
  let pressureRows = 0;

  const result = renderApiWorkbenchThreeSurface({
    frame,
    rect: { column: 0, row: 0, width: 4, height: 2 },
    grid: [["A", "B"], ["C", "D"]],
    theme: testWorkbenchTheme(),
    projectionCache: new WorkbenchThreeGridProjectionCache(),
    statusRows: [],
    paint: (text, style) => `${style.bg ?? ""}:${text}`,
    center: (text) => text,
    writeRows: () => {
      throw new Error("status rows should not render for populated grids");
    },
    scale: true,
    countForPressure: true,
    statusMessage: "renderer warming up",
    onPressureRows: (rows) => pressureRows = rows,
  });

  assertEquals(result.kind, "grid");
  assertEquals(frame, [
    ["A", "A", "B", "B"],
    ["C", "C", "D", "D"],
  ]);
  assertEquals(pressureRows, 2);
});

Deno.test("renderApiWorkbenchThreeSurface paints resize status for empty grids", () => {
  const writes: string[][] = [];

  const result = renderApiWorkbenchThreeSurface({
    frame: [],
    rect: { column: 0, row: 0, width: 32, height: 3 },
    grid: [],
    theme: testWorkbenchTheme(),
    projectionCache: new WorkbenchThreeGridProjectionCache(),
    statusRows: [],
    paint: (text, style) => `${style.bg ?? ""}:${text}`,
    center: (text) => text,
    writeRows: (_target, _rect, rows) => writes.push(rows.map((row) => row.text)),
    statusMessage: "renderer resizing",
  });

  assertEquals(result.kind, "status");
  assertEquals(writes[0]?.some((text) => text.includes("renderer resizing")), true);
});

Deno.test("renderApiWorkbenchExplorerPanel paints tree rows and registers row hits", () => {
  const frame: string[][] = [];
  const renderRows: Array<{ text: string; fg?: string; bg?: string; bold?: boolean }> = [];
  const written: string[] = [];
  const hits: Array<{ index: number; row: number; width: number }> = [];
  const rows = [
    {
      id: "src",
      label: "src",
      depth: 0,
      index: 10,
      hasChildren: true,
      expanded: true,
      node: { id: "src", label: "src", expanded: true, children: [] },
      text: "▾ src",
    },
    {
      id: "mod",
      label: "mod.ts",
      depth: 1,
      index: 11,
      hasChildren: false,
      expanded: false,
      node: { id: "mod", label: "mod.ts" },
      text: "  · mod.ts",
    },
  ];

  renderApiWorkbenchExplorerPanel({
    frame,
    rect: { column: 2, row: 3, width: 24, height: 4 },
    rows,
    selectedIndex: 11,
    renderRows,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    writeRows: (_target, _rect, outputRows) => written.push(...outputRows.map((row) => row.text)),
    addHit: (rect, action) => hits.push({ index: action.index, row: rect.row, width: rect.width }),
  });

  assertEquals(written, ["▾ src", "    mod.ts"]);
  assertEquals(renderRows[1]?.bold, true);
  assertEquals(hits, [
    { index: 10, row: 3, width: 24 },
    { index: 11, row: 4, width: 24 },
  ]);
});

Deno.test("renderApiWorkbenchDataPanel syncs page size paints rows and registers hits", () => {
  type ProcessTestRow = { name: string; cpu: number } & Record<string, unknown>;
  const frame: string[][] = [];
  const columns: DataColumn<ProcessTestRow>[] = [
    { id: "name", label: "Name", width: 8, sortable: true },
    { id: "cpu", label: "CPU", width: 5, sortable: true },
  ];
  const allRows: ProcessTestRow[] = [
    { name: "deno", cpu: 42 },
    { name: "bash", cpu: 7 },
  ];
  let pageSize = 1;
  const view = (): DataTableView<ProcessTestRow> => ({
    rows: allRows.slice(0, pageSize),
    totalRows: allRows.length,
    page: 0,
    pageSize,
    pageCount: 1,
    selectedIndex: 0,
    selectedKey: "deno",
    selectedRow: allRows[0],
  });
  const buffers = { renderRows: [], textRows: [], bodyRows: [] };
  let written: string[] = [];
  const hits: Array<{ index: number; row: number; width: number }> = [];

  renderApiWorkbenchDataPanel({
    frame,
    rect: { column: 4, row: 5, width: 32, height: 8 },
    columns,
    view,
    sort: () => ({ columnId: "cpu", direction: "desc" }),
    setPageSize: (nextPageSize) => pageSize = nextPageSize,
    buffers,
    theme: testWorkbenchTheme(),
    fit: (text, width) => text.slice(0, width),
    contrastText: () => "#000",
    writeRows: (_target, _rect, outputRows) => written = outputRows.map((row) => row.text),
    addHit: (rect, action) => hits.push({ index: action.index, row: rect.row, width: rect.width }),
  });

  assertEquals(pageSize > 1, true);
  assertEquals(written[0]?.includes("Name"), true);
  assertEquals(written.some((row) => row.includes("deno")), true);
  assertEquals(hits, [
    { index: 0, row: 6, width: 32 },
    { index: 1, row: 7, width: 32 },
  ]);
});

Deno.test("renderApiWorkbenchInspectorPanel and logs panel project text rows", () => {
  const frame: string[][] = [];
  const inspectorRows: Array<{ text: string; fg?: string; bg?: string; bold?: boolean }> = [];
  const logsRows: Array<{ text: string; fg?: string; bg?: string; bold?: boolean }> = [];
  const actionTextRows: string[] = [];
  const wrappedTextRows: string[] = [];
  const written: string[][] = [];

  renderApiWorkbenchInspectorPanel({
    frame,
    rect: { column: 0, row: 0, width: 48, height: 16 },
    themeLabel: "Test Theme",
    logs: ["opened modal", "ran command"],
    renderRows: inspectorRows,
    actionTextRows,
    wrappedTextRows,
    theme: testWorkbenchTheme(),
    fit: (text, width) => text.slice(0, width),
    writeRows: (_target, _rect, outputRows) => written.push(outputRows.map((row) => row.text)),
  });

  renderApiWorkbenchLogsPanel({
    frame,
    rect: { column: 0, row: 0, width: 48, height: 4 },
    sources: [["docs"], ["event one", "event two"]],
    renderRows: logsRows,
    theme: testWorkbenchTheme(),
    writeRows: (_target, _rect, outputRows) => written.push(outputRows.map((row) => row.text)),
  });

  assertEquals(written[0]?.some((row) => row.includes("Focused panel")), true);
  assertEquals(written[0]?.some((row) => row.includes("opened modal")), true);
  assertEquals(written[1], ["docs", "event one", "event two"]);
  assertEquals(actionTextRows.length > 0, true);
});

Deno.test("renderApiWorkbenchControls paints controls, hits, and dropdown overlay", () => {
  const buffers = new ApiWorkbenchControlsViewBufferCache();
  const frame: string[][] = [];
  const hits: Array<{ id: string; action?: string; index?: number; row: number; width: number }> = [];

  const result = renderApiWorkbenchControls({
    frame,
    rect: { column: 1, row: 0, width: 64, height: 20 },
    state: {
      activeControl: "combo",
      buttonPressCount: 2,
      genericButtonPressCount: 1,
      modalOpen: false,
      slider: { ratio: 0.5, value: 5, max: 10 },
      checkboxLivePreview: true,
      checkboxCompactRows: false,
      radioOptions: [
        { value: "fast", label: "Fast" },
        { value: "slow", label: "Slow" },
      ],
      radioSelectedValue: "slow",
      radioActiveIndex: 1,
      combo: {
        title: "Theme",
        label: "Test",
        expanded: true,
        items: ["Light", "Dark"],
        selectedIndex: 1,
      },
      dropdown: {
        title: "Dropdown",
        label: "CPU",
        expanded: true,
        items: ["CPU", "GPU"],
        selectedIndex: 0,
      },
      input: { title: "Input", text: "deno task", active: false },
      stepper: {
        steps: [
          { id: "draft", label: "Draft", completed: true },
          { id: "review", label: "Review" },
          { id: "ship", label: "Ship" },
        ],
        activeIndex: 1,
      },
      progress: { ratio: 0.42, value: 42 },
      textbox: {
        lines: ["hello world from textbox"],
        cursor: { x: 5, y: 0 },
      },
    },
    buffers,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    fit: (text, width) => text.slice(0, width),
    paint: (text, style) => `${style.bg}:${style.fg}:${style.bold ? "b:" : ""}${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    addHit: (rect, action) =>
      hits.push({
        id: action.id,
        action: action.action,
        index: action.index,
        row: rect.row,
        width: rect.width,
      }),
  });

  const painted = frame.flat().filter(Boolean).join("|");
  assertEquals(painted.includes("Run Action"), true);
  assertEquals(painted.includes("Theme"), true);
  assertEquals(painted.includes("TextBox"), true);
  assertEquals(hits.some((hit) => hit.id === "slider" && hit.action === "set"), true);
  assertEquals(hits.some((hit) => hit.id === "combo" && hit.index === 1), true);
  assertEquals(hits.some((hit) => hit.id === "stepper" && hit.index === 1), true);
  assertEquals(result.dropdownOverlay?.kind, "control");
  assertEquals(result.dropdownOverlay?.items, ["CPU", "GPU"]);
  assertEquals(buffers.projectedRows.length > 0, true);
});

Deno.test("renderApiWorkbenchModalOverlay paints modal content and action hits", () => {
  const buffers = new WorkbenchModalBufferCache<number>();
  const frame: string[][] = [];
  const fills: Array<{ row: number; width: number; bg: string }> = [];
  const frames: Array<{ title: string; width: number; active: boolean }> = [];
  const hits: Array<{ index: number; width: number }> = [];
  const selectedAction = { id: "ok", label: "OK", default: true };
  const inspection: ModalInspection = {
    open: true,
    title: "Confirm",
    body: ["Delete item?"],
    tone: "warning",
    actions: [
      { id: "cancel", label: "Cancel" },
      selectedAction,
    ],
    selectedActionIndex: 1,
    selectedAction,
  };

  renderApiWorkbenchModalOverlay({
    frame,
    bounds: { column: 0, row: 0, width: 80, height: 24 },
    inspection,
    buffers,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    fit: (text, width) => text.slice(0, width),
    paint: (text, style) => `${style.bg}:${style.fg}:${style.bold ? "b:" : ""}${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    fillRect: (_target, rect, bg) => fills.push({ row: rect.row, width: rect.width, bg }),
    drawFrame: (_target, rect, title, active) => frames.push({ title, width: rect.width, active }),
    addHit: (rect, action) => hits.push({ index: action.index, width: rect.width }),
  });

  const painted = frame.flat().filter(Boolean).join("|");
  assertEquals(painted.includes("Confirm"), true);
  assertEquals(painted.includes("Delete item?"), true);
  assertEquals(painted.includes("[ OK ]"), true);
  assertEquals(fills.some((fill) => fill.bg === "#222"), true);
  assertEquals(frames, [{ title: "Confirm", width: 72, active: true }]);
  assertEquals(hits.some((hit) => hit.index === -1 && hit.width === 80), true);
  assertEquals(hits.some((hit) => hit.index === 1), true);
  assertEquals(buffers.actionCommands.length, 2);
});

Deno.test("renderApiWorkbenchThreeConfigModal paints rows, footer, and config hits", () => {
  const buffers = new WorkbenchAsciiConfigModalBufferCache<WorkbenchAsciiConfigRow>();
  const frame: string[][] = [];
  const fills: Array<{ bg: string; width: number }> = [];
  const frames: Array<{ title: string; active: boolean }> = [];
  const hits: Array<{ type: string; action?: string; index?: number; width: number }> = [];
  const ascii = createDefaultWorkbenchAsciiOptions();
  const rows = defaultWorkbenchAsciiConfigRows.slice(0, 2);

  renderApiWorkbenchThreeConfigModal({
    frame,
    bounds: { column: 0, row: 0, width: 82, height: 22 },
    rows,
    selectedIndex: 0,
    title: "Three Test",
    helpText: "Use arrows/clicks",
    activateRowHits: true,
    buffers,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    fit: (text, width) => text.slice(0, width),
    paint: (text, style) => `${style.bg}:${style.fg}:${style.bold ? "b:" : ""}${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    fillRect: (_target, rect, bg) => fills.push({ bg, width: rect.width }),
    drawFrame: (_target, _rect, title, active) => frames.push({ title, active }),
    rowText: (row) => formatWorkbenchAsciiConfigRowText(row, ascii, { kittyStatus: "Kitty auto" }),
    addHit: (rect, action) =>
      hits.push({
        type: action.type,
        action: "action" in action ? action.action : undefined,
        index: "index" in action ? action.index : undefined,
        width: rect.width,
      }),
  });

  const painted = frame.flat().filter(Boolean).join("|");
  assertEquals(painted.includes("Three Test"), true);
  assertEquals(painted.includes("Use arrows/clicks"), true);
  assertEquals(painted.includes("Preset"), true);
  assertEquals(painted.includes("Up/Down select"), true);
  assertEquals(frames, [{ title: "Three Renderer Config", active: true }]);
  assertEquals(fills.some((fill) => fill.bg === "#222"), true);
  assertEquals(hits.some((hit) => hit.type === "asciiConfigBackdrop" && hit.width === 82), true);
  assertEquals(hits.some((hit) => hit.type === "asciiConfig" && hit.action === "activate" && hit.index === 0), true);
  assertEquals(hits.some((hit) => hit.type === "asciiConfig" && hit.action === "previous" && hit.index === 0), true);
  assertEquals(hits.some((hit) => hit.type === "asciiConfigAction" && hit.action === "ok"), true);
  assertEquals(buffers.rowRenderCommands.length > 0, true);
});

Deno.test("renderApiWorkbenchVisualizationMissing paints missing visualization state", () => {
  const captured: RowStyle[] = [];

  renderApiWorkbenchVisualizationMissing({
    frame: [],
    rect: { column: 2, row: 3, width: 30, height: 4 },
    theme: testWorkbenchTheme(),
    writeRows: (_frame, _rect, rows) => captured.push(...rows),
  });

  assertEquals(captured, [
    { text: "Visualization window not found", fg: "#ff0", bg: "#111", bold: true },
  ]);
});

Deno.test("renderApiWorkbenchVisualizationThreeChrome paints chrome and returns scene rect", () => {
  const frame: string[][] = [];
  const rows: RowStyle[] = [];
  const writes: string[] = [];
  const rect = { column: 2, row: 3, width: 40, height: 10 };

  const sceneRect = renderApiWorkbenchVisualizationThreeChrome({
    frame,
    rect,
    option: { group: "Monitor", label: "CPU", description: "CPU monitor" },
    rendered: testPanelRender({
      three: {
        mode: "lattice",
        signal: { x: 0, y: 0, depth: 0, twist: 0, lift: 0, pulse: 0, active: true, pressed: false },
      },
    }),
    ascii: createDefaultWorkbenchAsciiOptions(),
    accent: "#0f0",
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    fit: (text, width) => text.slice(0, width),
    paint: (text, style) => `${style.bg}:${style.fg}:${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
      writes.push(`${row}:${column}:${value}`);
    },
    writeRows: (_frame, _rect, nextRows) => rows.push(...nextRows),
  });

  assertEquals(sceneRect, { column: 2, row: 6, width: 40, height: 6 });
  assertEquals(rows[0], { text: " MONITOR · Load ", fg: "#000", bg: "#0f0", bold: true });
  assertEquals(rows[1], { text: "CPU monitor", fg: "#ccc", bg: "#111", bold: false });
  assertEquals(rows[2]?.text, "ACEROLA LATTICE · GLYPHS · CPU");
  assertEquals(writes, ["12:2:#222:#aaa:footer detail"]);
});

Deno.test("renderApiWorkbenchVisualizationTextWindow projects text visualization rows", () => {
  const captured: RowStyle[] = [];

  renderApiWorkbenchVisualizationTextWindow({
    frame: [],
    rect: { column: 1, row: 2, width: 32, height: 6 },
    option: { group: "Monitor", label: "CPU", description: "CPU monitor" },
    rendered: testPanelRender({ alert: "thermal", severity: "warning" }),
    accent: "#0f0",
    rows: [],
    textRows: [],
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    writeRows: (_frame, _rect, rows) => captured.push(...rows),
  });

  assertEquals(captured.map((row) => row.text), [
    " MONITOR · Load ",
    "! thermal",
    "core 0",
    "core 1",
    "footer detail",
  ]);
  assertEquals(captured[1], { text: "! thermal", fg: "#ff0", bg: "#111", bold: true });
});

Deno.test("addApiWorkbenchCpuHexTileHits registers CPU tile hit rectangles", () => {
  const hits: Array<{
    rect: { column: number; row: number; width: number; height: number };
    action: { type: "cpuHexTile"; id: string; label: string };
  }> = [];

  addApiWorkbenchCpuHexTileHits({
    id: "viz:cpu",
    rect: { column: 10, row: 5, width: 40, height: 12 },
    cores: [
      { label: "0", usage: 60 },
      { label: "1", usage: 20 },
    ],
    width: 40,
    height: 12,
    tiles: [],
    addHit: (rect, action) => hits.push({ rect, action }),
  });

  assertEquals(hits.length, 2);
  assertEquals(hits[0]!.action, { type: "cpuHexTile", id: "viz:cpu", label: "0" });
  assertEquals(hits[0]!.rect.row >= 9, true);
  assertEquals(hits[0]!.rect.width > 0, true);
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

Deno.test("renderApiWorkbenchTerminalOutputBody paints status hint and stream rows", () => {
  const frame: string[][] = [];
  const rows: WorkbenchTerminalOutputWindowRow[] = [];

  const written = renderApiWorkbenchTerminalOutputBody({
    frame,
    rect: { column: 1, row: 0, width: 80, height: 4 },
    startRow: 0,
    inspection: testProcessSessionInspection({ status: "running", running: true }),
    inputMode: "workbench",
    lines: [
      { source: "stdout", text: "hello" },
      { source: "stderr", text: "oops" },
    ],
    rows,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    fit: (text, width) => text.slice(0, width),
    paint: (text, style) => `${style.bg}:${style.fg}:${style.bold ? "b:" : ""}${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
  });

  assertEquals(written, 4);
  assertEquals(rows.map((row) => row.kind), ["status", "hint", "output", "output"]);
  assertEquals(frame[0]?.[1]?.includes("WORKBENCH  RUNNING"), true);
  assertEquals(frame[0]?.[1]?.includes("PROCESS FALLBACK"), true);
  assertEquals(frame[1]?.[1]?.includes("I raw input"), true);
  assertEquals(frame[2]?.[1], "#111:#fff:[out] hello");
  assertEquals(frame[3]?.[1], "#111:#f00:b:[err] oops");
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

Deno.test("renderApiWorkbenchTerminalShellHeader paints status and hint rows", () => {
  const frame: string[][] = [];
  const rowBuffer: WorkbenchTerminalShellHeaderRow[] = [];

  const nextRow = renderApiWorkbenchTerminalShellHeader({
    frame,
    rect: { column: 2, row: 0, width: 120, height: 4 },
    startRow: 1,
    inspection: testTerminalShellInspection({
      status: "running",
      backendLabel: "sigma-pty",
      commandLine: "/bin/bash",
      pty: true,
      scrollback: {
        offset: 4,
        viewportRows: 10,
        totalRows: 100,
      },
    }),
    inputMode: "raw",
    copyMode: false,
    rows: rowBuffer,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    fit: (text, width) => text.slice(0, width),
    paint: (text, style) => `${style.bg}:${style.fg}:${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
  });

  assertEquals(nextRow, 3);
  assertEquals(rowBuffer.length, 2);
  assertEquals(frame[1]?.[2], "#0f0:#000:RAW SHELL RUNNING PTY sigma-pty · /bin/bash · rows 5-14/100");
  assertEquals(
    frame[2]?.[2],
    "#222:#ccc:raw shell input: keys go to shell  Ctrl+C interrupts shell  Esc returns to Workbench",
  );
});

Deno.test("renderApiWorkbenchTerminalShellPanes paints copy rows and registers row hits", () => {
  const frame: string[][] = [];
  const buffers = new WorkbenchTerminalBufferCache();
  const hits: Array<{ type: string; index?: number; row: number; width: number }> = [];
  const shellInspection = testTerminalShellInspection({
    scrollback: {
      offset: 7,
      viewportRows: 2,
      totalRows: 12,
      visibleRows: ["alpha", "beta"],
      selection: { anchor: 7, focus: 7 },
    },
  });
  let resizeCall: { columns: number; rows: number } | undefined;
  const shell = {
    running: false,
    resize: (columns: number, rows: number) => {
      resizeCall = { columns, rows };
    },
    inspect: () => shellInspection,
    screen: {
      cursor: { row: 0, column: 0 },
      cellRows: () => [],
    },
  } as unknown as TerminalShellController;

  renderApiWorkbenchTerminalShellPanes({
    frame,
    rect: { column: 3, row: 5, width: 16, height: 2 },
    inspection: {
      activeId: "shell-1",
      activeShell: shellInspection,
      sessions: [{ id: "shell-1", title: "Shell 1", shell: shellInspection }],
      workspace: {
        activeId: "shell-1",
        sessions: [],
        count: 0,
        layout: { panes: [], count: 0 },
      },
    },
    activeShell: shell,
    shellForSession: (sessionId) => sessionId === "shell-1" ? shell : undefined,
    copyMode: true,
    rawInputActive: false,
    buffers,
    theme: testWorkbenchTheme(),
    contrastText: () => "#000",
    fillRect: () => {},
    fit: (text, width) => text.slice(0, width),
    paint: (text, style) => `${style.bg}:${style.fg}:${style.bold ? "b:" : ""}${text}`,
    write: (target, row, column, value) => {
      target[row] ??= [];
      target[row]![column] = value;
    },
    addHit: (rect, action) =>
      hits.push({
        type: action.type,
        index: action.type === "terminalShellCopyRow" ? action.index : undefined,
        row: rect.row,
        width: rect.width,
      }),
  });

  assertEquals(resizeCall, { columns: 16, rows: 2 });
  assertEquals(hits, [
    { type: "terminalShellContent", index: undefined, row: 5, width: 16 },
    { type: "terminalShellCopyRow", index: 7, row: 5, width: 16 },
    { type: "terminalShellCopyRow", index: 8, row: 6, width: 16 },
  ]);
  assertEquals(frame[5]?.[3], "#ff0:#000:b:   8 ");
  assertEquals(frame[5]?.[8], "#ff0:#000:b:alpha");
  assertEquals(frame[6]?.[3], "#222:#ccc:   9 ");
  assertEquals(frame[6]?.[8], "#111:#fff:beta");
  assertEquals(buffers.copyRows.length, 2);
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

function testPanelRender(overrides: Partial<PanelRender> = {}): PanelRender {
  return {
    title: "Load",
    body: "core 0\ncore 1",
    footer: "footer detail",
    alert: "",
    accent: "signal",
    severity: "info",
    ...overrides,
  };
}

function testProcessSessionInspection(
  overrides: Partial<ProcessSessionInspection> = {},
): ProcessSessionInspection {
  return {
    command: { command: "deno", args: ["eval", "console.log('hello')"] },
    commandLine: "deno eval console.log('hello')",
    status: "idle",
    running: false,
    output: {
      lines: [],
      lineCount: 0,
      visible: [],
      limit: 1000,
      follow: true,
      empty: true,
    },
    ...overrides,
  };
}

function testTerminalShellInspection(
  overrides: Omit<Partial<TerminalShellInspection>, "scrollback"> & {
    scrollback?: Partial<TerminalShellInspection["scrollback"]>;
  } = {},
): TerminalShellInspection {
  const { scrollback: scrollbackOverrides, ...inspectionOverrides } = overrides;
  const scrollback = {
    mode: "live" as const,
    offset: 0,
    maxOffset: 0,
    viewportRows: 3,
    totalRows: 3,
    scrollbackRows: 0,
    liveRows: 3,
    visibleRows: [],
    matches: [],
    activeMatch: undefined,
    query: undefined,
    selection: undefined,
    ...scrollbackOverrides,
  };
  return {
    title: undefined,
    status: "idle",
    running: false,
    backendId: undefined,
    backendLabel: undefined,
    pty: false,
    command: { command: "bash", args: [] },
    commandLine: "bash",
    columns: 80,
    rows: 24,
    resizeSupported: true,
    screen: {
      columns: 80,
      rows: 24,
      cursor: { column: 0, row: 0 },
      cursorVisible: true,
      cursorStyle: { shape: "block", blinking: true },
      privateModes: [],
      scrollbackRows: 0,
      alternate: false,
    },
    scrollback,
    ...inspectionOverrides,
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
