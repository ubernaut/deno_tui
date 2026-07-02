// Copyright 2023 Im-Beast. MIT license.
import Yoga from "yoga-layout";
import { textWidth } from "../../utils/strings.ts";
import type { Rectangle } from "../../types.ts";
import type { ComputedLayoutStyle, LayoutAlignItems, LayoutJustifyContent, LayoutLengthValue } from "../style.ts";
import {
  type ComputedLayoutBox,
  computedLayoutBoxOverflow,
  flattenComputedLayoutBoxes,
  type LayoutNode,
  type LayoutSolver,
  type LayoutSolverInput,
  type LayoutSolverResult,
  mapLayoutBoxes,
} from "../solver.ts";

/** Options for configuring the Yoga Flexbox layout solver. */
export interface YogaLayoutSolverOptions {
  measureText?: (text: string, width: number) => { width: number; height: number };
}

/** Optional Yoga-backed Flexbox solver for CSS-compatible TUI layout. */
export class YogaLayoutSolver implements LayoutSolver {
  readonly id = "yoga";
  readonly #measureText: (text: string, width: number) => { width: number; height: number };

  constructor(options: YogaLayoutSolverOptions = {}) {
    this.#measureText = options.measureText ?? defaultMeasureText;
  }

  supports(): boolean {
    return true;
  }

  solve(input: LayoutSolverInput): LayoutSolverResult {
    const rootYogaNode = this.#createYogaNode(input.root);
    rootYogaNode.calculateLayout(input.bounds.width, input.bounds.height, Yoga.DIRECTION_LTR);
    const root = this.#toComputedBox(input.root, rootYogaNode, input.bounds);
    rootYogaNode.freeRecursive();
    const boxes = flattenComputedLayoutBoxes(root);
    return {
      root,
      boxes,
      byId: mapLayoutBoxes(boxes),
      contentWidth: root.scrollWidth,
      contentHeight: root.scrollHeight,
    };
  }

  #createYogaNode(node: LayoutNode): YogaNode {
    const yogaNode = Yoga.Node.create() as YogaNode;
    applyYogaStyle(yogaNode, node.style);
    if (node.text && node.children.length === 0) {
      yogaNode.setMeasureFunc((width: number) => {
        const measured = this.#measureText(node.text ?? "", Math.max(1, Math.floor(width || Number.MAX_SAFE_INTEGER)));
        return measured;
      });
    }
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index]!;
      yogaNode.insertChild(this.#createYogaNode(child), index);
    }
    return yogaNode;
  }

  #toComputedBox(
    node: LayoutNode,
    yogaNode: YogaNode,
    rootBounds: Rectangle,
    parentOffset: { column: number; row: number } = { column: rootBounds.column, row: rootBounds.row },
  ): ComputedLayoutBox {
    const layout = yogaNode.getComputedLayout();
    const rect = {
      column: parentOffset.column + Math.round(layout.left),
      row: parentOffset.row + Math.round(layout.top),
      width: Math.max(0, Math.round(layout.width)),
      height: Math.max(0, Math.round(layout.height)),
    };
    const contentRect = yogaContentRect(rect, node.style);
    const children: ComputedLayoutBox[] = [];
    let scrollWidth = contentRect.width;
    let scrollHeight = contentRect.height;
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index]!;
      const childYogaNode = yogaNode.getChild(index) as YogaNode;
      const childBox = this.#toComputedBox(child, childYogaNode, rootBounds, { column: rect.column, row: rect.row });
      children.push(childBox);
      scrollWidth = Math.max(scrollWidth, childBox.rect.column + childBox.rect.width - contentRect.column);
      scrollHeight = Math.max(scrollHeight, childBox.rect.row + childBox.rect.height - contentRect.row);
    }
    const visible = node.style.visibility === "visible" && node.style.display !== "none";
    return {
      id: node.id,
      tag: node.tag,
      classes: node.classes,
      attributes: { ...node.attributes },
      text: node.text,
      rect,
      contentRect,
      padding: { ...node.style.padding },
      margin: { ...node.style.margin },
      border: { ...node.style.border },
      overflowX: node.style.overflowX,
      overflowY: node.style.overflowY,
      scrollWidth,
      scrollHeight,
      overflow: computedLayoutBoxOverflow(
        contentRect,
        scrollWidth,
        scrollHeight,
        node.style.overflowX,
        node.style.overflowY,
      ),
      zIndex: node.style.zIndex,
      visible,
      hitRegions: visible
        ? [{ id: node.id, bounds: rect, zIndex: node.style.zIndex, payload: { nodeId: node.id, tag: node.tag } }]
        : [],
      children,
    };
  }
}

/** Creates an optional Yoga-backed Flexbox layout solver. */
export function yogaLayoutSolver(options: YogaLayoutSolverOptions = {}): YogaLayoutSolver {
  return new YogaLayoutSolver(options);
}

type YogaNode = ReturnType<typeof Yoga.Node.create>;

function applyYogaStyle(node: YogaNode, style: ComputedLayoutStyle): void {
  node.setDisplay(style.display === "none" ? Yoga.DISPLAY_NONE : Yoga.DISPLAY_FLEX);
  node.setFlexDirection(
    style.display === "flex" && style.flexDirection === "row" ? Yoga.FLEX_DIRECTION_ROW : Yoga.FLEX_DIRECTION_COLUMN,
  );
  node.setFlexWrap(yogaFlexWrap(style.flexWrap));
  node.setFlexGrow(style.flexGrow);
  node.setFlexShrink(style.flexShrink);
  applyYogaLength(node, "width", style.width);
  applyYogaLength(node, "height", style.height);
  applyYogaLength(node, "minWidth", style.minWidth);
  applyYogaLength(node, "minHeight", style.minHeight);
  applyYogaLength(node, "maxWidth", style.maxWidth);
  applyYogaLength(node, "maxHeight", style.maxHeight);
  applyYogaLength(node, "flexBasis", style.flexBasis);
  node.setAlignItems(yogaAlign(style.alignItems));
  node.setJustifyContent(yogaJustify(style.justifyContent));
  node.setOverflow(yogaOverflow(style.overflowX === "visible" && style.overflowY === "visible" ? "visible" : "scroll"));
  node.setGap(Yoga.GUTTER_COLUMN, style.columnGap || style.gap);
  node.setGap(Yoga.GUTTER_ROW, style.rowGap || style.gap);
  node.setPositionType(style.position === "absolute" ? Yoga.POSITION_TYPE_ABSOLUTE : Yoga.POSITION_TYPE_RELATIVE);
  setYogaPositionEdges(node, style.inset);
  setYogaEdges(node, "setMargin", style.margin);
  setYogaEdges(node, "setPadding", style.padding);
  setYogaEdges(node, "setBorder", style.border);
}

function applyYogaLength(
  node: YogaNode,
  property: "width" | "height" | "minWidth" | "minHeight" | "maxWidth" | "maxHeight" | "flexBasis",
  length: LayoutLengthValue,
): void {
  if (length.unit === "fr") return;
  if (property === "width") {
    if (length.unit === "auto") node.setWidthAuto();
    else if (length.unit === "percent") node.setWidthPercent(length.value);
    else node.setWidth(length.value);
  } else if (property === "height") {
    if (length.unit === "auto") node.setHeightAuto();
    else if (length.unit === "percent") node.setHeightPercent(length.value);
    else node.setHeight(length.value);
  } else if (property === "minWidth") {
    if (length.unit === "percent") node.setMinWidthPercent(length.value);
    else if (length.unit !== "auto") node.setMinWidth(length.value);
  } else if (property === "minHeight") {
    if (length.unit === "percent") node.setMinHeightPercent(length.value);
    else if (length.unit !== "auto") node.setMinHeight(length.value);
  } else if (property === "maxWidth") {
    if (length.unit === "percent") node.setMaxWidthPercent(length.value);
    else if (length.unit !== "auto") node.setMaxWidth(length.value);
  } else if (property === "maxHeight") {
    if (length.unit === "percent") node.setMaxHeightPercent(length.value);
    else if (length.unit !== "auto") node.setMaxHeight(length.value);
  } else if (property === "flexBasis") {
    if (length.unit === "auto") node.setFlexBasisAuto();
    else if (length.unit === "percent") node.setFlexBasisPercent(length.value);
    else node.setFlexBasis(length.value);
  }
}

function setYogaEdges(
  node: YogaNode,
  method: "setMargin" | "setPadding" | "setBorder",
  edges: { top: number; right: number; bottom: number; left: number },
): void {
  node[method](Yoga.EDGE_TOP, edges.top);
  node[method](Yoga.EDGE_RIGHT, edges.right);
  node[method](Yoga.EDGE_BOTTOM, edges.bottom);
  node[method](Yoga.EDGE_LEFT, edges.left);
}

function setYogaPositionEdges(
  node: YogaNode,
  edges: ComputedLayoutStyle["inset"],
): void {
  applyYogaPosition(node, Yoga.EDGE_TOP, edges.top);
  applyYogaPosition(node, Yoga.EDGE_RIGHT, edges.right);
  applyYogaPosition(node, Yoga.EDGE_BOTTOM, edges.bottom);
  applyYogaPosition(node, Yoga.EDGE_LEFT, edges.left);
}

function applyYogaPosition(node: YogaNode, edge: number, length: LayoutLengthValue): void {
  if (length.unit === "auto" || length.unit === "fr") return;
  if (length.unit === "percent") node.setPositionPercent(edge, length.value);
  else node.setPosition(edge, length.value);
}

function yogaAlign(value: LayoutAlignItems): number {
  switch (value) {
    case "center":
      return Yoga.ALIGN_CENTER;
    case "end":
      return Yoga.ALIGN_FLEX_END;
    case "stretch":
      return Yoga.ALIGN_STRETCH;
    default:
      return Yoga.ALIGN_FLEX_START;
  }
}

function yogaJustify(value: LayoutJustifyContent): number {
  switch (value) {
    case "center":
      return Yoga.JUSTIFY_CENTER;
    case "end":
      return Yoga.JUSTIFY_FLEX_END;
    case "space-between":
      return Yoga.JUSTIFY_SPACE_BETWEEN;
    case "space-around":
      return Yoga.JUSTIFY_SPACE_AROUND;
    default:
      return Yoga.JUSTIFY_FLEX_START;
  }
}

function yogaFlexWrap(value: ComputedLayoutStyle["flexWrap"]): number {
  switch (value) {
    case "wrap":
      return Yoga.WRAP_WRAP;
    case "wrap-reverse":
      return Yoga.WRAP_WRAP_REVERSE;
    default:
      return Yoga.WRAP_NO_WRAP;
  }
}

function yogaOverflow(value: "visible" | "scroll"): number {
  return value === "visible" ? Yoga.OVERFLOW_VISIBLE : Yoga.OVERFLOW_SCROLL;
}

function yogaContentRect(rect: Rectangle, style: ComputedLayoutStyle): Rectangle {
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

function defaultMeasureText(text: string, width: number): { width: number; height: number } {
  let measuredWidth = 1;
  let lineStart = 0;
  for (let index = 0; index <= text.length; index += 1) {
    const char = text[index];
    if (index < text.length && char !== "\n" && char !== "\r") continue;
    measuredWidth = Math.max(measuredWidth, textWidth(text.slice(lineStart, index)));
    if (char === "\r" && text[index + 1] === "\n") index += 1;
    lineStart = index + 1;
  }
  const wrapWidth = Math.max(1, Math.min(width, measuredWidth));
  let height = 0;
  lineStart = 0;
  for (let index = 0; index <= text.length; index += 1) {
    const char = text[index];
    if (index < text.length && char !== "\n" && char !== "\r") continue;
    const lineWidth = textWidth(text.slice(lineStart, index));
    height += Math.max(1, Math.ceil(lineWidth / wrapWidth));
    if (char === "\r" && text[index + 1] === "\n") index += 1;
    lineStart = index + 1;
  }
  return {
    width: measuredWidth,
    height,
  };
}
