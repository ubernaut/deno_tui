// Copyright 2023 Im-Beast. MIT license.

import {
  type AsyncStore,
  Computed,
  type DiagnosticsCollector,
  type Rectangle,
  Signal,
  TerminalScreenController,
  TerminalScrollbackController,
  type WorkbenchWindowHostDescriptor,
  type WorkbenchWindowHostProjection,
  type WorkbenchWindowHostResult,
} from "../../../mod.ts";
import {
  ShowcaseKernel,
  type ShowcaseProvider,
  type ShowcaseProviderActivationContext,
  type ShowcaseProviderActivationResult,
} from "../shared/mod.ts";
import {
  initialMuxstoneWorkspaceState,
  isMuxstoneSessionId,
  MUXSTONE_MANIFEST,
  MUXSTONE_MAX_COLUMNS,
  MUXSTONE_MAX_ROWS,
  MUXSTONE_MAX_SESSIONS,
  MUXSTONE_THEMES,
  type MuxstoneClientPort,
  type MuxstoneControllerInspection,
  type MuxstoneOutputFrame,
  muxstoneSessionIdFromWindow,
  type MuxstoneSessionSummary,
  type MuxstoneSpawnOptions,
  muxstoneTheme,
  type MuxstoneThemeSpec,
  muxstoneWindowId,
  type MuxstoneWorkspaceState,
  normalizeMuxstoneWorkspaceState,
} from "./model.ts";

/** Stable host-manager window shown alongside terminal windows. */
export const MUXSTONE_SESSIONS_WINDOW_ID = "sessions" as const;
const WINDOW_RECONCILE_ATTEMPTS = 8;

/** Live client-side projection of one daemon-owned terminal. */
export interface MuxstoneTerminalRuntime {
  readonly sessionId: string;
  readonly screen: TerminalScreenController;
  readonly scrollback: TerminalScrollbackController;
  readonly summary: Signal<MuxstoneSessionSummary>;
  readonly attached: Signal<boolean>;
  readonly renderRevision: Signal<number>;
  readonly warning: Signal<string | undefined>;
  hostTitle: string;
  screenTitle?: string;
  lastSequence: number;
  attachGeneration: number;
  requestedColumns: number;
  requestedRows: number;
}

/** Construction options after the detached client has connected. */
export interface MuxstoneControllerOptions {
  readonly client: MuxstoneClientPort;
  readonly initialSessions?: readonly MuxstoneSessionSummary[];
  readonly store?: AsyncStore<unknown>;
  readonly storageKey?: string;
  readonly diagnostics?: DiagnosticsCollector;
  readonly defaultCommand?: string;
  readonly defaultArgs?: readonly string[];
  readonly defaultCwd?: string;
  readonly now?: () => number;
  readonly persistenceDebounceMs?: number;
}

/** Options for launching and positioning one terminal window. */
export interface MuxstoneControllerSpawnOptions {
  readonly command?: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly title?: string;
  readonly columns?: number;
  readonly rows?: number;
  readonly dock?: "right" | "bottom";
  readonly bounds?: Rectangle;
}

/** Creates, restores, and attaches a complete renderer-neutral multiplexer controller. */
export async function createMuxstoneController(options: MuxstoneControllerOptions): Promise<MuxstoneController> {
  const initialSessions = options.initialSessions ?? await options.client.list();
  const controller = new MuxstoneController({ ...options, initialSessions });
  await controller.ready;
  return controller;
}

/** Renderer-neutral controller for detached terminals and advanced window state. */
export class MuxstoneController {
  readonly client: MuxstoneClientPort;
  readonly kernel: ShowcaseKernel<MuxstoneWorkspaceState, MuxstoneClientProvider>;
  readonly windowHost: NonNullable<ShowcaseKernel<MuxstoneWorkspaceState>["windowHost"]>;
  readonly ready: Promise<void>;

  readonly sessions: Signal<readonly MuxstoneSessionSummary[]>;
  readonly themeId = new Signal<MuxstoneWorkspaceState["themeId"]>("midnight");
  readonly theme: Computed<MuxstoneThemeSpec>;
  readonly themeRevision = new Signal(0);
  readonly prefixPending = new Signal(false);
  readonly helpVisible = new Signal(false);
  readonly pendingKillSessionId = new Signal<string | undefined>(undefined);
  readonly status = new Signal("Connecting to local Muxstone host…");

  readonly #runtimes = new Map<string, MuxstoneTerminalRuntime>();
  readonly #lifecycleTails = new Map<string, Promise<void>>();
  readonly #pendingResizes = new Map<string, { columns: number; rows: number }>();
  readonly #resizeFlights = new Map<string, Promise<void>>();
  readonly #killFlights = new Map<string, Promise<boolean>>();
  readonly #defaultCommand: string;
  readonly #defaultArgs?: readonly string[];
  readonly #defaultCwd?: string;
  #terminalOrdinal = 1;
  #disposed = false;
  #disposePromise?: Promise<void>;

  constructor(options: MuxstoneControllerOptions) {
    this.client = options.client;
    this.#defaultCommand = options.defaultCommand ?? defaultMuxstoneShell();
    this.#defaultArgs = options.defaultArgs ? [...options.defaultArgs] : undefined;
    this.#defaultCwd = options.defaultCwd;
    const initialSessions = normalizeSessionList(options.initialSessions ?? []);
    this.sessions = new Signal<readonly MuxstoneSessionSummary[]>(initialSessions);
    for (const session of initialSessions) this.#runtimes.set(session.id, createTerminalRuntime(session));

    const provider = new MuxstoneClientProvider(this.client);
    this.kernel = new ShowcaseKernel({
      manifest: MUXSTONE_MANIFEST,
      provider,
      initialState: initialMuxstoneWorkspaceState(),
      normalizeState: normalizeMuxstoneWorkspaceState,
      store: options.store,
      storageKey: options.storageKey ?? "showcase:muxstone:workspace",
      diagnostics: options.diagnostics,
      now: options.now,
      persistenceDebounceMs: options.persistenceDebounceMs,
      workspace: { gap: 1 },
      advancedWindows: {
        windows: this.#windowDescriptors(),
        compactMode: "auto",
        historyCapacity: 160,
        ownerId: "muxstone-window-host",
        snapDistance: 2,
        snapOnRelease: true,
      },
    });
    const windowHost = this.kernel.windowHost;
    if (!windowHost) throw new Error("Muxstone requires the advanced window host.");
    this.windowHost = windowHost;
    this.theme = new Computed(() => muxstoneTheme(this.themeId.value));
    this.ready = this.#initialize();
  }

  /** Returns the live screen/runtime for one stable daemon session. */
  runtime(sessionId: string): MuxstoneTerminalRuntime | undefined {
    return this.#runtimes.get(sessionId);
  }

  /** Returns the terminal selected by the advanced window host. */
  activeRuntime(): MuxstoneTerminalRuntime | undefined {
    const sessionId = muxstoneSessionIdFromWindow(this.windowHost.controller.inspect().activeWindowId);
    return sessionId ? this.#runtimes.get(sessionId) : undefined;
  }

  /** Persists the window host's current terminal focus without waiting on PTY work. */
  syncActiveSession(): void {
    if (!this.#disposed) this.#persistActiveSession();
  }

  /** Arms the tmux-compatible Ctrl-B prefix without forwarding it to a child. */
  beginPrefix(): void {
    this.#assertActive();
    this.prefixPending.value = true;
    this.status.value = 'PREFIX · c new · % right · " below · d detach · & kill · t theme';
  }

  /** Cancels a pending prefix sequence. */
  cancelPrefix(): void {
    if (this.#disposed) return;
    this.prefixPending.value = false;
    this.status.value = this.#statusSummary();
  }

  /** Executes one awaited Ctrl-B command. Unknown keys are consumed and explained. */
  async handlePrefixKey(key: string, bounds: Rectangle): Promise<boolean> {
    this.#assertActive();
    this.prefixPending.value = false;
    const normalized = key.toLowerCase();
    switch (normalized) {
      case "c":
        await this.spawn({ bounds });
        return true;
      case "%":
        await this.spawn({ bounds, dock: "right" });
        return true;
      case '"':
        await this.spawn({ bounds, dock: "bottom" });
        return true;
      case "d":
      case "x":
        await this.closeActive(bounds);
        return true;
      case "&": {
        const active = this.activeRuntime();
        if (active) this.requestKillSession(active.sessionId);
        return true;
      }
      case "?":
        this.openHelp();
        return true;
      case "t":
        this.cycleTheme();
        return true;
      case "f":
      case "space":
        this.windowHost.execute({ kind: "toggle-placement" }, bounds);
        return true;
      case "z":
        this.windowHost.execute({ kind: "toggle-maximize" }, bounds);
        return true;
      case "m":
        this.windowHost.execute({ kind: "minimize" }, bounds);
        return true;
      case "n":
        this.windowHost.execute({ kind: "focus-next", direction: 1 }, bounds);
        this.#persistActiveSession();
        return true;
      case "p":
        this.windowHost.execute({ kind: "focus-next", direction: -1 }, bounds);
        this.#persistActiveSession();
        return true;
      case "w":
        this.windowHost.execute({ kind: "switcher-open", direction: 1 }, bounds);
        return true;
      case "s":
        this.windowHost.execute({ kind: "restore", id: MUXSTONE_SESSIONS_WINDOW_ID }, bounds);
        this.windowHost.execute({ kind: "focus", id: MUXSTONE_SESSIONS_WINDOW_ID }, bounds);
        return true;
      case "r":
        await this.refreshSessions();
        this.windowHost.execute({ kind: "recover-all" }, bounds);
        return true;
      case "left":
      case "right":
      case "up":
      case "down":
        this.windowHost.execute({
          kind: "snap",
          target: {
            kind: "workspace",
            edge: normalized === "up" ? "top" : normalized === "down" ? "bottom" : normalized,
          },
        }, bounds);
        return true;
      case "escape":
        this.cancelPrefix();
        return true;
      default:
        this.status.value = `Unknown prefix command: ${key} · Ctrl-B ? for help`;
        return true;
    }
  }

  /** Opens the destructive-session confirmation without touching the host. */
  requestKillSession(sessionId: string): boolean {
    this.#assertActive();
    const runtime = this.#runtimes.get(sessionId);
    if (!runtime) return false;
    this.prefixPending.value = false;
    this.helpVisible.value = false;
    this.pendingKillSessionId.value = sessionId;
    this.status.value = `Kill ${runtime.summary.peek().title}? Press y/Enter to confirm or Escape to cancel.`;
    return true;
  }

  /** Confirms the currently requested destructive session termination. */
  async confirmKillSession(): Promise<boolean> {
    this.#assertActive();
    const sessionId = this.pendingKillSessionId.peek();
    if (!sessionId) return false;
    this.pendingKillSessionId.value = undefined;
    if (!this.#runtimes.has(sessionId)) return false;
    return await this.killSession(sessionId);
  }

  /** Cancels the pending destructive action while leaving its PTY untouched. */
  cancelKillSession(): void {
    if (this.#disposed) return;
    this.pendingKillSessionId.value = undefined;
    this.status.value = this.#statusSummary();
  }

  /** Opens the modal key reference and clears conflicting destructive UI. */
  openHelp(): void {
    this.#assertActive();
    this.prefixPending.value = false;
    this.pendingKillSessionId.value = undefined;
    this.helpVisible.value = true;
    this.status.value = "Muxstone key reference open · Escape, tap, or click closes help.";
  }

  /** Closes the modal key reference. */
  closeHelp(): void {
    if (this.#disposed) return;
    this.helpVisible.value = false;
    this.status.value = this.#statusSummary();
  }

  /** Launches a daemon-owned shell, floating by default or tiled when explicitly docked. */
  async spawn(options: MuxstoneControllerSpawnOptions = {}): Promise<MuxstoneSessionSummary | undefined> {
    this.#assertActive();
    if (this.#runtimes.size >= MUXSTONE_MAX_SESSIONS) {
      this.status.value = `Session limit reached (${MUXSTONE_MAX_SESSIONS}).`;
      return undefined;
    }
    const activeWindowId = this.windowHost.controller.inspect().activeWindowId;
    const targetId = muxstoneSessionIdFromWindow(activeWindowId);
    const minimizeSessionManager = this.#runtimes.size === 0 || activeWindowId === MUXSTONE_SESSIONS_WINDOW_ID;
    this.#terminalOrdinal += 1;
    this.#persistMetadata();
    const spawnOptions: MuxstoneSpawnOptions = {
      command: options.command ?? this.#defaultCommand,
      args: options.args ? [...options.args] : this.#defaultArgs,
      cwd: options.cwd ?? this.#defaultCwd,
      env: options.env ? { ...options.env } : undefined,
      ...(options.title !== undefined ? { title: options.title } : {}),
      columns: clampDimension(options.columns, 80, MUXSTONE_MAX_COLUMNS),
      rows: clampDimension(options.rows, 24, MUXSTONE_MAX_ROWS),
    };
    this.status.value = `Launching ${options.title ?? applicationCommandName(spawnOptions.command)}…`;
    try {
      const session = normalizeSession(await this.client.spawn(spawnOptions));
      const runtime = createTerminalRuntime(session);
      const candidateRuntimes = new Map(this.#runtimes);
      candidateRuntimes.set(session.id, runtime);
      const reconciliation = await this.#reconcileWindows(
        this.#windowDescriptors(candidateRuntimes, new Map(), options.dock ? undefined : session.id),
      );
      if (!windowReconciliationApplied(reconciliation)) {
        const rolledBack = await this.client.kill(session.id).catch(() => false);
        disposeTerminalRuntime(runtime);
        this.status.value = rolledBack
          ? `Launch rolled back because window creation failed: ${reconciliation.reason ?? reconciliation.status}.`
          : `Window creation failed; detached host session ${session.id} may require recovery.`;
        return undefined;
      }
      this.#runtimes.set(session.id, runtime);
      this.#publishSessions();
      const bounds = options.bounds ?? { column: 0, row: 0, width: 120, height: 36 };
      if (options.dock && targetId && this.#runtimes.has(targetId)) {
        const targetWindowId = muxstoneWindowId(targetId);
        const targetWindow = this.windowHost.controller.inspect().windows.find((window) =>
          window.id === targetWindowId
        );
        // A default-floating terminal can still become the anchor for an
        // explicit tmux-style split. Docking requires both peers in the tiled
        // workspace, so promote the focused target before placing its child.
        if (targetWindow?.placement === "floating") {
          this.windowHost.execute({ kind: "set-placement", id: targetWindowId, placement: "tiled" }, bounds);
        }
        this.windowHost.execute({
          kind: "dock",
          id: muxstoneWindowId(session.id),
          targetId: targetWindowId,
          edge: options.dock,
          ratio: 0.5,
        }, bounds);
      }
      this.windowHost.execute({ kind: "restore", id: muxstoneWindowId(session.id) }, bounds);
      this.windowHost.execute({ kind: "focus", id: muxstoneWindowId(session.id) }, bounds);
      // The manager is an always-on-top floating utility. Leaving it over the
      // first focused shell hides the prompt and early echo, which looks like
      // severe input latency even though the PTY is current. Keep it one
      // Ctrl-B s away on the shelf when it launched the terminal.
      if (minimizeSessionManager) {
        this.windowHost.execute({ kind: "minimize", id: MUXSTONE_SESSIONS_WINDOW_ID }, bounds);
      }
      await this.#attachRuntime(runtime);
      this.#persistActiveSession();
      this.status.value = this.#statusSummary();
      return session;
    } catch {
      this.status.value = "The local host rejected the terminal launch.";
      return undefined;
    }
  }

  /** Closes the active presentation window and detaches without terminating its PTY. */
  async closeActive(bounds: Rectangle): Promise<boolean> {
    this.#assertActive();
    const runtime = this.activeRuntime();
    if (!runtime) return false;
    const result = this.windowHost.execute({ kind: "close", id: muxstoneWindowId(runtime.sessionId) }, bounds);
    await this.#detachRuntime(runtime);
    this.#persistActiveSession();
    this.status.value = `Detached ${runtime.summary.peek().title}; its PTY is still running.`;
    return result.handled;
  }

  /** Restores and reattaches one hidden terminal by stable host session id. */
  async openSession(sessionId: string, bounds: Rectangle): Promise<boolean> {
    this.#assertActive();
    const runtime = this.#runtimeRequired(sessionId);
    const targetId = muxstoneWindowId(sessionId);
    const maximizedId = this.windowHost.controller.inspect().maximizedWindowId;
    if (maximizedId && maximizedId !== targetId) {
      this.windowHost.execute({ kind: "restore", id: maximizedId }, bounds);
    }
    this.windowHost.execute({ kind: "restore", id: targetId }, bounds);
    this.windowHost.execute({ kind: "focus", id: targetId }, bounds);
    if (maximizedId && maximizedId !== targetId) {
      this.windowHost.execute({ kind: "maximize", id: targetId }, bounds);
    }
    const attached = await this.#attachRuntime(runtime);
    this.#persistActiveSession();
    this.status.value = attached ? `Attached ${runtime.summary.peek().title}.` : "Attach failed.";
    return attached;
  }

  /** Opens the persistent session selector, clearing any terminal fullscreen lock. */
  openSessionManager(bounds: Rectangle): boolean {
    this.#assertActive();
    const maximizedId = this.windowHost.controller.inspect().maximizedWindowId;
    if (maximizedId) this.windowHost.execute({ kind: "restore", id: maximizedId }, bounds);
    const restored = this.windowHost.execute({ kind: "restore", id: MUXSTONE_SESSIONS_WINDOW_ID }, bounds);
    const focused = this.windowHost.execute({ kind: "focus", id: MUXSTONE_SESSIONS_WINDOW_ID }, bounds);
    return restored.handled || focused.handled;
  }

  /** Explicitly destroys one host-owned process and removes its window. */
  async killSession(sessionId: string): Promise<boolean> {
    this.#assertActive();
    const pending = this.#killFlights.get(sessionId);
    if (pending) return await pending;
    const flight = this.#killSessionOnce(sessionId);
    this.#killFlights.set(sessionId, flight);
    try {
      return await flight;
    } finally {
      if (this.#killFlights.get(sessionId) === flight) this.#killFlights.delete(sessionId);
    }
  }

  async #killSessionOnce(sessionId: string): Promise<boolean> {
    const runtime = this.#runtimeRequired(sessionId);
    if (this.pendingKillSessionId.peek() === sessionId) this.pendingKillSessionId.value = undefined;
    const title = runtime.summary.peek().title;
    const killed = await this.client.kill(sessionId).catch(() => false);
    if (!killed) {
      this.status.value = "The host did not terminate that session.";
      return false;
    }
    runtime.attachGeneration += 1;
    runtime.attached.value = false;
    runtime.renderRevision.value += 1;
    const survivors = new Map(this.#runtimes);
    survivors.delete(sessionId);
    const reconciliation = await this.#reconcileWindows(this.#windowDescriptors(survivors));
    if (!windowReconciliationApplied(reconciliation)) {
      const summary = runtime.summary.peek();
      runtime.summary.value = normalizeSession({
        ...summary,
        status: "exited",
        running: false,
        updatedAt: Math.max(summary.updatedAt, Date.now()),
      });
      runtime.warning.value = `Terminated; window cleanup is pending (${
        reconciliation.reason ?? reconciliation.status
      }).`;
      runtime.renderRevision.value += 1;
      this.#publishSessions();
      this.windowHost.execute({ kind: "close", id: muxstoneWindowId(sessionId) }, {
        column: 0,
        row: 0,
        width: 120,
        height: 36,
      });
      this.status.value = `Terminated ${title}; window cleanup will retry on refresh.`;
      return true;
    }
    this.#runtimes.delete(sessionId);
    this.#lifecycleTails.delete(sessionId);
    disposeTerminalRuntime(runtime);
    this.#publishSessions();
    this.#persistActiveSession();
    this.status.value = `Terminated ${title}.`;
    return true;
  }

  /** Explicitly shuts down the retaining host; unlike UI disposal, this is destructive. */
  async shutdownHost(): Promise<boolean> {
    this.#assertActive();
    const stopped = await this.client.shutdownHost();
    this.status.value = stopped
      ? "Detached host stopped; all of its terminal processes were terminated."
      : "The detached host did not acknowledge shutdown.";
    return stopped;
  }

  /** Cycles all Muxstone chrome/default colors while preserving child ANSI colors. */
  cycleTheme(direction: -1 | 1 = 1): MuxstoneThemeSpec {
    this.#assertActive();
    const current = MUXSTONE_THEMES.findIndex((candidate) => candidate.id === this.themeId.peek());
    const next = (Math.max(0, current) + direction + MUXSTONE_THEMES.length) % MUXSTONE_THEMES.length;
    this.themeId.value = MUXSTONE_THEMES[next]!.id;
    this.themeRevision.value += 1;
    for (const runtime of this.#runtimes.values()) runtime.renderRevision.value += 1;
    this.#persistMetadata();
    this.status.value = `Theme: ${MUXSTONE_THEMES[next]!.label}`;
    return MUXSTONE_THEMES[next]!;
  }

  /** Writes exact bytes to the selected attached terminal. */
  async writeActive(data: string | Uint8Array): Promise<boolean> {
    this.#assertActive();
    const runtime = this.activeRuntime();
    return runtime ? await this.writeSession(runtime.sessionId, data) : false;
  }

  /** Writes exact bytes to one ingress-captured daemon session. */
  async writeSession(sessionId: string, data: string | Uint8Array): Promise<boolean> {
    this.#assertActive();
    const runtime = this.#runtimes.get(sessionId);
    if (!runtime || !runtime.attached.peek() || !runtime.summary.peek().running) return false;
    return await this.client.input(sessionId, data);
  }

  /** Reconciles non-destructive visibility changes with daemon attachments. */
  async syncWindowVisibility(_bounds: Rectangle): Promise<void> {
    this.#assertActive();
    const windows = this.windowHost.controller.inspect().windows;
    const operations: Promise<unknown>[] = [];
    for (const runtime of this.#runtimes.values()) {
      const state = windows.find((window) => window.id === muxstoneWindowId(runtime.sessionId))?.state;
      if (state === "closed" && runtime.attached.peek() && !this.#killFlights.has(runtime.sessionId)) {
        operations.push(this.#detachRuntime(runtime));
      } else if (state && state !== "closed" && !runtime.attached.peek()) operations.push(this.#attachRuntime(runtime));
    }
    await Promise.allSettled(operations);
    this.#persistActiveSession();
  }

  /** Resizes host PTYs only when projected client geometry actually changes. */
  syncTerminalGeometry(projection: WorkbenchWindowHostProjection): void {
    if (this.#disposed) return;
    for (const window of projection.windows) {
      const sessionId = muxstoneSessionIdFromWindow(window.id);
      const runtime = sessionId ? this.#runtimes.get(sessionId) : undefined;
      if (!runtime || window.clientRect.width <= 0 || window.clientRect.height <= 0) continue;
      const columns = clampDimension(window.clientRect.width, runtime.requestedColumns, MUXSTONE_MAX_COLUMNS);
      const rows = clampDimension(window.clientRect.height, runtime.requestedRows, MUXSTONE_MAX_ROWS);
      runtime.scrollback.setViewportRows(rows);
      if (columns === runtime.requestedColumns && rows === runtime.requestedRows) continue;
      runtime.requestedColumns = columns;
      runtime.requestedRows = rows;
      runtime.screen.resize(columns, rows);
      runtime.renderRevision.value += 1;
      if (runtime.attached.peek() && runtime.summary.peek().running) {
        this.#scheduleTerminalResize(runtime, columns, rows);
      }
    }
  }

  /** Reconciles the local navigator with the authoritative host inventory. */
  async refreshSessions(): Promise<void> {
    this.#assertActive();
    const listed = normalizeSessionList(await this.client.list());
    const listedIds = new Set(listed.map((session) => session.id));
    const listedSummaries = new Map(listed.map((session) => [session.id, session]));
    const candidateRuntimes = new Map<string, MuxstoneTerminalRuntime>();
    const createdRuntimes: MuxstoneTerminalRuntime[] = [];
    for (const summary of listed) {
      const runtime = this.#runtimes.get(summary.id);
      if (runtime) candidateRuntimes.set(summary.id, runtime);
      else {
        const created = createTerminalRuntime(summary);
        createdRuntimes.push(created);
        candidateRuntimes.set(summary.id, created);
      }
    }
    const reconciliation = await this.#reconcileWindows(
      this.#windowDescriptors(candidateRuntimes, listedSummaries),
    );
    if (!windowReconciliationApplied(reconciliation)) {
      for (const runtime of createdRuntimes) disposeTerminalRuntime(runtime);
      this.status.value = `Session refresh deferred: ${reconciliation.reason ?? reconciliation.status}.`;
      return;
    }
    for (const [sessionId, runtime] of this.#runtimes) {
      if (listedIds.has(sessionId)) continue;
      runtime.attachGeneration += 1;
      this.#lifecycleTails.delete(sessionId);
      disposeTerminalRuntime(runtime);
    }
    this.#runtimes.clear();
    for (const [sessionId, runtime] of candidateRuntimes) {
      this.#setHostSummary(runtime, listedSummaries.get(sessionId)!);
      this.#runtimes.set(sessionId, runtime);
    }
    this.#publishSessions();
    this.status.value = this.#statusSummary();
  }

  /** Content-minimized lifecycle and multiplexer inspection. */
  inspect(): MuxstoneControllerInspection {
    const sessions = this.sessions.peek();
    return {
      disposed: this.#disposed,
      connected: this.client.connected,
      themeId: this.themeId.peek(),
      activeSessionId: muxstoneSessionIdFromWindow(this.windowHost.controller.inspect().activeWindowId),
      prefixPending: this.prefixPending.peek(),
      status: this.status.peek(),
      sessionCount: sessions.length,
      attachedCount: [...this.#runtimes.values()].filter((runtime) => runtime.attached.peek()).length,
      runningCount: sessions.filter((session) => session.running).length,
      persistenceStatus: this.kernel.persistenceStatus.peek(),
      sessions: sessions.map((session) => ({ ...session })),
    };
  }

  /** Detaches every client view, persists layout, and leaves daemon PTYs alive. */
  dispose(): Promise<void> {
    this.#disposePromise ??= this.#dispose();
    return this.#disposePromise;
  }

  async #initialize(): Promise<void> {
    await this.kernel.ready;
    const restored = normalizeMuxstoneWorkspaceState(this.kernel.appState.peek());
    this.themeId.value = restored.themeId;
    this.#terminalOrdinal = restored.terminalOrdinal;
    this.themeRevision.value += 1;
    const windows = this.windowHost.controller.inspect().windows;
    const activeId = restored.activeSessionId && this.#runtimes.has(restored.activeSessionId)
      ? restored.activeSessionId
      : this.sessions.peek()[0]?.id;
    if (activeId) {
      this.windowHost.execute(
        { kind: "focus", id: muxstoneWindowId(activeId) },
        { column: 0, row: 0, width: 120, height: 36 },
      );
    }
    const attaches: Promise<unknown>[] = [];
    for (const runtime of this.#runtimes.values()) {
      const state = windows.find((window) => window.id === muxstoneWindowId(runtime.sessionId))?.state;
      if (state !== "closed") attaches.push(this.#attachRuntime(runtime));
    }
    await Promise.allSettled(attaches);
    this.#persistActiveSession();
    this.status.value = this.#statusSummary();
  }

  #attachRuntime(runtime: MuxstoneTerminalRuntime): Promise<boolean> {
    let result = false;
    const tail = (this.#lifecycleTails.get(runtime.sessionId) ?? Promise.resolve()).then(async () => {
      if (this.#disposed || runtime.attached.peek() || !this.#runtimes.has(runtime.sessionId)) {
        result = runtime.attached.peek();
        return;
      }
      const generation = ++runtime.attachGeneration;
      try {
        const attachment = await this.client.attach(runtime.sessionId, {
          sinceSequence: runtime.lastSequence,
          onOutput: (frame) => this.#acceptOutput(runtime, frame, generation),
          onSession: (summary) => this.#acceptSession(runtime, summary, generation),
        });
        if (generation !== runtime.attachGeneration || this.#disposed) return;
        if (attachment.truncated) {
          runtime.screen.clear();
          runtime.warning.value = "Replay buffer was truncated; this view resumed at the retained boundary.";
          runtime.lastSequence = 0;
        }
        this.#setHostSummary(runtime, attachment.session);
        for (const frame of attachment.replay) this.#acceptOutput(runtime, frame, generation);
        runtime.attached.value = true;
        this.#scheduleTerminalResize(runtime, runtime.requestedColumns, runtime.requestedRows);
        runtime.renderRevision.value += 1;
        this.#publishSessions();
        result = true;
      } catch {
        runtime.warning.value = "The detached terminal could not be attached.";
        runtime.renderRevision.value += 1;
      }
    });
    this.#lifecycleTails.set(runtime.sessionId, tail);
    return tail.then(() => result);
  }

  #detachRuntime(runtime: MuxstoneTerminalRuntime): Promise<boolean> {
    let result = false;
    const tail = (this.#lifecycleTails.get(runtime.sessionId) ?? Promise.resolve()).then(async () => {
      if (!runtime.attached.peek()) {
        result = true;
        return;
      }
      runtime.attachGeneration += 1;
      this.#pendingResizes.delete(runtime.sessionId);
      try {
        result = await this.client.detach(runtime.sessionId);
      } catch {
        result = false;
      }
      runtime.attached.value = false;
      runtime.renderRevision.value += 1;
    });
    this.#lifecycleTails.set(runtime.sessionId, tail);
    return tail.then(() => result);
  }

  #acceptOutput(runtime: MuxstoneTerminalRuntime, frameValue: MuxstoneOutputFrame, generation: number): void {
    if (generation !== runtime.attachGeneration || frameValue.sessionId !== runtime.sessionId) return;
    const sequence = Number.isSafeInteger(frameValue.sequence) ? frameValue.sequence : -1;
    if (sequence <= runtime.lastSequence) return;
    if (runtime.lastSequence > 0 && sequence !== runtime.lastSequence + 1) {
      runtime.warning.value = `Output sequence gap (${runtime.lastSequence} → ${sequence}).`;
    }
    runtime.lastSequence = sequence;
    runtime.screen.write(frameValue.data);
    const observedTitle = runtime.screen.inspect().title;
    if (observedTitle !== undefined) {
      const screenTitle = normalizeRuntimeTitle(observedTitle);
      if (screenTitle !== runtime.screenTitle) {
        runtime.screenTitle = screenTitle;
        const summary = runtime.summary.peek();
        const title = screenTitle ?? runtime.hostTitle;
        if (title !== summary.title) {
          runtime.summary.value = normalizeSession({ ...summary, title });
          this.#publishSessions();
        }
      }
    }
    runtime.renderRevision.value += 1;
  }

  #acceptSession(runtime: MuxstoneTerminalRuntime, summary: MuxstoneSessionSummary, generation: number): void {
    if (generation !== runtime.attachGeneration || summary.id !== runtime.sessionId) return;
    this.#setHostSummary(runtime, summary);
    this.#publishSessions();
  }

  #setHostSummary(runtime: MuxstoneTerminalRuntime, summary: MuxstoneSessionSummary): void {
    const normalized = normalizeSession(summary);
    runtime.hostTitle = normalized.title;
    runtime.summary.value = runtime.screenTitle === undefined
      ? normalized
      : normalizeSession({ ...normalized, title: runtime.screenTitle });
  }

  #scheduleTerminalResize(runtime: MuxstoneTerminalRuntime, columns: number, rows: number): void {
    if (this.#disposed) return;
    this.#pendingResizes.set(runtime.sessionId, { columns, rows });
    if (this.#resizeFlights.has(runtime.sessionId)) return;
    const flight = this.#drainTerminalResize(runtime);
    this.#resizeFlights.set(runtime.sessionId, flight);
    const settle = () => {
      if (this.#resizeFlights.get(runtime.sessionId) !== flight) return;
      this.#resizeFlights.delete(runtime.sessionId);
      if (this.#pendingResizes.has(runtime.sessionId)) {
        this.#scheduleTerminalResize(runtime, runtime.requestedColumns, runtime.requestedRows);
      }
    };
    void flight.then(settle, settle);
  }

  async #drainTerminalResize(runtime: MuxstoneTerminalRuntime): Promise<void> {
    while (!this.#disposed) {
      const next = this.#pendingResizes.get(runtime.sessionId);
      this.#pendingResizes.delete(runtime.sessionId);
      if (!next) return;
      if (
        this.#runtimes.get(runtime.sessionId) !== runtime || !runtime.attached.peek() ||
        !runtime.summary.peek().running
      ) return;
      try {
        await this.client.resize(runtime.sessionId, next.columns, next.rows);
      } catch {
        // A later geometry observation may enqueue a fresh, recoverable resize.
      }
    }
  }

  #publishSessions(): void {
    this.sessions.value = [...this.#runtimes.values()]
      .map((runtime) => runtime.summary.peek())
      .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  }

  async #reconcileWindows(
    descriptors: readonly WorkbenchWindowHostDescriptor<string>[],
  ): Promise<WorkbenchWindowHostResult> {
    let result = this.windowHost.reconcileWindows(descriptors);
    for (let attempt = 1; result.status === "blocked" && attempt < WINDOW_RECONCILE_ATTEMPTS; attempt += 1) {
      await yieldWindowMutationBoundary();
      if (this.#disposed) return result;
      result = this.windowHost.reconcileWindows(descriptors);
    }
    return result;
  }

  #windowDescriptors(
    runtimes: ReadonlyMap<string, MuxstoneTerminalRuntime> = this.#runtimes,
    summaries: ReadonlyMap<string, MuxstoneSessionSummary> = new Map(),
    floatingSessionId?: string,
  ): WorkbenchWindowHostDescriptor<string>[] {
    return [
      {
        id: MUXSTONE_SESSIONS_WINDOW_ID,
        title: "Sessions / Host",
        minWidth: 26,
        minHeight: 9,
        maxWidth: 72,
        maxHeight: 30,
        placement: "floating",
        floatingRect: { column: 2, row: 2, width: 38, height: 16 },
        alwaysOnTop: true,
      },
      ...[...runtimes.values()].map((runtime) => ({
        id: muxstoneWindowId(runtime.sessionId),
        title: (summaries.get(runtime.sessionId) ?? runtime.summary.peek()).title,
        minWidth: 20,
        minHeight: 6,
        maxWidth: MUXSTONE_MAX_COLUMNS + 2,
        maxHeight: MUXSTONE_MAX_ROWS + 2,
        ...(runtime.sessionId === floatingSessionId ? { placement: "floating" as const } : {}),
      })),
    ];
  }

  #persistActiveSession(): void {
    this.#persistMetadata(muxstoneSessionIdFromWindow(this.windowHost.controller.inspect().activeWindowId));
  }

  #persistMetadata(activeSessionId?: string): void {
    if (this.#disposed) return;
    const current = normalizeMuxstoneWorkspaceState(this.kernel.appState.peek());
    const selected = activeSessionId === undefined ? current.activeSessionId : activeSessionId;
    this.kernel.setState({
      schemaVersion: 1,
      themeId: this.themeId.peek(),
      terminalOrdinal: this.#terminalOrdinal,
      ...(selected && this.#runtimes.has(selected) ? { activeSessionId: selected } : {}),
    });
  }

  #statusSummary(): string {
    const sessions = this.sessions.peek();
    const running = sessions.filter((session) => session.running).length;
    const hidden = [...this.#runtimes.values()].filter((runtime) => !runtime.attached.peek()).length;
    return `${running}/${sessions.length} running · ${hidden} detached · Ctrl-B ? commands`;
  }

  #runtimeRequired(sessionId: string): MuxstoneTerminalRuntime {
    if (!isMuxstoneSessionId(sessionId)) throw new TypeError("Invalid Muxstone session id.");
    const runtime = this.#runtimes.get(sessionId);
    if (!runtime) throw new RangeError("Muxstone session was not found.");
    return runtime;
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error("Muxstone controller is disposed.");
  }

  async #dispose(): Promise<void> {
    if (this.#disposed) return;
    this.prefixPending.value = false;
    this.helpVisible.value = false;
    this.pendingKillSessionId.value = undefined;
    this.#pendingResizes.clear();
    const detachments = [...this.#runtimes.values()].map((runtime) => this.#detachRuntime(runtime));
    await Promise.allSettled(detachments);
    await this.kernel.dispose();
    this.#disposed = true;
    for (const runtime of this.#runtimes.values()) disposeTerminalRuntime(runtime);
    this.#runtimes.clear();
    this.#lifecycleTails.clear();
    this.#resizeFlights.clear();
    this.theme.dispose();
    this.sessions.dispose();
    this.themeId.dispose();
    this.themeRevision.dispose();
    this.prefixPending.dispose();
    this.helpVisible.dispose();
    this.pendingKillSessionId.dispose();
    this.status.value = "disposed";
    this.status.dispose();
  }
}

class MuxstoneClientProvider implements ShowcaseProvider {
  readonly id = "muxstone-local-host";
  readonly label = "Muxstone local detached terminal host";
  readonly capabilities = Object.freeze([
    Object.freeze({ id: "terminal.multiplex", status: "available" as const }),
    Object.freeze({ id: "window.advanced", status: "available" as const }),
    Object.freeze({ id: "terminal.pty", status: "available" as const }),
    Object.freeze({ id: "terminal.replay", status: "available" as const }),
  ]);
  #disposed = false;

  constructor(readonly client: MuxstoneClientPort) {}

  activate(_context: ShowcaseProviderActivationContext): ShowcaseProviderActivationResult {
    if (this.#disposed || !this.client.connected) return { status: "degraded", message: "Client is disconnected." };
    return { status: "ready" };
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await this.client.dispose();
  }
}

function createTerminalRuntime(summary: MuxstoneSessionSummary): MuxstoneTerminalRuntime {
  const screen = new TerminalScreenController({
    columns: summary.columns,
    rows: summary.rows,
    scrollbackLimit: 2_000,
  });
  return {
    sessionId: summary.id,
    screen,
    scrollback: new TerminalScrollbackController({ screen, viewportRows: summary.rows }),
    summary: new Signal(summary),
    attached: new Signal(false),
    renderRevision: new Signal(0),
    warning: new Signal<string | undefined>(undefined),
    hostTitle: summary.title,
    lastSequence: 0,
    attachGeneration: 0,
    requestedColumns: summary.columns,
    requestedRows: summary.rows,
  };
}

function disposeTerminalRuntime(runtime: MuxstoneTerminalRuntime): void {
  runtime.summary.dispose();
  runtime.attached.dispose();
  runtime.renderRevision.dispose();
  runtime.warning.dispose();
}

function normalizeSessionList(input: readonly MuxstoneSessionSummary[]): readonly MuxstoneSessionSummary[] {
  if (!Array.isArray(input) || input.length > MUXSTONE_MAX_SESSIONS) {
    throw new TypeError("Invalid Muxstone session inventory.");
  }
  const seen = new Set<string>();
  return input.map((session) => {
    const normalized = normalizeSession(session);
    if (seen.has(normalized.id)) throw new TypeError("Duplicate Muxstone session id.");
    seen.add(normalized.id);
    return normalized;
  });
}

function normalizeSession(session: MuxstoneSessionSummary): MuxstoneSessionSummary {
  if (!session || typeof session !== "object" || !isMuxstoneSessionId(session.id)) {
    throw new TypeError("Invalid Muxstone session.");
  }
  const status = session.status === "running" || session.status === "exited" || session.status === "failed"
    ? session.status
    : session.running
    ? "running"
    : "failed";
  const title = boundedText(session.title, "terminal", 160);
  const commandLine = boundedText(session.commandLine, "shell", 8_192);
  const sequence = Number.isSafeInteger(session.sequence) && session.sequence >= 0 ? session.sequence : 0;
  const createdAt = finiteTime(session.createdAt);
  const updatedAt = Math.max(createdAt, finiteTime(session.updatedAt));
  return Object.freeze({
    id: session.id,
    title,
    commandLine,
    status,
    running: status === "running" && session.running !== false,
    columns: clampDimension(session.columns, 80, MUXSTONE_MAX_COLUMNS),
    rows: clampDimension(session.rows, 24, MUXSTONE_MAX_ROWS),
    sequence,
    createdAt,
    updatedAt,
    ...(Number.isSafeInteger(session.exitCode) ? { exitCode: session.exitCode } : {}),
  });
}

function boundedText(value: unknown, fallback: string, maximum: number): string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !value.includes("\0")
    ? value
    : fallback;
}

function normalizeRuntimeTitle(value: string): string | undefined {
  let result = "";
  let pendingSpace = false;
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || /\s/u.test(char)) {
      pendingSpace = result.length > 0;
      continue;
    }
    if (pendingSpace && result.length < 160) result += " ";
    pendingSpace = false;
    if (result.length + char.length > 160) break;
    result += char;
  }
  const normalized = result.trim();
  return normalized || undefined;
}

function applicationCommandName(command: string): string {
  const title = normalizeRuntimeTitle(command);
  if (!title) return "terminal";
  return title.includes(" ") ? title : title.split(/[\\/]/).at(-1) ?? title;
}

function finiteTime(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clampDimension(value: unknown, fallback: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(maximum, Math.floor(value)))
    : fallback;
}

function windowReconciliationApplied(result: WorkbenchWindowHostResult): boolean {
  return result.status === "applied" || result.status === "unchanged";
}

function yieldWindowMutationBoundary(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function defaultMuxstoneShell(): string {
  if (Deno.build.os === "windows") return "powershell.exe";
  try {
    return Deno.env.get("SHELL") || "/bin/sh";
  } catch {
    return "/bin/sh";
  }
}
