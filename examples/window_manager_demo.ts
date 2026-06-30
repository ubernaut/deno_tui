import {
  createFileExplorerTree,
  FileExplorerController,
  OverlayStackController,
  type OverlaySurfaceInspection,
  placePopover,
  WindowManagerController,
  type WindowManagerWindowInspection,
} from "../mod.ts";

const manager = new WindowManagerController({
  activeId: "editor",
  tileOptions: { minTileWidth: 28, minTileHeight: 7 },
  windows: [
    { id: "explorer", title: "Explorer", minWidth: 24, minHeight: 8 },
    { id: "editor", title: "Editor", minWidth: 42, minHeight: 10 },
    { id: "preview", title: "Preview", minWidth: 34, minHeight: 8 },
    { id: "inspector", title: "Inspector", minWidth: 30, minHeight: 7 },
    { id: "console", title: "Console", minWidth: 36, minHeight: 7 },
  ],
});

const opened: string[] = [];
const explorer = new FileExplorerController({
  root: createFileExplorerTree([
    "app/api_workbench.ts",
    "app/neon_exodus.ts",
    "examples/window_manager_demo.ts",
    "examples/table_selection_workflow.ts",
    "src/components/file_explorer.ts",
    "src/components/tree.ts",
    "src/layout/window_manager.ts",
    "tests/window_manager_usability.test.ts",
    "README.md",
  ]),
  onOpen: (entry) => {
    opened.push(entry.path);
  },
});

const initial = manager.layout({ bounds: { column: 0, row: 0, width: 118, height: 32 } });
manager.fullscreen("editor");
manager.selectTab("explorer");
const fullscreen = manager.layout({ bounds: { column: 0, row: 0, width: 118, height: 30 } });
manager.minimize("inspector");
manager.restore("inspector");
manager.restore();
manager.focusNext();
const restored = manager.layout({ bounds: { column: 0, row: 0, width: 84, height: 26 } });
const menuRect = placePopover(
  { column: 4, row: 1, width: 10, height: 1 },
  { width: 24, height: 6 },
  { column: 0, row: 0, width: 84, height: 26 },
  { placement: "bottom-start", margin: 1 },
);
const overlays = new OverlayStackController({
  surfaces: [
    { id: "workspace", kind: "workspace", rect: { column: 0, row: 0, width: 84, height: 26 } },
    { id: "active-window", kind: "window", rect: restored.visible.at(-1)?.rect ?? restored.bounds },
    { id: "file-menu", kind: "menu", rect: menuRect },
    {
      id: "confirm-close",
      kind: "modal",
      rect: { column: 20, row: 8, width: 44, height: 8 },
      closeOnOutsideClick: true,
    },
    {
      id: "confirm-ok",
      kind: "custom",
      layer: "modal",
      ownerId: "confirm-close",
      rect: { column: 47, row: 14, width: 8, height: 1 },
    },
  ],
});
const modalButtonHit = overlays.hitTest({ column: 48, row: 14 });
const blockedHit = overlays.hitTest({ column: menuRect.column + 1, row: menuRect.row + 1 });
const outsideClick = overlays.handlePointerDown({ column: menuRect.column + 1, row: menuRect.row + 1 });
const menuHit = overlays.hitTest({ column: menuRect.column + 1, row: menuRect.row + 1 });

explorer.tree.setSelectedIndex(1);
explorer.openActive();

console.log("# Window Manager And File Explorer Demo");
console.log("");
console.log("A controller-first miniature desktop: responsive tiling, fullscreen tabs, restore/minimize state,");
console.log("and a project explorer backed by the reusable tree controller.");
console.log("");
console.log("## Tiled Workspace 118x32");
console.log(formatWindowGrid(initial.visible));
console.log("");
console.log("## Fullscreen Tab Strip");
console.log(fullscreen.tabs.map((tab) => `${tab.fullscreen ? "[active]" : "[tab]"} ${tab.title}`).join("  "));
console.log(`Visible fullscreen pane: ${fullscreen.visible.map((entry) => entry.title).join(", ")}`);
console.log("");
console.log("## Responsive Workspace 84x26 After Restore");
console.log(formatWindowGrid(restored.visible));
console.log("");
console.log("## Overlay Stack");
console.log(formatOverlayGrid(overlays.inspect().zOrder));
console.log(`Modal button hit: ${modalButtonHit?.surface.id ?? "none"}`);
console.log(`Background hit while modal is open: ${blockedHit?.surface.id ?? "blocked"}`);
console.log(`Outside click closed: ${outsideClick.closedIds.join(", ") || "none"}`);
console.log(`Menu hit after close: ${menuHit?.surface.id ?? "none"}`);
console.log("");
console.log("## File Explorer");
console.log(
  explorer.entries().slice(0, 12).map((entry) => `${entry.id === explorer.selected()?.id ? ">" : " "} ${entry.text}`)
    .join("\n"),
);
console.log("");
console.log(`Selected: ${explorer.selected()?.path ?? "none"}`);
console.log(`Opened: ${opened.join(", ") || "none"}`);
console.log("");
console.log("## Usability Test Plan");
console.log(
  "- Keyboard: Tab/Shift+Tab cycles windows; arrows navigate tree/table/logs; Enter toggles fullscreen or opens files.",
);
console.log(
  "- Mouse: click any window to focus it; click table/explorer rows to select; click scrollbars to jump; click shelf/tabs.",
);
console.log(
  "- Responsiveness: shrink below 96 columns for stacked tiles, then widen past 150 columns for 3-4 columns.",
);
console.log(
  "- Recovery: minimize panes, restore from the shelf, fullscreen a pane, and switch panes from the bottom tab strip.",
);

explorer.dispose();
manager.dispose();
overlays.dispose();

function formatWindowGrid(windows: readonly WindowManagerWindowInspection[]): string {
  const rows = windows.map((entry) => {
    const rect = entry.rect;
    const size = rect ? `${rect.width}x${rect.height}@${rect.column},${rect.row}` : "hidden";
    const flags = [
      entry.active ? "active" : "",
      entry.minimized ? "minimized" : "",
      entry.fullscreen ? "fullscreen" : "",
    ].filter(Boolean).join(",");
    return `| ${pad(entry.title, 12)} | ${pad(size, 14)} | ${pad(flags || "normal", 18)} |`;
  });
  return [
    "| Window       | Rect           | State              |",
    "| ---          | ---            | ---                |",
    ...rows,
  ].join("\n");
}

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value + " ".repeat(width - value.length);
}

function formatOverlayGrid(surfaces: readonly OverlaySurfaceInspection[]): string {
  const rows = surfaces.map((entry) => {
    const rect = `${entry.rect.width}x${entry.rect.height}@${entry.rect.column},${entry.rect.row}`;
    return `| ${pad(entry.id, 14)} | ${pad(entry.kind, 9)} | ${pad(entry.layer, 9)} | ${pad(`${entry.zIndex}`, 6)} | ${
      pad(rect, 14)
    } |`;
  });
  return [
    "| Surface        | Kind      | Layer     | Z      | Rect           |",
    "| ---            | ---       | ---       | ---    | ---            |",
    ...rows,
  ].join("\n");
}
