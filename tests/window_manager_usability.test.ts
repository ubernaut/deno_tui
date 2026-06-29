import { assertEquals } from "./deps.ts";
import { createFileExplorerTree, FileExplorerController, WindowManagerController } from "../mod.ts";

Deno.test("window manager supports keyboard-style focus fullscreen tabs and restore flows", () => {
  const manager = new WindowManagerController({
    activeId: "editor",
    windows: [
      { id: "explorer", title: "Explorer", minWidth: 24, minHeight: 8 },
      { id: "editor", title: "Editor", minWidth: 40, minHeight: 10 },
      { id: "preview", title: "Preview", minWidth: 32, minHeight: 8 },
      { id: "logs", title: "Logs", minWidth: 30, minHeight: 7 },
    ],
  });

  assertEquals(manager.active()?.id, "editor");
  assertEquals(manager.focusNext()?.id, "preview");
  assertEquals(manager.fullscreen("preview")?.id, "preview");
  assertEquals(
    manager.layout({ bounds: { column: 0, row: 0, width: 100, height: 24 } }).visible.map((entry) => entry.id),
    [
      "preview",
    ],
  );

  manager.selectTab("explorer");
  assertEquals(manager.inspect().fullscreenId, "explorer");
  manager.minimize("explorer");
  assertEquals(manager.inspect().fullscreenId, undefined);
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "explorer")?.minimized, true);

  manager.restore("explorer");
  const restored = manager.layout({ bounds: { column: 0, row: 0, width: 88, height: 24 } });
  assertEquals(restored.visible.length, 4);
  assertEquals(restored.visible.every((entry) => entry.rect && entry.rect.width >= 24), true);
  manager.dispose();
});

Deno.test("window manager keeps closed windows out of focus and tab loops", () => {
  const manager = new WindowManagerController({
    activeId: "one",
    windows: [
      { id: "one", title: "One" },
      { id: "two", title: "Two" },
      { id: "three", title: "Three", closable: false },
    ],
  });

  manager.close("two");
  assertEquals(manager.ids(), ["one", "three"]);
  assertEquals(manager.focus("two"), undefined);
  assertEquals(manager.focusNext()?.id, "three");
  manager.close("three");
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "three")?.closed, false);
  manager.dispose();
});

Deno.test("file explorer exposes indented entries and mouse-style row selection", () => {
  const opened: string[] = [];
  const explorer = new FileExplorerController({
    root: createFileExplorerTree([
      "src/components/tree.ts",
      "src/components/file_explorer.ts",
      "src/layout/window_manager.ts",
      "README.md",
    ]),
    onOpen: (entry) => {
      opened.push(entry.path);
    },
  });

  assertEquals(explorer.entries().map((entry) => entry.text).slice(0, 4), [
    "▾ src",
    "  ▾ components",
    "    · file_explorer.ts",
    "    · tree.ts",
  ]);

  explorer.tree.setSelectedIndex(2);
  assertEquals(explorer.selected()?.path, "/src/components/file_explorer.ts");
  explorer.openActive();
  assertEquals(opened, ["/src/components/file_explorer.ts"]);

  explorer.tree.setSelectedIndex(1);
  explorer.openActive();
  assertEquals(explorer.entries().map((entry) => entry.text).slice(0, 4), [
    "▾ src",
    "  ▸ components",
    "  ▾ layout",
    "    · window_manager.ts",
  ]);
  explorer.dispose();
});
