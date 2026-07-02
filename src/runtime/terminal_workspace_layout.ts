// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

/** Split direction for terminal panes. */
export type TerminalWorkspaceSplitDirection = "row" | "column";

/** Placement for a newly split terminal pane relative to the current pane. */
export type TerminalWorkspacePanePlacement = "before" | "after";

/** Leaf pane in a terminal workspace layout tree. */
export interface TerminalWorkspacePaneNode {
  kind: "pane";
  id: string;
  sessionId: string;
  title?: string;
  minColumns?: number;
  minRows?: number;
}

/** Split branch in a terminal workspace layout tree. */
export interface TerminalWorkspaceSplitNode {
  kind: "split";
  id: string;
  direction: TerminalWorkspaceSplitDirection;
  ratio: number;
  first: TerminalWorkspaceLayoutNode;
  second: TerminalWorkspaceLayoutNode;
}

/** Node in a serializable terminal workspace pane tree. */
export type TerminalWorkspaceLayoutNode = TerminalWorkspacePaneNode | TerminalWorkspaceSplitNode;

/** Serializable pane layout state for a terminal workspace. */
export interface TerminalWorkspaceLayoutState {
  root?: TerminalWorkspaceLayoutNode;
  activePaneId?: string;
  zoomedPaneId?: string;
}

/** Options for projecting a terminal workspace pane tree into rectangles. */
export interface TerminalWorkspacePaneRectOptions {
  gap?: number;
  respectZoom?: boolean;
}

/** Terminal pane projected into concrete terminal-cell bounds. */
export interface TerminalWorkspacePaneRect {
  pane: TerminalWorkspacePaneNode;
  rect: Rectangle;
  active: boolean;
  zoomed: boolean;
}

/** Projects a terminal workspace pane tree into terminal-cell rectangles. */
export function terminalWorkspacePaneRects(
  layout: TerminalWorkspaceLayoutState,
  bounds: Rectangle,
  options: TerminalWorkspacePaneRectOptions = {},
): TerminalWorkspacePaneRect[] {
  const normalizedBounds = normalizeRect(bounds);
  if (!layout.root || normalizedBounds.width <= 0 || normalizedBounds.height <= 0) return [];
  if (options.respectZoom !== false && layout.zoomedPaneId) {
    const pane = findTerminalWorkspacePaneRef(layout.root, layout.zoomedPaneId);
    if (pane) {
      return [{
        pane: cloneTerminalWorkspacePaneNode(pane),
        rect: normalizedBounds,
        active: pane.id === layout.activePaneId,
        zoomed: true,
      }];
    }
  }
  const rows: TerminalWorkspacePaneRect[] = [];
  collectPaneRects(layout.root, normalizedBounds, Math.max(0, Math.floor(options.gap ?? 1)), layout, rows);
  return rows;
}

export function createTerminalWorkspacePaneNode(
  sessionId: string,
  root?: TerminalWorkspaceLayoutNode,
  options: { title?: string; minColumns?: number; minRows?: number } = {},
): TerminalWorkspacePaneNode {
  return {
    kind: "pane",
    id: uniqueTerminalWorkspaceLayoutId(`pane-${sanitizeTerminalWorkspaceLayoutId(sessionId)}`, root),
    sessionId,
    title: options.title,
    minColumns: normalizePaneDimension(options.minColumns),
    minRows: normalizePaneDimension(options.minRows),
  };
}

export function terminalWorkspaceLayoutWithActive(
  layout: TerminalWorkspaceLayoutState,
  sessionId: string,
): TerminalWorkspaceLayoutState {
  const pane = findTerminalWorkspacePaneBySessionRef(layout.root, sessionId) ??
    firstTerminalWorkspacePaneRef(layout.root);
  return {
    root: layout.root ? cloneTerminalWorkspaceLayoutNode(layout.root) : undefined,
    activePaneId: pane?.id,
    zoomedPaneId: layout.zoomedPaneId,
  };
}

export function cloneTerminalWorkspaceLayoutState(layout: TerminalWorkspaceLayoutState): TerminalWorkspaceLayoutState {
  return {
    root: layout.root ? cloneTerminalWorkspaceLayoutNode(layout.root) : undefined,
    activePaneId: layout.activePaneId,
    zoomedPaneId: layout.zoomedPaneId,
  };
}

export function cloneTerminalWorkspaceLayoutNode(node: TerminalWorkspaceLayoutNode): TerminalWorkspaceLayoutNode {
  return node.kind === "pane" ? cloneTerminalWorkspacePaneNode(node) : {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: cloneTerminalWorkspaceLayoutNode(node.first),
    second: cloneTerminalWorkspaceLayoutNode(node.second),
  };
}

export function cloneTerminalWorkspacePaneNode(node: TerminalWorkspacePaneNode): TerminalWorkspacePaneNode {
  return {
    kind: "pane",
    id: node.id,
    sessionId: node.sessionId,
    title: node.title,
    minColumns: node.minColumns,
    minRows: node.minRows,
  };
}

export function updateTerminalWorkspacePaneRuntimeTitles(
  layout: TerminalWorkspaceLayoutState,
  sessionId: string,
  runtimeTitle: string,
  previousVisibleTitle: string,
  previousRuntimeTitle: string | undefined,
  templateTitle: string,
): TerminalWorkspaceLayoutState {
  return {
    ...layout,
    root: layout.root
      ? updatePaneRuntimeTitleNode(
        layout.root,
        sessionId,
        runtimeTitle,
        previousVisibleTitle,
        previousRuntimeTitle,
        templateTitle,
      )
      : undefined,
  };
}

export function pruneTerminalWorkspaceLayoutSessions(
  layout: TerminalWorkspaceLayoutState,
  sessionIds: ReadonlySet<string>,
): TerminalWorkspaceLayoutState {
  const root = pruneLayoutNode(layout.root, sessionIds);
  return {
    root,
    activePaneId: layout.activePaneId && findTerminalWorkspacePaneRef(root, layout.activePaneId)
      ? layout.activePaneId
      : undefined,
    zoomedPaneId: layout.zoomedPaneId && findTerminalWorkspacePaneRef(root, layout.zoomedPaneId)
      ? layout.zoomedPaneId
      : undefined,
  };
}

export function collectTerminalWorkspacePanes(
  node: TerminalWorkspaceLayoutNode | undefined,
): TerminalWorkspacePaneNode[] {
  const panes: TerminalWorkspacePaneNode[] = [];
  collectTerminalWorkspacePanesInto(node, panes);
  return panes;
}

export function findTerminalWorkspacePane(
  node: TerminalWorkspaceLayoutNode | undefined,
  paneId: string,
): TerminalWorkspacePaneNode | undefined {
  const pane = findTerminalWorkspacePaneRef(node, paneId);
  return pane ? cloneTerminalWorkspacePaneNode(pane) : undefined;
}

export function findTerminalWorkspacePaneBySession(
  node: TerminalWorkspaceLayoutNode | undefined,
  sessionId: string,
): TerminalWorkspacePaneNode | undefined {
  const pane = findTerminalWorkspacePaneBySessionRef(node, sessionId);
  return pane ? cloneTerminalWorkspacePaneNode(pane) : undefined;
}

export function findActiveTerminalWorkspacePane(
  layout: TerminalWorkspaceLayoutState,
): TerminalWorkspacePaneNode | undefined {
  const pane = layout.activePaneId
    ? findTerminalWorkspacePaneRef(layout.root, layout.activePaneId)
    : firstTerminalWorkspacePaneRef(layout.root);
  return pane ? cloneTerminalWorkspacePaneNode(pane) : undefined;
}

export function replaceTerminalWorkspacePane(
  node: TerminalWorkspaceLayoutNode,
  paneId: string,
  replacement: TerminalWorkspaceLayoutNode,
): TerminalWorkspaceLayoutNode {
  if (node.kind === "pane") {
    return node.id === paneId ? cloneTerminalWorkspaceLayoutNode(replacement) : cloneTerminalWorkspacePaneNode(node);
  }
  return {
    ...node,
    first: replaceTerminalWorkspacePane(node.first, paneId, replacement),
    second: replaceTerminalWorkspacePane(node.second, paneId, replacement),
  };
}

export function removeTerminalWorkspacePane(
  node: TerminalWorkspaceLayoutNode | undefined,
  paneId: string,
): TerminalWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.id === paneId ? undefined : cloneTerminalWorkspacePaneNode(node);
  const first = removeTerminalWorkspacePane(node.first, paneId);
  const second = removeTerminalWorkspacePane(node.second, paneId);
  if (first && second) return { ...node, first, second };
  return first ?? second;
}

export function updateTerminalWorkspaceSplitRatio(
  node: TerminalWorkspaceLayoutNode | undefined,
  splitId: string,
  ratio: number,
): { node?: TerminalWorkspaceLayoutNode; changed: boolean } {
  if (!node) return { changed: false };
  if (node.kind === "pane") return { node, changed: false };
  if (node.id === splitId) {
    return {
      node: {
        ...node,
        ratio,
      },
      changed: true,
    };
  }
  const first = updateTerminalWorkspaceSplitRatio(node.first, splitId, ratio);
  if (first.changed) {
    return {
      node: {
        ...node,
        first: first.node ?? node.first,
      },
      changed: true,
    };
  }
  const second = updateTerminalWorkspaceSplitRatio(node.second, splitId, ratio);
  if (second.changed) {
    return {
      node: {
        ...node,
        second: second.node ?? node.second,
      },
      changed: true,
    };
  }
  return {
    node,
    changed: false,
  };
}

export function findNearestTerminalWorkspaceSplit(
  node: TerminalWorkspaceLayoutNode | undefined,
  paneId: string,
): { split: TerminalWorkspaceSplitNode; activeSide: "first" | "second" } | undefined {
  return findNearestTerminalWorkspaceSplitSearch(node, paneId).nearest;
}

export function uniqueTerminalWorkspaceLayoutId(prefix: string, root?: TerminalWorkspaceLayoutNode): string {
  const ids = new Set<string>();
  collectLayoutIds(root, ids);
  let candidate = prefix;
  let suffix = 2;
  while (ids.has(candidate)) {
    candidate = `${prefix}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function sanitizeTerminalWorkspaceLayoutId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "terminal";
}

export function clampTerminalWorkspaceSplitRatio(value: number): number {
  return Math.max(0.1, Math.min(0.9, Number.isFinite(value) ? value : 0.5));
}

function collectPaneRects(
  node: TerminalWorkspaceLayoutNode,
  rect: Rectangle,
  gap: number,
  layout: TerminalWorkspaceLayoutState,
  rows: TerminalWorkspacePaneRect[],
): void {
  if (node.kind === "pane") {
    rows.push({
      pane: cloneTerminalWorkspacePaneNode(node),
      rect,
      active: node.id === layout.activePaneId,
      zoomed: node.id === layout.zoomedPaneId,
    });
    return;
  }
  const [first, second] = splitPaneRect(rect, node, gap);
  collectPaneRects(node.first, first, gap, layout, rows);
  collectPaneRects(node.second, second, gap, layout, rows);
}

function splitPaneRect(
  rect: Rectangle,
  split: TerminalWorkspaceSplitNode,
  gap: number,
): [Rectangle, Rectangle] {
  const safeGap = split.direction === "row" ? Math.min(gap, Math.max(0, rect.width - 1)) : Math.min(
    gap,
    Math.max(0, rect.height - 1),
  );
  if (split.direction === "row") {
    const available = Math.max(0, rect.width - safeGap);
    const firstWidth = clampSplitSize(Math.floor(available * clampTerminalWorkspaceSplitRatio(split.ratio)), available);
    const secondWidth = Math.max(0, available - firstWidth);
    return [
      { ...rect, width: firstWidth },
      { column: rect.column + firstWidth + safeGap, row: rect.row, width: secondWidth, height: rect.height },
    ];
  }
  const available = Math.max(0, rect.height - safeGap);
  const firstHeight = clampSplitSize(Math.floor(available * clampTerminalWorkspaceSplitRatio(split.ratio)), available);
  const secondHeight = Math.max(0, available - firstHeight);
  return [
    { ...rect, height: firstHeight },
    { column: rect.column, row: rect.row + firstHeight + safeGap, width: rect.width, height: secondHeight },
  ];
}

function updatePaneRuntimeTitleNode(
  node: TerminalWorkspaceLayoutNode,
  sessionId: string,
  runtimeTitle: string,
  previousVisibleTitle: string,
  previousRuntimeTitle: string | undefined,
  templateTitle: string,
): TerminalWorkspaceLayoutNode {
  if (node.kind === "pane") {
    const pane = cloneTerminalWorkspacePaneNode(node);
    if (
      pane.sessionId === sessionId &&
      (
        pane.title === undefined ||
        pane.title === previousVisibleTitle ||
        pane.title === previousRuntimeTitle ||
        pane.title === templateTitle
      )
    ) {
      pane.title = runtimeTitle;
    }
    return pane;
  }
  return {
    ...node,
    first: updatePaneRuntimeTitleNode(
      node.first,
      sessionId,
      runtimeTitle,
      previousVisibleTitle,
      previousRuntimeTitle,
      templateTitle,
    ),
    second: updatePaneRuntimeTitleNode(
      node.second,
      sessionId,
      runtimeTitle,
      previousVisibleTitle,
      previousRuntimeTitle,
      templateTitle,
    ),
  };
}

function pruneLayoutNode(
  node: TerminalWorkspaceLayoutNode | undefined,
  sessionIds: ReadonlySet<string>,
): TerminalWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return sessionIds.has(node.sessionId) ? cloneTerminalWorkspacePaneNode(node) : undefined;
  const first = pruneLayoutNode(node.first, sessionIds);
  const second = pruneLayoutNode(node.second, sessionIds);
  if (first && second) return { ...node, ratio: clampTerminalWorkspaceSplitRatio(node.ratio), first, second };
  return first ?? second;
}

function cloneTerminalWorkspaceSplitNode(node: TerminalWorkspaceSplitNode): TerminalWorkspaceSplitNode {
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: cloneTerminalWorkspaceLayoutNode(node.first),
    second: cloneTerminalWorkspaceLayoutNode(node.second),
  };
}

function collectTerminalWorkspacePanesInto(
  node: TerminalWorkspaceLayoutNode | undefined,
  panes: TerminalWorkspacePaneNode[],
): void {
  if (!node) return;
  if (node.kind === "pane") {
    panes.push(cloneTerminalWorkspacePaneNode(node));
    return;
  }
  collectTerminalWorkspacePanesInto(node.first, panes);
  collectTerminalWorkspacePanesInto(node.second, panes);
}

function findTerminalWorkspacePaneRef(
  node: TerminalWorkspaceLayoutNode | undefined,
  paneId: string,
): TerminalWorkspacePaneNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.id === paneId ? node : undefined;
  return findTerminalWorkspacePaneRef(node.first, paneId) ?? findTerminalWorkspacePaneRef(node.second, paneId);
}

function findTerminalWorkspacePaneBySessionRef(
  node: TerminalWorkspaceLayoutNode | undefined,
  sessionId: string,
): TerminalWorkspacePaneNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.sessionId === sessionId ? node : undefined;
  return findTerminalWorkspacePaneBySessionRef(node.first, sessionId) ??
    findTerminalWorkspacePaneBySessionRef(node.second, sessionId);
}

function firstTerminalWorkspacePaneRef(
  node: TerminalWorkspaceLayoutNode | undefined,
): TerminalWorkspacePaneNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node;
  return firstTerminalWorkspacePaneRef(node.first) ?? firstTerminalWorkspacePaneRef(node.second);
}

function findNearestTerminalWorkspaceSplitSearch(
  node: TerminalWorkspaceLayoutNode | undefined,
  paneId: string,
): {
  found: boolean;
  nearest?: { split: TerminalWorkspaceSplitNode; activeSide: "first" | "second" };
} {
  if (!node) return { found: false };
  if (node.kind === "pane") return { found: node.id === paneId };

  const first = findNearestTerminalWorkspaceSplitSearch(node.first, paneId);
  if (first.nearest) return first;
  if (first.found) {
    return {
      found: true,
      nearest: { split: cloneTerminalWorkspaceSplitNode(node), activeSide: "first" },
    };
  }

  const second = findNearestTerminalWorkspaceSplitSearch(node.second, paneId);
  if (second.nearest) return second;
  if (second.found) {
    return {
      found: true,
      nearest: { split: cloneTerminalWorkspaceSplitNode(node), activeSide: "second" },
    };
  }

  return { found: false };
}

function collectLayoutIds(node: TerminalWorkspaceLayoutNode | undefined, ids: Set<string>): void {
  if (!node) return;
  ids.add(node.id);
  if (node.kind === "split") {
    collectLayoutIds(node.first, ids);
    collectLayoutIds(node.second, ids);
  }
}

function clampSplitSize(value: number, available: number): number {
  if (available <= 1) return available;
  return Math.max(1, Math.min(available - 1, value));
}

function normalizeRect(rect: Rectangle): Rectangle {
  return {
    column: Math.floor(rect.column),
    row: Math.floor(rect.row),
    width: Math.max(0, Math.floor(rect.width)),
    height: Math.max(0, Math.floor(rect.height)),
  };
}

function normalizePaneDimension(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value!));
}
