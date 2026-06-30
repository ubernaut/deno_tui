// Copyright 2023 Im-Beast. MIT license.
import { textWidth } from "../../utils/strings.ts";
import type { WidgetHitRegion } from "../../components/interaction.ts";
import type { Rectangle } from "../../types.ts";
import { type FlexDirection, type FlexItem, flexRects } from "../flex_layout.ts";
import { clampLayoutSize, type ComputedLayoutStyle, resolveLayoutLength } from "../style.ts";
import {
  type ComputedLayoutBox,
  flattenComputedLayoutBoxes,
  type LayoutIntrinsicSize,
  type LayoutNode,
  type LayoutSolver,
  type LayoutSolverInput,
  type LayoutSolverResult,
  mapLayoutBoxes,
} from "../solver.ts";

/** Options for configuring the built-in TypeScript layout solver. */
export interface SimpleLayoutSolverOptions {
  defaultTextHeight?: number;
}

/** Built-in deterministic block/flex layout solver for terminal-cell rectangles. */
export class SimpleLayoutSolver implements LayoutSolver {
  readonly id = "simple";
  readonly #defaultTextHeight: number;

  constructor(options: SimpleLayoutSolverOptions = {}) {
    this.#defaultTextHeight = Math.max(1, Math.floor(options.defaultTextHeight ?? 1));
  }

  supports(): boolean {
    return true;
  }

  solve(input: LayoutSolverInput): LayoutSolverResult {
    const root = this.#layoutNode(input.root, normalizeRect(input.bounds), true);
    const boxes = flattenComputedLayoutBoxes(root);
    return {
      root,
      boxes,
      byId: mapLayoutBoxes(boxes),
      contentWidth: root.scrollWidth,
      contentHeight: root.scrollHeight,
    };
  }

  #layoutNode(node: LayoutNode, allocated: Rectangle, isRoot = false, fillAllocated = false): ComputedLayoutBox {
    const style = node.style;
    const margin = isRoot ? { top: 0, right: 0, bottom: 0, left: 0 } : style.margin;
    const outer = shrinkByMargin(allocated, margin);
    const rect = resolveNodeRect(node, outer, isRoot, fillAllocated, this.#defaultTextHeight);
    const contentRect = contentRectangle(rect, style);
    const visible = style.visibility === "visible" && style.display !== "none";
    const children = style.display === "flex"
      ? this.#layoutFlexChildren(node, contentRect)
      : this.#layoutBlockChildren(node, contentRect);
    const scroll = scrollSize(node, contentRect, children);

    return {
      id: node.id,
      tag: node.tag,
      classes: node.classes,
      attributes: { ...node.attributes },
      text: node.text,
      rect,
      contentRect,
      padding: { ...style.padding },
      margin: { ...style.margin },
      border: { ...style.border },
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollWidth: scroll.width,
      scrollHeight: scroll.height,
      zIndex: style.zIndex,
      visible,
      hitRegions: visible ? [hitRegionForNode(node, rect, style.zIndex)] : [],
      children,
    };
  }

  #layoutBlockChildren(node: LayoutNode, bounds: Rectangle): ComputedLayoutBox[] {
    const boxes: ComputedLayoutBox[] = [];
    const children = layoutChildren(node);
    const gap = Math.max(0, node.style.rowGap || node.style.gap);
    let cursor = bounds.row;

    for (const child of children) {
      const childMargins = child.style.margin;
      const preferred = preferredBlockChildSize(child, bounds, this.#defaultTextHeight);
      const availableHeight = Math.max(0, bounds.row + bounds.height - cursor);
      const allocatedHeight = Math.max(
        preferred.height + childMargins.top + childMargins.bottom,
        Math.min(availableHeight, preferred.height + childMargins.top + childMargins.bottom),
      );
      const childBounds = {
        column: bounds.column,
        row: cursor,
        width: bounds.width,
        height: allocatedHeight,
      };
      const box = this.#layoutNode(child, childBounds);
      boxes.push(box);
      cursor = box.rect.row + box.rect.height + box.margin.bottom + gap;
    }

    return boxes;
  }

  #layoutFlexChildren(node: LayoutNode, bounds: Rectangle): ComputedLayoutBox[] {
    const children = layoutChildren(node);
    if (children.length === 0) return [];

    const direction: FlexDirection = node.style.flexDirection;
    const gap = Math.max(
      0,
      direction === "row" ? node.style.columnGap || node.style.gap : node.style.rowGap || node.style.gap,
    );
    const items = children.map((child): FlexItem<string> => {
      const basis = preferredFlexBasis(child, bounds, direction, this.#defaultTextHeight);
      const minimum = resolveFlexMinimum(child, bounds, direction);
      const maximum = resolveFlexMaximum(child, bounds, direction);
      const max = child.style.flexGrow === 0 ? Math.max(minimum, Math.min(maximum ?? basis, basis)) : maximum;
      return {
        id: child.id,
        basis,
        grow: child.style.flexGrow,
        shrink: child.style.flexShrink,
        min: minimum,
        max,
      };
    });
    const rects = flexRects(bounds, direction, items, gap);
    return children.map((child) => this.#layoutNode(child, rects[child.id] ?? bounds, false, true));
  }
}

/** Creates the built-in deterministic block/flex layout solver. */
export function simpleLayoutSolver(options: SimpleLayoutSolverOptions = {}): SimpleLayoutSolver {
  return new SimpleLayoutSolver(options);
}

function layoutChildren(node: LayoutNode): LayoutNode[] {
  return node.children.filter((child) => child.style.display !== "none");
}

function normalizeRect(rect: Rectangle): Rectangle {
  return {
    column: Math.floor(rect.column),
    row: Math.floor(rect.row),
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  };
}

function shrinkByMargin(rect: Rectangle, margin: ComputedLayoutStyle["margin"]): Rectangle {
  return {
    column: rect.column + margin.left,
    row: rect.row + margin.top,
    width: Math.max(0, rect.width - margin.left - margin.right),
    height: Math.max(0, rect.height - margin.top - margin.bottom),
  };
}

function resolveNodeRect(
  node: LayoutNode,
  allocated: Rectangle,
  isRoot: boolean,
  fillAllocated: boolean,
  defaultTextHeight: number,
): Rectangle {
  const style = node.style;
  const intrinsic = measureNodeIntrinsic(node, Math.max(1, allocated.width), defaultTextHeight);
  const fallbackWidth = allocated.width;
  const fallbackHeight = isRoot || fillAllocated ? allocated.height : intrinsic.height || allocated.height;
  const width = clampLayoutSize(
    resolveLayoutLength(style.width, allocated.width, Math.min(allocated.width, fallbackWidth)),
    allocated.width,
    style.minWidth,
    style.maxWidth,
  );
  const height = clampLayoutSize(
    resolveLayoutLength(style.height, allocated.height, Math.min(allocated.height, fallbackHeight)),
    allocated.height,
    style.minHeight,
    style.maxHeight,
  );
  return {
    column: allocated.column,
    row: allocated.row,
    width: Math.min(width, allocated.width),
    height: Math.min(height, allocated.height),
  };
}

function contentRectangle(rect: Rectangle, style: ComputedLayoutStyle): Rectangle {
  const left = style.border.left + style.padding.left;
  const right = style.border.right + style.padding.right;
  const top = style.border.top + style.padding.top;
  const bottom = style.border.bottom + style.padding.bottom;
  return {
    column: rect.column + left,
    row: rect.row + top,
    width: Math.max(0, rect.width - left - right),
    height: Math.max(0, rect.height - top - bottom),
  };
}

function preferredBlockChildSize(
  node: LayoutNode,
  bounds: Rectangle,
  defaultTextHeight: number,
): LayoutIntrinsicSize {
  const intrinsic = measureNodeIntrinsic(node, Math.max(1, bounds.width), defaultTextHeight);
  const width = resolveLayoutLength(node.style.width, bounds.width, bounds.width);
  const height = resolveLayoutLength(
    node.style.height,
    bounds.height,
    Math.max(intrinsic.height, resolveLayoutLength(node.style.minHeight, bounds.height, 0), defaultTextHeight),
  );
  return {
    width,
    height: clampLayoutSize(height, bounds.height, node.style.minHeight, node.style.maxHeight),
  };
}

function preferredFlexBasis(
  node: LayoutNode,
  bounds: Rectangle,
  direction: FlexDirection,
  defaultTextHeight: number,
): number {
  const mainAvailable = direction === "row" ? bounds.width : bounds.height;
  const mainLength = direction === "row" ? node.style.width : node.style.height;
  if (node.style.flexBasis.unit !== "auto") return resolveLayoutLength(node.style.flexBasis, mainAvailable, 0);
  if (mainLength.unit !== "auto") return resolveLayoutLength(mainLength, mainAvailable, 0);
  const intrinsic = measureNodeIntrinsic(node, Math.max(1, bounds.width), defaultTextHeight);
  const fallback = direction === "row" ? intrinsic.width : intrinsic.height;
  return Math.max(1, fallback);
}

function resolveFlexMinimum(node: LayoutNode, bounds: Rectangle, direction: FlexDirection): number {
  return resolveLayoutLength(
    direction === "row" ? node.style.minWidth : node.style.minHeight,
    mainSize(bounds, direction),
    0,
  );
}

function resolveFlexMaximum(node: LayoutNode, bounds: Rectangle, direction: FlexDirection): number | undefined {
  const length = direction === "row" ? node.style.maxWidth : node.style.maxHeight;
  return length.unit === "auto"
    ? undefined
    : resolveLayoutLength(length, mainSize(bounds, direction), mainSize(bounds, direction));
}

function mainSize(rect: Rectangle, direction: FlexDirection): number {
  return direction === "row" ? rect.width : rect.height;
}

function measureNodeIntrinsic(
  node: LayoutNode,
  availableWidth: number,
  defaultTextHeight: number,
): LayoutIntrinsicSize {
  if (node.intrinsic?.width !== undefined || node.intrinsic?.height !== undefined) {
    return {
      width: Math.max(0, Math.floor(node.intrinsic.width ?? 0)),
      height: Math.max(defaultTextHeight, Math.floor(node.intrinsic.height ?? defaultTextHeight)),
    };
  }
  if (node.text) {
    return measureTextIntrinsic(node.text, availableWidth, defaultTextHeight);
  }
  if (node.children.length === 0) {
    return { width: 1, height: defaultTextHeight };
  }

  const childSizes = node.children.map((child) => measureNodeIntrinsic(child, availableWidth, defaultTextHeight));
  if (node.style.display === "flex" && node.style.flexDirection === "row") {
    return {
      width: childSizes.reduce((sum, size) => sum + size.width, 0) +
        Math.max(0, childSizes.length - 1) * node.style.columnGap,
      height: Math.max(defaultTextHeight, ...childSizes.map((size) => size.height)),
    };
  }
  return {
    width: Math.max(1, ...childSizes.map((size) => size.width)),
    height: childSizes.reduce((sum, size) => sum + Math.max(defaultTextHeight, size.height), 0),
  };
}

function measureTextIntrinsic(text: string, availableWidth: number, defaultTextHeight: number): LayoutIntrinsicSize {
  const lines = text.split(/\r?\n/);
  const width = Math.max(1, ...lines.map((line) => textWidth(line)));
  const wrapWidth = Math.max(1, availableWidth);
  const height = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(textWidth(line) / wrapWidth)), 0);
  return { width, height: Math.max(defaultTextHeight, height) };
}

function scrollSize(
  node: LayoutNode,
  contentRect: Rectangle,
  children: readonly ComputedLayoutBox[],
): LayoutIntrinsicSize {
  const textSize = node.text
    ? measureTextIntrinsic(node.text, Math.max(1, contentRect.width), 1)
    : { width: 0, height: 0 };
  let right = contentRect.column + Math.max(contentRect.width, textSize.width);
  let bottom = contentRect.row + Math.max(contentRect.height, textSize.height);
  for (const child of children) {
    right = Math.max(right, child.rect.column + child.rect.width + child.margin.right);
    bottom = Math.max(bottom, child.rect.row + child.rect.height + child.margin.bottom);
  }
  return {
    width: Math.max(contentRect.width, right - contentRect.column),
    height: Math.max(contentRect.height, bottom - contentRect.row),
  };
}

function hitRegionForNode(
  node: LayoutNode,
  bounds: Rectangle,
  zIndex: number,
): WidgetHitRegion<{ nodeId: string; tag: string }> {
  return {
    id: node.id,
    bounds,
    zIndex,
    payload: { nodeId: node.id, tag: node.tag },
  };
}
