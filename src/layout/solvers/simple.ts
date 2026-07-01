// Copyright 2023 Im-Beast. MIT license.
import { textWidth } from "../../utils/strings.ts";
import type { Rectangle } from "../../types.ts";
import { LayoutMeasurementCache } from "../measurement.ts";
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
    const flowChildren = style.display === "flex"
      ? this.#layoutFlexChildren(node, contentRect)
      : style.display === "grid"
      ? this.#layoutGridChildren(node, contentRect)
      : this.#layoutBlockChildren(node, contentRect);
    const children = [...flowChildren, ...this.#layoutAbsoluteChildren(node, contentRect)];
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
    const items = children.map((child): FlexLayoutItem => {
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
      return {
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
    });
    const lines = node.style.flexWrap === "nowrap"
      ? [items]
      : wrapFlexLines(items, mainSize(bounds, direction), mainGap);
    const orderedLines = node.style.flexWrap === "wrap-reverse" ? [...lines].reverse() : lines;
    const boxes: ComputedLayoutBox[] = [];
    let crossCursor = direction === "row" ? bounds.row : bounds.column;

    for (const line of orderedLines) {
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
    const columnCount = Math.max(
      1,
      node.style.gridTemplateColumns.length,
      ...placed.map((item) => item.column + item.columnSpan),
    );
    const rowCount = Math.max(
      1,
      node.style.gridTemplateRows.length,
      ...placed.map((item) => item.row + item.rowSpan),
    );
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

    return placed.map((item) => {
      const column = columnOffsets[item.column] ?? bounds.column;
      const row = rowOffsets[item.row] ?? bounds.row;
      const width = gridSpanSize(columns, item.column, item.columnSpan, columnGap);
      const height = gridSpanSize(rows, item.row, item.rowSpan, rowGap);
      const itemBounds = alignGridItemBounds(item.node, { column, row, width, height });
      return this.#layoutNode(item.node, itemBounds, false, true);
    });
  }

  #layoutAbsoluteChildren(node: LayoutNode, bounds: Rectangle): ComputedLayoutBox[] {
    return layoutAbsoluteChildren(node).map((child) => {
      return this.#layoutNode(
        child,
        absoluteChildBounds(child, bounds, this.#defaultTextHeight, this.#intrinsicMeasurementCache),
      );
    });
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
  return node.children.filter((child) => child.style.display !== "none" && child.style.position !== "absolute");
}

function layoutAbsoluteChildren(node: LayoutNode): LayoutNode[] {
  return node.children.filter((child) => child.style.display !== "none" && child.style.position === "absolute");
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
  const intrinsic = measureNodeIntrinsic(node, Math.max(1, allocated.width), defaultTextHeight, measurementCache);
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
  measurementCache?: LayoutMeasurementCache,
): LayoutIntrinsicSize {
  const intrinsic = measureNodeIntrinsic(node, Math.max(1, bounds.width), defaultTextHeight, measurementCache);
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
  return Math.max(1, ...items.map((item) => item.crossSize));
}

function flexLineRects(
  bounds: Rectangle,
  direction: FlexDirection,
  items: readonly FlexLayoutItem[],
  gap: number,
  justifyContent: LayoutJustifyContent,
): Record<string, Rectangle> {
  const rects = flexRects(bounds, direction, items, gap);
  const ordered = items.map((item) => rects[item.id] ?? bounds);
  const sizes = ordered.map((rect) => mainSize(rect, direction));
  const used = sizes.reduce((sum, size) => sum + size, 0) + Math.max(0, items.length - 1) * gap;
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

  let measured: LayoutIntrinsicSize;
  if (node.intrinsic?.width !== undefined || node.intrinsic?.height !== undefined) {
    measured = {
      width: Math.max(0, Math.floor(node.intrinsic.width ?? 0)),
      height: Math.max(defaultTextHeight, Math.floor(node.intrinsic.height ?? defaultTextHeight)),
    };
    if (cacheKey) measurementCache?.set(cacheKey, measured);
    return measured;
  }
  if (node.text) {
    measured = measureTextIntrinsic(node.text, availableWidth, defaultTextHeight);
    if (cacheKey) measurementCache?.set(cacheKey, measured);
    return measured;
  }
  if (node.children.length === 0) {
    measured = { width: 1, height: defaultTextHeight };
    if (cacheKey) measurementCache?.set(cacheKey, measured);
    return measured;
  }

  const childSizes = node.children.map((child) =>
    measureNodeIntrinsic(child, availableWidth, defaultTextHeight, measurementCache)
  );
  if (node.style.display === "flex" && node.style.flexDirection === "row") {
    measured = {
      width: childSizes.reduce((sum, size) => sum + size.width, 0) +
        Math.max(0, childSizes.length - 1) * node.style.columnGap,
      height: Math.max(defaultTextHeight, ...childSizes.map((size) => size.height)),
    };
    if (cacheKey) measurementCache?.set(cacheKey, measured);
    return measured;
  }
  measured = {
    width: Math.max(1, ...childSizes.map((size) => size.width)),
    height: childSizes.reduce((sum, size) => sum + Math.max(defaultTextHeight, size.height), 0),
  };
  if (cacheKey) measurementCache?.set(cacheKey, measured);
  return measured;
}

function measureTextIntrinsic(text: string, availableWidth: number, defaultTextHeight: number): LayoutIntrinsicSize {
  const lines = text.split(/\r?\n/);
  const width = Math.max(1, ...lines.map((line) => textWidth(line)));
  const wrapWidth = Math.max(1, availableWidth);
  const height = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(textWidth(line) / wrapWidth)), 0);
  return { width, height: Math.max(defaultTextHeight, height) };
}

function intrinsicMeasurementCacheKey(node: LayoutNode, availableWidth: number, defaultTextHeight: number): string {
  return [
    "v1",
    Math.max(1, Math.floor(availableWidth)),
    Math.max(1, Math.floor(defaultTextHeight)),
    node.tag,
    node.text ?? "",
    node.intrinsic?.width ?? "",
    node.intrinsic?.height ?? "",
    node.style.display,
    node.style.flexDirection,
    node.style.columnGap,
    ...node.children.map((child) => intrinsicNodeSignature(child)),
  ].join("\u001f");
}

function intrinsicNodeSignature(node: LayoutNode): string {
  return [
    node.tag,
    node.text ?? "",
    node.intrinsic?.width ?? "",
    node.intrinsic?.height ?? "",
    node.style.display,
    node.style.flexDirection,
    node.style.columnGap,
    node.children.map((child) => intrinsicNodeSignature(child)).join("\u001e"),
  ].join("\u001f");
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
