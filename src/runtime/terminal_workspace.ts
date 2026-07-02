// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { Rectangle } from "../types.ts";
import {
  clampTerminalWorkspaceSplitRatio,
  cloneTerminalWorkspaceLayoutNode,
  cloneTerminalWorkspacePaneNode,
  collectTerminalWorkspacePanes,
  createTerminalWorkspacePaneNode,
  findNearestTerminalWorkspaceSplit,
  pruneTerminalWorkspaceLayoutSessions,
  removeTerminalWorkspacePane,
  replaceTerminalWorkspacePane,
  terminalWorkspaceLayoutWithActive,
  terminalWorkspacePaneRects as projectTerminalWorkspacePaneRects,
  uniqueTerminalWorkspaceLayoutId,
  updateTerminalWorkspacePaneRuntimeTitles,
  updateTerminalWorkspaceSplitRatio,
} from "./terminal_workspace_layout.ts";
import {
  cloneTerminalSessionDescriptor,
  descriptorFromTerminalTemplate,
  duplicateTerminalSessionDescriptor,
  shouldAdoptRuntimeTitle,
} from "./terminal_workspace_sessions.ts";
import {
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

/** Projects a terminal workspace pane tree into terminal-cell rectangles. */
export function terminalWorkspacePaneRects(
  layout: TerminalWorkspaceLayoutState,
  bounds: Rectangle,
  options: TerminalWorkspacePaneRectOptions = {},
): TerminalWorkspacePaneRect[] {
  return projectTerminalWorkspacePaneRects(layout, bounds, options);
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
