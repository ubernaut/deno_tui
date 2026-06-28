import { assertEquals } from "./deps.ts";
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
import { renderToast } from "../src/components/toast.ts";
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
    "virtual-list",
    "data-table",
    "command-palette",
    "context-menu",
    "metric-series",
  ]);
});

Deno.test("component catalog supports combined queries and inspection", () => {
  assertEquals(queryComponents({ category: "overlay", capability: "controller" }).map((entry) => entry.id), [
    "command-palette",
    "context-menu",
  ]);
  assertEquals(queryComponents({ capabilities: ["controller", "selection"] }).map((entry) => entry.id), [
    "virtual-list",
    "data-table",
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
      controller: 2,
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
