// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { Rectangle } from "../types.ts";
import { formatProcessCommandLine } from "./process_session.ts";
import {
  describeAttachTerminalTemplate,
  isSpawnTerminalTemplate,
  type TerminalSessionDescriptor,
  type TerminalTemplate,
} from "./terminal_templates.ts";

/** Options for constructing a terminal workspace controller. */
export interface TerminalWorkspaceControllerOptions {
  sessions?: readonly TerminalSessionDescriptor[];
  activeId?: string;
  layout?: TerminalWorkspaceLayoutState;
  now?: () => number;
}

/** Options for adding a terminal template to a workspace. */
export interface AddTerminalWorkspaceSessionOptions {
  title?: string;
  backendId?: string;
  columns?: number;
  rows?: number;
  status?: TerminalSessionDescriptor["status"];
  running?: boolean;
  activate?: boolean;
}

/** Options for inserting or replacing a terminal workspace descriptor. */
export interface UpsertTerminalWorkspaceSessionOptions {
  activate?: boolean;
}

/** Options for duplicating an existing terminal workspace descriptor. */
export interface DuplicateTerminalWorkspaceSessionOptions {
  id?: string;
  title?: string;
  activate?: boolean;
}

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

/** Options for splitting the active terminal pane. */
export interface SplitTerminalWorkspacePaneOptions {
  paneId?: string;
  ratio?: number;
  placement?: TerminalWorkspacePanePlacement;
  title?: string;
  minColumns?: number;
  minRows?: number;
}

/** Serializable terminal pane with linked session metadata. */
export interface TerminalWorkspacePaneInspection extends TerminalWorkspacePaneNode {
  active: boolean;
  zoomed: boolean;
  session?: TerminalSessionDescriptor;
}

/** Serializable terminal pane layout inspection. */
export interface TerminalWorkspaceLayoutInspection {
  root?: TerminalWorkspaceLayoutNode;
  activePaneId?: string;
  zoomedPaneId?: string;
  panes: TerminalWorkspacePaneInspection[];
  count: number;
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

/** Serializable terminal workspace state. */
export interface TerminalWorkspaceInspection {
  activeId?: string;
  active?: TerminalSessionDescriptor;
  sessions: TerminalSessionDescriptor[];
  count: number;
  layout: TerminalWorkspaceLayoutInspection;
}

/** Current serialized terminal workspace snapshot schema version. */
export const TERMINAL_WORKSPACE_SNAPSHOT_VERSION = 1;

/** Versioned terminal workspace state intended for persistence. */
export interface TerminalWorkspaceSnapshot {
  version: typeof TERMINAL_WORKSPACE_SNAPSHOT_VERSION;
  activeId?: string;
  sessions: TerminalSessionDescriptor[];
  layout: TerminalWorkspaceLayoutState;
}

/** Renderer-neutral session/tab model for tmux-like terminal workspaces. */
export class TerminalWorkspaceController {
  readonly sessions: Signal<TerminalSessionDescriptor[]>;
  readonly activeId: Signal<string | undefined>;
  readonly layout: Signal<TerminalWorkspaceLayoutState>;
  readonly #now: () => number;

  constructor(options: TerminalWorkspaceControllerOptions = {}) {
    this.#now = options.now ?? (() => Date.now());
    const sourceSessions = options.sessions ?? [];
    const sessions = new Array<TerminalSessionDescriptor>(sourceSessions.length);
    for (let index = 0; index < sourceSessions.length; index += 1) {
      sessions[index] = cloneTerminalSessionDescriptor(sourceSessions[index]!);
    }
    const activeId = options.activeId && hasTerminalSession(sessions, options.activeId)
      ? options.activeId
      : sessions[0]?.id;
    this.sessions = new Signal(sessions);
    this.activeId = new Signal<string | undefined>(activeId);
    this.layout = new Signal(normalizeTerminalWorkspaceLayout(options.layout, sessions, activeId));
  }

  get active(): TerminalSessionDescriptor | undefined {
    const id = this.activeId.peek();
    return findTerminalSession(this.sessions.peek(), id);
  }

  add(template: TerminalTemplate, options: AddTerminalWorkspaceSessionOptions = {}): TerminalSessionDescriptor {
    const descriptor = descriptorFromTerminalTemplate(template, options, this.#now());
    return this.upsert(descriptor, {
      activate: options.activate ?? this.sessions.peek().length === 0,
    });
  }

  upsert(
    descriptor: TerminalSessionDescriptor,
    options: UpsertTerminalWorkspaceSessionOptions = {},
  ): TerminalSessionDescriptor {
    const nextDescriptor = cloneTerminalSessionDescriptor(descriptor);
    const sessions = this.sessions.peek();
    const index = terminalSessionIndex(sessions, nextDescriptor.id);
    this.sessions.value = index >= 0 ? replaceTerminalSession(sessions, index, nextDescriptor) : appendTerminalSession(
      sessions,
      nextDescriptor,
    );
    if (options.activate || !this.activeId.peek()) this.activeId.value = nextDescriptor.id;
    if (!this.layout.peek().root) {
      this.layout.value = terminalWorkspaceLayoutWithActive({
        root: createTerminalWorkspacePaneNode(nextDescriptor.id, undefined, { title: nextDescriptor.title }),
      }, nextDescriptor.id);
    }
    return cloneTerminalSessionDescriptor(nextDescriptor);
  }

  activate(id: string): boolean {
    if (!hasTerminalSession(this.sessions.peek(), id)) return false;
    this.activeId.value = id;
    const layout = this.layout.peek();
    const pane = findTerminalWorkspacePaneBySessionRef(layout.root, id);
    if (pane) {
      this.layout.value = {
        root: layout.root,
        activePaneId: pane.id,
        zoomedPaneId: layout.zoomedPaneId,
      };
    } else if (!layout.root) {
      this.layout.value = terminalWorkspaceLayoutWithActive({ root: createTerminalWorkspacePaneNode(id) }, id);
    }
    return true;
  }

  remove(id: string): boolean {
    const sessions = this.sessions.peek();
    const index = terminalSessionIndex(sessions, id);
    if (index < 0) return false;
    const next = removeTerminalSessionAt(sessions, index);
    this.sessions.value = next;
    const sessionIds = new Set<string>();
    for (const session of next) sessionIds.add(session.id);
    this.layout.value = normalizeTerminalWorkspaceLayout(
      pruneTerminalWorkspaceLayoutSessions(this.layout.peek(), sessionIds),
      next,
      this.activeId.peek(),
    );
    if (this.activeId.peek() === id) {
      this.activeId.value = next[index]?.id ?? next[index - 1]?.id;
      const pane = this.activeId.peek()
        ? findTerminalWorkspacePaneBySessionRef(this.layout.peek().root, this.activeId.peek()!)
        : undefined;
      if (pane) {
        const layout = this.layout.peek();
        this.layout.value = {
          root: layout.root,
          activePaneId: pane.id,
          zoomedPaneId: layout.zoomedPaneId,
        };
      }
    }
    return true;
  }

  rename(id: string, title: string): boolean {
    const trimmed = title.trim();
    if (!trimmed) return false;
    const sessions = this.sessions.peek();
    const index = terminalSessionIndex(sessions, id);
    if (index < 0) return false;
    const descriptor = cloneTerminalSessionDescriptor(sessions[index]!);
    descriptor.title = trimmed;
    descriptor.updatedAt = this.#now();
    this.sessions.value = replaceTerminalSession(sessions, index, descriptor);
    return true;
  }

  updateRuntimeTitle(id: string, title: string | undefined): boolean {
    const trimmed = title?.trim();
    if (!trimmed) return false;
    const sessions = this.sessions.peek();
    const index = terminalSessionIndex(sessions, id);
    if (index < 0) return false;

    const previous = sessions[index]!;
    const descriptor = cloneTerminalSessionDescriptor(previous);
    const previousRuntimeTitle = descriptor.runtimeTitle;
    const previousVisibleTitle = descriptor.title;
    descriptor.runtimeTitle = trimmed;
    if (shouldAdoptRuntimeTitle(descriptor, previousRuntimeTitle)) {
      descriptor.title = trimmed;
    }
    descriptor.updatedAt = this.#now();
    this.sessions.value = replaceTerminalSession(sessions, index, descriptor);
    if (descriptor.title !== previousVisibleTitle) {
      this.layout.value = updateTerminalWorkspacePaneRuntimeTitles(
        this.layout.peek(),
        id,
        trimmed,
        previousVisibleTitle,
        previousRuntimeTitle,
        descriptor.template.title,
      );
    }
    return true;
  }

  move(id: string, delta: number): boolean {
    const sessions = this.sessions.peek();
    const index = terminalSessionIndex(sessions, id);
    if (index < 0 || sessions.length < 2) return false;
    const nextIndex = Math.max(0, Math.min(sessions.length - 1, index + Math.trunc(delta)));
    if (nextIndex === index) return false;
    this.sessions.value = moveTerminalSession(sessions, index, nextIndex);
    return true;
  }

  activateRelative(delta: number): TerminalSessionDescriptor | undefined {
    const sessions = this.sessions.peek();
    if (sessions.length === 0) return undefined;
    const activeId = this.activeId.peek();
    let index = terminalSessionIndex(sessions, activeId ?? "");
    if (index < 0) index = 0;
    const nextIndex = (index + Math.trunc(delta) + sessions.length) % sessions.length;
    const next = sessions[nextIndex]!;
    return this.activate(next.id) ? cloneTerminalSessionDescriptor(next) : undefined;
  }

  duplicate(
    id = this.activeId.peek(),
    options: DuplicateTerminalWorkspaceSessionOptions = {},
  ): TerminalSessionDescriptor | undefined {
    if (!id) return undefined;
    const sessions = this.sessions.peek();
    const source = findTerminalSession(sessions, id);
    if (!source) return undefined;

    const descriptor = duplicateTerminalSessionDescriptor(source, sessions, options, this.#now());
    return this.upsert(descriptor, { activate: options.activate ?? true });
  }

  detach(id = this.activeId.peek()): boolean {
    if (!id) return false;
    const sessions = this.sessions.peek();
    const index = terminalSessionIndex(sessions, id);
    if (index < 0) return false;
    const descriptor = cloneTerminalSessionDescriptor(sessions[index]!);
    descriptor.detached = true;
    descriptor.reconnectable = true;
    descriptor.running = false;
    descriptor.updatedAt = this.#now();
    this.sessions.value = replaceTerminalSession(sessions, index, descriptor);
    return true;
  }

  attach(id = this.activeId.peek()): boolean {
    if (!id) return false;
    const sessions = this.sessions.peek();
    const index = terminalSessionIndex(sessions, id);
    if (index < 0) return false;
    const descriptor = cloneTerminalSessionDescriptor(sessions[index]!);
    if (!descriptor.detached) return false;
    descriptor.detached = false;
    descriptor.updatedAt = this.#now();
    this.sessions.value = replaceTerminalSession(sessions, index, descriptor);
    return this.activate(id);
  }

  restart(id = this.activeId.peek()): boolean {
    if (!id) return false;
    const sessions = this.sessions.peek();
    const index = terminalSessionIndex(sessions, id);
    if (index < 0) return false;
    const descriptor = cloneTerminalSessionDescriptor(sessions[index]!);
    if (!isSpawnTerminalTemplate(descriptor.template)) return false;
    descriptor.runtimeTitle = undefined;
    descriptor.status = "idle";
    descriptor.running = false;
    descriptor.detached = false;
    descriptor.updatedAt = this.#now();
    this.sessions.value = replaceTerminalSession(sessions, index, descriptor);
    return this.activate(id);
  }

  clear(): void {
    this.sessions.value = [];
    this.activeId.value = undefined;
    this.layout.value = {};
  }

  splitActive(
    direction: TerminalWorkspaceSplitDirection,
    sessionId: string,
    options: SplitTerminalWorkspacePaneOptions = {},
  ): TerminalWorkspacePaneNode | undefined {
    if (!hasTerminalSession(this.sessions.peek(), sessionId)) return undefined;
    const current = normalizeTerminalWorkspaceLayout(this.layout.peek(), this.sessions.peek(), this.activeId.peek());
    if (!current.root) {
      const pane = createTerminalWorkspacePaneNode(sessionId, undefined, options);
      this.layout.value = { root: pane, activePaneId: pane.id };
      this.activeId.value = sessionId;
      return cloneTerminalWorkspacePaneNode(pane);
    }

    const activePane = options.paneId
      ? findTerminalWorkspacePaneRef(current.root, options.paneId)
      : findActiveTerminalWorkspacePaneRef(current);
    if (!activePane) return undefined;
    const nextPane = createTerminalWorkspacePaneNode(sessionId, current.root, options);
    const ratio = clampTerminalWorkspaceSplitRatio(options.ratio ?? 0.5);
    const placement = options.placement ?? "after";
    const split: TerminalWorkspaceSplitNode = {
      kind: "split",
      id: uniqueTerminalWorkspaceLayoutId("split", current.root),
      direction,
      ratio,
      first: placement === "before" ? nextPane : cloneTerminalWorkspacePaneNode(activePane),
      second: placement === "before" ? cloneTerminalWorkspacePaneNode(activePane) : nextPane,
    };
    const root = replaceTerminalWorkspacePane(current.root, activePane.id, split);
    this.layout.value = {
      root,
      activePaneId: nextPane.id,
      zoomedPaneId: current.zoomedPaneId === activePane.id ? nextPane.id : current.zoomedPaneId,
    };
    this.activeId.value = sessionId;
    return cloneTerminalWorkspacePaneNode(nextPane);
  }

  activatePane(paneId: string): boolean {
    const pane = findTerminalWorkspacePaneRef(this.layout.peek().root, paneId);
    if (!pane || !hasTerminalSession(this.sessions.peek(), pane.sessionId)) return false;
    const layout = this.layout.peek();
    this.layout.value = {
      root: layout.root,
      activePaneId: pane.id,
      zoomedPaneId: layout.zoomedPaneId,
    };
    this.activeId.value = pane.sessionId;
    return true;
  }

  closePane(paneId: string): boolean {
    const current = this.layout.peek();
    if (!findTerminalWorkspacePaneRef(current.root, paneId)) return false;
    const root = removeTerminalWorkspacePane(current.root, paneId);
    const activePane = current.activePaneId ? findTerminalWorkspacePaneRef(root, current.activePaneId) : undefined;
    const nextActivePane = activePane ?? firstTerminalWorkspacePaneRef(root);
    this.layout.value = {
      root,
      activePaneId: nextActivePane?.id,
      zoomedPaneId: current.zoomedPaneId === paneId ? undefined : current.zoomedPaneId,
    };
    if (nextActivePane) this.activeId.value = nextActivePane.sessionId;
    return true;
  }

  resizeSplit(splitId: string, ratio: number): boolean {
    const current = this.layout.peek();
    const root = updateTerminalWorkspaceSplitRatio(current.root, splitId, clampTerminalWorkspaceSplitRatio(ratio));
    if (!root.changed) return false;
    this.layout.value = {
      root: root.node,
      activePaneId: current.activePaneId,
      zoomedPaneId: current.zoomedPaneId,
    };
    return true;
  }

  resizeActiveSplit(delta: number): boolean {
    const current = this.layout.peek();
    const activePane = findActiveTerminalWorkspacePaneRef(current);
    if (!activePane) return false;
    const nearest = findNearestTerminalWorkspaceSplit(current.root, activePane.id);
    if (!nearest) return false;
    const nextRatio = nearest.activeSide === "first" ? nearest.split.ratio + delta : nearest.split.ratio - delta;
    return this.resizeSplit(nearest.split.id, nextRatio);
  }

  toggleZoomPane(paneId = this.layout.peek().activePaneId): boolean {
    if (!paneId || !findTerminalWorkspacePaneRef(this.layout.peek().root, paneId)) return false;
    const current = this.layout.peek();
    this.layout.value = {
      root: current.root,
      activePaneId: paneId,
      zoomedPaneId: current.zoomedPaneId === paneId ? undefined : paneId,
    };
    return true;
  }

  inspectLayout(): TerminalWorkspaceLayoutInspection {
    return inspectTerminalWorkspaceLayout(this.layout.peek(), this.sessions.peek());
  }

  inspect(): TerminalWorkspaceInspection {
    const source = this.sessions.peek();
    const sessions = new Array<TerminalSessionDescriptor>(source.length);
    for (let index = 0; index < source.length; index += 1) {
      sessions[index] = cloneTerminalSessionDescriptor(source[index]!);
    }
    const activeId = this.activeId.peek();
    const active = findTerminalSession(sessions, activeId);
    return {
      activeId,
      active,
      sessions,
      count: sessions.length,
      layout: inspectTerminalWorkspaceLayout(this.layout.peek(), sessions),
    };
  }

  snapshot(): TerminalWorkspaceSnapshot {
    return snapshotTerminalWorkspace(this.inspect());
  }

  dispose(): void {
    this.sessions.dispose();
    this.activeId.dispose();
    this.layout.dispose();
  }
}

/** Creates a terminal workspace controller. */
export function createTerminalWorkspaceController(
  options: TerminalWorkspaceControllerOptions = {},
): TerminalWorkspaceController {
  return new TerminalWorkspaceController(options);
}

/** Creates a terminal workspace controller from a persisted snapshot. */
export function createTerminalWorkspaceControllerFromSnapshot(
  snapshot: TerminalWorkspaceSnapshot,
  options: Pick<TerminalWorkspaceControllerOptions, "now"> = {},
): TerminalWorkspaceController {
  const restored = normalizeTerminalWorkspaceSnapshot(snapshot);
  return new TerminalWorkspaceController({
    ...options,
    sessions: restored.sessions,
    activeId: restored.activeId,
    layout: restored.layout,
  });
}

/** Normalizes and clones a terminal workspace snapshot for persistence or restore. */
export function normalizeTerminalWorkspaceSnapshot(snapshot: TerminalWorkspaceSnapshot): TerminalWorkspaceSnapshot {
  const sessions = new Array<TerminalSessionDescriptor>(snapshot.sessions.length);
  for (let index = 0; index < snapshot.sessions.length; index += 1) {
    sessions[index] = cloneTerminalSessionDescriptor(snapshot.sessions[index]!);
  }
  const activeId = snapshot.activeId && hasTerminalSession(sessions, snapshot.activeId)
    ? snapshot.activeId
    : sessions[0]?.id;
  const layout = normalizeTerminalWorkspaceLayout(snapshot.layout, sessions, activeId);
  return {
    version: TERMINAL_WORKSPACE_SNAPSHOT_VERSION,
    activeId,
    sessions,
    layout: cloneTerminalWorkspaceLayoutState(layout),
  };
}

/** Captures a versioned, clone-safe terminal workspace snapshot from controller inspection state. */
export function snapshotTerminalWorkspace(
  source: TerminalWorkspaceController | TerminalWorkspaceInspection,
): TerminalWorkspaceSnapshot {
  const inspection = source instanceof TerminalWorkspaceController ? source.inspect() : source;
  return normalizeTerminalWorkspaceSnapshot({
    version: TERMINAL_WORKSPACE_SNAPSHOT_VERSION,
    activeId: inspection.activeId,
    sessions: inspection.sessions,
    layout: inspection.layout,
  });
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

function createTerminalWorkspacePaneNode(
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

function terminalWorkspaceLayoutWithActive(
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

function cloneTerminalWorkspaceLayoutNode(node: TerminalWorkspaceLayoutNode): TerminalWorkspaceLayoutNode {
  return node.kind === "pane" ? cloneTerminalWorkspacePaneNode(node) : {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: cloneTerminalWorkspaceLayoutNode(node.first),
    second: cloneTerminalWorkspaceLayoutNode(node.second),
  };
}

function cloneTerminalWorkspacePaneNode(node: TerminalWorkspacePaneNode): TerminalWorkspacePaneNode {
  return {
    kind: "pane",
    id: node.id,
    sessionId: node.sessionId,
    title: node.title,
    minColumns: node.minColumns,
    minRows: node.minRows,
  };
}

function updateTerminalWorkspacePaneRuntimeTitles(
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

function pruneTerminalWorkspaceLayoutSessions(
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

function collectTerminalWorkspacePanes(
  node: TerminalWorkspaceLayoutNode | undefined,
): TerminalWorkspacePaneNode[] {
  const panes: TerminalWorkspacePaneNode[] = [];
  collectTerminalWorkspacePanesInto(node, panes);
  return panes;
}

function replaceTerminalWorkspacePane(
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

function removeTerminalWorkspacePane(
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

function updateTerminalWorkspaceSplitRatio(
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

function findNearestTerminalWorkspaceSplit(
  node: TerminalWorkspaceLayoutNode | undefined,
  paneId: string,
): { split: TerminalWorkspaceSplitNode; activeSide: "first" | "second" } | undefined {
  return findNearestTerminalWorkspaceSplitSearch(node, paneId).nearest;
}

function uniqueTerminalWorkspaceLayoutId(prefix: string, root?: TerminalWorkspaceLayoutNode): string {
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

function sanitizeTerminalWorkspaceLayoutId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "terminal";
}

function clampTerminalWorkspaceSplitRatio(value: number): number {
  return Math.max(0.1, Math.min(0.9, Number.isFinite(value) ? value : 0.5));
}

function descriptorFromTerminalTemplate(
  template: TerminalTemplate,
  options: AddTerminalWorkspaceSessionOptions,
  now: number,
): TerminalSessionDescriptor {
  if (!isSpawnTerminalTemplate(template)) {
    return {
      ...describeAttachTerminalTemplate(template, now),
      title: options.title ?? template.title,
      backendId: options.backendId,
      columns: normalizeTerminalWorkspaceDimension(options.columns),
      rows: normalizeTerminalWorkspaceDimension(options.rows),
      status: options.status,
      running: options.running,
      detached: false,
    };
  }
  const commandLine = formatProcessCommandLine(template);
  return {
    id: template.id,
    title: options.title ?? template.title,
    template: cloneTerminalTemplate(template),
    backendId: options.backendId,
    commandLine,
    status: options.status ?? "idle",
    running: options.running ?? false,
    columns: normalizeTerminalWorkspaceDimension(options.columns ?? template.columns),
    rows: normalizeTerminalWorkspaceDimension(options.rows ?? template.rows),
    reconnectable: template.reconnectable ?? false,
    restartPolicy: template.restartPolicy ?? "never",
    createdAt: now,
    updatedAt: now,
  };
}

function cloneTerminalSessionDescriptor(descriptor: TerminalSessionDescriptor): TerminalSessionDescriptor {
  return {
    ...descriptor,
    template: cloneTerminalTemplate(descriptor.template),
  };
}

function duplicateTerminalSessionDescriptor(
  source: TerminalSessionDescriptor,
  sessions: readonly TerminalSessionDescriptor[],
  options: DuplicateTerminalWorkspaceSessionOptions,
  now: number,
): TerminalSessionDescriptor {
  const ids = new Set<string>();
  for (let index = 0; index < sessions.length; index += 1) ids.add(sessions[index]!.id);
  const id = uniqueTerminalWorkspaceSessionId(options.id ?? `${source.id}-copy`, ids);
  const title = options.title ?? `${source.title} Copy`;
  const template = cloneTerminalTemplate(source.template);
  template.id = id;
  template.title = title;

  const descriptor: TerminalSessionDescriptor = {
    ...cloneTerminalSessionDescriptor(source),
    id,
    title,
    runtimeTitle: undefined,
    template,
    status: isSpawnTerminalTemplate(template) ? "idle" : source.status,
    running: isSpawnTerminalTemplate(template) ? false : source.running,
    detached: false,
    createdAt: now,
    updatedAt: now,
  };
  if (isSpawnTerminalTemplate(template)) descriptor.commandLine = formatProcessCommandLine(template);
  return descriptor;
}

function shouldAdoptRuntimeTitle(
  descriptor: TerminalSessionDescriptor,
  previousRuntimeTitle: string | undefined,
): boolean {
  return descriptor.title === descriptor.template.title ||
    descriptor.title === previousRuntimeTitle ||
    descriptor.title === descriptor.runtimeTitle;
}

function cloneTerminalTemplate(template: TerminalTemplate): TerminalTemplate {
  if (!isSpawnTerminalTemplate(template)) {
    return {
      ...template,
      metadata: template.metadata ? { ...template.metadata } : undefined,
    };
  }
  return {
    ...template,
    args: template.args ? [...template.args] : undefined,
    env: template.env ? { ...template.env } : undefined,
    metadata: template.metadata ? { ...template.metadata } : undefined,
  };
}

function normalizeTerminalWorkspaceDimension(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value!));
}

function uniqueTerminalWorkspaceSessionId(prefix: string, ids: ReadonlySet<string>): string {
  const base = sanitizeTerminalWorkspaceLayoutId(prefix);
  let candidate = base;
  let suffix = 2;
  while (ids.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
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

function normalizeTerminalWorkspaceLayout(
  layout: TerminalWorkspaceLayoutState | undefined,
  sessions: readonly TerminalSessionDescriptor[],
  activeId: string | undefined,
): TerminalWorkspaceLayoutState {
  const sessionIds = new Set<string>();
  for (const session of sessions) sessionIds.add(session.id);
  const pruned = pruneTerminalWorkspaceLayoutSessions(layout ?? {}, sessionIds);
  if (!pruned.root && activeId && sessionIds.has(activeId)) {
    const activeSession = findTerminalSession(sessions, activeId);
    return terminalWorkspaceLayoutWithActive({
      root: createTerminalWorkspacePaneNode(activeId, undefined, { title: activeSession?.title }),
      zoomedPaneId: undefined,
    }, activeId);
  }
  const activePane = pruned.activePaneId ? findTerminalWorkspacePaneRef(pruned.root, pruned.activePaneId) : undefined;
  const fallbackPane = activeId ? findTerminalWorkspacePaneBySessionRef(pruned.root, activeId) : undefined;
  const firstPane = firstTerminalWorkspacePaneRef(pruned.root);
  const nextActive = activePane ?? fallbackPane ?? firstPane;
  return {
    root: pruned.root,
    activePaneId: nextActive?.id,
    zoomedPaneId: pruned.zoomedPaneId && findTerminalWorkspacePaneRef(pruned.root, pruned.zoomedPaneId)
      ? pruned.zoomedPaneId
      : undefined,
  };
}

function cloneTerminalWorkspaceLayoutState(layout: TerminalWorkspaceLayoutState): TerminalWorkspaceLayoutState {
  return {
    root: layout.root ? cloneTerminalWorkspaceLayoutNode(layout.root) : undefined,
    activePaneId: layout.activePaneId,
    zoomedPaneId: layout.zoomedPaneId,
  };
}

function findTerminalSession(
  sessions: readonly TerminalSessionDescriptor[],
  id: string | undefined,
): TerminalSessionDescriptor | undefined {
  if (!id) return undefined;
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index]!;
    if (session.id === id) return session;
  }
  return undefined;
}

function hasTerminalSession(sessions: readonly TerminalSessionDescriptor[], id: string): boolean {
  return findTerminalSession(sessions, id) !== undefined;
}

function terminalSessionIndex(sessions: readonly TerminalSessionDescriptor[], id: string): number {
  for (let index = 0; index < sessions.length; index += 1) {
    if (sessions[index]!.id === id) return index;
  }
  return -1;
}

function moveTerminalSession(
  sessions: readonly TerminalSessionDescriptor[],
  fromIndex: number,
  toIndex: number,
): TerminalSessionDescriptor[] {
  const moved = sessions[fromIndex]!;
  const next = new Array<TerminalSessionDescriptor>(sessions.length);
  let write = 0;
  for (let index = 0; index < sessions.length; index += 1) {
    if (write === toIndex) next[write++] = moved;
    if (index === fromIndex) continue;
    next[write++] = sessions[index]!;
  }
  if (write < next.length) next[write] = moved;
  return next;
}

function inspectTerminalWorkspaceLayout(
  layout: TerminalWorkspaceLayoutState,
  sessions: readonly TerminalSessionDescriptor[],
): TerminalWorkspaceLayoutInspection {
  const normalized = normalizeTerminalWorkspaceLayout(layout, sessions, sessions[0]?.id);
  const sessionById = new Map<string, TerminalSessionDescriptor>();
  for (const session of sessions) sessionById.set(session.id, session);
  const sourcePanes = collectTerminalWorkspacePanes(normalized.root);
  const panes = new Array<TerminalWorkspacePaneInspection>(sourcePanes.length);
  for (let index = 0; index < sourcePanes.length; index += 1) {
    const pane = sourcePanes[index]!;
    const session = sessionById.get(pane.sessionId);
    panes[index] = {
      ...cloneTerminalWorkspacePaneNode(pane),
      active: pane.id === normalized.activePaneId,
      zoomed: pane.id === normalized.zoomedPaneId,
      session: session ? cloneTerminalSessionDescriptor(session) : undefined,
    };
  }
  return {
    root: normalized.root ? cloneTerminalWorkspaceLayoutNode(normalized.root) : undefined,
    activePaneId: normalized.activePaneId,
    zoomedPaneId: normalized.zoomedPaneId,
    panes,
    count: panes.length,
  };
}

function appendTerminalSession(
  sessions: readonly TerminalSessionDescriptor[],
  descriptor: TerminalSessionDescriptor,
): TerminalSessionDescriptor[] {
  const next = new Array<TerminalSessionDescriptor>(sessions.length + 1);
  for (let index = 0; index < sessions.length; index += 1) next[index] = sessions[index]!;
  next[sessions.length] = descriptor;
  return next;
}

function replaceTerminalSession(
  sessions: readonly TerminalSessionDescriptor[],
  index: number,
  descriptor: TerminalSessionDescriptor,
): TerminalSessionDescriptor[] {
  const next = new Array<TerminalSessionDescriptor>(sessions.length);
  for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
    next[sessionIndex] = sessionIndex === index ? descriptor : sessions[sessionIndex]!;
  }
  return next;
}

function removeTerminalSessionAt(
  sessions: readonly TerminalSessionDescriptor[],
  index: number,
): TerminalSessionDescriptor[] {
  const next = new Array<TerminalSessionDescriptor>(Math.max(0, sessions.length - 1));
  let target = 0;
  for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
    if (sessionIndex === index) continue;
    next[target] = sessions[sessionIndex]!;
    target += 1;
  }
  return next;
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

function findActiveTerminalWorkspacePaneRef(
  layout: TerminalWorkspaceLayoutState,
): TerminalWorkspacePaneNode | undefined {
  return layout.activePaneId
    ? findTerminalWorkspacePaneRef(layout.root, layout.activePaneId)
    : firstTerminalWorkspacePaneRef(layout.root);
}

function firstTerminalWorkspacePaneRef(
  node: TerminalWorkspaceLayoutNode | undefined,
): TerminalWorkspacePaneNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node;
  return firstTerminalWorkspacePaneRef(node.first) ?? firstTerminalWorkspacePaneRef(node.second);
}
