// Copyright 2023 Im-Beast. MIT license.

import {
  type AsyncStore,
  Computed,
  type DiagnosticsCollector,
  type Rectangle,
  Signal,
  TerminalScreenController,
  TerminalScrollbackController,
  TreeController,
  type TreeNode,
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
  createTailscaleStatusSource,
  type TailnetDevice,
  TailnetPoller,
  type TailnetStatusResult,
  type TailnetStatusSource,
} from "./tailnet.ts";
import {
  cycleMuxstoneWindowSetting,
  defaultMuxstoneWindowSettings,
  initialMuxstoneWorkspaceState,
  isMuxstoneSessionId,
  isMuxstoneSshTarget,
  MUXSTONE_BACKGROUND_IDS,
  MUXSTONE_MANIFEST,
  MUXSTONE_MAX_COLUMNS,
  MUXSTONE_MAX_ROWS,
  MUXSTONE_MAX_SESSIONS,
  MUXSTONE_THEMES,
  MUXSTONE_WINDOW_SETTING_SPECS,
  type MuxstoneBackgroundId,
  type MuxstoneClientPort,
  type MuxstoneControllerInspection,
  type MuxstoneOutputFrame,
  muxstoneSessionIdFromWindow,
  type MuxstoneSessionSummary,
  type MuxstoneSpawnOptions,
  muxstoneTheme,
  type MuxstoneThemeSpec,
  muxstoneWindowId,
  type MuxstoneWindowSettingId,
  type MuxstoneWindowSettings,
  type MuxstoneWorkspaceState,
  normalizeMuxstoneWorkspaceState,
} from "./model.ts";

/** Stable host-manager window shown alongside terminal windows. */
export const MUXSTONE_SESSIONS_WINDOW_ID = "sessions" as const;

/** Network tree node id for one saved SSH host entry. */
export function muxstoneNetworkHostNodeId(target: string): string {
  return `host:${target}`;
}

/** Extracts the saved SSH target from a `host:` parent node id. */
export function muxstoneNetworkNodeHostTarget(nodeId: string): string | undefined {
  return nodeId.startsWith("host:") ? nodeId.slice(5) : undefined;
}

/** Extracts the SSH target from an `act:host-shell:` action leaf id. */
export function muxstoneNetworkNodeHostShellTarget(nodeId: string): string | undefined {
  return nodeId.startsWith("act:host-shell:") ? nodeId.slice(15) : undefined;
}

/** Extracts the daemon session id from a `ses:` open-shell leaf id. */
export function muxstoneNetworkNodeSessionId(nodeId: string): string | undefined {
  return nodeId.startsWith("ses:") ? nodeId.slice(4) : undefined;
}

/** Extracts the tailnet device id from a `dev:` machine or `act:shell:` action node id. */
export function muxstoneNetworkNodeDeviceId(nodeId: string): string | undefined {
  if (nodeId.startsWith("dev:")) return nodeId.slice(4);
  if (nodeId.startsWith("act:shell:")) return nodeId.slice(10);
  return undefined;
}

/** Compact single-line label for one tailnet device row. */
export function muxstoneNetworkDeviceLabel(device: TailnetDevice): string {
  const glyph = device.online ? "●" : "○";
  const relay = device.relayed && device.online ? " · relay" : "";
  const suffix = device.self ? " · this device" : device.online ? "" : " · offline";
  return `${glyph} ${device.shortName} · ${device.os}${relay}${suffix}`;
}

/**
 * Extracts one plausible local file path from pasted text: single line, an
 * absolute or `~/` path, optionally quoted or a `file://` URI. Anything else —
 * including multi-line pastes and control characters — is left untouched.
 */
export function muxstoneScpCandidatePath(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 1024) return undefined;
  // deno-lint-ignore no-control-regex
  if (/[\r\n\x00-\x1f]/.test(trimmed)) return undefined;
  let path = trimmed;
  if (path.startsWith("file://")) {
    try {
      path = decodeURIComponent(new URL(path).pathname);
    } catch {
      return undefined;
    }
  }
  if ((path.startsWith("'") && path.endsWith("'")) || (path.startsWith('"') && path.endsWith('"'))) {
    path = path.slice(1, -1);
  }
  path = path.replace(/\\ /g, " ");
  if (path.startsWith("~/")) {
    try {
      const home = Deno.env.get("HOME");
      if (!home) return undefined;
      path = `${home}${path.slice(1)}`;
    } catch {
      return undefined;
    }
  }
  return path.startsWith("/") ? path : undefined;
}

async function defaultMuxstoneStatFile(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch {
    return false;
  }
}

/**
 * Finds the path printed by a `pwd` probe in raw shell output: a line that is
 * exactly one conservatively-charactered absolute path, ANSI sequences
 * stripped, ignoring the probe's own echo and prompt lines.
 */
export function muxstoneCapturedPwdPath(output: string): string | undefined {
  // deno-lint-ignore no-control-regex
  const plain = output.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "").replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
  for (const rawLine of plain.split(/[\r\n]+/)) {
    const line = rawLine.trim();
    if (!line.startsWith("/") || line.length > 510) continue;
    if (!/^\/[A-Za-z0-9._/@+-]*$/.test(line)) continue;
    return line;
  }
  return undefined;
}

/** Builds the Hosts/Tailscale hierarchy consumed by the shared workbench tree widget. */
export function buildMuxstoneNetworkNodes(
  savedHosts: readonly string[],
  status: TailnetStatusResult | undefined,
  expansion: ReadonlySet<string>,
  sessions: readonly MuxstoneSessionSummary[] = [],
  sessionHosts: Readonly<Record<string, string>> = {},
): TreeNode[] {
  const shellsForTargets = (targets: readonly (string | undefined)[]): TreeNode[] => {
    const nodes: TreeNode[] = [];
    for (const session of sessions) {
      const target = sessionHosts[session.id];
      if (!target || !targets.includes(target)) continue;
      nodes.push({
        id: `ses:${session.id}`,
        label: `⌨ ${session.title}${session.running ? "" : " · exited"}`,
      });
    }
    return nodes;
  };
  const hostChildren: TreeNode[] = savedHosts.length > 0
    ? savedHosts.map((target) => {
      const id = muxstoneNetworkHostNodeId(target);
      return {
        id,
        label: `@ ${target}`,
        children: [
          { id: `act:host-shell:${target}`, label: "Open shell" },
          ...shellsForTargets([target]),
        ],
        expanded: expansion.has(id),
      };
    })
    : [{ id: "note:hosts-empty", label: "No saved hosts · SSH once to remember" }];
  const tailscaleChildren: TreeNode[] = [];
  if (!status) {
    tailscaleChildren.push({ id: "note:ts-loading", label: "Checking tailscaled…" });
  } else if (!status.snapshot || status.availability === "unavailable") {
    tailscaleChildren.push({ id: "note:ts-detail", label: status.detail });
  } else {
    if (status.availability === "degraded") {
      tailscaleChildren.push({ id: "note:ts-detail", label: status.detail });
    }
    if (status.snapshot.devices.length === 0) {
      tailscaleChildren.push({ id: "note:ts-empty", label: "No devices in this tailnet." });
    }
    for (const device of status.snapshot.devices) {
      const id = `dev:${device.id}`;
      tailscaleChildren.push({
        id,
        label: muxstoneNetworkDeviceLabel(device),
        children: [
          { id: `act:shell:${device.id}`, label: "Open shell" },
          ...shellsForTargets([device.dnsName || undefined, device.ipv4]),
        ],
        expanded: expansion.has(id),
      });
    }
  }
  return [
    { id: "hosts", label: "HOSTS", children: hostChildren, expanded: expansion.has("hosts") },
    { id: "tailscale", label: "TAILSCALE", children: tailscaleChildren, expanded: expansion.has("tailscale") },
  ];
}
/** Stable left-docked network panel window listing saved hosts and tailnet devices. */
export const MUXSTONE_NETWORK_WINDOW_ID = "network" as const;
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
  /** Transient observers of decoded output text (e.g. remote cwd capture). */
  readonly outputTaps: Set<(chunk: string) => void>;
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
  readonly tailnetSource?: Pick<TailnetStatusSource, "fetchStatus">;
  readonly tailnetPollIntervalMs?: number;
  /** Injectable local-file existence probe for paste-to-scp interception. */
  readonly statFile?: (path: string) => Promise<boolean>;
  /** How long the remote `pwd` capture may wait before falling back to the remote home. */
  readonly scpCwdTimeoutMs?: number;
}

/** One intercepted paste awaiting a Send / Paste path / Cancel decision. */
export interface MuxstoneScpRequest {
  readonly sessionId: string;
  readonly target: string;
  readonly localPath: string;
  /** Remote directory captured from the shell, or undefined for the remote home. */
  readonly remoteDir?: string;
  /** Original pasted text, forwarded verbatim when the user picks "Paste path". */
  readonly pasteText: string;
  /** Optional password typed into the modal; empty means key/agent auth. */
  readonly password: string;
}

/** Human-readable destination for one pending transfer. */
export function muxstoneScpDestinationLabel(request: Pick<MuxstoneScpRequest, "target" | "remoteDir">): string {
  return `${request.target}:${request.remoteDir ?? "~"}`;
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
  readonly quitModalVisible = new Signal(false);
  readonly status = new Signal("Connecting to local Muxstone host…");
  readonly networkStatus = new Signal<TailnetStatusResult | undefined>(undefined);
  readonly savedHosts = new Signal<readonly string[]>([]);
  readonly sessionHosts = new Signal<Readonly<Record<string, string>>>({});
  readonly backgroundId = new Signal<MuxstoneBackgroundId>("metaballs");
  /** Session id → per-window shell settings edited from the titlebar config button. */
  readonly windowSettings = new Signal<Readonly<Record<string, MuxstoneWindowSettings>>>({});
  /** Session whose per-window config modal is open, when any. */
  readonly configSessionId = new Signal<string | undefined>(undefined);
  /** Highlighted row inside the per-window config modal. */
  readonly configRowIndex = new Signal(0);
  /** Pending paste-to-scp confirmation; non-undefined opens the transfer modal. */
  readonly pendingScp = new Signal<MuxstoneScpRequest | undefined>(undefined);
  /** Hierarchical Hosts/Tailscale browser state, driven by the shared workbench tree widget. */
  readonly networkTree: TreeController;

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
  #lastBounds: Rectangle = { column: 0, row: 0, width: 120, height: 36 };
  readonly #networkExpansion = new Set<string>(["hosts", "tailscale"]);
  #tailnetPoller?: TailnetPoller;
  readonly #tailnetSource: Pick<TailnetStatusSource, "fetchStatus">;
  readonly #tailnetPollIntervalMs?: number;
  readonly #statFile: (path: string) => Promise<boolean>;
  readonly #scpCwdTimeoutMs: number;
  #scpCwdCapture?: Promise<string | undefined>;

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
        // Terminal windows own per-window shell settings; the manager and
        // network panels have nothing to configure.
        windowConfigButton: (id: string) => muxstoneSessionIdFromWindow(id) !== undefined,
        windowConfigLabel: "cfg",
      },
    });
    const windowHost = this.kernel.windowHost;
    if (!windowHost) throw new Error("Muxstone requires the advanced window host.");
    this.windowHost = windowHost;
    this.theme = new Computed(() => muxstoneTheme(this.themeId.value));
    this.#tailnetSource = options.tailnetSource ?? createTailscaleStatusSource();
    this.#tailnetPollIntervalMs = options.tailnetPollIntervalMs;
    this.#statFile = options.statFile ?? defaultMuxstoneStatFile;
    this.#scpCwdTimeoutMs = Math.min(10_000, Math.max(50, options.scpCwdTimeoutMs ?? 1_500));
    this.networkTree = new TreeController({
      nodes: buildMuxstoneNetworkNodes([], undefined, this.#networkExpansion),
      onToggle: (row, expanded) => {
        if (expanded) this.#networkExpansion.add(row.id);
        else this.#networkExpansion.delete(row.id);
      },
    });
    this.savedHosts.subscribe(() => this.#rebuildNetworkTree());
    this.networkStatus.subscribe(() => this.#rebuildNetworkTree());
    this.sessionHosts.subscribe(() => this.#rebuildNetworkTree());
    this.sessions.subscribe(() => this.#rebuildNetworkTree());
    this.ready = this.#initialize();
  }

  #rebuildNetworkTree(): void {
    if (this.#disposed) return;
    this.networkTree.nodes.value = buildMuxstoneNetworkNodes(
      this.savedHosts.peek(),
      this.networkStatus.peek(),
      this.#networkExpansion,
      this.sessions.peek(),
      this.sessionHosts.peek(),
    );
  }

  /** Resolves a tailnet device referenced by a network tree node id. */
  networkDevice(nodeId: string): TailnetDevice | undefined {
    const deviceId = muxstoneNetworkNodeDeviceId(nodeId);
    if (!deviceId) return undefined;
    return this.networkStatus.peek()?.snapshot?.devices.find((device) => device.id === deviceId);
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

  /** Opens the end-session choice modal and clears conflicting transient UI. */
  openQuitModal(): void {
    this.#assertActive();
    this.prefixPending.value = false;
    this.helpVisible.value = false;
    this.pendingKillSessionId.value = undefined;
    this.quitModalVisible.value = true;
    this.status.value = "End session? d detaches, t terminates the host, Escape cancels.";
  }

  /** Closes the end-session modal without detaching or terminating anything. */
  cancelQuitModal(): void {
    if (this.#disposed) return;
    this.quitModalVisible.value = false;
    this.status.value = this.#statusSummary();
  }

  /** Returns the effective per-window settings for one session. */
  windowSettingsFor(sessionId: string): MuxstoneWindowSettings {
    return this.windowSettings.peek()[sessionId] ?? defaultMuxstoneWindowSettings();
  }

  /** Opens the per-window config modal for one terminal session. */
  openWindowConfig(sessionId: string): boolean {
    if (this.#disposed || !this.#runtimes.has(sessionId)) return false;
    this.prefixPending.value = false;
    this.helpVisible.value = false;
    this.pendingKillSessionId.value = undefined;
    this.configRowIndex.value = 0;
    this.configSessionId.value = sessionId;
    this.status.value = "Window config · ↑↓ choose · ←→/Enter change · r reset · Escape close";
    return true;
  }

  /** Closes the per-window config modal. */
  closeWindowConfig(): void {
    if (this.#disposed) return;
    this.configSessionId.value = undefined;
    this.status.value = this.#statusSummary();
  }

  /** Moves the highlighted row inside the config modal. */
  moveWindowConfigRow(delta: number): void {
    if (this.#disposed || !this.configSessionId.peek()) return;
    const count = MUXSTONE_WINDOW_SETTING_SPECS.length;
    const next = (this.configRowIndex.peek() + Math.trunc(delta) + count) % count;
    this.configRowIndex.value = next;
  }

  /** Cycles one setting for a session and applies it to the live runtime. */
  cycleWindowSetting(sessionId: string, id: MuxstoneWindowSettingId, direction = 1): MuxstoneWindowSettings {
    const current = this.windowSettingsFor(sessionId);
    if (this.#disposed) return current;
    const next = cycleMuxstoneWindowSetting(current, id, direction);
    this.#commitWindowSettings(sessionId, next);
    const spec = MUXSTONE_WINDOW_SETTING_SPECS.find((candidate) => candidate.id === id);
    if (spec) this.status.value = `${spec.label}: ${spec.format(next[id])}`;
    return next;
  }

  /** Restores factory defaults for one window. */
  resetWindowSettings(sessionId: string): MuxstoneWindowSettings {
    const defaults = defaultMuxstoneWindowSettings();
    if (this.#disposed) return defaults;
    this.#commitWindowSettings(sessionId, defaults);
    this.status.value = "Window settings reset to defaults.";
    return defaults;
  }

  #commitWindowSettings(sessionId: string, settings: MuxstoneWindowSettings): void {
    this.windowSettings.value = Object.freeze({ ...this.windowSettings.peek(), [sessionId]: settings });
    this.#applyWindowSettings(sessionId, settings);
    const runtime = this.#runtimes.get(sessionId);
    if (runtime) runtime.renderRevision.value += 1;
    this.#persistMetadata();
  }

  /** Pushes settings that own live runtime state into the session's screen model. */
  #applyWindowSettings(sessionId: string, settings: MuxstoneWindowSettings): void {
    const runtime = this.#runtimes.get(sessionId);
    if (!runtime) return;
    runtime.screen.setScrollbackLimit(settings.scrollbackLimit);
  }

  /** Arms the tmux-style Ctrl-N prefix without forwarding it to a child. */
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

  /** Executes one awaited Ctrl-N command. Unknown keys are consumed and explained. */
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
      case "b":
        this.cycleBackground();
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
        this.status.value = `Unknown prefix command: ${key} · Ctrl-N ? for help`;
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
    // Windows configured without a close prompt terminate straight away.
    if (!this.windowSettingsFor(sessionId).confirmClose) {
      this.pendingKillSessionId.value = undefined;
      void this.killSession(sessionId);
      return true;
    }
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

  /** Toggles the left-docked network panel; opening starts tailnet polling, closing stops it. */
  toggleNetworkPanel(bounds: Rectangle): void {
    this.#assertActive();
    const active = this.windowHost.controller.inspect().activeWindowId === MUXSTONE_NETWORK_WINDOW_ID;
    if (active) {
      this.windowHost.execute({ kind: "minimize", id: MUXSTONE_NETWORK_WINDOW_ID }, bounds);
      this.#tailnetPoller?.setVisible(false);
      this.status.value = this.#statusSummary();
      return;
    }
    this.windowHost.execute({ kind: "restore", id: MUXSTONE_NETWORK_WINDOW_ID }, bounds);
    this.windowHost.execute({ kind: "focus", id: MUXSTONE_NETWORK_WINDOW_ID }, bounds);
    this.#ensureTailnetPoller().setVisible(true);
    this.status.value = "Network panel · Enter opens SSH · Del forgets a saved host · r refreshes.";
  }

  /** Forces one immediate tailnet status fetch. */
  async refreshNetwork(): Promise<void> {
    this.#assertActive();
    await this.#ensureTailnetPoller().refresh();
  }

  /** Opens an SSH terminal to a validated target through the detached host and remembers it. */
  async spawnNetworkShell(
    target: string,
    title: string,
    bounds: Rectangle,
  ): Promise<MuxstoneSessionSummary | undefined> {
    this.#assertActive();
    if (!isMuxstoneSshTarget(target)) {
      this.status.value = `Refusing SSH target with unsupported characters: ${target.slice(0, 40)}`;
      return undefined;
    }
    const session = await this.spawn({ bounds, command: "ssh", args: [target], title: title || target });
    if (session) {
      this.rememberHost(target);
      this.sessionHosts.value = Object.freeze({ ...this.sessionHosts.peek(), [session.id]: target });
      this.#persistMetadata();
    }
    return session;
  }

  /** Preferred SSH target for one tailnet device (MagicDNS name over raw IP). */
  static tailnetSshTarget(device: TailnetDevice): string | undefined {
    const target = device.dnsName || device.ipv4;
    return target && isMuxstoneSshTarget(target) ? target : undefined;
  }

  /** Persists one SSH target in the saved-hosts list. */
  rememberHost(target: string): void {
    if (this.#disposed || !isMuxstoneSshTarget(target)) return;
    const current = this.savedHosts.peek();
    if (current.includes(target)) return;
    this.savedHosts.value = Object.freeze([target, ...current].slice(0, 64));
    this.#persistMetadata();
  }

  /** Removes one SSH target from the saved-hosts list. */
  forgetHost(target: string): boolean {
    this.#assertActive();
    const current = this.savedHosts.peek();
    if (!current.includes(target)) return false;
    this.savedHosts.value = Object.freeze(current.filter((host) => host !== target));
    this.#persistMetadata();
    this.status.value = `Forgot saved host ${target}.`;
    return true;
  }

  /** Centered default rect for a freshly spawned floating terminal, cascading slightly per launch. */
  #centeredFloatingRect(): Rectangle {
    const bounds = this.#lastBounds;
    const width = Math.max(24, Math.min(86, bounds.width - 6));
    const height = Math.max(8, Math.min(28, bounds.height - 4));
    const cascade = ((this.#terminalOrdinal % 5) - 2) * 2;
    return {
      column: Math.max(bounds.column, bounds.column + Math.floor((bounds.width - width) / 2) + cascade),
      row: Math.max(bounds.row, bounds.row + Math.floor((bounds.height - height) / 2) + Math.trunc(cascade / 2)),
      width,
      height,
    };
  }

  /**
   * SSH target of one session, from the network-panel mapping or, for shells
   * launched any other way, parsed from the session's `ssh …` command line.
   */
  scpEligibleTarget(sessionId: string): string | undefined {
    const mapped = this.sessionHosts.peek()[sessionId];
    if (mapped) return mapped;
    const summary = this.#runtimes.get(sessionId)?.summary.peek();
    if (!summary) return undefined;
    const tokens = summary.commandLine.trim().split(/\s+/);
    const command = tokens[0] ?? "";
    if (command !== "ssh" && !command.endsWith("/ssh")) return undefined;
    for (let index = tokens.length - 1; index >= 1; index -= 1) {
      const token = tokens[index]!;
      if (token.startsWith("-")) continue;
      return isMuxstoneSshTarget(token) ? token : undefined;
    }
    return undefined;
  }

  /**
   * Intercepts a paste that names one existing local file while an SSH shell
   * is focused. The modal opens as soon as the fast local stat confirms the
   * file; the remote cwd resolves in the background and never blocks input.
   * Returns true when the modal was opened; false means the caller must
   * forward the paste verbatim.
   */
  async maybeInterceptScpPaste(text: string): Promise<boolean> {
    if (this.#disposed || this.pendingScp.peek()) return false;
    const runtime = this.activeRuntime();
    if (!runtime) return false;
    const target = this.scpEligibleTarget(runtime.sessionId);
    if (!target) return false;
    const localPath = muxstoneScpCandidatePath(text);
    if (!localPath) return false;
    const exists = await this.#statFile(localPath).catch(() => false);
    if (!exists || this.#disposed) return false;
    this.prefixPending.value = false;
    const request: MuxstoneScpRequest = {
      sessionId: runtime.sessionId,
      target,
      localPath,
      pasteText: text,
      password: "",
    };
    this.pendingScp.value = request;
    this.status.value = `Send ${localPath} → ${
      muxstoneScpDestinationLabel(request)
    } ? Type a password if needed · Enter sends · Escape cancels.`;
    this.#scpCwdCapture = this.captureRemoteCwd(runtime.sessionId).then((remoteDir) => {
      if (remoteDir && !this.#disposed && this.pendingScp.peek() === request) {
        this.pendingScp.value = { ...request, remoteDir };
      }
      return remoteDir;
    }).catch(() => undefined);
    return true;
  }

  /**
   * Runs a hidden-history `pwd` in the shell and captures the printed path, so
   * transfers land in the directory the user is actually in. Skipped for
   * alternate-screen apps and whenever the shell is not sitting at an empty
   * prompt (the probe would otherwise type into a half-written command);
   * undefined falls back to the remote home directory.
   */
  async captureRemoteCwd(sessionId: string, timeoutMs = this.#scpCwdTimeoutMs): Promise<string | undefined> {
    const runtime = this.#runtimes.get(sessionId);
    if (!runtime || !runtime.attached.peek() || !runtime.summary.peek().running) return undefined;
    const inspection = runtime.screen.inspect();
    if (inspection.alternate) return undefined;
    const cursorLine = runtime.screen.textRows()[inspection.cursor.row] ?? "";
    const beforeCursor = cursorLine.slice(0, inspection.cursor.column).trimEnd();
    if (!/[$#%>❯]$/.test(beforeCursor)) return undefined;
    let settle: (value: string | undefined) => void;
    const captured = new Promise<string | undefined>((resolve) => settle = resolve);
    let buffer = "";
    const tap = (chunk: string) => {
      buffer = (buffer + chunk).slice(-8_192);
      const path = muxstoneCapturedPwdPath(buffer);
      if (path) settle(path);
    };
    runtime.outputTaps.add(tap);
    const timer = setTimeout(() => settle(undefined), Math.max(50, timeoutMs));
    try {
      // The leading space keeps the probe out of history in most shells.
      await this.writeSession(sessionId, " pwd\r");
      return await captured;
    } finally {
      clearTimeout(timer);
      runtime.outputTaps.delete(tap);
    }
  }

  /** Appends one typed character to the pending transfer's password field. */
  appendScpPassword(char: string): void {
    const request = this.pendingScp.peek();
    if (this.#disposed || !request || char.length === 0 || request.password.length >= 256) return;
    this.pendingScp.value = { ...request, password: request.password + char };
  }

  /** Removes the last character from the pending transfer's password field. */
  backspaceScpPassword(): void {
    const request = this.pendingScp.peek();
    if (this.#disposed || !request || request.password.length === 0) return;
    this.pendingScp.value = { ...request, password: request.password.slice(0, -1) };
  }

  /**
   * Opens a dedicated terminal window running scp so its native progress meter
   * is visible. When a password was typed, it is injected once at the first
   * password prompt; otherwise scp uses key/agent auth or prompts in-window.
   */
  async confirmScpTransfer(bounds: Rectangle): Promise<boolean> {
    this.#assertActive();
    const request = this.pendingScp.peek();
    if (!request) return false;
    this.pendingScp.value = undefined;
    // A still-running cwd probe may finish after confirmation; honor it.
    const capturedDir = request.remoteDir ?? await (this.#scpCwdCapture ?? Promise.resolve(undefined));
    this.#scpCwdCapture = undefined;
    if (this.#disposed) return false;
    const remoteDir = capturedDir ?? request.remoteDir;
    const remoteSpec = `${request.target}:${remoteDir ? `${remoteDir}/` : ""}`;
    const fileName = request.localPath.split("/").pop() || request.localPath;
    const session = await this.spawn({
      bounds,
      command: "scp",
      // No -q: scp draws its progress meter when stdout is a PTY.
      args: ["-o", "StrictHostKeyChecking=accept-new", "--", request.localPath, remoteSpec],
      title: `scp ${fileName}`,
    });
    if (!session) return false;
    if (request.password) this.#injectScpPassword(session.id, request.password);
    this.status.value = `Transferring ${fileName} → ${muxstoneScpDestinationLabel(request)} in a new window…`;
    return true;
  }

  /** Watches one scp session for its password prompt and answers it exactly once. */
  #injectScpPassword(sessionId: string, password: string, timeoutMs = 30_000): void {
    const runtime = this.#runtimes.get(sessionId);
    if (!runtime) return;
    let buffer = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      runtime.outputTaps.delete(tap);
    };
    const tap = (chunk: string) => {
      if (done) return;
      buffer = (buffer + chunk).slice(-256);
      if (/[Pp]assword:\s*$|[Pp]assphrase[^:]*:\s*$/.test(buffer)) {
        finish();
        void this.writeSession(sessionId, `${password}\r`).catch(() => false);
      }
    };
    const timer = setTimeout(finish, Math.max(1_000, timeoutMs));
    runtime.outputTaps.add(tap);
  }

  /** Dismisses the modal; returns the original paste text when it should be forwarded. */
  cancelScpTransfer(pastePathInstead: boolean): string | undefined {
    if (this.#disposed) return undefined;
    const request = this.pendingScp.peek();
    this.pendingScp.value = undefined;
    this.#scpCwdCapture = undefined;
    this.status.value = this.#statusSummary();
    return pastePathInstead ? request?.pasteText : undefined;
  }

  #ensureTailnetPoller(): TailnetPoller {
    this.#tailnetPoller ??= new TailnetPoller({
      source: this.#tailnetSource,
      onResult: (result) => {
        if (this.#disposed) return;
        this.networkStatus.value = result;
      },
      ...(this.#tailnetPollIntervalMs !== undefined ? { intervalMs: this.#tailnetPollIntervalMs } : {}),
    });
    return this.#tailnetPoller;
  }

  /** Launches a daemon-owned shell, floating by default or tiled when explicitly docked. */
  async spawn(options: MuxstoneControllerSpawnOptions = {}): Promise<MuxstoneSessionSummary | undefined> {
    this.#assertActive();
    if (options.bounds) this.#lastBounds = { ...options.bounds };
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
      // Ctrl-N s away on the shelf when it launched the terminal.
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

  /** Cycles the animated desktop background and persists the selection. */
  cycleBackground(direction: -1 | 1 = 1): MuxstoneBackgroundId {
    this.#assertActive();
    const current = MUXSTONE_BACKGROUND_IDS.indexOf(this.backgroundId.peek());
    const next = (Math.max(0, current) + direction + MUXSTONE_BACKGROUND_IDS.length) % MUXSTONE_BACKGROUND_IDS.length;
    this.backgroundId.value = MUXSTONE_BACKGROUND_IDS[next]!;
    this.themeRevision.value += 1;
    this.#persistMetadata();
    this.status.value = `Background: ${MUXSTONE_BACKGROUND_IDS[next]!}`;
    return MUXSTONE_BACKGROUND_IDS[next]!;
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
    this.savedHosts.value = restored.savedHosts;
    this.sessionHosts.value = restored.sessionHosts;
    this.backgroundId.value = restored.backgroundId;
    this.windowSettings.value = restored.windowSettings;
    for (const [sessionId, settings] of Object.entries(restored.windowSettings)) {
      this.#applyWindowSettings(sessionId, settings);
    }
    this.themeRevision.value += 1;
    // The network panel opens on demand from the menu; a restored session
    // starts with it tucked away regardless of how the last run ended.
    this.windowHost.execute(
      { kind: "minimize", id: MUXSTONE_NETWORK_WINDOW_ID },
      { column: 0, row: 0, width: 120, height: 36 },
    );
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
    if (runtime.outputTaps.size > 0) {
      const text = typeof frameValue.data === "string" ? frameValue.data : new TextDecoder().decode(frameValue.data);
      for (const tap of runtime.outputTaps) tap(text);
    }
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
      // The network panel stacks in the normal tier so freshly spawned
      // terminals (which take focus) always land above it.
      {
        id: MUXSTONE_NETWORK_WINDOW_ID,
        title: "Network",
        minWidth: 24,
        minHeight: 8,
        maxWidth: 46,
        maxHeight: 42,
        placement: "floating",
        floatingRect: { column: 0, row: 0, width: 32, height: 22 },
      },
      ...[...runtimes.values()].map((runtime) => ({
        id: muxstoneWindowId(runtime.sessionId),
        title: (summaries.get(runtime.sessionId) ?? runtime.summary.peek()).title,
        minWidth: 20,
        minHeight: 6,
        maxWidth: MUXSTONE_MAX_COLUMNS + 2,
        maxHeight: MUXSTONE_MAX_ROWS + 2,
        ...(runtime.sessionId === floatingSessionId
          ? { placement: "floating" as const, floatingRect: this.#centeredFloatingRect() }
          : {}),
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
    const sessionHosts: Record<string, string> = {};
    for (const [sessionId, target] of Object.entries(this.sessionHosts.peek())) {
      if (this.#runtimes.has(sessionId)) sessionHosts[sessionId] = target;
    }
    const windowSettings: Record<string, MuxstoneWindowSettings> = {};
    for (const [sessionId, settings] of Object.entries(this.windowSettings.peek())) {
      if (this.#runtimes.has(sessionId)) windowSettings[sessionId] = settings;
    }
    this.kernel.setState({
      schemaVersion: 1,
      themeId: this.themeId.peek(),
      terminalOrdinal: this.#terminalOrdinal,
      ...(selected && this.#runtimes.has(selected) ? { activeSessionId: selected } : {}),
      savedHosts: this.savedHosts.peek(),
      backgroundId: this.backgroundId.peek(),
      sessionHosts,
      windowSettings,
    });
  }

  #statusSummary(): string {
    const sessions = this.sessions.peek();
    const running = sessions.filter((session) => session.running).length;
    const hidden = [...this.#runtimes.values()].filter((runtime) => !runtime.attached.peek()).length;
    return `${running}/${sessions.length} running · ${hidden} detached · Ctrl-N ? commands`;
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
    this.quitModalVisible.dispose();
    this.#tailnetPoller?.dispose();
    this.networkTree.dispose();
    this.networkStatus.dispose();
    this.savedHosts.dispose();
    this.sessionHosts.dispose();
    this.backgroundId.dispose();
    this.pendingScp.dispose();
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
    outputTaps: new Set(),
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
