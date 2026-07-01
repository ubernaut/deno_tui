// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { Rectangle } from "../types.ts";
import {
  clampTerminalWorkspaceSplitRatio,
  cloneTerminalWorkspaceLayoutNode,
  cloneTerminalWorkspaceLayoutState,
  cloneTerminalWorkspacePaneNode,
  collectTerminalWorkspacePanes,
  createTerminalWorkspacePaneNode,
  findActiveTerminalWorkspacePane,
  findNearestTerminalWorkspaceSplit,
  findTerminalWorkspacePane,
  findTerminalWorkspacePaneBySession,
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
import { type TerminalSessionDescriptor, type TerminalTemplate } from "./terminal_templates.ts";

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
    const sessions = (options.sessions ?? []).map((session) => cloneTerminalSessionDescriptor(session));
    const activeId = options.activeId && sessions.some((session) => session.id === options.activeId)
      ? options.activeId
      : sessions[0]?.id;
    this.sessions = new Signal(sessions);
    this.activeId = new Signal<string | undefined>(activeId);
    this.layout = new Signal(normalizeTerminalWorkspaceLayout(options.layout, sessions, activeId));
  }

  get active(): TerminalSessionDescriptor | undefined {
    const id = this.activeId.peek();
    return id ? this.sessions.peek().find((session) => session.id === id) : undefined;
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
    const index = sessions.findIndex((session) => session.id === nextDescriptor.id);
    this.sessions.value = index >= 0
      ? sessions.map((session, sessionIndex) => sessionIndex === index ? nextDescriptor : session)
      : [...sessions, nextDescriptor];
    if (options.activate || !this.activeId.peek()) this.activeId.value = nextDescriptor.id;
    if (!this.layout.peek().root) {
      this.layout.value = terminalWorkspaceLayoutWithActive({
        root: createTerminalWorkspacePaneNode(nextDescriptor.id, undefined, { title: nextDescriptor.title }),
      }, nextDescriptor.id);
    }
    return cloneTerminalSessionDescriptor(nextDescriptor);
  }

  activate(id: string): boolean {
    if (!this.sessions.peek().some((session) => session.id === id)) return false;
    this.activeId.value = id;
    const layout = this.layout.peek();
    const pane = findTerminalWorkspacePaneBySession(layout.root, id);
    if (pane) this.layout.value = { ...cloneTerminalWorkspaceLayoutState(layout), activePaneId: pane.id };
    else if (!layout.root) {
      this.layout.value = terminalWorkspaceLayoutWithActive({ root: createTerminalWorkspacePaneNode(id) }, id);
    }
    return true;
  }

  remove(id: string): boolean {
    const sessions = this.sessions.peek();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) return false;
    const next = sessions.filter((session) => session.id !== id);
    this.sessions.value = next;
    this.layout.value = normalizeTerminalWorkspaceLayout(
      pruneTerminalWorkspaceLayoutSessions(
        this.layout.peek(),
        new Set(next.map(
          (session) => session.id,
        )),
      ),
      next,
      this.activeId.peek(),
    );
    if (this.activeId.peek() === id) {
      this.activeId.value = next[index]?.id ?? next[index - 1]?.id;
      const pane = this.activeId.peek()
        ? findTerminalWorkspacePaneBySession(this.layout.peek().root, this.activeId.peek()!)
        : undefined;
      if (pane) this.layout.value = { ...cloneTerminalWorkspaceLayoutState(this.layout.peek()), activePaneId: pane.id };
    }
    return true;
  }

  rename(id: string, title: string): boolean {
    const trimmed = title.trim();
    if (!trimmed) return false;
    const sessions = this.sessions.peek();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) return false;
    const descriptor = cloneTerminalSessionDescriptor(sessions[index]!);
    descriptor.title = trimmed;
    descriptor.updatedAt = this.#now();
    this.sessions.value = sessions.map((session, sessionIndex) => sessionIndex === index ? descriptor : session);
    return true;
  }

  updateRuntimeTitle(id: string, title: string | undefined): boolean {
    const trimmed = title?.trim();
    if (!trimmed) return false;
    const sessions = this.sessions.peek();
    const index = sessions.findIndex((session) => session.id === id);
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
    this.sessions.value = sessions.map((session, sessionIndex) => sessionIndex === index ? descriptor : session);
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
    const sessions = [...this.sessions.peek()];
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0 || sessions.length < 2) return false;
    const nextIndex = Math.max(0, Math.min(sessions.length - 1, index + Math.trunc(delta)));
    if (nextIndex === index) return false;
    const [session] = sessions.splice(index, 1);
    sessions.splice(nextIndex, 0, session!);
    this.sessions.value = sessions;
    return true;
  }

  duplicate(
    id = this.activeId.peek(),
    options: DuplicateTerminalWorkspaceSessionOptions = {},
  ): TerminalSessionDescriptor | undefined {
    if (!id) return undefined;
    const sessions = this.sessions.peek();
    const source = sessions.find((session) => session.id === id);
    if (!source) return undefined;

    const descriptor = duplicateTerminalSessionDescriptor(source, sessions, options, this.#now());
    return this.upsert(descriptor, { activate: options.activate ?? true });
  }

  detach(id = this.activeId.peek()): boolean {
    if (!id) return false;
    const sessions = this.sessions.peek();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) return false;
    const descriptor = cloneTerminalSessionDescriptor(sessions[index]!);
    descriptor.detached = true;
    descriptor.reconnectable = true;
    descriptor.running = false;
    descriptor.updatedAt = this.#now();
    this.sessions.value = sessions.map((session, sessionIndex) => sessionIndex === index ? descriptor : session);
    return true;
  }

  attach(id = this.activeId.peek()): boolean {
    if (!id) return false;
    const sessions = this.sessions.peek();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) return false;
    const descriptor = cloneTerminalSessionDescriptor(sessions[index]!);
    if (!descriptor.detached) return false;
    descriptor.detached = false;
    descriptor.updatedAt = this.#now();
    this.sessions.value = sessions.map((session, sessionIndex) => sessionIndex === index ? descriptor : session);
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
    if (!this.sessions.peek().some((session) => session.id === sessionId)) return undefined;
    const current = normalizeTerminalWorkspaceLayout(this.layout.peek(), this.sessions.peek(), this.activeId.peek());
    if (!current.root) {
      const pane = createTerminalWorkspacePaneNode(sessionId, undefined, options);
      this.layout.value = { root: pane, activePaneId: pane.id };
      this.activeId.value = sessionId;
      return cloneTerminalWorkspacePaneNode(pane);
    }

    const activePane = options.paneId
      ? findTerminalWorkspacePane(current.root, options.paneId)
      : findActiveTerminalWorkspacePane(current);
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
    const pane = findTerminalWorkspacePane(this.layout.peek().root, paneId);
    if (!pane || !this.sessions.peek().some((session) => session.id === pane.sessionId)) return false;
    this.layout.value = { ...cloneTerminalWorkspaceLayoutState(this.layout.peek()), activePaneId: pane.id };
    this.activeId.value = pane.sessionId;
    return true;
  }

  closePane(paneId: string): boolean {
    const current = cloneTerminalWorkspaceLayoutState(this.layout.peek());
    if (!findTerminalWorkspacePane(current.root, paneId)) return false;
    const root = removeTerminalWorkspacePane(current.root, paneId);
    const panes = collectTerminalWorkspacePanes(root);
    const activePane = panes.find((pane) => pane.id === current.activePaneId) ?? panes[0];
    this.layout.value = {
      root,
      activePaneId: activePane?.id,
      zoomedPaneId: current.zoomedPaneId === paneId ? undefined : current.zoomedPaneId,
    };
    if (activePane) this.activeId.value = activePane.sessionId;
    return true;
  }

  resizeSplit(splitId: string, ratio: number): boolean {
    const current = cloneTerminalWorkspaceLayoutState(this.layout.peek());
    const root = updateTerminalWorkspaceSplitRatio(current.root, splitId, clampTerminalWorkspaceSplitRatio(ratio));
    if (!root.changed) return false;
    this.layout.value = { ...current, root: root.node };
    return true;
  }

  resizeActiveSplit(delta: number): boolean {
    const current = cloneTerminalWorkspaceLayoutState(this.layout.peek());
    const activePane = findActiveTerminalWorkspacePane(current);
    if (!activePane) return false;
    const nearest = findNearestTerminalWorkspaceSplit(current.root, activePane.id);
    if (!nearest) return false;
    const nextRatio = nearest.activeSide === "first" ? nearest.split.ratio + delta : nearest.split.ratio - delta;
    return this.resizeSplit(nearest.split.id, nextRatio);
  }

  toggleZoomPane(paneId = this.layout.peek().activePaneId): boolean {
    if (!paneId || !findTerminalWorkspacePane(this.layout.peek().root, paneId)) return false;
    const current = cloneTerminalWorkspaceLayoutState(this.layout.peek());
    this.layout.value = {
      ...current,
      activePaneId: paneId,
      zoomedPaneId: current.zoomedPaneId === paneId ? undefined : paneId,
    };
    return true;
  }

  inspectLayout(): TerminalWorkspaceLayoutInspection {
    return inspectTerminalWorkspaceLayout(this.layout.peek(), this.sessions.peek());
  }

  inspect(): TerminalWorkspaceInspection {
    const sessions = this.sessions.peek().map((session) => cloneTerminalSessionDescriptor(session));
    const activeId = this.activeId.peek();
    const active = activeId ? sessions.find((session) => session.id === activeId) : undefined;
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
  const sessionIds = new Set(sessions.map((session) => session.id));
  const pruned = pruneTerminalWorkspaceLayoutSessions(layout ?? {}, sessionIds);
  if (!pruned.root && activeId && sessionIds.has(activeId)) {
    const activeSession = sessions.find((session) => session.id === activeId);
    return terminalWorkspaceLayoutWithActive({
      root: createTerminalWorkspacePaneNode(activeId, undefined, { title: activeSession?.title }),
      zoomedPaneId: undefined,
    }, activeId);
  }
  const activePane = pruned.activePaneId ? findTerminalWorkspacePane(pruned.root, pruned.activePaneId) : undefined;
  const fallbackPane = activeId ? findTerminalWorkspacePaneBySession(pruned.root, activeId) : undefined;
  const firstPane = collectTerminalWorkspacePanes(pruned.root)[0];
  const nextActive = activePane ?? fallbackPane ?? firstPane;
  return {
    root: pruned.root,
    activePaneId: nextActive?.id,
    zoomedPaneId: pruned.zoomedPaneId && findTerminalWorkspacePane(pruned.root, pruned.zoomedPaneId)
      ? pruned.zoomedPaneId
      : undefined,
  };
}

function inspectTerminalWorkspaceLayout(
  layout: TerminalWorkspaceLayoutState,
  sessions: readonly TerminalSessionDescriptor[],
): TerminalWorkspaceLayoutInspection {
  const normalized = normalizeTerminalWorkspaceLayout(layout, sessions, sessions[0]?.id);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const panes = collectTerminalWorkspacePanes(normalized.root).map((pane) => ({
    ...cloneTerminalWorkspacePaneNode(pane),
    active: pane.id === normalized.activePaneId,
    zoomed: pane.id === normalized.zoomedPaneId,
    session: sessionById.has(pane.sessionId)
      ? cloneTerminalSessionDescriptor(sessionById.get(pane.sessionId)!)
      : undefined,
  }));
  return {
    root: normalized.root ? cloneTerminalWorkspaceLayoutNode(normalized.root) : undefined,
    activePaneId: normalized.activePaneId,
    zoomedPaneId: normalized.zoomedPaneId,
    panes,
    count: panes.length,
  };
}
