import { assertEquals } from "./deps.ts";
import {
  clampCommandPaletteSelection,
  filterCommandPaletteItems,
  renderCommandPaletteRows,
  shiftCommandPaletteSelection,
} from "../src/components/command_palette.ts";
import {
  clampContextMenuSelection,
  renderContextMenuRows,
  shiftContextMenuSelection,
  visibleContextMenuItems,
} from "../src/components/context_menu.ts";
import { renderToast } from "../src/components/toast.ts";
import { flattenTree } from "../src/components/tree.ts";

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
