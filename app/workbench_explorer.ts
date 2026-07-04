// Copyright 2023 Im-Beast. MIT license.
import type { TreeRow } from "../src/components/tree.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";

/** Minimal theme tokens needed by the API workbench explorer panel. */
export interface WorkbenchExplorerTheme {
  background: string;
  good: string;
  surface: string;
  text: string;
  warn: string;
}

/** Options for projecting file/tree explorer rows. */
export interface WorkbenchExplorerRowsOptions {
  rows: readonly TreeRow[];
  selectedIndex: number;
  theme: WorkbenchExplorerTheme;
  contrast: (color: string, darkFallback: string, lightFallback: string) => string;
}

/** Projects explorer tree rows into caller-owned row storage. */
export function workbenchExplorerRowsInto(
  target: RowStyle[],
  options: WorkbenchExplorerRowsOptions,
): RowStyle[] {
  const { rows, selectedIndex, theme: t, contrast } = options;
  target.length = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const treeRow = rows[index]!;
    const selected = treeRow.index === selectedIndex;
    const node = treeRow.node as { kind?: string };
    const icon = treeRow.hasChildren ? treeRow.expanded ? "▾" : "▸" : node.kind === "file" ? "·" : " ";
    const row = target[index] ?? { text: "" };
    row.text = `${"  ".repeat(treeRow.depth)}${icon} ${treeRow.label}`;
    row.fg = selected ? contrast(t.warn, t.background, t.text) : node.kind === "directory" ? t.good : t.text;
    row.bg = selected ? t.warn : t.surface;
    row.bold = selected || node.kind === "directory";
    target[index] = row;
  }
  return target;
}
