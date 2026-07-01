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
    const descriptor = descriptorFromTemplate(template, options, this.#now());
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
      this.layout.value = layoutWithActive({
        root: createPaneNode(nextDescriptor.id, undefined, { title: nextDescriptor.title }),
      }, nextDescriptor.id);
    }
    return cloneTerminalSessionDescriptor(nextDescriptor);
  }

  activate(id: string): boolean {
    if (!this.sessions.peek().some((session) => session.id === id)) return false;
    this.activeId.value = id;
    const layout = this.layout.peek();
    const pane = findPaneBySession(layout.root, id);
    if (pane) this.layout.value = { ...cloneLayoutState(layout), activePaneId: pane.id };
    else if (!layout.root) this.layout.value = layoutWithActive({ root: createPaneNode(id) }, id);
    return true;
  }

  remove(id: string): boolean {
    const sessions = this.sessions.peek();
    const index = sessions.findIndex((session) => session.id === id);
    if (index < 0) return false;
    const next = sessions.filter((session) => session.id !== id);
    this.sessions.value = next;
    this.layout.value = normalizeTerminalWorkspaceLayout(
      pruneLayoutSessions(
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
      const pane = this.activeId.peek() ? findPaneBySession(this.layout.peek().root, this.activeId.peek()!) : undefined;
      if (pane) this.layout.value = { ...cloneLayoutState(this.layout.peek()), activePaneId: pane.id };
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
      this.layout.value = updatePaneRuntimeTitles(
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
      const pane = createPaneNode(sessionId, undefined, options);
      this.layout.value = { root: pane, activePaneId: pane.id };
      this.activeId.value = sessionId;
      return clonePaneNode(pane);
    }

    const activePane = options.paneId ? findPane(current.root, options.paneId) : findActivePane(current);
    if (!activePane) return undefined;
    const nextPane = createPaneNode(sessionId, current.root, options);
    const ratio = clampRatio(options.ratio ?? 0.5);
    const placement = options.placement ?? "after";
    const split: TerminalWorkspaceSplitNode = {
      kind: "split",
      id: uniqueLayoutId("split", current.root),
      direction,
      ratio,
      first: placement === "before" ? nextPane : clonePaneNode(activePane),
      second: placement === "before" ? clonePaneNode(activePane) : nextPane,
    };
    const root = replacePane(current.root, activePane.id, split);
    this.layout.value = {
      root,
      activePaneId: nextPane.id,
      zoomedPaneId: current.zoomedPaneId === activePane.id ? nextPane.id : current.zoomedPaneId,
    };
    this.activeId.value = sessionId;
    return clonePaneNode(nextPane);
  }

  activatePane(paneId: string): boolean {
    const pane = findPane(this.layout.peek().root, paneId);
    if (!pane || !this.sessions.peek().some((session) => session.id === pane.sessionId)) return false;
    this.layout.value = { ...cloneLayoutState(this.layout.peek()), activePaneId: pane.id };
    this.activeId.value = pane.sessionId;
    return true;
  }

  closePane(paneId: string): boolean {
    const current = cloneLayoutState(this.layout.peek());
    if (!findPane(current.root, paneId)) return false;
    const root = removePane(current.root, paneId);
    const panes = collectPanes(root);
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
    const current = cloneLayoutState(this.layout.peek());
    const root = updateSplitRatio(current.root, splitId, clampRatio(ratio));
    if (!root.changed) return false;
    this.layout.value = { ...current, root: root.node };
    return true;
  }

  resizeActiveSplit(delta: number): boolean {
    const current = cloneLayoutState(this.layout.peek());
    const activePane = findActivePane(current);
    if (!activePane) return false;
    const nearest = findNearestSplit(current.root, activePane.id);
    if (!nearest) return false;
    const nextRatio = nearest.activeSide === "first" ? nearest.split.ratio + delta : nearest.split.ratio - delta;
    return this.resizeSplit(nearest.split.id, nextRatio);
  }

  toggleZoomPane(paneId = this.layout.peek().activePaneId): boolean {
    if (!paneId || !findPane(this.layout.peek().root, paneId)) return false;
    const current = cloneLayoutState(this.layout.peek());
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
  const normalizedBounds = normalizeRect(bounds);
  if (!layout.root || normalizedBounds.width <= 0 || normalizedBounds.height <= 0) return [];
  if (options.respectZoom !== false && layout.zoomedPaneId) {
    const pane = findPane(layout.root, layout.zoomedPaneId);
    if (pane) {
      return [{
        pane,
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

function descriptorFromTemplate(
  template: TerminalTemplate,
  options: AddTerminalWorkspaceSessionOptions,
  now: number,
): TerminalSessionDescriptor {
  if (!isSpawnTerminalTemplate(template)) {
    return {
      ...describeAttachTerminalTemplate(template, now),
      title: options.title ?? template.title,
      backendId: options.backendId,
      columns: normalizeDimension(options.columns),
      rows: normalizeDimension(options.rows),
      status: options.status,
      running: options.running,
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
    columns: normalizeDimension(options.columns ?? template.columns),
    rows: normalizeDimension(options.rows ?? template.rows),
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

function normalizeDimension(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value!));
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
      pane: clonePaneNode(node),
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
    const firstWidth = clampSplitSize(Math.floor(available * clampRatio(split.ratio)), available);
    const secondWidth = Math.max(0, available - firstWidth);
    return [
      { ...rect, width: firstWidth },
      { column: rect.column + firstWidth + safeGap, row: rect.row, width: secondWidth, height: rect.height },
    ];
  }
  const available = Math.max(0, rect.height - safeGap);
  const firstHeight = clampSplitSize(Math.floor(available * clampRatio(split.ratio)), available);
  const secondHeight = Math.max(0, available - firstHeight);
  return [
    { ...rect, height: firstHeight },
    { column: rect.column, row: rect.row + firstHeight + safeGap, width: rect.width, height: secondHeight },
  ];
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

function normalizeTerminalWorkspaceLayout(
  layout: TerminalWorkspaceLayoutState | undefined,
  sessions: readonly TerminalSessionDescriptor[],
  activeId: string | undefined,
): TerminalWorkspaceLayoutState {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const pruned = pruneLayoutSessions(layout ?? {}, sessionIds);
  if (!pruned.root && activeId && sessionIds.has(activeId)) {
    const activeSession = sessions.find((session) => session.id === activeId);
    return layoutWithActive({
      root: createPaneNode(activeId, undefined, { title: activeSession?.title }),
      zoomedPaneId: undefined,
    }, activeId);
  }
  const activePane = pruned.activePaneId ? findPane(pruned.root, pruned.activePaneId) : undefined;
  const fallbackPane = activeId ? findPaneBySession(pruned.root, activeId) : undefined;
  const firstPane = collectPanes(pruned.root)[0];
  const nextActive = activePane ?? fallbackPane ?? firstPane;
  return {
    root: pruned.root,
    activePaneId: nextActive?.id,
    zoomedPaneId: pruned.zoomedPaneId && findPane(pruned.root, pruned.zoomedPaneId) ? pruned.zoomedPaneId : undefined,
  };
}

function inspectTerminalWorkspaceLayout(
  layout: TerminalWorkspaceLayoutState,
  sessions: readonly TerminalSessionDescriptor[],
): TerminalWorkspaceLayoutInspection {
  const normalized = normalizeTerminalWorkspaceLayout(layout, sessions, sessions[0]?.id);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const panes = collectPanes(normalized.root).map((pane) => ({
    ...clonePaneNode(pane),
    active: pane.id === normalized.activePaneId,
    zoomed: pane.id === normalized.zoomedPaneId,
    session: sessionById.has(pane.sessionId)
      ? cloneTerminalSessionDescriptor(sessionById.get(pane.sessionId)!)
      : undefined,
  }));
  return {
    root: normalized.root ? cloneLayoutNode(normalized.root) : undefined,
    activePaneId: normalized.activePaneId,
    zoomedPaneId: normalized.zoomedPaneId,
    panes,
    count: panes.length,
  };
}

function layoutWithActive(layout: TerminalWorkspaceLayoutState, sessionId: string): TerminalWorkspaceLayoutState {
  const pane = findPaneBySession(layout.root, sessionId) ?? collectPanes(layout.root)[0];
  return {
    root: layout.root ? cloneLayoutNode(layout.root) : undefined,
    activePaneId: pane?.id,
    zoomedPaneId: layout.zoomedPaneId,
  };
}

function createPaneNode(
  sessionId: string,
  root?: TerminalWorkspaceLayoutNode,
  options: { title?: string; minColumns?: number; minRows?: number } = {},
): TerminalWorkspacePaneNode {
  return {
    kind: "pane",
    id: uniqueLayoutId(`pane-${sanitizeLayoutId(sessionId)}`, root),
    sessionId,
    title: options.title,
    minColumns: normalizeDimension(options.minColumns),
    minRows: normalizeDimension(options.minRows),
  };
}

function cloneLayoutState(layout: TerminalWorkspaceLayoutState): TerminalWorkspaceLayoutState {
  return {
    root: layout.root ? cloneLayoutNode(layout.root) : undefined,
    activePaneId: layout.activePaneId,
    zoomedPaneId: layout.zoomedPaneId,
  };
}

function cloneLayoutNode(node: TerminalWorkspaceLayoutNode): TerminalWorkspaceLayoutNode {
  return node.kind === "pane" ? clonePaneNode(node) : {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: cloneLayoutNode(node.first),
    second: cloneLayoutNode(node.second),
  };
}

function clonePaneNode(node: TerminalWorkspacePaneNode): TerminalWorkspacePaneNode {
  return {
    kind: "pane",
    id: node.id,
    sessionId: node.sessionId,
    title: node.title,
    minColumns: node.minColumns,
    minRows: node.minRows,
  };
}

function updatePaneRuntimeTitles(
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

function updatePaneRuntimeTitleNode(
  node: TerminalWorkspaceLayoutNode,
  sessionId: string,
  runtimeTitle: string,
  previousVisibleTitle: string,
  previousRuntimeTitle: string | undefined,
  templateTitle: string,
): TerminalWorkspaceLayoutNode {
  if (node.kind === "pane") {
    const pane = clonePaneNode(node);
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

function pruneLayoutSessions(
  layout: TerminalWorkspaceLayoutState,
  sessionIds: ReadonlySet<string>,
): TerminalWorkspaceLayoutState {
  const root = pruneLayoutNode(layout.root, sessionIds);
  return {
    root,
    activePaneId: layout.activePaneId && findPane(root, layout.activePaneId) ? layout.activePaneId : undefined,
    zoomedPaneId: layout.zoomedPaneId && findPane(root, layout.zoomedPaneId) ? layout.zoomedPaneId : undefined,
  };
}

function pruneLayoutNode(
  node: TerminalWorkspaceLayoutNode | undefined,
  sessionIds: ReadonlySet<string>,
): TerminalWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return sessionIds.has(node.sessionId) ? clonePaneNode(node) : undefined;
  const first = pruneLayoutNode(node.first, sessionIds);
  const second = pruneLayoutNode(node.second, sessionIds);
  if (first && second) return { ...node, ratio: clampRatio(node.ratio), first, second };
  return first ?? second;
}

function collectPanes(node: TerminalWorkspaceLayoutNode | undefined): TerminalWorkspacePaneNode[] {
  if (!node) return [];
  if (node.kind === "pane") return [clonePaneNode(node)];
  return [...collectPanes(node.first), ...collectPanes(node.second)];
}

function findPane(
  node: TerminalWorkspaceLayoutNode | undefined,
  paneId: string,
): TerminalWorkspacePaneNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.id === paneId ? clonePaneNode(node) : undefined;
  return findPane(node.first, paneId) ?? findPane(node.second, paneId);
}

function findPaneBySession(
  node: TerminalWorkspaceLayoutNode | undefined,
  sessionId: string,
): TerminalWorkspacePaneNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.sessionId === sessionId ? clonePaneNode(node) : undefined;
  return findPaneBySession(node.first, sessionId) ?? findPaneBySession(node.second, sessionId);
}

function findActivePane(layout: TerminalWorkspaceLayoutState): TerminalWorkspacePaneNode | undefined {
  return layout.activePaneId ? findPane(layout.root, layout.activePaneId) : collectPanes(layout.root)[0];
}

function replacePane(
  node: TerminalWorkspaceLayoutNode,
  paneId: string,
  replacement: TerminalWorkspaceLayoutNode,
): TerminalWorkspaceLayoutNode {
  if (node.kind === "pane") return node.id === paneId ? cloneLayoutNode(replacement) : clonePaneNode(node);
  return {
    ...node,
    first: replacePane(node.first, paneId, replacement),
    second: replacePane(node.second, paneId, replacement),
  };
}

function removePane(
  node: TerminalWorkspaceLayoutNode | undefined,
  paneId: string,
): TerminalWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.id === paneId ? undefined : clonePaneNode(node);
  const first = removePane(node.first, paneId);
  const second = removePane(node.second, paneId);
  if (first && second) return { ...node, first, second };
  return first ?? second;
}

function updateSplitRatio(
  node: TerminalWorkspaceLayoutNode | undefined,
  splitId: string,
  ratio: number,
): { node?: TerminalWorkspaceLayoutNode; changed: boolean } {
  if (!node) return { changed: false };
  if (node.kind === "pane") return { node: clonePaneNode(node), changed: false };
  if (node.id === splitId) {
    return {
      node: { ...node, ratio, first: cloneLayoutNode(node.first), second: cloneLayoutNode(node.second) },
      changed: true,
    };
  }
  const first = updateSplitRatio(node.first, splitId, ratio);
  const second = updateSplitRatio(node.second, splitId, ratio);
  return {
    node: {
      ...node,
      first: first.node ?? cloneLayoutNode(node.first),
      second: second.node ?? cloneLayoutNode(node.second),
    },
    changed: first.changed || second.changed,
  };
}

function findNearestSplit(
  node: TerminalWorkspaceLayoutNode | undefined,
  paneId: string,
): { split: TerminalWorkspaceSplitNode; activeSide: "first" | "second" } | undefined {
  if (!node || node.kind === "pane") return undefined;
  if (findPane(node.first, paneId)) {
    return findNearestSplit(node.first, paneId) ?? { split: cloneSplitNode(node), activeSide: "first" };
  }
  if (findPane(node.second, paneId)) {
    return findNearestSplit(node.second, paneId) ?? { split: cloneSplitNode(node), activeSide: "second" };
  }
  return undefined;
}

function cloneSplitNode(node: TerminalWorkspaceSplitNode): TerminalWorkspaceSplitNode {
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: cloneLayoutNode(node.first),
    second: cloneLayoutNode(node.second),
  };
}

function uniqueLayoutId(prefix: string, root?: TerminalWorkspaceLayoutNode): string {
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

function collectLayoutIds(node: TerminalWorkspaceLayoutNode | undefined, ids: Set<string>): void {
  if (!node) return;
  ids.add(node.id);
  if (node.kind === "split") {
    collectLayoutIds(node.first, ids);
    collectLayoutIds(node.second, ids);
  }
}

function sanitizeLayoutId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "terminal";
}

function clampRatio(value: number): number {
  return Math.max(0.1, Math.min(0.9, Number.isFinite(value) ? value : 0.5));
}
