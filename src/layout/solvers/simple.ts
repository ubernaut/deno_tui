// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../../types.ts";
import { LayoutMeasurementCache, measureTerminalTextIntrinsic } from "../measurement.ts";
import { type FlexDirection, type FlexItem, flexRects } from "../flex_layout.ts";
import { clampLayoutSize, type ComputedLayoutStyle, type LayoutJustifyContent, resolveLayoutLength } from "../style.ts";
import {
  alignGridItemBounds,
  gridSpanSize,
  gridTrackOffsets,
  hitRegionForNode,
  placeGridChildren,
  resolveGridTracks,
} from "./simple_grid.ts";
import {
  type ComputedLayoutBox,
  computedLayoutBoxOverflow,
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
  intrinsicMeasurementCache?: LayoutMeasurementCache | false;
  maxIntrinsicCacheEntries?: number;
}

/** Built-in deterministic block/flex layout solver for terminal-cell rectangles. */
export class SimpleLayoutSolver implements LayoutSolver {
  readonly id = "simple";
  readonly #defaultTextHeight: number;
  readonly #intrinsicMeasurementCache?: LayoutMeasurementCache;

  constructor(options: SimpleLayoutSolverOptions = {}) {
    this.#defaultTextHeight = Math.max(1, Math.floor(options.defaultTextHeight ?? 1));
    this.#intrinsicMeasurementCache = options.intrinsicMeasurementCache === false
      ? undefined
      : options.intrinsicMeasurementCache ?? new LayoutMeasurementCache({
        maxEntries: options.maxIntrinsicCacheEntries,
      });
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
    const rect = resolveNodeRect(
      node,
      outer,
      isRoot,
      fillAllocated,
      this.#defaultTextHeight,
      this.#intrinsicMeasurementCache,
    );
    const contentRect = contentRectangle(rect, style);
    const visible = style.visibility === "visible" && style.display !== "none";
    const children = style.display === "flex"
      ? this.#layoutFlexChildren(node, contentRect)
      : style.display === "grid"
      ? this.#layoutGridChildren(node, contentRect)
      : this.#layoutBlockChildren(node, contentRect);
    this.#layoutAbsoluteChildrenInto(children, node, contentRect);
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
      overflow: computedLayoutBoxOverflow(contentRect, scroll.width, scroll.height, style.overflowX, style.overflowY),
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
      const preferred = preferredBlockChildSize(
        child,
        bounds,
        this.#defaultTextHeight,
        this.#intrinsicMeasurementCache,
      );
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
    const mainGap = Math.max(
      0,
      direction === "row" ? node.style.columnGap || node.style.gap : node.style.rowGap || node.style.gap,
    );
    const crossGap = Math.max(
      0,
      direction === "row" ? node.style.rowGap || node.style.gap : node.style.columnGap || node.style.gap,
    );
    const items = new Array<FlexLayoutItem>(children.length);
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index]!;
      const basis = preferredFlexBasis(
        child,
        bounds,
        direction,
        this.#defaultTextHeight,
        this.#intrinsicMeasurementCache,
      );
      const minimum = resolveFlexMinimum(child, bounds, direction);
      const maximum = resolveFlexMaximum(child, bounds, direction);
      const max = child.style.flexGrow === 0 ? Math.max(minimum, Math.min(maximum ?? basis, basis)) : maximum;
      items[index] = {
        node: child,
        id: child.id,
        basis,
        grow: child.style.flexGrow,
        shrink: child.style.flexShrink,
        min: minimum,
        max,
        crossSize: preferredFlexCrossSize(
          child,
          bounds,
          direction,
          this.#defaultTextHeight,
          this.#intrinsicMeasurementCache,
        ),
      };
    }
    const lines = node.style.flexWrap === "nowrap"
      ? [items]
      : wrapFlexLines(items, mainSize(bounds, direction), mainGap);
    const boxes: ComputedLayoutBox[] = [];
    let crossCursor = direction === "row" ? bounds.row : bounds.column;

    const reverseLines = node.style.flexWrap === "wrap-reverse";
    for (
      let lineIndex = reverseLines ? lines.length - 1 : 0;
      reverseLines ? lineIndex >= 0 : lineIndex < lines.length;
      lineIndex += reverseLines ? -1 : 1
    ) {
      const line = lines[lineIndex]!;
      const lineCrossSize = lineFlexCrossSize(
        line,
        bounds,
        direction,
        node.style.alignItems,
        node.style.flexWrap === "nowrap",
      );
      const lineBounds = direction === "row"
        ? { column: bounds.column, row: crossCursor, width: bounds.width, height: lineCrossSize }
        : { column: crossCursor, row: bounds.row, width: lineCrossSize, height: bounds.height };
      const rects = flexLineRects(lineBounds, direction, line, mainGap, node.style.justifyContent);
      for (const item of line) {
        const itemBounds = alignFlexItemRect(rects[item.id] ?? lineBounds, item, direction, node.style.alignItems);
        boxes.push(this.#layoutNode(item.node, itemBounds, false, true));
      }
      crossCursor += lineCrossSize + crossGap;
    }

    return boxes;
  }

  #layoutGridChildren(node: LayoutNode, bounds: Rectangle): ComputedLayoutBox[] {
    const children = layoutChildren(node);
    if (children.length === 0) return [];

    const columnGap = Math.max(0, node.style.columnGap || node.style.gap);
    const rowGap = Math.max(0, node.style.rowGap || node.style.gap);
    const placed = placeGridChildren(children, {
      columns: node.style.gridTemplateColumns.length,
      rows: node.style.gridTemplateRows.length,
      autoFlow: node.style.gridAutoFlow,
      areas: node.style.gridTemplateAreas,
    });
    let columnCount = Math.max(1, node.style.gridTemplateColumns.length);
    let rowCount = Math.max(1, node.style.gridTemplateRows.length);
    for (const item of placed) {
      columnCount = Math.max(columnCount, item.column + item.columnSpan);
      rowCount = Math.max(rowCount, item.row + item.rowSpan);
    }
    const columns = resolveGridTracks(
      node.style.gridTemplateColumns,
      columnCount,
      bounds.width,
      columnGap,
      node.style.gridAutoColumns,
    );
    const rows = resolveGridTracks(
      node.style.gridTemplateRows,
      rowCount,
      bounds.height,
      rowGap,
      node.style.gridAutoRows,
    );
    const columnOffsets = gridTrackOffsets(bounds.column, columns, columnGap);
    const rowOffsets = gridTrackOffsets(bounds.row, rows, rowGap);

    const boxes = new Array<ComputedLayoutBox>(placed.length);
    for (let index = 0; index < placed.length; index += 1) {
      const item = placed[index]!;
      const column = columnOffsets[item.column] ?? bounds.column;
      const row = rowOffsets[item.row] ?? bounds.row;
      const width = gridSpanSize(columns, item.column, item.columnSpan, columnGap);
      const height = gridSpanSize(rows, item.row, item.rowSpan, rowGap);
      const itemBounds = alignGridItemBounds(item.node, { column, row, width, height });
      boxes[index] = this.#layoutNode(item.node, itemBounds, false, true);
    }
    return boxes;
  }

  #layoutAbsoluteChildrenInto(target: ComputedLayoutBox[], node: LayoutNode, bounds: Rectangle): void {
    for (const child of node.children) {
      if (child.style.display === "none" || child.style.position !== "absolute") continue;
      target.push(this.#layoutNode(
        child,
        absoluteChildBounds(child, bounds, this.#defaultTextHeight, this.#intrinsicMeasurementCache),
      ));
    }
  }
}

/** Creates the built-in deterministic block/flex layout solver. */
export function simpleLayoutSolver(options: SimpleLayoutSolverOptions = {}): SimpleLayoutSolver {
  return new SimpleLayoutSolver(options);
}

interface FlexLayoutItem extends FlexItem<string> {
  node: LayoutNode;
  crossSize: number;
}

function layoutChildren(node: LayoutNode): LayoutNode[] {
  const children: LayoutNode[] = [];
  for (const child of node.children) {
    if (child.style.display !== "none" && child.style.position !== "absolute") children.push(child);
  }
  return children;
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
  measurementCache?: LayoutMeasurementCache,
): Rectangle {
  const style = node.style;
  const fallbackWidth = allocated.width;
  const width = clampLayoutSize(
    resolveLayoutLength(style.width, allocated.width, Math.min(allocated.width, fallbackWidth)),
    allocated.width,
    style.minWidth,
    style.maxWidth,
  );
  const intrinsic = measureNodeIntrinsic(node, Math.max(1, width), defaultTextHeight, measurementCache);
  const fallbackHeight = isRoot || fillAllocated ? allocated.height : intrinsic.height || allocated.height;
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
  measurementCache?: LayoutMeasurementCache,
): LayoutIntrinsicSize {
  const width = resolveLayoutLength(node.style.width, bounds.width, bounds.width);
  const intrinsic = measureNodeIntrinsic(node, Math.max(1, width), defaultTextHeight, measurementCache);
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

function absoluteChildBounds(
  node: LayoutNode,
  containingBlock: Rectangle,
  defaultTextHeight: number,
  measurementCache?: LayoutMeasurementCache,
): Rectangle {
  const style = node.style;
  const left = resolveInset(style.inset.left, containingBlock.width);
  const right = resolveInset(style.inset.right, containingBlock.width);
  const top = resolveInset(style.inset.top, containingBlock.height);
  const bottom = resolveInset(style.inset.bottom, containingBlock.height);
  const intrinsic = preferredBlockChildSize(node, containingBlock, defaultTextHeight, measurementCache);
  const width = left !== undefined && right !== undefined
    ? Math.max(0, containingBlock.width - left - right)
    : clampLayoutSize(
      resolveLayoutLength(style.width, containingBlock.width, Math.min(containingBlock.width, intrinsic.width)),
      containingBlock.width,
      style.minWidth,
      style.maxWidth,
    );
  const height = top !== undefined && bottom !== undefined
    ? Math.max(0, containingBlock.height - top - bottom)
    : clampLayoutSize(
      resolveLayoutLength(style.height, containingBlock.height, Math.min(containingBlock.height, intrinsic.height)),
      containingBlock.height,
      style.minHeight,
      style.maxHeight,
    );
  const column = left !== undefined
    ? containingBlock.column + left
    : right !== undefined
    ? containingBlock.column + Math.max(0, containingBlock.width - right - width)
    : containingBlock.column;
  const row = top !== undefined
    ? containingBlock.row + top
    : bottom !== undefined
    ? containingBlock.row + Math.max(0, containingBlock.height - bottom - height)
    : containingBlock.row;

  return { column, row, width, height };
}

function resolveInset(value: ComputedLayoutStyle["inset"]["top"], available: number): number | undefined {
  return value.unit === "auto" ? undefined : resolveLayoutLength(value, available, 0);
}

function preferredFlexBasis(
  node: LayoutNode,
  bounds: Rectangle,
  direction: FlexDirection,
  defaultTextHeight: number,
  measurementCache?: LayoutMeasurementCache,
): number {
  const mainAvailable = direction === "row" ? bounds.width : bounds.height;
  const mainLength = direction === "row" ? node.style.width : node.style.height;
  if (node.style.flexBasis.unit !== "auto") return resolveLayoutLength(node.style.flexBasis, mainAvailable, 0);
  if (mainLength.unit !== "auto") return resolveLayoutLength(mainLength, mainAvailable, 0);
  const intrinsic = measureNodeIntrinsic(node, Math.max(1, bounds.width), defaultTextHeight, measurementCache);
  const fallback = direction === "row" ? intrinsic.width : intrinsic.height;
  return Math.max(1, fallback);
}

function preferredFlexCrossSize(
  node: LayoutNode,
  bounds: Rectangle,
  direction: FlexDirection,
  defaultTextHeight: number,
  measurementCache?: LayoutMeasurementCache,
): number {
  const crossAvailable = direction === "row" ? bounds.height : bounds.width;
  const crossLength = direction === "row" ? node.style.height : node.style.width;
  if (crossLength.unit !== "auto") return resolveLayoutLength(crossLength, crossAvailable, 0);
  const intrinsic = measureNodeIntrinsic(node, Math.max(1, bounds.width), defaultTextHeight, measurementCache);
  const fallback = direction === "row" ? intrinsic.height : intrinsic.width;
  const min = direction === "row" ? node.style.minHeight : node.style.minWidth;
  const max = direction === "row" ? node.style.maxHeight : node.style.maxWidth;
  return clampLayoutSize(Math.max(1, fallback), crossAvailable, min, max);
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

function crossSize(rect: Rectangle, direction: FlexDirection): number {
  return direction === "row" ? rect.height : rect.width;
}

function wrapFlexLines(
  items: readonly FlexLayoutItem[],
  availableMainSize: number,
  gap: number,
): FlexLayoutItem[][] {
  const lines: FlexLayoutItem[][] = [];
  let current: FlexLayoutItem[] = [];
  let used = 0;
  const safeAvailable = Math.max(0, Math.floor(availableMainSize));
  const safeGap = Math.max(0, gap);

  for (const item of items) {
    const itemSize = Math.max(item.min ?? 0, item.basis ?? 0);
    const projected = current.length === 0 ? itemSize : used + safeGap + itemSize;
    if (current.length > 0 && projected > safeAvailable) {
      lines.push(current);
      current = [item];
      used = itemSize;
    } else {
      current.push(item);
      used = projected;
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

function lineFlexCrossSize(
  items: readonly FlexLayoutItem[],
  bounds: Rectangle,
  direction: FlexDirection,
  alignItems: ComputedLayoutStyle["alignItems"],
  singleLine: boolean,
): number {
  if (alignItems === "stretch" && singleLine) return crossSize(bounds, direction);
  let size = 1;
  for (const item of items) size = Math.max(size, item.crossSize);
  return size;
}

function flexLineRects(
  bounds: Rectangle,
  direction: FlexDirection,
  items: readonly FlexLayoutItem[],
  gap: number,
  justifyContent: LayoutJustifyContent,
): Record<string, Rectangle> {
  const rects = flexRects(bounds, direction, items, gap);
  const sizes = new Array<number>(items.length);
  let usedSize = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const size = mainSize(rects[item.id] ?? bounds, direction);
    sizes[index] = size;
    usedSize += size;
  }
  const used = usedSize + Math.max(0, items.length - 1) * gap;
  const free = Math.max(0, mainSize(bounds, direction) - used);
  let leading = 0;
  let resolvedGap = gap;
  let remainder = 0;

  if (justifyContent === "end") {
    leading = free;
  } else if (justifyContent === "center") {
    leading = Math.floor(free / 2);
  } else if (justifyContent === "space-between" && items.length > 1) {
    resolvedGap += Math.floor(free / (items.length - 1));
    remainder = free % (items.length - 1);
  } else if (justifyContent === "space-around" && items.length > 0) {
    const share = Math.floor(free / items.length);
    leading = Math.floor(share / 2);
    resolvedGap += share;
    remainder = free % items.length;
  }

  const adjusted: Record<string, Rectangle> = {};
  let cursor = (direction === "row" ? bounds.column : bounds.row) + leading;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const size = sizes[index] ?? 0;
    adjusted[item.id] = direction === "row"
      ? { column: cursor, row: bounds.row, width: size, height: bounds.height }
      : { column: bounds.column, row: cursor, width: bounds.width, height: size };
    cursor += size + resolvedGap + (remainder > 0 && index < items.length - 1 ? 1 : 0);
    if (remainder > 0 && index < items.length - 1) remainder -= 1;
  }

  return adjusted;
}

function alignFlexItemRect(
  rect: Rectangle,
  item: FlexLayoutItem,
  direction: FlexDirection,
  alignItems: ComputedLayoutStyle["alignItems"],
): Rectangle {
  if (alignItems === "stretch") return rect;

  const availableCross = crossSize(rect, direction);
  const size = Math.min(availableCross, Math.max(0, item.crossSize));
  let offset = 0;
  if (alignItems === "end") offset = availableCross - size;
  else if (alignItems === "center") offset = Math.floor((availableCross - size) / 2);

  return direction === "row"
    ? { ...rect, row: rect.row + offset, height: size }
    : { ...rect, column: rect.column + offset, width: size };
}

function measureNodeIntrinsic(
  node: LayoutNode,
  availableWidth: number,
  defaultTextHeight: number,
  measurementCache?: LayoutMeasurementCache,
): LayoutIntrinsicSize {
  const cacheKey = measurementCache ? intrinsicMeasurementCacheKey(node, availableWidth, defaultTextHeight) : undefined;
  if (cacheKey) {
    const cached = measurementCache?.get(cacheKey);
    if (cached) return cached;
  }

  const intrinsicWidth = node.intrinsic?.width;
  const measurementWidth = intrinsicWidth === undefined ? availableWidth : Math.max(1, Math.floor(intrinsicWidth));
  let measured = measureNodeIntrinsicBase(node, measurementWidth, defaultTextHeight, measurementCache);
  if (node.intrinsic?.width !== undefined || node.intrinsic?.height !== undefined) {
    measured = {
      width: node.intrinsic.width === undefined ? measured.width : Math.max(0, Math.floor(node.intrinsic.width)),
      height: node.intrinsic.height === undefined
        ? measured.height
        : Math.max(defaultTextHeight, Math.floor(node.intrinsic.height)),
    };
  }
  if (cacheKey) measurementCache?.set(cacheKey, measured);
  return measured;
}

function measureNodeIntrinsicBase(
  node: LayoutNode,
  availableWidth: number,
  defaultTextHeight: number,
  measurementCache?: LayoutMeasurementCache,
): LayoutIntrinsicSize {
  if (node.text) {
    return measureTextIntrinsic(node.text, availableWidth, defaultTextHeight);
  }
  if (node.children.length === 0) {
    return { width: 1, height: defaultTextHeight };
  }

  if (node.style.display === "flex" && node.style.flexDirection === "row") {
    let width = 0;
    let height = defaultTextHeight;
    let count = 0;
    const gap = Math.max(0, node.style.columnGap || node.style.gap);
    for (const child of node.children) {
      if (!participatesInLayout(child)) continue;
      const childSize = childLayoutIntrinsicSize(child, availableWidth, defaultTextHeight, measurementCache);
      width += childSize.width;
      height = Math.max(height, childSize.height);
      count += 1;
    }
    return {
      width: width + Math.max(0, count - 1) * gap,
      height,
    };
  }
  let width = 1;
  let height = 0;
  let count = 0;
  const gap = Math.max(0, node.style.rowGap || node.style.gap);
  for (const child of node.children) {
    if (!participatesInLayout(child)) continue;
    const childSize = childLayoutIntrinsicSize(child, availableWidth, defaultTextHeight, measurementCache);
    width = Math.max(width, childSize.width);
    if (count > 0) height += gap;
    height += Math.max(defaultTextHeight, childSize.height);
    count += 1;
  }
  return {
    width,
    height: count === 0 ? defaultTextHeight : height,
  };
}

function participatesInLayout(node: LayoutNode): boolean {
  return node.style.display !== "none" && node.style.position !== "absolute";
}

function childLayoutIntrinsicSize(
  node: LayoutNode,
  availableWidth: number,
  defaultTextHeight: number,
  measurementCache?: LayoutMeasurementCache,
): LayoutIntrinsicSize {
  const measured = measureNodeIntrinsic(node, availableWidth, defaultTextHeight, measurementCache);
  const width = node.style.width.unit === "auto"
    ? measured.width
    : resolveLayoutLength(node.style.width, availableWidth, measured.width);
  const height = node.style.height.unit === "auto"
    ? measured.height
    : resolveLayoutLength(node.style.height, Math.max(defaultTextHeight, measured.height), measured.height);
  return {
    width: Math.max(0, width),
    height: Math.max(defaultTextHeight, height),
  };
}

function measureTextIntrinsic(text: string, availableWidth: number, defaultTextHeight: number): LayoutIntrinsicSize {
  return measureTerminalTextIntrinsic(text, availableWidth, defaultTextHeight);
}

function intrinsicMeasurementCacheKey(node: LayoutNode, availableWidth: number, defaultTextHeight: number): string {
  let key = "v1" +
    "\u001f" + Math.max(1, Math.floor(availableWidth)) +
    "\u001f" + Math.max(1, Math.floor(defaultTextHeight)) +
    "\u001f" + node.tag +
    "\u001f" + (node.text ?? "") +
    "\u001f" + (node.intrinsic?.width ?? "") +
    "\u001f" + (node.intrinsic?.height ?? "") +
    "\u001f" + node.style.display +
    "\u001f" + node.style.position +
    "\u001f" + node.style.flexDirection +
    "\u001f" + layoutLengthSignature(node.style.flexBasis) +
    "\u001f" + layoutLengthSignature(node.style.width) +
    "\u001f" + layoutLengthSignature(node.style.height) +
    "\u001f" + layoutLengthSignature(node.style.minWidth) +
    "\u001f" + layoutLengthSignature(node.style.minHeight) +
    "\u001f" + layoutLengthSignature(node.style.maxWidth) +
    "\u001f" + layoutLengthSignature(node.style.maxHeight) +
    "\u001f" + node.style.gap +
    "\u001f" + node.style.rowGap +
    "\u001f" + node.style.columnGap;
  for (const child of node.children) {
    key += "\u001f" + intrinsicNodeSignature(child);
  }
  return key;
}

function intrinsicNodeSignature(node: LayoutNode): string {
  let signature = node.tag +
    "\u001f" + (node.text ?? "") +
    "\u001f" + (node.intrinsic?.width ?? "") +
    "\u001f" + (node.intrinsic?.height ?? "") +
    "\u001f" + node.style.display +
    "\u001f" + node.style.position +
    "\u001f" + node.style.flexDirection +
    "\u001f" + layoutLengthSignature(node.style.flexBasis) +
    "\u001f" + layoutLengthSignature(node.style.width) +
    "\u001f" + layoutLengthSignature(node.style.height) +
    "\u001f" + layoutLengthSignature(node.style.minWidth) +
    "\u001f" + layoutLengthSignature(node.style.minHeight) +
    "\u001f" + layoutLengthSignature(node.style.maxWidth) +
    "\u001f" + layoutLengthSignature(node.style.maxHeight) +
    "\u001f" + node.style.gap +
    "\u001f" + node.style.rowGap +
    "\u001f" + node.style.columnGap;
  if (node.children.length === 0) return signature + "\u001f";
  signature += "\u001f";
  for (let index = 0; index < node.children.length; index += 1) {
    if (index > 0) signature += "\u001e";
    signature += intrinsicNodeSignature(node.children[index]!);
  }
  return signature;
}

function layoutLengthSignature(value: ComputedLayoutStyle["width"]): string {
  return `${value.unit}:${value.value}`;
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
