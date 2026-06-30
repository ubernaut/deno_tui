// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { clampSelectionIndex, selectionWindow } from "../selection.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { List } from "./list.ts";

/** Public interface describing a tree Node. */
export interface TreeNode {
  id: string;
  label: string;
  children?: readonly TreeNode[];
  expanded?: boolean;
}

/** Options for configuring tree. */
export interface TreeOptions extends ComponentOptions {
  nodes: TreeNode[] | Signal<TreeNode[]>;
  selectedIndex?: number | Signal<number>;
  controller?: TreeController;
  onSelect?: (row: TreeRow, index: number) => void | Promise<void>;
  onToggle?: (row: TreeRow, expanded: boolean) => void | Promise<void>;
}

/** Public interface describing a tree Row. */
export interface TreeRow {
  id: string;
  label: string;
  depth: number;
  index: number;
  hasChildren: boolean;
  expanded: boolean;
  node: TreeNode;
  text: string;
}

/** Options for configuring tree Controller. */
export interface TreeControllerOptions {
  nodes: TreeNode[] | Signal<TreeNode[]>;
  selectedIndex?: number | Signal<number>;
  onSelect?: (row: TreeRow, index: number) => void | Promise<void>;
  onToggle?: (row: TreeRow, expanded: boolean) => void | Promise<void>;
}

/** Serializable inspection snapshot for tree Row. */
export interface TreeRowInspection {
  id: string;
  label: string;
  depth: number;
  index: number;
  hasChildren: boolean;
  expanded: boolean;
  text: string;
}

/** Serializable inspection snapshot for tree. */
export interface TreeInspection {
  nodes: TreeNode[];
  rows: TreeRowInspection[];
  rowCount: number;
  selectedIndex: number;
  selected?: TreeRowInspection;
  window: { start: number; end: number };
  empty: boolean;
}

/** Public helper for flatten Tree Rows. */
export function flattenTreeRows(nodes: readonly TreeNode[], depth = 0, rows: TreeRow[] = []): TreeRow[] {
  for (const node of nodes) {
    const hasChildren = Boolean(node.children?.length);
    const expanded = Boolean(node.expanded);
    const marker = hasChildren ? expanded ? "▾" : "▸" : " ";
    const index = rows.length;
    const text = `${"  ".repeat(depth)}${marker} ${node.label}`;
    rows.push({
      id: node.id,
      label: node.label,
      depth,
      index,
      hasChildren,
      expanded,
      node,
      text,
    });
    if (hasChildren && expanded) {
      flattenTreeRows(node.children!, depth + 1, rows);
    }
  }
  return rows;
}

/** Public helper for flatten Tree. */
export function flattenTree(nodes: readonly TreeNode[], depth = 0): string[] {
  return flattenTreeRows(nodes, depth).map((row) => row.text);
}

/** Creates a serializable inspection snapshot for tree Row. */
export function inspectTreeRow(row: TreeRow): TreeRowInspection {
  return {
    id: row.id,
    label: row.label,
    depth: row.depth,
    index: row.index,
    hasChildren: row.hasChildren,
    expanded: row.expanded,
    text: row.text,
  };
}

/** State controller for tree behavior. */
export class TreeController {
  readonly nodes: Signal<TreeNode[]>;
  readonly selectedIndex: Signal<number>;
  readonly #ownsNodes: boolean;
  readonly #ownsSelectedIndex: boolean;
  readonly #onSelect?: (row: TreeRow, index: number) => void | Promise<void>;
  readonly #onToggle?: (row: TreeRow, expanded: boolean) => void | Promise<void>;
  readonly #syncSelection = () => {
    this.selectedIndex.value = clampSelectionIndex(this.visibleRows().length, this.selectedIndex.peek());
  };

  constructor(options: TreeControllerOptions) {
    this.#ownsNodes = !(options.nodes instanceof Signal);
    this.#ownsSelectedIndex = !(options.selectedIndex instanceof Signal);
    this.nodes = signalify(options.nodes, { deepObserve: true });
    this.selectedIndex = signalify(options.selectedIndex ?? 0);
    this.#onSelect = options.onSelect;
    this.#onToggle = options.onToggle;
    this.nodes.subscribe(this.#syncSelection);
    this.#syncSelection();
  }

  visibleRows(): TreeRow[] {
    return flattenTreeRows(this.nodes.peek());
  }

  rowTexts(): string[] {
    return this.visibleRows().map((row) => row.text);
  }

  visible(height = this.visibleRows().length): TreeRow[] {
    const rows = this.visibleRows();
    const selected = clampSelectionIndex(rows.length, this.selectedIndex.peek());
    const window = selectionWindow(rows.length, selected, Math.max(0, Math.floor(height)));
    return rows.slice(window.start, window.end);
  }

  selected(): TreeRow | undefined {
    const rows = this.visibleRows();
    return rows[clampSelectionIndex(rows.length, this.selectedIndex.peek())];
  }

  move(delta: number): TreeRow | undefined {
    return this.setSelectedIndex(this.selectedIndex.peek() + delta);
  }

  page(delta: number, height: number): TreeRow | undefined {
    return this.move(delta * Math.max(1, Math.floor(height)));
  }

  first(): TreeRow | undefined {
    return this.setSelectedIndex(0);
  }

  last(): TreeRow | undefined {
    return this.setSelectedIndex(this.visibleRows().length - 1);
  }

  setSelectedIndex(index: number): TreeRow | undefined {
    this.selectedIndex.value = clampSelectionIndex(this.visibleRows().length, index);
    return this.selected();
  }

  selectActive(): TreeRow | undefined {
    const row = this.selected();
    if (row) {
      void this.#onSelect?.(row, row.index);
    }
    return row;
  }

  toggleActive(): TreeRow | undefined {
    const row = this.selected();
    if (!row?.hasChildren) return row;
    this.setExpanded(row.id, !row.expanded);
    const next = this.visibleRows().find((entry) => entry.id === row.id) ?? row;
    void this.#onToggle?.(next, next.expanded);
    return next;
  }

  expandActive(): TreeRow | undefined {
    const row = this.selected();
    if (!row?.hasChildren || row.expanded) return row;
    this.setExpanded(row.id, true);
    const next = this.visibleRows().find((entry) => entry.id === row.id) ?? row;
    void this.#onToggle?.(next, true);
    return next;
  }

  collapseActive(): TreeRow | undefined {
    const row = this.selected();
    if (!row?.hasChildren || !row.expanded) return row;
    this.setExpanded(row.id, false);
    const next = this.visibleRows().find((entry) => entry.id === row.id) ?? row;
    void this.#onToggle?.(next, false);
    return next;
  }

  setExpanded(id: string, expanded: boolean): boolean {
    let changed = false;
    const visit = (nodes: readonly TreeNode[]): TreeNode[] =>
      nodes.map((node) => {
        const children = node.children ? visit(node.children) : undefined;
        if (node.id !== id || !node.children?.length) {
          return children && children !== node.children ? { ...node, children } : node;
        }
        if (Boolean(node.expanded) === expanded) {
          return children && children !== node.children ? { ...node, children } : node;
        }
        changed = true;
        return { ...node, children, expanded };
      });

    const next = visit(this.nodes.peek());
    if (changed) {
      this.nodes.value = next;
      this.#syncSelection();
    }
    return changed;
  }

  handleKeyPress(
    { key, ctrl, meta, shift }: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean },
    height = 1,
  ): TreeRow | undefined {
    if (ctrl || meta || shift) return undefined;
    if (key === "up") return this.move(-1);
    if (key === "down") return this.move(1);
    if (key === "pageup") return this.page(-1, height);
    if (key === "pagedown") return this.page(1, height);
    if (key === "home") return this.first();
    if (key === "end") return this.last();
    if (key === "left") return this.collapseActive();
    if (key === "right") return this.expandActive();
    if (key === "space") return this.toggleActive();
    if (key === "return") return this.selectActive();
    return undefined;
  }

  inspect(height = this.visibleRows().length): TreeInspection {
    const rows = this.visibleRows();
    const selectedIndex = clampSelectionIndex(rows.length, this.selectedIndex.peek());
    return {
      nodes: structuredClone(this.nodes.peek()),
      rows: rows.map(inspectTreeRow),
      rowCount: rows.length,
      selectedIndex,
      selected: rows[selectedIndex] ? inspectTreeRow(rows[selectedIndex]) : undefined,
      window: selectionWindow(rows.length, selectedIndex, Math.max(0, Math.floor(height))),
      empty: rows.length === 0,
    };
  }

  dispose(): void {
    this.nodes.unsubscribe(this.#syncSelection);
    if (this.#ownsNodes) this.nodes.dispose();
    if (this.#ownsSelectedIndex) this.selectedIndex.dispose();
  }
}

/** Public class implementing a tree. */
export class Tree extends Component {
  nodes: Signal<TreeNode[]>;
  selectedIndex: Signal<number>;
  readonly controller: TreeController;

  constructor(options: TreeOptions) {
    super(options);
    const ownsController = !options.controller;
    this.controller = options.controller ??
      new TreeController({
        nodes: options.nodes,
        selectedIndex: options.selectedIndex,
        onSelect: options.onSelect,
        onToggle: options.onToggle,
      });
    this.nodes = this.controller.nodes;
    this.selectedIndex = this.controller.selectedIndex;
    this.on("keyPress", (event) => {
      this.controller.handleKeyPress(event, this.rectangle.peek().height);
    });
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  override draw(): void {
    super.draw();

    const list = new List({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      items: new Computed(() => this.controller.rowTexts()),
      selectedIndex: this.selectedIndex,
      rectangle: this.rectangle,
      visible: this.visible,
    });
    list.subComponentOf = this;
    this.subComponents.list = list;
  }
}
