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
    return this.tree.visibleRows().map(fileExplorerEntry);
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
    const parts = path.split("/").filter(Boolean);
    let current = root;
    let accumulated = "";
    for (const [index, part] of parts.entries()) {
      accumulated = `${accumulated}/${part}`;
      const isFile = index === parts.length - 1 && /\.[^/.]+$/.test(part);
      let node = current.find((entry) => entry.label === part);
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
  return [...nodes]
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
      return left.label.localeCompare(right.label);
    })
    .map((node) => ({
      ...node,
      children: node.children.length > 0 ? sortExplorerNodes(node.children) : undefined,
    }));
}
