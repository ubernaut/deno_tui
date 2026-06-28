import { assertEquals } from "./deps.ts";
import {
  bindComponentCatalogCommands,
  type ComponentCatalogCommandAction,
  componentCatalogCommands,
  inspectComponentCatalogCommands,
} from "../src/app/component_commands.ts";
import { CommandRegistry } from "../src/app/commands.ts";
import { bindToastCommands, toastCommands } from "../src/app/toast_commands.ts";
import {
  componentCapabilities,
  componentCatalog,
  componentCategories,
  componentsByCategory,
  componentsWithCapability,
  findComponent,
  inspectComponentCatalog,
  listComponents,
  queryComponents,
} from "../src/components/catalog.ts";
import {
  clampCommandPaletteSelection,
  CommandPaletteController,
  filterCommandPaletteItems,
  renderCommandPaletteRows,
  shiftCommandPaletteSelection,
} from "../src/components/command_palette.ts";
import {
  clampContextMenuSelection,
  ContextMenuController,
  renderContextMenuRows,
  shiftContextMenuSelection,
  visibleContextMenuItems,
} from "../src/components/context_menu.ts";
import { renderToast, ToastStackController } from "../src/components/toast.ts";
import { flattenTree } from "../src/components/tree.ts";
import type { Key, KeyPressEvent } from "../src/input_reader/types.ts";

Deno.test("component catalog exposes searchable widget metadata", () => {
  const ids = listComponents().map((entry) => entry.id);

  assertEquals(ids.includes("command-palette"), true);
  assertEquals(ids.includes("three-ascii"), true);
  assertEquals(findComponent("Command Palette")?.id, "command-palette");
  assertEquals(findComponent("ThreeAscii")?.capabilities.includes("three"), true);
  assertEquals(findComponent("missing"), undefined);
  assertEquals(componentCatalog.every((entry) => entry.description.length > 0), true);
});

Deno.test("component catalog groups widgets by category and capability", () => {
  assertEquals(componentCategories(), [
    "data",
    "feedback",
    "input",
    "layout",
    "navigation",
    "overlay",
    "primitive",
    "visualization",
  ]);
  assertEquals(componentCapabilities().includes("virtualized"), true);
  assertEquals(componentsByCategory("overlay").map((entry) => entry.id), [
    "command-palette",
    "context-menu",
    "modal",
    "toast",
  ]);
  assertEquals(componentsWithCapability("three").map((entry) => entry.id), ["three-ascii"]);
  assertEquals(componentsWithCapability("controller").map((entry) => entry.id), [
    "button",
    "checkbox",
    "combobox",
    "slider",
    "radio-group",
    "list",
    "virtual-list",
    "data-table",
    "tree",
    "tabs",
    "stepper",
    "menu-bar",
    "command-palette",
    "context-menu",
    "toast",
    "progressbar",
    "log-viewer",
    "metric-series",
    "scroll-area",
  ]);
});

Deno.test("component catalog supports combined queries and inspection", () => {
  assertEquals(queryComponents({ category: "overlay", capability: "controller" }).map((entry) => entry.id), [
    "command-palette",
    "context-menu",
    "toast",
  ]);
  assertEquals(queryComponents({ capabilities: ["controller", "selection"] }).map((entry) => entry.id), [
    "combobox",
    "radio-group",
    "list",
    "virtual-list",
    "data-table",
    "tree",
    "tabs",
    "stepper",
    "menu-bar",
    "command-palette",
    "context-menu",
  ]);
  assertEquals(queryComponents({ search: "ascii" }).map((entry) => entry.id), ["three-ascii"]);

  const overlay = queryComponents({ category: "overlay" });
  assertEquals(inspectComponentCatalog(overlay), {
    count: 4,
    categories: {
      data: 0,
      feedback: 0,
      input: 0,
      layout: 0,
      navigation: 0,
      overlay: 4,
      primitive: 0,
      visualization: 0,
    },
    capabilities: {
      async: 2,
      component: 0,
      controller: 3,
      dashboard: 0,
      keyboard: 3,
      mouse: 1,
      "render-helper": 4,
      selection: 2,
      themeable: 1,
      three: 0,
      virtualized: 0,
    },
  });
});

Deno.test("component catalog commands project widgets into command surfaces", async () => {
  const registry = new CommandRegistry<ComponentCatalogCommandAction>();
  const dispose = bindComponentCatalogCommands(registry, {
    idPrefix: "widgets",
    group: "catalog",
    query: { category: "overlay", capability: "controller" },
  });
  const actions: ComponentCatalogCommandAction[] = [];

  assertEquals(registry.list("catalog").map((command) => command.id), [
    "widgets.select.command-palette",
    "widgets.select.context-menu",
    "widgets.select.toast",
  ]);
  assertEquals(registry.projections("catalog"), [
    {
      id: "widgets.select.command-palette",
      label: "CommandPalette",
      keywords: [
        "command-palette",
        "CommandPalette",
        "overlay",
        "Filterable command surface.",
        "controller",
        "render-helper",
        "selection",
        "keyboard",
        "async",
      ],
      disabled: false,
    },
    {
      id: "widgets.select.context-menu",
      label: "ContextMenu",
      keywords: [
        "context-menu",
        "ContextMenu",
        "overlay",
        "Selectable contextual command list.",
        "controller",
        "render-helper",
        "selection",
        "keyboard",
        "mouse",
      ],
      disabled: false,
    },
    {
      id: "widgets.select.toast",
      label: "ToastStack",
      keywords: [
        "toast",
        "ToastStack",
        "overlay",
        "Transient notification stack renderer.",
        "controller",
        "render-helper",
        "async",
      ],
      disabled: false,
    },
  ]);

  assertEquals(
    await registry.execute("widgets.select.context-menu", (action) => void actions.push(action)),
    true,
  );
  assertEquals(actions[0]?.type, "component.selected");
  assertEquals(actions[0]?.payload?.id, "context-menu");

  dispose();
  assertEquals(registry.inspect("catalog"), { count: 0, enabled: 0, disabled: 0, groups: [], commands: [] });
});

Deno.test("component catalog commands support custom actions disabled state and inspection", async () => {
  type DocsAction = { type: "open-docs"; payload: string };
  const registry = new CommandRegistry<DocsAction>();
  const commands = componentCatalogCommands<DocsAction>({
    entries: componentsWithCapability("three"),
    label: (entry) => `Docs: ${entry.name}`,
    disabled: (entry) => entry.id === "three-ascii",
    action: (entry) => ({ type: "open-docs", payload: entry.id }),
  });
  registry.registerAll(commands);
  const actions: DocsAction[] = [];
  const enabledRegistry = new CommandRegistry<DocsAction>();
  enabledRegistry.registerAll(componentCatalogCommands<DocsAction>({
    entries: componentsWithCapability("three"),
    action: (entry) => ({ type: "open-docs", payload: entry.id }),
  }));

  assertEquals(commands.map((command) => [command.id, command.label, command.disabled instanceof Function]), [
    ["component.select.three-ascii", "Docs: ThreeAscii", true],
  ]);
  assertEquals(await registry.execute("component.select.three-ascii", (action) => void actions.push(action)), false);
  assertEquals(actions, []);
  assertEquals(
    await enabledRegistry.execute("component.select.three-ascii", (action) => void actions.push(action)),
    true,
  );
  assertEquals(actions, [{ type: "open-docs", payload: "three-ascii" }]);
  assertEquals(inspectComponentCatalogCommands({ entries: componentsWithCapability("three"), group: "docs" }), {
    count: 1,
    commandCount: 1,
    group: "docs",
    categories: {
      data: 0,
      feedback: 0,
      input: 0,
      layout: 0,
      navigation: 0,
      overlay: 0,
      primitive: 0,
      visualization: 1,
    },
    capabilities: {
      async: 0,
      component: 1,
      controller: 0,
      dashboard: 1,
      keyboard: 0,
      mouse: 0,
      "render-helper": 0,
      selection: 0,
      themeable: 0,
      three: 1,
      virtualized: 0,
    },
  });
});

Deno.test("command palette filters labels ids and keywords", () => {
  const items = [
    { id: "open-file", label: "Open File", keywords: ["find"] },
    { id: "close-pane", label: "Close Pane" },
  ];

  assertEquals(filterCommandPaletteItems(items, "find").map((item) => item.id), ["open-file"]);
  assertEquals(renderCommandPaletteRows(items, "pane", 0, 2), ["> Close Pane"]);
});

Deno.test("command palette rows clamp to the filtered list", () => {
  const items = [
    { id: "open-file", label: "Open File", keywords: ["find"] },
    { id: "close-pane", label: "Close Pane" },
  ];

  assertEquals(renderCommandPaletteRows(items, "open", 99, 2), ["> Open File"]);
});

Deno.test("command palette marks disabled rows and skips them during selection", () => {
  const items = [
    { id: "open-file", label: "Open File" },
    { id: "close-pane", label: "Close Pane", disabled: true },
    { id: "save-file", label: "Save File" },
  ];

  assertEquals(renderCommandPaletteRows(items, "", 1, 3), [
    "  Open File",
    "> (Close Pane)",
    "  Save File",
  ]);
  assertEquals(shiftCommandPaletteSelection(items, 0, 1), 2);
  assertEquals(shiftCommandPaletteSelection(items, 2, -1), 0);
  assertEquals(clampCommandPaletteSelection(items, 1), 2);
});

Deno.test("CommandPaletteController handles typed query movement and inspection", () => {
  const controller = new CommandPaletteController({
    items: [
      { id: "open-file", label: "Open File", keywords: ["find"] },
      { id: "close-pane", label: "Close Pane", disabled: true },
      { id: "save-file", label: "Save File" },
    ],
    selectedIndex: 1,
  });

  assertEquals(controller.inspect(), {
    query: "",
    selectedIndex: 2,
    filteredCount: 3,
    selected: { id: "save-file", label: "Save File" },
  });

  controller.handleKeyPress(keyPress("o"));
  assertEquals(controller.inspect(), {
    query: "o",
    selectedIndex: 0,
    filteredCount: 2,
    selected: { id: "open-file", label: "Open File", keywords: ["find"] },
  });

  controller.handleKeyPress(keyPress("backspace"));
  controller.move(1);
  assertEquals(controller.selected()?.id, "save-file");
  controller.dispose();
});

Deno.test("context menu renders separators and skips disabled entries", () => {
  const items = [
    { id: "open", label: "Open" },
    { id: "separator", label: "", separatorBefore: true },
    { id: "delete", label: "Delete", disabled: true },
    { id: "rename", label: "Rename" },
  ];

  assertEquals(renderContextMenuRows(items, 0, 4), [
    "> Open",
    "──",
    "  (Delete)",
    "  Rename",
  ]);
  assertEquals(shiftContextMenuSelection(items, 0, 1), 3);
  assertEquals(shiftContextMenuSelection(items, 3, -1), 0);
  assertEquals(clampContextMenuSelection(items, 2), 3);
  assertEquals(visibleContextMenuItems(items, 3, 2).map((row) => row.index), [2, 3]);
});

Deno.test("ContextMenuController handles navigation and inspection", () => {
  const controller = new ContextMenuController({
    items: [
      { id: "open", label: "Open" },
      { id: "separator", label: "", separatorBefore: true },
      { id: "delete", label: "Delete", disabled: true },
      { id: "rename", label: "Rename" },
    ],
  });

  controller.handleKeyPress(keyPress("down"));
  assertEquals(controller.inspect(), {
    selectedIndex: 3,
    itemCount: 4,
    selected: { id: "rename", label: "Rename" },
  });

  controller.handleKeyPress(keyPress("home"));
  assertEquals(controller.selected()?.id, "open");
  controller.handleKeyPress(keyPress("end"));
  assertEquals(controller.handleKeyPress(keyPress("return"))?.id, "rename");
  controller.dispose();
});

Deno.test("toast rendering includes severity", () => {
  assertEquals(renderToast({ id: "1", level: "warning", message: "Disk high" }), "[WARNING] Disk high");
});

Deno.test("ToastStackController bounds messages and exposes inspection", () => {
  let nextId = 0;
  const controller = new ToastStackController({
    limit: 2,
    idFactory: () => `toast-${++nextId}`,
  });

  assertEquals(controller.show("Booted", "success"), { id: "toast-1", level: "success", message: "Booted" });
  controller.show("Queued", "info");
  controller.push({ id: "manual", level: "warning", message: "Manual" });

  assertEquals(controller.inspect(), {
    messages: [
      { id: "toast-2", level: "info", message: "Queued" },
      { id: "manual", level: "warning", message: "Manual" },
    ],
    count: 2,
    limit: 2,
    empty: false,
  });
  assertEquals(controller.dismiss("toast-2"), true);
  assertEquals(controller.dismiss("missing"), false);
  assertEquals(controller.dismissLatest()?.id, "manual");
  assertEquals(controller.inspect().empty, true);
  controller.push({ id: "a", message: "A" });
  controller.push({ id: "b", message: "B" });
  controller.setLimit(1);
  assertEquals(controller.inspect().messages, [{ id: "b", message: "B" }]);
  controller.setLimit(0);
  assertEquals(controller.inspect().empty, true);
  controller.dispose();
});

Deno.test("toastCommands clear and dismiss controller messages", async () => {
  const controller = new ToastStackController({
    messages: [
      { id: "a", message: "Alpha" },
      { id: "b", message: "Beta" },
    ],
  });
  const registry = new CommandRegistry();
  const actions: unknown[] = [];
  const dispose = bindToastCommands(registry, controller, {
    idPrefix: "notifications",
    group: "notifications",
  });

  assertEquals(toastCommands(new ToastStackController()).map((command) => [command.id, commandDisabled(command)]), [
    ["toast.dismissLatest", true],
    ["toast.clear", true],
  ]);
  assertEquals(registry.list("notifications").map((command) => command.id), [
    "notifications.clear",
    "notifications.dismissLatest",
  ]);

  assertEquals(await registry.execute("notifications.dismissLatest", (action) => void actions.push(action)), true);
  assertEquals(controller.inspect().messages.map((message) => message.id), ["a"]);
  assertEquals(actions, [
    {
      type: "toast.dismissed",
      payload: {
        dismissedId: "b",
        inspection: {
          messages: [{ id: "a", message: "Alpha" }],
          count: 1,
          limit: 4,
          empty: false,
        },
      },
    },
  ]);

  assertEquals(await registry.execute("notifications.clear", (action) => void actions.push(action)), true);
  assertEquals(controller.inspect().empty, true);

  dispose();
  assertEquals(registry.list("notifications"), []);
});

Deno.test("flattenTree respects expanded state", () => {
  assertEquals(
    flattenTree([
      {
        id: "root",
        label: "Root",
        expanded: true,
        children: [
          { id: "child", label: "Child" },
          { id: "closed", label: "Closed", children: [{ id: "hidden", label: "Hidden" }] },
        ],
      },
    ]),
    ["▾ Root", "    Child", "  ▸ Closed"],
  );
});

function keyPress(key: Key, options: Partial<Omit<KeyPressEvent, "key" | "buffer">> = {}): KeyPressEvent {
  return {
    key,
    ctrl: options.ctrl ?? false,
    meta: options.meta ?? false,
    shift: options.shift ?? false,
    buffer: new Uint8Array(),
  };
}

function commandDisabled(command: { disabled?: boolean | (() => boolean) }): boolean | undefined {
  return typeof command.disabled === "function" ? command.disabled() : command.disabled;
}
