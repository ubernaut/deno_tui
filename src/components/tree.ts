// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { List } from "./list.ts";

export interface TreeNode {
  id: string;
  label: string;
  children?: readonly TreeNode[];
  expanded?: boolean;
}

export interface TreeOptions extends ComponentOptions {
  nodes: TreeNode[] | Signal<TreeNode[]>;
  selectedIndex?: number | Signal<number>;
}

export function flattenTree(nodes: readonly TreeNode[], depth = 0): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const hasChildren = Boolean(node.children?.length);
    const marker = hasChildren ? node.expanded ? "▾" : "▸" : " ";
    lines.push(`${"  ".repeat(depth)}${marker} ${node.label}`);
    if (hasChildren && node.expanded) {
      lines.push(...flattenTree(node.children!, depth + 1));
    }
  }
  return lines;
}

export class Tree extends Component {
  nodes: Signal<TreeNode[]>;
  selectedIndex: Signal<number>;

  constructor(options: TreeOptions) {
    super(options);
    this.nodes = signalify(options.nodes, { deepObserve: true });
    this.selectedIndex = signalify(options.selectedIndex ?? 0);
  }

  override draw(): void {
    super.draw();

    const list = new List({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      items: new Computed(() => flattenTree(this.nodes.value)),
      selectedIndex: this.selectedIndex,
      rectangle: this.rectangle,
      visible: this.visible,
    });
    list.subComponentOf = this;
    this.subComponents.list = list;
  }
}
