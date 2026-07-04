import { assertEquals } from "./deps.ts";
import { workbenchExplorerRowsInto, type WorkbenchExplorerTheme } from "../app/workbench_explorer.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";
import type { FileExplorerNode } from "../src/components/file_explorer.ts";
import type { TreeRow } from "../src/components/tree.ts";

const theme: WorkbenchExplorerTheme = {
  background: "#000000",
  good: "#44dd66",
  surface: "#050510",
  text: "#eeeeee",
  warn: "#ffaa00",
};

const directoryNode: FileExplorerNode = { id: "src", label: "src", kind: "directory", path: "src" };
const fileNode: FileExplorerNode = { id: "src/mod.ts", label: "mod.ts", kind: "file", path: "src/mod.ts" };

const rows: TreeRow[] = [
  {
    id: "src",
    label: "src",
    depth: 0,
    index: 0,
    hasChildren: true,
    expanded: true,
    node: directoryNode,
    text: "▾ src",
  },
  {
    id: "src/mod.ts",
    label: "mod.ts",
    depth: 1,
    index: 1,
    hasChildren: false,
    expanded: false,
    node: fileNode,
    text: "  mod.ts",
  },
];

Deno.test("workbench explorer projects tree rows into themed labels", () => {
  const projected = workbenchExplorerRowsInto([], {
    rows,
    selectedIndex: 1,
    theme,
    contrast: () => "#000000",
  });

  assertEquals(projected, [
    { text: "▾ src", fg: "#44dd66", bg: "#050510", bold: true },
    { text: "  · mod.ts", fg: "#000000", bg: "#ffaa00", bold: true },
  ]);
});

Deno.test("workbench explorer distinguishes collapsed directories and plain rows", () => {
  const projected = workbenchExplorerRowsInto([], {
    rows: [
      {
        ...rows[0]!,
        expanded: false,
      },
      {
        ...rows[1]!,
        node: { id: "unknown", label: "unknown" },
        label: "unknown",
      },
    ],
    selectedIndex: -1,
    theme,
    contrast: () => "#000000",
  });

  assertEquals(projected[0], { text: "▸ src", fg: "#44dd66", bg: "#050510", bold: true });
  assertEquals(projected[1], { text: "    unknown", fg: "#eeeeee", bg: "#050510", bold: false });
});

Deno.test("workbench explorer rows reuse caller-owned row objects", () => {
  const target: RowStyle[] = [{ text: "stale", fg: "x", bg: "y", bold: true }, { text: "old" }];
  const firstRow = target[0];
  const projected = workbenchExplorerRowsInto(target, {
    rows: rows.slice(0, 1),
    selectedIndex: -1,
    theme,
    contrast: () => "#000000",
  });

  assertEquals(projected === target, true);
  assertEquals(projected.length, 1);
  assertEquals(projected[0] === firstRow, true);
  assertEquals(projected[0], { text: "▾ src", fg: "#44dd66", bg: "#050510", bold: true });
});
