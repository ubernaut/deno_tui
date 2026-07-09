// Copyright 2023 Im-Beast. MIT license.
import type { WidgetHitRegion } from "../components/interaction.ts";
import type { Rectangle } from "../types.ts";
import { inspectViewportOverflow, type ViewportOverflowInspection } from "../viewport.ts";
import {
  type BoxEdges,
  cloneComputedLayoutStyle,
  type ComputedLayoutStyle,
  defaultComputedLayoutStyle,
} from "./style.ts";

/** Public interface describing intrinsic size metadata for a layout node. */
export interface LayoutIntrinsicSize {
  width: number;
  height: number;
}

/** Public interface describing a renderer-neutral layout tree node. */
export interface LayoutNode {
  id: string;
  tag: string;
  classes: readonly string[];
  attributes: Record<string, string>;
  text?: string;
  style: ComputedLayoutStyle;
  children: LayoutNode[];
  intrinsic?: Partial<LayoutIntrinsicSize>;
}

/** Options for creating a renderer-neutral layout tree node. */
export interface LayoutNodeOptions {
  id?: string;
  tag: string;
  classes?: readonly string[];
  attributes?: Record<string, string>;
  text?: string;
  style?: ComputedLayoutStyle;
  children?: readonly LayoutNode[];
  intrinsic?: Partial<LayoutIntrinsicSize>;
}

/** Public interface describing a computed box produced by a layout solver. */
export interface ComputedLayoutBox {
  id: string;
  tag: string;
  classes: readonly string[];
  attributes: Record<string, string>;
  text?: string;
  rect: Rectangle;
  contentRect: Rectangle;
  padding: BoxEdges<number>;
  margin: BoxEdges<number>;
  border: BoxEdges<number>;
  overflowX: ComputedLayoutStyle["overflowX"];
  overflowY: ComputedLayoutStyle["overflowY"];
  scrollWidth: number;
  scrollHeight: number;
  overflow: ViewportOverflowInspection;
  zIndex: number;
  visible: boolean;
  hitRegions: Array<WidgetHitRegion<{ nodeId: string; tag: string }>>;
  children: ComputedLayoutBox[];
}

/** Public interface describing a layout solver input. */
export interface LayoutSolverInput {
  root: LayoutNode;
  bounds: Rectangle;
}

/** Public interface describing a layout solver result. */
export interface LayoutSolverResult {
  root: ComputedLayoutBox;
  boxes: ComputedLayoutBox[];
  byId: Map<string, ComputedLayoutBox>;
  contentWidth: number;
  contentHeight: number;
}

/** Public interface implemented by pluggable layout solvers. */
export interface LayoutSolver {
  readonly id: string;
  supports(node: LayoutNode): boolean;
  solve(input: LayoutSolverInput): LayoutSolverResult;
}

/** Computes the shared overflow contract for one solved layout box. */
export function computedLayoutBoxOverflow(
  contentRect: Rectangle,
  scrollWidth: number,
  scrollHeight: number,
  overflowX: ComputedLayoutStyle["overflowX"],
  overflowY: ComputedLayoutStyle["overflowY"],
): ViewportOverflowInspection {
  return inspectViewportOverflow({
    contentWidth: scrollWidth,
    contentHeight: scrollHeight,
    viewportWidth: contentRect.width,
    viewportHeight: contentRect.height,
    overflowX,
    overflowY,
  });
}

/** Creates a renderer-neutral layout tree node with normalized defaults. */
export function createLayoutNode(options: LayoutNodeOptions): LayoutNode {
  const attributes = { ...(options.attributes ?? {}) };
  const id = options.id ?? attributes.id ?? options.tag;
  if (!attributes.id) attributes.id = id;
  const classNames = options.classes ?? splitClassList(attributes.class);
  return {
    id,
    tag: options.tag,
    classes: classNames.slice(),
    attributes,
    text: options.text,
    style: options.style ? cloneComputedLayoutStyle(options.style) : defaultComputedLayoutStyle(),
    children: [...(options.children ?? [])],
    intrinsic: options.intrinsic ? { ...options.intrinsic } : undefined,
  };
}

/** Clones a renderer-neutral layout tree node recursively. */
export function cloneLayoutNode(node: LayoutNode): LayoutNode {
  const children = new Array<LayoutNode>(node.children.length);
  for (let index = 0; index < node.children.length; index += 1) {
    children[index] = cloneLayoutNode(node.children[index]!);
  }
  return {
    id: node.id,
    tag: node.tag,
    classes: node.classes.slice(),
    attributes: { ...node.attributes },
    text: node.text,
    style: cloneComputedLayoutStyle(node.style),
    children,
    intrinsic: node.intrinsic ? { ...node.intrinsic } : undefined,
  };
}

/** Visits a renderer-neutral layout tree in pre-order. */
export function walkLayoutNodes(
  node: LayoutNode,
  visit: (node: LayoutNode, ancestors: readonly LayoutNode[]) => void,
): void {
  const ancestors: LayoutNode[] = [];
  walk(node);

  function walk(current: LayoutNode): void {
    visit(current, ancestors);
    ancestors.push(current);
    for (const child of current.children) walk(child);
    ancestors.pop();
  }
}

/** Builds a stable lookup map from computed boxes. */
export function mapLayoutBoxes(boxes: readonly ComputedLayoutBox[]): Map<string, ComputedLayoutBox> {
  const byId = new Map<string, ComputedLayoutBox>();
  for (const box of boxes) byId.set(box.id, box);
  return byId;
}

/** Flattens a computed layout box tree in pre-order. */
export function flattenComputedLayoutBoxes(root: ComputedLayoutBox): ComputedLayoutBox[] {
  const boxes: ComputedLayoutBox[] = [];
  visit(root);
  return boxes;

  function visit(box: ComputedLayoutBox): void {
    boxes.push(box);
    for (const child of box.children) visit(child);
  }
}

function splitClassList(value: string | undefined): string[] {
  if (!value) return [];
  const classes: string[] = [];
  let start = -1;
  for (let index = 0; index <= value.length; index += 1) {
    const char = index < value.length ? value[index] : " ";
    if (char !== undefined && !isClassWhitespace(char)) {
      if (start < 0) start = index;
      continue;
    }
    if (start >= 0) {
      classes.push(value.slice(start, index));
      start = -1;
    }
  }
  return classes;
}

function isClassWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\t" || char === "\r" || char === "\f";
}
