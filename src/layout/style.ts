// Copyright 2023 Im-Beast. MIT license.

/** Public type alias for CSS-inspired layout display modes. */
export type LayoutDisplay = "block" | "flex" | "grid" | "none";

/** Public type alias for CSS-inspired positioning modes. */
export type LayoutPosition = "relative" | "absolute";

/** Public type alias for CSS-inspired overflow handling. */
export type LayoutOverflow = "visible" | "hidden" | "auto" | "scroll";

/** Public type alias for flex layout direction. */
export type LayoutFlexDirection = "row" | "column";

/** Public type alias for flex wrapping behavior. */
export type LayoutFlexWrap = "nowrap" | "wrap" | "wrap-reverse";

/** Public type alias for cross-axis alignment. */
export type LayoutAlignItems = "start" | "end" | "center" | "stretch";

/** Public type alias for main-axis distribution. */
export type LayoutJustifyContent = "start" | "end" | "center" | "space-between" | "space-around";

/** Public type alias for CSS-grid auto-placement direction. */
export type LayoutGridAutoFlow = "row" | "column";

/** Public type alias for visibility state. */
export type LayoutVisibility = "visible" | "hidden";

/** Public interface describing a terminal-cell layout length. */
export interface LayoutLengthValue {
  unit: "auto" | "cell" | "percent" | "fr";
  value: number;
}

/** Public interface describing a one-dimensional CSS-grid placement. */
export interface LayoutGridPlacement {
  start?: number;
  end?: number;
  span?: number;
}

/** Public interface describing box model edges. */
export interface BoxEdges<T = number> {
  top: T;
  right: T;
  bottom: T;
  left: T;
}

/** Public interface describing the normalized style used by layout solvers. */
export interface ComputedLayoutStyle {
  display: LayoutDisplay;
  position: LayoutPosition;
  flexDirection: LayoutFlexDirection;
  flexWrap: LayoutFlexWrap;
  flexGrow: number;
  flexShrink: number;
  flexBasis: LayoutLengthValue;
  alignItems: LayoutAlignItems;
  justifyContent: LayoutJustifyContent;
  gridTemplateColumns: LayoutLengthValue[];
  gridTemplateRows: LayoutLengthValue[];
  gridAutoColumns: LayoutLengthValue;
  gridAutoRows: LayoutLengthValue;
  gridAutoFlow: LayoutGridAutoFlow;
  gridColumn: LayoutGridPlacement;
  gridRow: LayoutGridPlacement;
  width: LayoutLengthValue;
  height: LayoutLengthValue;
  minWidth: LayoutLengthValue;
  minHeight: LayoutLengthValue;
  maxWidth: LayoutLengthValue;
  maxHeight: LayoutLengthValue;
  inset: BoxEdges<LayoutLengthValue>;
  margin: BoxEdges<number>;
  padding: BoxEdges<number>;
  border: BoxEdges<number>;
  gap: number;
  rowGap: number;
  columnGap: number;
  overflowX: LayoutOverflow;
  overflowY: LayoutOverflow;
  zIndex: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: string;
  visibility: LayoutVisibility;
  variables: Record<string, string>;
}

/** Public constant for an automatic layout length. */
export const AUTO_LAYOUT_LENGTH: LayoutLengthValue = { unit: "auto", value: 0 };

/** Public constant for a zero-valued box edge set. */
export const ZERO_BOX_EDGES: BoxEdges<number> = { top: 0, right: 0, bottom: 0, left: 0 };

/** Creates a terminal-cell length value. */
export function cellLength(value: number): LayoutLengthValue {
  return { unit: "cell", value: Math.max(0, Math.floor(finiteNumber(value, 0))) };
}

/** Creates a percentage layout length value. */
export function percentLength(value: number): LayoutLengthValue {
  return { unit: "percent", value: finiteNumber(value, 0) };
}

/** Creates an fractional layout length value. */
export function frLength(value: number): LayoutLengthValue {
  return { unit: "fr", value: Math.max(0, finiteNumber(value, 0)) };
}

/** Creates an automatic layout length value. */
export function autoLength(): LayoutLengthValue {
  return { ...AUTO_LAYOUT_LENGTH };
}

/** Returns a fresh normalized style object. */
export function defaultComputedLayoutStyle(): ComputedLayoutStyle {
  return {
    display: "block",
    position: "relative",
    flexDirection: "row",
    flexWrap: "nowrap",
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: autoLength(),
    alignItems: "stretch",
    justifyContent: "start",
    gridTemplateColumns: [],
    gridTemplateRows: [],
    gridAutoColumns: autoLength(),
    gridAutoRows: autoLength(),
    gridAutoFlow: "row",
    gridColumn: {},
    gridRow: {},
    width: autoLength(),
    height: autoLength(),
    minWidth: cellLength(0),
    minHeight: cellLength(0),
    maxWidth: autoLength(),
    maxHeight: autoLength(),
    inset: {
      top: autoLength(),
      right: autoLength(),
      bottom: autoLength(),
      left: autoLength(),
    },
    margin: { ...ZERO_BOX_EDGES },
    padding: { ...ZERO_BOX_EDGES },
    border: { ...ZERO_BOX_EDGES },
    gap: 0,
    rowGap: 0,
    columnGap: 0,
    overflowX: "visible",
    overflowY: "visible",
    zIndex: 0,
    visibility: "visible",
    variables: {},
  };
}

/** Clones a computed layout style without preserving object identity. */
export function cloneComputedLayoutStyle(style: ComputedLayoutStyle): ComputedLayoutStyle {
  return {
    ...style,
    flexBasis: { ...style.flexBasis },
    gridTemplateColumns: style.gridTemplateColumns.map((track) => ({ ...track })),
    gridTemplateRows: style.gridTemplateRows.map((track) => ({ ...track })),
    gridAutoColumns: { ...style.gridAutoColumns },
    gridAutoRows: { ...style.gridAutoRows },
    gridColumn: { ...style.gridColumn },
    gridRow: { ...style.gridRow },
    width: { ...style.width },
    height: { ...style.height },
    minWidth: { ...style.minWidth },
    minHeight: { ...style.minHeight },
    maxWidth: { ...style.maxWidth },
    maxHeight: { ...style.maxHeight },
    inset: {
      top: { ...style.inset.top },
      right: { ...style.inset.right },
      bottom: { ...style.inset.bottom },
      left: { ...style.inset.left },
    },
    margin: { ...style.margin },
    padding: { ...style.padding },
    border: { ...style.border },
    variables: { ...style.variables },
  };
}

/** Resolves a layout length against an available terminal-cell size. */
export function resolveLayoutLength(
  value: LayoutLengthValue | undefined,
  available: number,
  fallback = 0,
): number {
  const safeAvailable = Math.max(0, Math.floor(finiteNumber(available, 0)));
  const safeFallback = Math.max(0, Math.floor(finiteNumber(fallback, 0)));
  if (!value || value.unit === "auto") return safeFallback;
  if (value.unit === "cell") return Math.max(0, Math.floor(value.value));
  if (value.unit === "percent") return Math.max(0, Math.floor(safeAvailable * value.value / 100));
  return Math.max(0, Math.floor(value.value));
}

/** Clamps a terminal-cell size by min and max layout lengths. */
export function clampLayoutSize(
  size: number,
  available: number,
  min: LayoutLengthValue,
  max: LayoutLengthValue,
): number {
  const safe = Math.max(0, Math.floor(finiteNumber(size, 0)));
  const lower = resolveLayoutLength(min, available, 0);
  const upper = max.unit === "auto" ? Number.MAX_SAFE_INTEGER : resolveLayoutLength(max, available, available);
  return Math.max(lower, Math.min(upper, safe));
}

/** Parses a CSS-like length into a terminal-cell layout length. */
export function parseLayoutLength(
  value: string | undefined,
  fallback: LayoutLengthValue = autoLength(),
): LayoutLengthValue {
  if (value === undefined) return { ...fallback };
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === "auto") return autoLength();
  if (trimmed.endsWith("%")) return percentLength(Number.parseFloat(trimmed.slice(0, -1)));
  if (trimmed.endsWith("fr")) return frLength(Number.parseFloat(trimmed.slice(0, -2)));
  if (trimmed.endsWith("ch") || trimmed.endsWith("cell") || trimmed.endsWith("cells")) {
    return cellLength(Number.parseFloat(trimmed));
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return cellLength(Number.parseFloat(trimmed));
  return { ...fallback };
}

/** Parses a CSS-grid track list into terminal-cell layout lengths. */
export function parseGridTrackList(
  value: string | undefined,
  fallback: readonly LayoutLengthValue[] = [],
): LayoutLengthValue[] {
  if (value === undefined) return fallback.map((track) => ({ ...track }));
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === "none") return [];
  return tokenizeGridTrackList(expandGridRepeat(trimmed))
    .map((part) => parseLayoutLength(part, autoLength()));
}

/** Parses a CSS-grid line placement shorthand. */
export function parseGridPlacement(
  value: string | undefined,
  fallback: LayoutGridPlacement = {},
): LayoutGridPlacement {
  if (value === undefined) return { ...fallback };
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === "auto") return {};

  const [startPart = "", endPart = ""] = trimmed.split("/").map((part) => part.trim());
  const placement: LayoutGridPlacement = {};
  const startSpan = parseGridSpan(startPart);
  const startLine = parsePositiveInteger(startPart);

  if (startSpan !== undefined) {
    placement.span = startSpan;
  } else if (startLine !== undefined) {
    placement.start = startLine;
  }

  const endSpan = parseGridSpan(endPart);
  const endLine = parsePositiveInteger(endPart);
  if (endSpan !== undefined) {
    placement.span = endSpan;
  } else if (placement.start !== undefined && endLine !== undefined) {
    placement.end = endLine;
    placement.span = Math.max(1, endLine - placement.start);
  } else if (endLine !== undefined) {
    placement.end = endLine;
  }

  if (placement.start === undefined && placement.span === undefined) return { ...fallback };
  return placement;
}

/** Parses a non-negative terminal-cell integer. */
export function parseLayoutInteger(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

/** Expands one-to-four CSS box values into top, right, bottom, and left edges. */
export function parseBoxEdges(
  value: string | undefined,
  fallback: BoxEdges<number> = ZERO_BOX_EDGES,
): BoxEdges<number> {
  if (value === undefined) return { ...fallback };
  const parts = value.trim().split(/\s+/).filter(Boolean).map((part) => parseLayoutInteger(part, 0));
  if (parts.length === 0) return { ...fallback };
  const [top, right = top, bottom = top, left = right] = parts;
  return { top: top ?? 0, right: right ?? 0, bottom: bottom ?? 0, left: left ?? 0 };
}

/** Applies one CSS-like declaration to a computed style. */
export function applyLayoutDeclaration(
  style: ComputedLayoutStyle,
  property: string,
  value: string,
): ComputedLayoutStyle {
  const next = cloneComputedLayoutStyle(style);
  const normalized = property.trim().toLowerCase();
  const resolved = value.trim();

  if (normalized.startsWith("--")) {
    next.variables[normalized] = resolved;
    return next;
  }

  switch (normalized) {
    case "display":
      next.display = parseOneOf(resolved, ["block", "flex", "grid", "none"], next.display);
      break;
    case "position":
      next.position = parseOneOf(resolved, ["relative", "absolute"], next.position);
      break;
    case "flex-direction":
      next.flexDirection = parseOneOf(resolved, ["row", "column"], next.flexDirection);
      break;
    case "flex-wrap":
      next.flexWrap = parseOneOf(resolved, ["nowrap", "wrap", "wrap-reverse"], next.flexWrap);
      break;
    case "flex-flow":
      applyFlexFlowShorthand(next, resolved);
      break;
    case "flex-grow":
      next.flexGrow = nonNegativeFloat(resolved, next.flexGrow);
      break;
    case "flex-shrink":
      next.flexShrink = nonNegativeFloat(resolved, next.flexShrink);
      break;
    case "flex-basis":
      next.flexBasis = parseLayoutLength(resolved, next.flexBasis);
      break;
    case "flex":
      applyFlexShorthand(next, resolved);
      break;
    case "align-items":
      next.alignItems = normalizeAlignItems(resolved, next.alignItems);
      break;
    case "justify-content":
      next.justifyContent = normalizeJustifyContent(resolved, next.justifyContent);
      break;
    case "grid-template-columns":
      next.gridTemplateColumns = parseGridTrackList(resolved, next.gridTemplateColumns);
      break;
    case "grid-template-rows":
      next.gridTemplateRows = parseGridTrackList(resolved, next.gridTemplateRows);
      break;
    case "grid-auto-columns":
      next.gridAutoColumns = parseLayoutLength(resolved, next.gridAutoColumns);
      break;
    case "grid-auto-rows":
      next.gridAutoRows = parseLayoutLength(resolved, next.gridAutoRows);
      break;
    case "grid-auto-flow":
      next.gridAutoFlow = parseOneOf(resolved.split(/\s+/)[0] ?? resolved, ["row", "column"], next.gridAutoFlow);
      break;
    case "grid-column":
      next.gridColumn = parseGridPlacement(resolved, next.gridColumn);
      break;
    case "grid-row":
      next.gridRow = parseGridPlacement(resolved, next.gridRow);
      break;
    case "grid-column-start":
      next.gridColumn = applyGridPlacementLonghand(next.gridColumn, "start", resolved);
      break;
    case "grid-column-end":
      next.gridColumn = applyGridPlacementLonghand(next.gridColumn, "end", resolved);
      break;
    case "grid-row-start":
      next.gridRow = applyGridPlacementLonghand(next.gridRow, "start", resolved);
      break;
    case "grid-row-end":
      next.gridRow = applyGridPlacementLonghand(next.gridRow, "end", resolved);
      break;
    case "width":
      next.width = parseLayoutLength(resolved, next.width);
      break;
    case "height":
      next.height = parseLayoutLength(resolved, next.height);
      break;
    case "min-width":
      next.minWidth = parseLayoutLength(resolved, next.minWidth);
      break;
    case "min-height":
      next.minHeight = parseLayoutLength(resolved, next.minHeight);
      break;
    case "max-width":
      next.maxWidth = parseLayoutLength(resolved, next.maxWidth);
      break;
    case "max-height":
      next.maxHeight = parseLayoutLength(resolved, next.maxHeight);
      break;
    case "inset":
      next.inset = parseBoxEdgeLengths(resolved, next.inset);
      break;
    case "top":
    case "right":
    case "bottom":
    case "left":
      {
        const edge = normalized as keyof BoxEdges<LayoutLengthValue>;
        next.inset = applyBoxEdgeLength(next.inset, edge, parseLayoutLength(resolved, next.inset[edge]));
      }
      break;
    case "margin":
      next.margin = parseBoxEdges(resolved, next.margin);
      break;
    case "margin-top":
    case "margin-right":
    case "margin-bottom":
    case "margin-left":
      next.margin = applyBoxEdge(next.margin, normalized.slice("margin-".length), parseLayoutInteger(resolved, 0));
      break;
    case "padding":
      next.padding = parseBoxEdges(resolved, next.padding);
      break;
    case "padding-top":
    case "padding-right":
    case "padding-bottom":
    case "padding-left":
      next.padding = applyBoxEdge(next.padding, normalized.slice("padding-".length), parseLayoutInteger(resolved, 0));
      break;
    case "border":
      applyBorderShorthand(next, resolved);
      break;
    case "border-width":
      next.border = parseBoxEdges(resolved, next.border);
      break;
    case "border-top":
    case "border-right":
    case "border-bottom":
    case "border-left":
      next.border = applyBoxEdge(next.border, normalized.slice("border-".length), parseLayoutInteger(resolved, 1));
      break;
    case "border-style":
      next.borderStyle = resolved || next.borderStyle;
      break;
    case "border-color":
      next.borderColor = resolved || next.borderColor;
      break;
    case "gap":
      next.gap = parseLayoutInteger(resolved, next.gap);
      next.rowGap = next.gap;
      next.columnGap = next.gap;
      break;
    case "row-gap":
      next.rowGap = parseLayoutInteger(resolved, next.rowGap);
      break;
    case "column-gap":
      next.columnGap = parseLayoutInteger(resolved, next.columnGap);
      break;
    case "overflow":
      next.overflowX = parseOneOf(resolved, ["visible", "hidden", "auto", "scroll"], next.overflowX);
      next.overflowY = next.overflowX;
      break;
    case "overflow-x":
      next.overflowX = parseOneOf(resolved, ["visible", "hidden", "auto", "scroll"], next.overflowX);
      break;
    case "overflow-y":
      next.overflowY = parseOneOf(resolved, ["visible", "hidden", "auto", "scroll"], next.overflowY);
      break;
    case "z-index":
      next.zIndex = Math.floor(Number.parseFloat(resolved)) || 0;
      break;
    case "color":
      next.color = resolved || undefined;
      break;
    case "background":
    case "background-color":
      next.backgroundColor = resolved || undefined;
      break;
    case "visibility":
      next.visibility = parseOneOf(resolved, ["visible", "hidden"], next.visibility);
      break;
  }

  return next;
}

/** Applies multiple CSS-like declarations to a computed style. */
export function applyLayoutDeclarations(
  style: ComputedLayoutStyle,
  declarations: Iterable<readonly [property: string, value: string]>,
): ComputedLayoutStyle {
  let next = style;
  for (const [property, value] of declarations) {
    next = applyLayoutDeclaration(next, property, value);
  }
  return next;
}

function applyFlexShorthand(style: ComputedLayoutStyle, value: string): void {
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    if (parts[0] === "none") {
      style.flexGrow = 0;
      style.flexShrink = 0;
      style.flexBasis = autoLength();
      return;
    }
    if (parts[0] === "auto") {
      style.flexGrow = 1;
      style.flexShrink = 1;
      style.flexBasis = autoLength();
      return;
    }
    style.flexGrow = nonNegativeFloat(parts[0]!, style.flexGrow);
    return;
  }
  style.flexGrow = nonNegativeFloat(parts[0]!, style.flexGrow);
  style.flexShrink = nonNegativeFloat(parts[1]!, style.flexShrink);
  if (parts[2]) style.flexBasis = parseLayoutLength(parts[2], style.flexBasis);
}

function applyFlexFlowShorthand(style: ComputedLayoutStyle, value: string): void {
  for (const part of value.split(/\s+/).filter(Boolean)) {
    style.flexDirection = parseOneOf(part, ["row", "column"], style.flexDirection);
    style.flexWrap = parseOneOf(part, ["nowrap", "wrap", "wrap-reverse"], style.flexWrap);
  }
}

function applyBorderShorthand(style: ComputedLayoutStyle, value: string): void {
  const parts = value.split(/\s+/).filter(Boolean);
  const width = parts.find((part) => /^-?\d+(\.\d+)?/.test(part));
  const color = parts.find((part) => part.startsWith("#") || part.startsWith("rgb") || part.startsWith("var("));
  const stylePart = parts.find((part) => ["none", "single", "double", "solid", "round", "heavy"].includes(part));
  if (width) style.border = parseBoxEdges(width, style.border);
  else if (value.trim() && value.trim() !== "none") style.border = parseBoxEdges("1", style.border);
  if (color) style.borderColor = color;
  if (stylePart) style.borderStyle = stylePart;
}

function expandGridRepeat(value: string): string {
  return value.replace(/repeat\(\s*(\d+)\s*,\s*([^)]+)\)/g, (_match, countText: string, trackText: string) => {
    const count = Math.max(0, Math.floor(Number.parseFloat(countText)));
    return Array.from({ length: Math.min(count, 256) }, () => trackText.trim()).join(" ");
  });
}

function tokenizeGridTrackList(value: string): string[] {
  return value.split(/\s+/).map((part) => part.trim()).filter(Boolean);
}

function parseGridSpan(value: string): number | undefined {
  const match = value.match(/^span\s+(\d+)$/);
  if (!match) return undefined;
  return Math.max(1, Math.floor(Number.parseFloat(match[1]!)));
}

function parsePositiveInteger(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Math.floor(Number.parseFloat(value));
  return parsed > 0 ? parsed : undefined;
}

function applyGridPlacementLonghand(
  placement: LayoutGridPlacement,
  edge: "start" | "end",
  value: string,
): LayoutGridPlacement {
  const trimmed = value.trim().toLowerCase();
  const next = { ...placement };
  if (!trimmed || trimmed === "auto") {
    delete next[edge];
    if (next.start === undefined || next.end === undefined) delete next.span;
    return next;
  }

  const span = parseGridSpan(trimmed);
  if (span !== undefined) {
    next.span = span;
    return next;
  }

  const line = parsePositiveInteger(trimmed);
  if (line === undefined) return next;
  next[edge] = line;
  if (next.start !== undefined && next.end !== undefined) next.span = Math.max(1, next.end - next.start);
  return next;
}

function applyBoxEdge(edges: BoxEdges<number>, edge: string, value: number): BoxEdges<number> {
  const next = { ...edges };
  if (edge === "top" || edge === "right" || edge === "bottom" || edge === "left") {
    next[edge] = value;
  }
  return next;
}

function parseBoxEdgeLengths(
  value: string | undefined,
  fallback: BoxEdges<LayoutLengthValue>,
): BoxEdges<LayoutLengthValue> {
  if (value === undefined) return cloneBoxEdgeLengths(fallback);
  const parts = value.trim().split(/\s+/).filter(Boolean).map((part) => parseLayoutLength(part));
  if (parts.length === 0) return cloneBoxEdgeLengths(fallback);
  const [top, right = top, bottom = top, left = right] = parts;
  return {
    top: top ? { ...top } : autoLength(),
    right: right ? { ...right } : autoLength(),
    bottom: bottom ? { ...bottom } : autoLength(),
    left: left ? { ...left } : autoLength(),
  };
}

function applyBoxEdgeLength(
  edges: BoxEdges<LayoutLengthValue>,
  edge: keyof BoxEdges<LayoutLengthValue>,
  value: LayoutLengthValue,
): BoxEdges<LayoutLengthValue> {
  return {
    top: edge === "top" ? { ...value } : { ...edges.top },
    right: edge === "right" ? { ...value } : { ...edges.right },
    bottom: edge === "bottom" ? { ...value } : { ...edges.bottom },
    left: edge === "left" ? { ...value } : { ...edges.left },
  };
}

function cloneBoxEdgeLengths(edges: BoxEdges<LayoutLengthValue>): BoxEdges<LayoutLengthValue> {
  return {
    top: { ...edges.top },
    right: { ...edges.right },
    bottom: { ...edges.bottom },
    left: { ...edges.left },
  };
}

function normalizeAlignItems(value: string, fallback: LayoutAlignItems): LayoutAlignItems {
  const normalized = value === "flex-start" ? "start" : value === "flex-end" ? "end" : value;
  return parseOneOf(normalized, ["start", "end", "center", "stretch"], fallback);
}

function normalizeJustifyContent(value: string, fallback: LayoutJustifyContent): LayoutJustifyContent {
  const normalized = value === "flex-start" ? "start" : value === "flex-end" ? "end" : value;
  return parseOneOf(normalized, ["start", "end", "center", "space-between", "space-around"], fallback);
}

function parseOneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  const normalized = value.trim().toLowerCase();
  return allowed.includes(normalized as T) ? normalized as T : fallback;
}

function nonNegativeFloat(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function finiteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
