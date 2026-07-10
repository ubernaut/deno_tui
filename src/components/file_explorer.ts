// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { TreeController, type TreeInspection, type TreeNode, type TreeRow } from "./tree.ts";

/** Identifier union for file Explorer Node variants. */
export type FileExplorerNodeKind = "file" | "directory";

/** Public interface describing a file Explorer Node. */
export interface FileExplorerNode extends TreeNode {
  kind: FileExplorerNodeKind;
  path: string;
  children?: readonly FileExplorerNode[];
}

/** Options for configuring file Explorer Controller. */
export interface FileExplorerControllerOptions {
  root: FileExplorerNode[] | Signal<FileExplorerNode[]>;
  selectedIndex?: number | Signal<number>;
  onOpen?: (entry: FileExplorerEntry) => void | Promise<void>;
}

/** Entry record used by file Explorer catalogs or renderers. */
export interface FileExplorerEntry {
  id: string;
  label: string;
  path: string;
  kind: FileExplorerNodeKind;
  depth: number;
  expanded: boolean;
  text: string;
}

/** Serializable inspection snapshot for file Explorer. */
export interface FileExplorerInspection extends Omit<TreeInspection, "nodes" | "rows" | "selected"> {
  entries: FileExplorerEntry[];
  selected?: FileExplorerEntry;
}

/** State controller for file Explorer behavior. */
export class FileExplorerController {
  readonly root: Signal<FileExplorerNode[]>;
  readonly tree: TreeController;
  readonly #onOpen?: (entry: FileExplorerEntry) => void | Promise<void>;
  readonly #ownsRoot: boolean;

  constructor(options: FileExplorerControllerOptions) {
    this.#ownsRoot = !(options.root instanceof Signal);
    this.root = signalify(options.root, { deepObserve: true });
    this.tree = new TreeController({
      nodes: this.root as unknown as Signal<TreeNode[]>,
      selectedIndex: options.selectedIndex,
      onSelect: (row) => {
        const entry = fileExplorerEntry(row);
        if (entry.kind === "directory") this.tree.toggleActive();
        else void this.#onOpen?.(entry);
      },
    });
    this.#onOpen = options.onOpen;
  }

  entries(): FileExplorerEntry[] {
    const rows = this.tree.visibleRows();
    const entries = new Array<FileExplorerEntry>(rows.length);
    for (let index = 0; index < rows.length; index += 1) {
      entries[index] = fileExplorerEntry(rows[index]!);
    }
    return entries;
  }

  selected(): FileExplorerEntry | undefined {
    const row = this.tree.selected();
    return row ? fileExplorerEntry(row) : undefined;
  }

  openActive(): FileExplorerEntry | undefined {
    const entry = this.selected();
    if (!entry) return undefined;
    if (entry.kind === "directory") {
      this.tree.toggleActive();
    } else {
      void this.#onOpen?.(entry);
    }
    return entry;
  }

  handleKeyPress(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }, height = 1) {
    if (event.key === "return") return this.openActive();
    this.tree.handleKeyPress(event, height);
    return this.selected();
  }

  inspect(height?: number): FileExplorerInspection {
    const inspection = this.tree.inspect(height);
    return {
      rowCount: inspection.rowCount,
      selectedIndex: inspection.selectedIndex,
      window: inspection.window,
      empty: inspection.empty,
      entries: this.entries(),
      selected: this.selected(),
    };
  }

  dispose(): void {
    this.tree.dispose();
    if (this.#ownsRoot) this.root.dispose();
  }
}

/** Creates an file Explorer Tree. */
export function createFileExplorerTree(paths: readonly string[]): FileExplorerNode[] {
  const root: MutableFileExplorerNode[] = [];
  for (const path of paths) {
    const parts = splitPathParts(path);
    let current = root;
    let accumulated = "";
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]!;
      accumulated = `${accumulated}/${part}`;
      const isFile = index === parts.length - 1 && /\.[^/.]+$/.test(part);
      let node = findExplorerNode(current, part);
      if (!node) {
        node = {
          id: accumulated,
          label: part,
          path: accumulated,
          kind: isFile ? "file" : "directory",
          expanded: index < 2,
          children: [],
        };
        current.push(node);
      }
      current = node.children;
    }
  }
  return sortExplorerNodes(root);
}

function splitPathParts(path: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index <= path.length; index += 1) {
    if (index !== path.length && path[index] !== "/") continue;
    if (index > start) parts.push(path.slice(start, index));
    start = index + 1;
  }
  return parts;
}

function findExplorerNode(
  nodes: readonly MutableFileExplorerNode[],
  label: string,
): MutableFileExplorerNode | undefined {
  for (const node of nodes) {
    if (node.label === label) return node;
  }
  return undefined;
}

function fileExplorerEntry(row: TreeRow): FileExplorerEntry {
  const node = row.node as FileExplorerNode;
  return {
    id: row.id,
    label: row.label,
    path: node.path,
    kind: node.kind,
    depth: row.depth,
    expanded: row.expanded,
    text: `${"  ".repeat(row.depth)}${node.kind === "directory" ? row.expanded ? "▾" : "▸" : "·"} ${row.label}`,
  };
}

interface MutableFileExplorerNode extends FileExplorerNode {
  children: MutableFileExplorerNode[];
}

function sortExplorerNodes(nodes: readonly MutableFileExplorerNode[]): FileExplorerNode[] {
  const sorted = nodes.slice();
  sorted.sort(compareExplorerNodes);
  const output = new Array<FileExplorerNode>(sorted.length);
  for (let index = 0; index < sorted.length; index += 1) {
    const node = sorted[index]!;
    output[index] = {
      id: node.id,
      label: node.label,
      path: node.path,
      kind: node.kind,
      expanded: node.expanded,
      children: node.children.length > 0 ? sortExplorerNodes(node.children) : undefined,
    };
  }
  return output;
}

function compareExplorerNodes(left: FileExplorerNode, right: FileExplorerNode): number {
  if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
  return left.label.localeCompare(right.label);
}
