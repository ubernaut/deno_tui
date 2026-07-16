// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { Rectangle } from "../types.ts";
import { normalizeRectangle } from "../utils/rectangles.ts";

/** Direction in which the children of a tiled workspace split are arranged. */
export type TiledWorkspaceSplitDirection = "row" | "column";

/** Edge of a target pane on which another pane can be docked. */
export type TiledWorkspaceDockEdge = "left" | "right" | "top" | "bottom";

/** Coordinate axis changed when dragging a tiled workspace separator. */
export type TiledWorkspaceSeparatorAxis = "column" | "row";

/** Window metadata needed by the renderer-neutral tiled layout. */
export interface TiledWorkspaceWindow {
  id: string;
  minWidth?: number;
  minHeight?: number;
}

/** Leaf pane in a tiled workspace tree. */
export interface TiledWorkspacePaneNode {
  kind: "pane";
  id: string;
  windowId: string;
  minWidth?: number;
  minHeight?: number;
}

/** Branch in a tiled workspace tree. */
export interface TiledWorkspaceSplitNode {
  kind: "split";
  id: string;
  direction: TiledWorkspaceSplitDirection;
  ratio: number;
  first: TiledWorkspaceLayoutNode;
  second: TiledWorkspaceLayoutNode;
}

/** Node in a serializable tiled workspace tree. */
export type TiledWorkspaceLayoutNode = TiledWorkspacePaneNode | TiledWorkspaceSplitNode;

/** Serializable tiled workspace state. */
export interface TiledWorkspaceLayoutState {
  root?: TiledWorkspaceLayoutNode;
  activePaneId?: string;
}

/** Options for constructing a tiled workspace controller. */
export interface TiledWorkspaceControllerOptions {
  windows?: readonly TiledWorkspaceWindow[];
  layout?: TiledWorkspaceLayoutState;
  activeWindowId?: string;
  gap?: number;
}

/** Options for reconciling a controller with the current visible windows. */
export interface ReconcileTiledWorkspaceOptions {
  activeWindowId?: string;
}

/** Options for docking one tiled workspace window around another. */
export interface DockTiledWorkspaceOptions {
  /** Fraction of the new split assigned to the source window. */
  ratio?: number;
}

/** Options for projecting a tiled workspace tree into rectangles. */
export interface TiledWorkspaceLayoutOptions {
  gap?: number;
  separatorHitSize?: number;
  /** Window ids included in this projection; omitted panes are collapsed without mutating persisted state. */
  visibleWindowIds?: readonly string[] | ReadonlySet<string>;
}

/** Recursive minimum size of a tiled workspace node. */
export interface TiledWorkspaceMinimumSize {
  width: number;
  height: number;
}

/** Pane projected into concrete renderer coordinates. */
export interface TiledWorkspacePaneLayout {
  pane: TiledWorkspacePaneNode;
  windowId: string;
  rect: Rectangle;
  active: boolean;
}

/** Split and separator projected into concrete renderer coordinates. */
export interface TiledWorkspaceSeparatorLayout {
  splitId: string;
  direction: TiledWorkspaceSplitDirection;
  axis: TiledWorkspaceSeparatorAxis;
  ratio: number;
  bounds: Rectangle;
  firstRect: Rectangle;
  rect: Rectangle;
  hitRect: Rectangle;
  secondRect: Rectangle;
}

/** Clone-safe projected tiled workspace inspection. */
export interface TiledWorkspaceLayoutInspection {
  bounds: Rectangle;
  minimumSize: TiledWorkspaceMinimumSize;
  fitsMinimumSize: boolean;
  activePaneId?: string;
  activeWindowId?: string;
  panes: TiledWorkspacePaneLayout[];
  separators: TiledWorkspaceSeparatorLayout[];
}

/** Clone-safe logical tiled workspace inspection. */
export interface TiledWorkspaceInspection {
  layout: TiledWorkspaceLayoutState;
  activePaneId?: string;
  activeWindowId?: string;
  windows: TiledWorkspaceWindow[];
  count: number;
}

/** Current serialized tiled workspace snapshot schema version. */
export const TILED_WORKSPACE_SNAPSHOT_VERSION = 1;

/** Versioned tiled workspace state intended for persistence. */
export interface TiledWorkspaceSnapshot {
  version: typeof TILED_WORKSPACE_SNAPSHOT_VERSION;
  gap: number;
  layout: TiledWorkspaceLayoutState;
}

/** Renderer-neutral controller for persistent docked workspace geometry. */
export class TiledWorkspaceController {
  readonly state: Signal<TiledWorkspaceLayoutState>;
  readonly gap: Signal<number>;

  constructor(options: TiledWorkspaceControllerOptions = {}) {
    const layout = normalizeTiledWorkspaceLayout(options.layout ?? {});
    this.gap = new Signal(normalizeGap(options.gap));
    this.state = new Signal(
      options.windows === undefined
        ? activateTiledWorkspaceWindow(layout, options.activeWindowId)
        : reconcileTiledWorkspaceLayout(layout, options.windows, { activeWindowId: options.activeWindowId }),
    );
  }

  /** Returns window ids in their current visual traversal order. */
  windowIds(): string[] {
    return collectPaneRefs(this.state.peek().root).map((pane) => pane.windowId);
  }

  /** Reconciles the tree with current visible windows while preserving surviving geometry. */
  reconcile(
    windows: readonly TiledWorkspaceWindow[],
    options: ReconcileTiledWorkspaceOptions = {},
  ): TiledWorkspaceInspection {
    this.state.value = reconcileTiledWorkspaceLayout(this.state.peek(), windows, options);
    return this.inspect();
  }

  /** Makes the pane containing a window active. */
  focus(windowId: string): boolean {
    const pane = findPaneByWindowRef(this.state.peek().root, windowId);
    if (!pane || this.state.peek().activePaneId === pane.id) return pane !== undefined;
    this.state.value = { ...this.state.peek(), activePaneId: pane.id };
    return true;
  }

  /** Makes a pane active by its stable pane id. */
  activatePane(paneId: string): boolean {
    const pane = findPaneByIdRef(this.state.peek().root, paneId);
    if (!pane || this.state.peek().activePaneId === pane.id) return pane !== undefined;
    this.state.value = { ...this.state.peek(), activePaneId: pane.id };
    return true;
  }

  /** Removes a window pane and collapses any resulting single-child split. */
  remove(windowId: string): boolean {
    const current = this.state.peek();
    const pane = findPaneByWindowRef(current.root, windowId);
    if (!pane) return false;
    const root = removePaneById(current.root, pane.id);
    const activePane = current.activePaneId ? findPaneByIdRef(root, current.activePaneId) : undefined;
    this.state.value = {
      root,
      activePaneId: activePane?.id ?? firstPaneRef(root)?.id,
    };
    return true;
  }

  /** Moves a window through the current visual pane order. */
  move(windowId: string, delta: number): boolean {
    if (!Number.isFinite(delta) || Math.trunc(delta) === 0) return false;
    const current = this.state.peek();
    const panes = collectPaneRefs(current.root);
    const index = panes.findIndex((pane) => pane.windowId === windowId);
    if (index < 0 || panes.length < 2) return false;
    const targetIndex = Math.max(0, Math.min(panes.length - 1, index + Math.trunc(delta)));
    if (targetIndex === index) return false;
    const source = panes[index]!;
    const reordered = [...panes];
    reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, source);
    this.state.value = {
      root: reorderPaneLocations(current.root, reordered, { value: 0 }),
      activePaneId: source.id,
    };
    return true;
  }

  /** Swaps two windows without changing the surrounding split geometry. */
  swap(firstWindowId: string, secondWindowId: string): boolean {
    if (firstWindowId === secondWindowId) return false;
    const current = this.state.peek();
    const first = findPaneByWindowRef(current.root, firstWindowId);
    const second = findPaneByWindowRef(current.root, secondWindowId);
    if (!first || !second) return false;
    this.state.value = {
      root: swapPaneLocations(current.root, first.id, second.id),
      activePaneId: first.id,
    };
    return true;
  }

  /** Docks a source window on an edge of a target window. */
  dock(
    sourceWindowId: string,
    targetWindowId: string,
    edge: TiledWorkspaceDockEdge,
    options: DockTiledWorkspaceOptions = {},
  ): boolean {
    if (sourceWindowId === targetWindowId) return false;
    const current = this.state.peek();
    const source = findPaneByWindowRef(current.root, sourceWindowId);
    const target = findPaneByWindowRef(current.root, targetWindowId);
    if (!source || !target) return false;

    const withoutSource = removePaneById(current.root, source.id);
    const survivingTarget = findPaneByIdRef(withoutSource, target.id);
    if (!withoutSource || !survivingTarget) return false;
    const sourceFirst = edge === "left" || edge === "top";
    const sourceRatio = clampRatio(options.ratio ?? 0.5);
    const split: TiledWorkspaceSplitNode = {
      kind: "split",
      id: uniqueLayoutId("split", withoutSource),
      direction: edge === "left" || edge === "right" ? "row" : "column",
      ratio: sourceFirst ? sourceRatio : 1 - sourceRatio,
      first: sourceFirst ? clonePane(source) : clonePane(survivingTarget),
      second: sourceFirst ? clonePane(survivingTarget) : clonePane(source),
    };
    this.state.value = {
      root: replacePaneById(withoutSource, survivingTarget.id, split),
      activePaneId: source.id,
    };
    return true;
  }

  /** Sets the persisted ratio of a split. */
  setSplitRatio(splitId: string, ratio: number): boolean {
    const current = this.state.peek();
    const nextRatio = clampRatio(ratio);
    const updated = updateSplitRatio(current.root, splitId, nextRatio);
    if (!updated.changed) return false;
    this.state.value = { ...current, root: updated.node };
    return true;
  }

  /** Adds a normalized ratio delta to a split. */
  resizeSplitRatio(splitId: string, delta: number): boolean {
    const split = findSplitByIdRef(this.state.peek().root, splitId);
    if (!split || !Number.isFinite(delta) || delta === 0) return false;
    return this.setSplitRatio(splitId, split.ratio + delta);
  }

  /** Moves a split separator by renderer cells, respecting recursive pane minimums. */
  resizeSplit(
    splitId: string,
    delta: number,
    bounds: Rectangle,
    options: TiledWorkspaceLayoutOptions = {},
  ): boolean {
    if (!Number.isFinite(delta) || Math.trunc(delta) === 0) return false;
    const projection = this.layout(bounds, options);
    const separator = projection.separators.find((entry) => entry.splitId === splitId);
    const projectedLayout = tiledWorkspaceVisibleLayout(this.state.peek(), options.visibleWindowIds);
    const split = findSplitByIdRef(projectedLayout.root, splitId);
    if (!separator || !split) return false;
    const available = split.direction === "row"
      ? separator.firstRect.width + separator.secondRect.width
      : separator.firstRect.height + separator.secondRect.height;
    if (available <= 0) return false;
    const firstSize = split.direction === "row" ? separator.firstRect.width : separator.firstRect.height;
    const firstMinimum = tiledWorkspaceMinimumSize(split.first, options.gap ?? this.gap.peek());
    const secondMinimum = tiledWorkspaceMinimumSize(split.second, options.gap ?? this.gap.peek());
    const nextSize = resolveFirstSize(
      available,
      firstSize + Math.trunc(delta),
      split.direction === "row" ? firstMinimum.width : firstMinimum.height,
      split.direction === "row" ? secondMinimum.width : secondMinimum.height,
    );
    if (nextSize === firstSize) return false;
    return this.setSplitRatio(splitId, nextSize / available);
  }

  /** Projects the current tree into pane and separator rectangles. */
  layout(bounds: Rectangle, options: TiledWorkspaceLayoutOptions = {}): TiledWorkspaceLayoutInspection {
    return projectTiledWorkspaceLayout(this.state.peek(), bounds, {
      ...options,
      gap: options.gap ?? this.gap.peek(),
    });
  }

  /** Returns a clone-safe logical inspection. */
  inspect(): TiledWorkspaceInspection {
    const layout = cloneLayoutState(this.state.peek());
    const panes = collectPaneRefs(layout.root);
    const active = layout.activePaneId ? findPaneByIdRef(layout.root, layout.activePaneId) : undefined;
    return {
      layout,
      activePaneId: active?.id,
      activeWindowId: active?.windowId,
      windows: panes.map(windowFromPane),
      count: panes.length,
    };
  }

  /** Captures a versioned, clone-safe snapshot. */
  snapshot(): TiledWorkspaceSnapshot {
    return normalizeTiledWorkspaceSnapshot({
      version: TILED_WORKSPACE_SNAPSHOT_VERSION,
      gap: this.gap.peek(),
      layout: this.state.peek(),
    });
  }

  /** Replaces controller state from a persisted snapshot. */
  restore(snapshot: TiledWorkspaceSnapshot, windows?: readonly TiledWorkspaceWindow[]): TiledWorkspaceInspection {
    const restored = normalizeTiledWorkspaceSnapshot(snapshot);
    this.gap.value = restored.gap;
    this.state.value = windows === undefined
      ? restored.layout
      : reconcileTiledWorkspaceLayout(restored.layout, windows);
    return this.inspect();
  }

  dispose(): void {
    this.state.dispose();
    this.gap.dispose();
  }
}

/** Creates a tiled workspace controller. */
export function createTiledWorkspaceController(
  options: TiledWorkspaceControllerOptions = {},
): TiledWorkspaceController {
  return new TiledWorkspaceController(options);
}

/** Creates a tiled workspace controller from a persisted snapshot. */
export function createTiledWorkspaceControllerFromSnapshot(
  snapshot: TiledWorkspaceSnapshot,
  options: Pick<TiledWorkspaceControllerOptions, "windows" | "activeWindowId"> = {},
): TiledWorkspaceController {
  const restored = normalizeTiledWorkspaceSnapshot(snapshot);
  return new TiledWorkspaceController({
    ...options,
    gap: restored.gap,
    layout: restored.layout,
  });
}

/** Normalizes and clones a tiled workspace snapshot for persistence or restore. */
export function normalizeTiledWorkspaceSnapshot(snapshot: TiledWorkspaceSnapshot): TiledWorkspaceSnapshot {
  return {
    version: TILED_WORKSPACE_SNAPSHOT_VERSION,
    gap: normalizeGap(snapshot.gap),
    layout: normalizeTiledWorkspaceLayout(snapshot.layout),
  };
}

/** Normalizes a tree, unique ids, ratios, active pane, and optional window inventory. */
export function normalizeTiledWorkspaceLayout(
  layout: TiledWorkspaceLayoutState = {},
  windows?: readonly TiledWorkspaceWindow[],
  options: ReconcileTiledWorkspaceOptions = {},
): TiledWorkspaceLayoutState {
  const ids = new Set<string>();
  const windowIds = new Set<string>();
  const root = normalizeLayoutNode(layout.root, ids, windowIds);
  const normalized = {
    root,
    activePaneId: layout.activePaneId && findPaneByIdRef(root, layout.activePaneId)
      ? layout.activePaneId
      : firstPaneRef(root)?.id,
  };
  return windows === undefined
    ? activateTiledWorkspaceWindow(normalized, options.activeWindowId)
    : reconcileNormalizedLayout(normalized, windows, options);
}

/** Reconciles a layout with a window inventory while preserving surviving splits. */
export function reconcileTiledWorkspaceLayout(
  layout: TiledWorkspaceLayoutState,
  windows: readonly TiledWorkspaceWindow[],
  options: ReconcileTiledWorkspaceOptions = {},
): TiledWorkspaceLayoutState {
  return reconcileNormalizedLayout(normalizeTiledWorkspaceLayout(layout), windows, options);
}

/** Returns the recursive minimum size required by a tiled layout node. */
export function tiledWorkspaceMinimumSize(
  node: TiledWorkspaceLayoutNode | undefined,
  gap = 1,
): TiledWorkspaceMinimumSize {
  if (!node) return { width: 0, height: 0 };
  if (node.kind === "pane") {
    return {
      width: normalizeMinimum(node.minWidth),
      height: normalizeMinimum(node.minHeight),
    };
  }
  const first = tiledWorkspaceMinimumSize(node.first, gap);
  const second = tiledWorkspaceMinimumSize(node.second, gap);
  const safeGap = normalizeGap(gap);
  return node.direction === "row"
    ? { width: first.width + safeGap + second.width, height: Math.max(first.height, second.height) }
    : { width: Math.max(first.width, second.width), height: first.height + safeGap + second.height };
}

/** Projects a tiled layout state into clone-safe pane and separator geometry. */
export function projectTiledWorkspaceLayout(
  layout: TiledWorkspaceLayoutState,
  bounds: Rectangle,
  options: TiledWorkspaceLayoutOptions = {},
): TiledWorkspaceLayoutInspection {
  const normalized = tiledWorkspaceVisibleLayout(layout, options.visibleWindowIds);
  const normalizedBounds = normalizeRectangle(bounds);
  const gap = normalizeGap(options.gap);
  const minimumSize = tiledWorkspaceMinimumSize(normalized.root, gap);
  const activePane = normalized.activePaneId ? findPaneByIdRef(normalized.root, normalized.activePaneId) : undefined;
  const projection: TiledWorkspaceLayoutInspection = {
    bounds: cloneRect(normalizedBounds),
    minimumSize,
    fitsMinimumSize: normalizedBounds.width >= minimumSize.width && normalizedBounds.height >= minimumSize.height,
    activePaneId: activePane?.id,
    activeWindowId: activePane?.windowId,
    panes: [],
    separators: [],
  };
  if (normalized.root) {
    collectLayoutGeometry(
      normalized.root,
      normalizedBounds,
      gap,
      normalizeHitSize(options.separatorHitSize),
      normalized.activePaneId,
      projection,
    );
  }
  return projection;
}

function tiledWorkspaceVisibleLayout(
  layout: TiledWorkspaceLayoutState,
  visibleWindowIds: TiledWorkspaceLayoutOptions["visibleWindowIds"],
): TiledWorkspaceLayoutState {
  const normalized = normalizeTiledWorkspaceLayout(layout);
  if (visibleWindowIds === undefined) return normalized;
  const visible = new Set<string>();
  for (const value of visibleWindowIds) {
    const id = normalizeId(value);
    if (id) visible.add(id);
  }
  const root = pruneLayoutToVisibleWindows(normalized.root, visible);
  const active = normalized.activePaneId ? findPaneByIdRef(root, normalized.activePaneId) : undefined;
  return {
    root,
    activePaneId: active?.id ?? firstPaneRef(root)?.id,
  };
}

function pruneLayoutToVisibleWindows(
  node: TiledWorkspaceLayoutNode | undefined,
  visible: ReadonlySet<string>,
): TiledWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return visible.has(node.windowId) ? clonePane(node) : undefined;
  const first = pruneLayoutToVisibleWindows(node.first, visible);
  const second = pruneLayoutToVisibleWindows(node.second, visible);
  if (!first || !second) return first ?? second;
  return { ...node, first, second };
}

function reconcileNormalizedLayout(
  layout: TiledWorkspaceLayoutState,
  windows: readonly TiledWorkspaceWindow[],
  options: ReconcileTiledWorkspaceOptions,
): TiledWorkspaceLayoutState {
  const inventory = normalizeWindows(windows);
  const byId = new Map(inventory.map((window) => [window.id, window]));
  let root = reconcileNodeWindows(layout.root, byId, new Set<string>());
  const present = new Set(collectPaneRefs(root).map((pane) => pane.windowId));
  const missing = inventory.filter((window) => !present.has(window.id));
  if (!root && missing.length > 0) {
    root = buildBalancedLayout(missing, 0, { value: 1 });
  } else {
    for (const window of missing) root = appendWindowPane(root, paneFromWindow(window));
  }
  root = normalizeLayoutNode(root, new Set<string>(), new Set<string>());
  const requested = options.activeWindowId ? findPaneByWindowRef(root, options.activeWindowId) : undefined;
  const preserved = layout.activePaneId ? findPaneByIdRef(root, layout.activePaneId) : undefined;
  return {
    root,
    activePaneId: requested?.id ?? preserved?.id ?? firstPaneRef(root)?.id,
  };
}

function activateTiledWorkspaceWindow(
  layout: TiledWorkspaceLayoutState,
  windowId?: string,
): TiledWorkspaceLayoutState {
  const requested = windowId ? findPaneByWindowRef(layout.root, windowId) : undefined;
  const active = layout.activePaneId ? findPaneByIdRef(layout.root, layout.activePaneId) : undefined;
  return {
    root: layout.root ? cloneLayoutNode(layout.root) : undefined,
    activePaneId: requested?.id ?? active?.id ?? firstPaneRef(layout.root)?.id,
  };
}

function normalizeLayoutNode(
  node: TiledWorkspaceLayoutNode | undefined,
  ids: Set<string>,
  windowIds: Set<string>,
): TiledWorkspaceLayoutNode | undefined {
  if (!node || (node.kind !== "pane" && node.kind !== "split")) return undefined;
  if (node.kind === "pane") {
    const windowId = normalizeId(node.windowId);
    if (!windowId || windowIds.has(windowId)) return undefined;
    windowIds.add(windowId);
    return {
      kind: "pane",
      id: claimLayoutId(normalizeId(node.id) || `pane-${sanitizeId(windowId)}`, ids),
      windowId,
      minWidth: normalizeOptionalMinimum(node.minWidth),
      minHeight: normalizeOptionalMinimum(node.minHeight),
    };
  }
  const first = normalizeLayoutNode(node.first, ids, windowIds);
  const second = normalizeLayoutNode(node.second, ids, windowIds);
  if (!first || !second) return first ?? second;
  return {
    kind: "split",
    id: claimLayoutId(normalizeId(node.id) || "split", ids),
    direction: node.direction === "column" ? "column" : "row",
    ratio: clampRatio(node.ratio),
    first,
    second,
  };
}

function normalizeWindows(windows: readonly TiledWorkspaceWindow[]): TiledWorkspaceWindow[] {
  const normalized: TiledWorkspaceWindow[] = [];
  const ids = new Set<string>();
  for (const window of windows) {
    const id = normalizeId(window.id);
    if (!id || ids.has(id)) continue;
    ids.add(id);
    normalized.push({
      id,
      minWidth: normalizeOptionalMinimum(window.minWidth),
      minHeight: normalizeOptionalMinimum(window.minHeight),
    });
  }
  return normalized;
}

function reconcileNodeWindows(
  node: TiledWorkspaceLayoutNode | undefined,
  windows: ReadonlyMap<string, TiledWorkspaceWindow>,
  seen: Set<string>,
): TiledWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") {
    const window = windows.get(node.windowId);
    if (!window || seen.has(window.id)) return undefined;
    seen.add(window.id);
    return { ...clonePane(node), minWidth: window.minWidth, minHeight: window.minHeight };
  }
  const first = reconcileNodeWindows(node.first, windows, seen);
  const second = reconcileNodeWindows(node.second, windows, seen);
  if (!first || !second) return first ?? second;
  return { ...node, first, second };
}

function buildBalancedLayout(
  windows: readonly TiledWorkspaceWindow[],
  depth: number,
  splitCounter: { value: number },
): TiledWorkspaceLayoutNode {
  if (windows.length === 1) return paneFromWindow(windows[0]!);
  const midpoint = Math.ceil(windows.length / 2);
  const first = buildBalancedLayout(windows.slice(0, midpoint), depth + 1, splitCounter);
  const second = buildBalancedLayout(windows.slice(midpoint), depth + 1, splitCounter);
  const id = `split-${splitCounter.value}`;
  splitCounter.value += 1;
  return {
    kind: "split",
    id,
    direction: depth % 2 === 0 ? "row" : "column",
    ratio: midpoint / windows.length,
    first,
    second,
  };
}

function appendWindowPane(
  root: TiledWorkspaceLayoutNode | undefined,
  pane: TiledWorkspacePaneNode,
): TiledWorkspaceLayoutNode {
  if (!root) return pane;
  const last = collectPaneRefs(root).at(-1)!;
  const parent = findParentSplitRef(root, last.id);
  const split: TiledWorkspaceSplitNode = {
    kind: "split",
    id: uniqueLayoutId("split", root),
    direction: parent?.direction === "row" ? "column" : "row",
    ratio: 0.5,
    first: clonePane(last),
    second: pane,
  };
  return replacePaneById(root, last.id, split);
}

function collectLayoutGeometry(
  node: TiledWorkspaceLayoutNode,
  bounds: Rectangle,
  gap: number,
  hitSize: number,
  activePaneId: string | undefined,
  projection: TiledWorkspaceLayoutInspection,
): void {
  if (node.kind === "pane") {
    projection.panes.push({
      pane: clonePane(node),
      windowId: node.windowId,
      rect: cloneRect(bounds),
      active: node.id === activePaneId,
    });
    return;
  }

  const split = projectSplit(node, bounds, gap, hitSize);
  projection.separators.push(split);
  collectLayoutGeometry(node.first, split.firstRect, gap, hitSize, activePaneId, projection);
  collectLayoutGeometry(node.second, split.secondRect, gap, hitSize, activePaneId, projection);
}

function projectSplit(
  split: TiledWorkspaceSplitNode,
  bounds: Rectangle,
  gap: number,
  hitSize: number,
): TiledWorkspaceSeparatorLayout {
  const mainSize = split.direction === "row" ? bounds.width : bounds.height;
  const safeGap = Math.min(gap, Math.max(0, mainSize - 1));
  const available = Math.max(0, mainSize - safeGap);
  const firstMinimum = tiledWorkspaceMinimumSize(split.first, gap);
  const secondMinimum = tiledWorkspaceMinimumSize(split.second, gap);
  const requested = Math.floor(available * split.ratio);
  const firstSize = resolveFirstSize(
    available,
    requested,
    split.direction === "row" ? firstMinimum.width : firstMinimum.height,
    split.direction === "row" ? secondMinimum.width : secondMinimum.height,
  );
  const secondSize = Math.max(0, available - firstSize);

  let firstRect: Rectangle;
  let separatorRect: Rectangle;
  let secondRect: Rectangle;
  if (split.direction === "row") {
    firstRect = { ...bounds, width: firstSize };
    separatorRect = {
      column: bounds.column + firstSize,
      row: bounds.row,
      width: safeGap,
      height: bounds.height,
    };
    secondRect = {
      column: separatorRect.column + safeGap,
      row: bounds.row,
      width: secondSize,
      height: bounds.height,
    };
  } else {
    firstRect = { ...bounds, height: firstSize };
    separatorRect = {
      column: bounds.column,
      row: bounds.row + firstSize,
      width: bounds.width,
      height: safeGap,
    };
    secondRect = {
      column: bounds.column,
      row: separatorRect.row + safeGap,
      width: bounds.width,
      height: secondSize,
    };
  }

  return {
    splitId: split.id,
    direction: split.direction,
    axis: split.direction === "row" ? "column" : "row",
    ratio: available <= 0 ? 0 : firstSize / available,
    bounds: cloneRect(bounds),
    firstRect,
    rect: separatorRect,
    hitRect: separatorHitRect(bounds, separatorRect, split.direction, hitSize),
    secondRect,
  };
}

function separatorHitRect(
  bounds: Rectangle,
  separator: Rectangle,
  direction: TiledWorkspaceSplitDirection,
  hitSize: number,
): Rectangle {
  if (direction === "row") {
    const width = Math.min(bounds.width, Math.max(separator.width, hitSize));
    if (width <= 0) return { column: bounds.column, row: bounds.row, width: 0, height: bounds.height };
    const center = separator.column + separator.width / 2;
    const column = Math.max(
      bounds.column,
      Math.min(bounds.column + bounds.width - width, Math.floor(center - width / 2)),
    );
    return { column, row: bounds.row, width, height: bounds.height };
  }
  const height = Math.min(bounds.height, Math.max(separator.height, hitSize));
  if (height <= 0) return { column: bounds.column, row: bounds.row, width: bounds.width, height: 0 };
  const center = separator.row + separator.height / 2;
  const row = Math.max(
    bounds.row,
    Math.min(bounds.row + bounds.height - height, Math.floor(center - height / 2)),
  );
  return { column: bounds.column, row, width: bounds.width, height };
}

function resolveFirstSize(available: number, requested: number, minFirst: number, minSecond: number): number {
  if (available <= 0) return 0;
  const firstMinimum = Math.max(0, Math.floor(minFirst));
  const secondMinimum = Math.max(0, Math.floor(minSecond));
  if (firstMinimum + secondMinimum <= available) {
    return Math.max(firstMinimum, Math.min(available - secondMinimum, Math.floor(requested)));
  }
  const totalMinimum = firstMinimum + secondMinimum;
  if (totalMinimum <= 0) return Math.max(0, Math.min(available, Math.floor(requested)));
  return Math.max(0, Math.min(available, Math.round(available * firstMinimum / totalMinimum)));
}

function removePaneById(
  node: TiledWorkspaceLayoutNode | undefined,
  paneId: string,
): TiledWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.id === paneId ? undefined : clonePane(node);
  const first = removePaneById(node.first, paneId);
  const second = removePaneById(node.second, paneId);
  if (!first || !second) return first ?? second;
  return { ...node, first, second };
}

function replacePaneById(
  node: TiledWorkspaceLayoutNode,
  paneId: string,
  replacement: TiledWorkspaceLayoutNode,
): TiledWorkspaceLayoutNode {
  if (node.kind === "pane") return node.id === paneId ? cloneLayoutNode(replacement) : clonePane(node);
  return {
    ...node,
    first: replacePaneById(node.first, paneId, replacement),
    second: replacePaneById(node.second, paneId, replacement),
  };
}

function swapPaneLocations(
  node: TiledWorkspaceLayoutNode | undefined,
  firstPaneId: string,
  secondPaneId: string,
): TiledWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  const first = findPaneByIdRef(node, firstPaneId);
  const second = findPaneByIdRef(node, secondPaneId);
  if (!first || !second) return cloneLayoutNode(node);
  return replacePanePair(node, first, second);
}

function reorderPaneLocations(
  node: TiledWorkspaceLayoutNode | undefined,
  panes: readonly TiledWorkspacePaneNode[],
  index: { value: number },
): TiledWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") {
    const pane = panes[index.value];
    index.value += 1;
    return pane ? clonePane(pane) : clonePane(node);
  }
  return {
    ...node,
    first: reorderPaneLocations(node.first, panes, index) ?? cloneLayoutNode(node.first),
    second: reorderPaneLocations(node.second, panes, index) ?? cloneLayoutNode(node.second),
  };
}

function replacePanePair(
  node: TiledWorkspaceLayoutNode,
  first: TiledWorkspacePaneNode,
  second: TiledWorkspacePaneNode,
): TiledWorkspaceLayoutNode {
  if (node.kind === "pane") {
    if (node.id === first.id) return clonePane(second);
    if (node.id === second.id) return clonePane(first);
    return clonePane(node);
  }
  return {
    ...node,
    first: replacePanePair(node.first, first, second),
    second: replacePanePair(node.second, first, second),
  };
}

function updateSplitRatio(
  node: TiledWorkspaceLayoutNode | undefined,
  splitId: string,
  ratio: number,
): { node?: TiledWorkspaceLayoutNode; changed: boolean } {
  if (!node || node.kind === "pane") return { node, changed: false };
  if (node.id === splitId) {
    if (node.ratio === ratio) return { node: cloneLayoutNode(node), changed: false };
    return { node: { ...node, ratio }, changed: true };
  }
  const first = updateSplitRatio(node.first, splitId, ratio);
  if (first.changed) return { node: { ...node, first: first.node ?? node.first }, changed: true };
  const second = updateSplitRatio(node.second, splitId, ratio);
  if (second.changed) return { node: { ...node, second: second.node ?? node.second }, changed: true };
  return { node: cloneLayoutNode(node), changed: false };
}

function collectPaneRefs(node: TiledWorkspaceLayoutNode | undefined): TiledWorkspacePaneNode[] {
  const panes: TiledWorkspacePaneNode[] = [];
  collectPaneRefsInto(node, panes);
  return panes;
}

function collectPaneRefsInto(
  node: TiledWorkspaceLayoutNode | undefined,
  panes: TiledWorkspacePaneNode[],
): void {
  if (!node) return;
  if (node.kind === "pane") {
    panes.push(node);
    return;
  }
  collectPaneRefsInto(node.first, panes);
  collectPaneRefsInto(node.second, panes);
}

function findPaneByIdRef(
  node: TiledWorkspaceLayoutNode | undefined,
  paneId: string,
): TiledWorkspacePaneNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.id === paneId ? node : undefined;
  return findPaneByIdRef(node.first, paneId) ?? findPaneByIdRef(node.second, paneId);
}

function findPaneByWindowRef(
  node: TiledWorkspaceLayoutNode | undefined,
  windowId: string,
): TiledWorkspacePaneNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.windowId === windowId ? node : undefined;
  return findPaneByWindowRef(node.first, windowId) ?? findPaneByWindowRef(node.second, windowId);
}

function findSplitByIdRef(
  node: TiledWorkspaceLayoutNode | undefined,
  splitId: string,
): TiledWorkspaceSplitNode | undefined {
  if (!node || node.kind === "pane") return undefined;
  if (node.id === splitId) return node;
  return findSplitByIdRef(node.first, splitId) ?? findSplitByIdRef(node.second, splitId);
}

function findParentSplitRef(
  node: TiledWorkspaceLayoutNode | undefined,
  paneId: string,
): TiledWorkspaceSplitNode | undefined {
  if (!node || node.kind === "pane") return undefined;
  if (
    (node.first.kind === "pane" && node.first.id === paneId) ||
    (node.second.kind === "pane" && node.second.id === paneId)
  ) return node;
  return findParentSplitRef(node.first, paneId) ?? findParentSplitRef(node.second, paneId);
}

function firstPaneRef(node: TiledWorkspaceLayoutNode | undefined): TiledWorkspacePaneNode | undefined {
  if (!node) return undefined;
  return node.kind === "pane" ? node : firstPaneRef(node.first);
}

function paneFromWindow(window: TiledWorkspaceWindow): TiledWorkspacePaneNode {
  return {
    kind: "pane",
    id: `pane-${sanitizeId(window.id)}`,
    windowId: window.id,
    minWidth: window.minWidth,
    minHeight: window.minHeight,
  };
}

function windowFromPane(pane: TiledWorkspacePaneNode): TiledWorkspaceWindow {
  return {
    id: pane.windowId,
    minWidth: pane.minWidth,
    minHeight: pane.minHeight,
  };
}

function cloneLayoutState(layout: TiledWorkspaceLayoutState): TiledWorkspaceLayoutState {
  return {
    root: layout.root ? cloneLayoutNode(layout.root) : undefined,
    activePaneId: layout.activePaneId,
  };
}

function cloneLayoutNode(node: TiledWorkspaceLayoutNode): TiledWorkspaceLayoutNode {
  return node.kind === "pane" ? clonePane(node) : {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: cloneLayoutNode(node.first),
    second: cloneLayoutNode(node.second),
  };
}

function clonePane(pane: TiledWorkspacePaneNode): TiledWorkspacePaneNode {
  return {
    kind: "pane",
    id: pane.id,
    windowId: pane.windowId,
    minWidth: pane.minWidth,
    minHeight: pane.minHeight,
  };
}

function cloneRect(rect: Rectangle): Rectangle {
  return { column: rect.column, row: rect.row, width: rect.width, height: rect.height };
}

function claimLayoutId(preferred: string, ids: Set<string>): string {
  let candidate = preferred;
  let suffix = 2;
  while (ids.has(candidate)) {
    candidate = `${preferred}-${suffix}`;
    suffix += 1;
  }
  ids.add(candidate);
  return candidate;
}

function uniqueLayoutId(prefix: string, node: TiledWorkspaceLayoutNode | undefined): string {
  const ids = new Set<string>();
  collectLayoutIds(node, ids);
  return claimLayoutId(prefix, ids);
}

function collectLayoutIds(node: TiledWorkspaceLayoutNode | undefined, ids: Set<string>): void {
  if (!node) return;
  ids.add(node.id);
  if (node.kind === "split") {
    collectLayoutIds(node.first, ids);
    collectLayoutIds(node.second, ids);
  }
}

function normalizeId(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "window";
}

function normalizeOptionalMinimum(value: number | undefined): number | undefined {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value!)) : undefined;
}

function normalizeMinimum(value: number | undefined): number {
  return normalizeOptionalMinimum(value) ?? 1;
}

function normalizeGap(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 1;
}

function normalizeHitSize(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value!)) : 1;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0.05, Math.min(0.95, value));
}
