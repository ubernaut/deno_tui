// Copyright 2023 Im-Beast. MIT license.

import { createTerminalApp, type TerminalApp, type TerminalAppOptions } from "../../../mod.app.ts";
import {
  Component,
  type ComponentOptions,
  Computed,
  createAnsiStyle,
  DrawObject,
  encodeTerminalKeyPress,
  type PointerInputEvent,
  type Rectangle,
  Signal,
  type SignalOfObject,
  type Style,
  type TreeRow,
  type WorkbenchWindowChromeProjection,
  type WorkbenchWindowHostCommand,
  type WorkbenchWindowHostProjection,
  type WorkbenchWindowHostProjectionOptions,
} from "../../../mod.ts";
import type { KeyPressEvent, MousePressEvent, MouseScrollEvent } from "../../../src/input_reader/types.ts";
import {
  layoutWorkbenchButtonRowInto,
  type WorkbenchButtonRowItem,
  type WorkbenchButtonRowPlacement,
  type WorkbenchButtonRowRenderCommand,
  workbenchButtonRowRenderCommandsInto,
} from "../../../src/app/workbench_control_layout.ts";
import {
  createMuxstoneController,
  MUXSTONE_NETWORK_WINDOW_ID,
  MUXSTONE_SESSIONS_WINDOW_ID,
  MuxstoneController,
  type MuxstoneControllerOptions,
  muxstoneNetworkNodeDeviceId,
  muxstoneNetworkNodeHostShellTarget,
  muxstoneNetworkNodeHostTarget,
  muxstoneNetworkNodeSessionId,
  muxstoneScpCandidatePath,
  muxstoneScpDestinationLabel,
  type MuxstoneScpRequest,
  type MuxstoneTerminalRuntime,
} from "./controller.ts";
import {
  MUXSTONE_BACKGROUND_IDS,
  MUXSTONE_GLOBAL_SETTING_SPECS,
  MUXSTONE_THEMES,
  MUXSTONE_WINDOW_SETTING_SPECS,
  type MuxstoneBackgroundId,
  type MuxstoneBorderGlyphs,
  muxstoneBorderGlyphs,
  type MuxstoneRgb,
  muxstoneSessionIdFromWindow,
  type MuxstoneSessionSummary,
  type MuxstoneThemeSpec,
  muxstoneWindowId,
  type MuxstoneWindowSettings,
} from "./model.ts";
import { textWidth } from "../../../src/utils/strings.ts";
import {
  muxstoneBackgroundOvergrows,
  muxstoneOvergrowthRatio,
  MuxstoneOvergrowthTracker,
  muxstoneOvergrowthVisible,
} from "./overgrowth.ts";
import { MuxstoneOperationQueue } from "./operation_queue.ts";
import { MUXSTONE_PROTOCOL_LIMITS } from "./protocol.ts";
import {
  muxstonePointerCancellationEvent as pointerCancellationEvent,
  MuxstoneTerminalMouseRouter,
} from "./terminal_mouse.ts";
import { muxstoneTerminalForegroundRgb, muxstoneTerminalRgb } from "./terminal_palette.ts";
import { type MuxstoneAnimatedBackground, muxstoneBackgroundAcceptsPicks } from "./background.ts";
import { MuxstoneBiomechField } from "./biomech_background.ts";
import { MuxstoneCircuitField } from "./circuit_background.ts";
import { MuxstoneJungleField } from "./jungle_background.ts";
import { MuxstoneMatrixRainField } from "./matrix_background.ts";
import { MuxstoneIvyField } from "./ivy_background.ts";
import { MuxstoneSkullField } from "./skull_background.ts";
import { MuxstoneVaporwaveField } from "./vaporwave_background.ts";
import {
  MUXSTONE_METABALL_FRAME_INTERVAL_MS,
  MUXSTONE_METABALL_LEVELS,
  MuxstoneMetaballField,
} from "./metaball_background.ts";

/** Actions exposed through the application command registry. */
export type MuxstoneAppAction =
  | Readonly<{ type: "muxstone.new" }>
  | Readonly<{ type: "muxstone.sessions" }>
  | Readonly<{ type: "muxstone.theme" }>
  | Readonly<{ type: "muxstone.help" }>
  | Readonly<{ type: "muxstone.detach" }>
  | Readonly<{ type: "muxstone.kill" }>
  | Readonly<{ type: "muxstone.quit" }>;

/** Mutable mount slot populated synchronously by TerminalApp setup. */
export interface MuxstoneAppMountRef {
  current?: MuxstoneAppMount;
}

/** Mounted surfaces and interaction hooks useful to launchers and pilots. */
export interface MuxstoneAppMount {
  readonly app: TerminalApp<MuxstoneAppAction>;
  readonly controller: MuxstoneController;
  readonly bodyRect: Computed<Rectangle>;
  readonly shelfBounds: Computed<Rectangle>;
  readonly windowProjection: Computed<WorkbenchWindowHostProjection>;
  readonly selectedSessionIndex: Signal<number>;
  /** Serializes workbench commands and raw PTY input in their arrival order. */
  enqueue(operation: () => void | Promise<unknown>): Promise<void>;
  /** Routes normalized browser/pen/touch input without compatibility-mouse duplication. */
  handlePointer(event: PointerInputEvent): Promise<boolean>;
  /** Routes physical wheel or trackpad scrolling at one cell coordinate. */
  handleScroll(event: MouseScrollEvent): Promise<boolean>;
  /** Returns the completed background-frame count for diagnostics and pilots. */
  metaballFrameRevision(): number;
  /** Window id → background reclaim ratio, for diagnostics and pilots. */
  overgrowthRatios(): ReadonlyMap<string, number>;
  whenIdle(): Promise<void>;
  dispose(): void;
}

/** Controller, app options, and mount reference returned to hosts. */
export interface MuxstoneAppDefinition {
  readonly controller: MuxstoneController;
  readonly mount: MuxstoneAppMountRef;
  readonly terminalOptions: TerminalAppOptions<MuxstoneAppAction>;
}

/** Minimal browser/mobile input source accepted by the Muxstone pointer bridge. */
export interface MuxstonePointerInputSource {
  on(type: "pointerInput", listener: (event: PointerInputEvent) => void | Promise<void>): () => void;
  on(type: "mouseScroll", listener: (event: MouseScrollEvent) => void | Promise<void>): () => void;
}

/** Dependencies accepted by the definition/runtime factories. */
export interface CreateMuxstoneAppDefinitionOptions {
  readonly controller?: MuxstoneController;
  readonly controllerOptions?: MuxstoneControllerOptions;
}

/** Running real-terminal Muxstone instance. */
export interface MuxstoneTerminalAppRuntime {
  readonly app: TerminalApp<MuxstoneAppAction>;
  readonly controller: MuxstoneController;
  readonly mount: MuxstoneAppMount;
  start(): void;
  destroy(): Promise<void>;
}

// One top bar, no bottom bars: the window taskbar sits inline on the top row
// and every command lives in the start-menu dropdown, so all other rows are
// terminal real estate.
const HEADER_ROWS = 1;
const FOOTER_ROWS = 0;
const SESSION_LIST_START = 3;
/** Start-menu button occupying the top-left, opening the command dropdown. */
const START_BUTTON_IDLE_LABEL = "≡ Muxstone ▾";
const START_BUTTON_PREFIX_LABEL = "≡ PREFIX ▾";
const START_BUTTON = Object.freeze({ column: 0, row: 0, width: 14, height: 1 });
const MENU_QUIT_WIDTH = 5;
/** Command items listed in the start-menu dropdown, in display order. */
const START_MENU_ITEMS: readonly { readonly id: MuxstoneMenuId; readonly label: string; readonly danger?: boolean }[] =
  Object.freeze([
    { id: "new", label: "New terminal" },
    { id: "network", label: "Network" },
    { id: "sessions", label: "Sessions" },
    { id: "config", label: "Settings" },
    { id: "help", label: "Help" },
    { id: "quit", label: "Quit", danger: true },
  ]);
const NETWORK_LIST_START = 1;
const MAX_TOUCH_GESTURES = 8;
const SCROLL_LINES_PER_NOTCH = 3;
const CLASSIFIED_INPUT_PIPELINE_DEPTH = 4;
const MAX_CLASSIFIED_INPUT_BYTES = MUXSTONE_PROTOCOL_LIMITS.inputBytes * CLASSIFIED_INPUT_PIPELINE_DEPTH;
const MIN_CLASSIFIED_KEY_RESERVATION_BYTES = 64;

/** Keeps animation behind explicit input and control work without treating child output as interaction. */
export function muxstoneMetaballsMayAdvance(
  now: number,
  lastInputActivityAt: number,
  hasPendingBarrier: boolean,
): boolean {
  return !hasPendingBarrier && now - lastInputActivityAt >= MUXSTONE_METABALL_FRAME_INTERVAL_MS;
}

type MuxstoneMenuId = "new" | "network" | "sessions" | "config" | "help" | "quit";

function menuQuitRect(bounds: Rectangle): Rectangle {
  return {
    column: bounds.column + Math.max(0, bounds.width - MENU_QUIT_WIDTH),
    row: 0,
    width: Math.min(MENU_QUIT_WIDTH, bounds.width),
    height: 1,
  };
}

/** One command row inside the start-menu dropdown. */
export interface MuxstoneStartMenuItemLayout {
  readonly id: MuxstoneMenuId;
  readonly label: string;
  readonly danger: boolean;
  readonly rect: Rectangle;
}

/** Placement of the start-menu dropdown; exported for deterministic pointer tests. */
export interface MuxstoneStartMenuLayout {
  readonly panelRect: Rectangle;
  readonly items: readonly MuxstoneStartMenuItemLayout[];
}

/** Lays out the start-menu dropdown hanging below the top-left button. */
export function muxstoneStartMenuLayout(bounds: Rectangle): MuxstoneStartMenuLayout {
  const labelWidth = START_MENU_ITEMS.reduce((max, item) => Math.max(max, textWidth(item.label)), 0);
  const width = Math.min(Math.max(18, labelWidth + 4), Math.max(4, bounds.width));
  const height = Math.min(START_MENU_ITEMS.length + 2, Math.max(3, bounds.height - 1));
  const panelRect: Rectangle = { column: bounds.column, row: bounds.row + 1, width, height };
  const items = START_MENU_ITEMS.map((item, index) => ({
    id: item.id,
    label: item.label,
    danger: item.danger ?? false,
    rect: { column: panelRect.column + 1, row: panelRect.row + 1 + index, width: panelRect.width - 2, height: 1 },
  }));
  return { panelRect, items };
}

export type MuxstoneTerminalBarAction =
  | Readonly<{ kind: "session"; sessionId: string }>
  | Readonly<{ kind: "sessions" }>;

export interface MuxstoneTerminalBarProjection {
  readonly bounds: Rectangle;
  readonly collapsed: boolean;
  readonly commands: readonly WorkbenchButtonRowRenderCommand<MuxstoneTerminalBarAction>[];
}

/**
 * Projects the persistent terminal taskbar. Every presentation window that is
 * still open participates, including normal, tiled, floating, and minimized
 * terminals. If one row cannot contain every button, the row becomes one
 * selector that opens the existing session manager instead of silently
 * dropping terminals.
 */
export function projectMuxstoneTerminalBar(
  controller: MuxstoneController,
  _projection: WorkbenchWindowHostProjection,
  bounds: Rectangle,
): MuxstoneTerminalBarProjection {
  const inspection = controller.windowHost.controller.inspect();
  const windowsById = new Map(inspection.windows.map((window) => [window.id, window]));
  const items: WorkbenchButtonRowItem<MuxstoneTerminalBarAction>[] = [];
  for (const session of controller.sessions.peek()) {
    const windowId = muxstoneWindowId(session.id);
    const window = windowsById.get(windowId);
    if (!window || window.state === "closed") continue;
    const hiddenPrefix = window.state === "minimized" ? "▁ " : "";
    items.push({
      label: `${hiddenPrefix}${fitText(session.title, 18)}`,
      action: { kind: "session", sessionId: session.id },
      active: inspection.activeWindowId === windowId,
    });
  }

  let collapsed = false;
  let placements: WorkbenchButtonRowPlacement<MuxstoneTerminalBarAction>[] = [];
  layoutWorkbenchButtonRowInto(placements, items, bounds, bounds.row, { gap: 1 });
  if (placements.length < items.length) {
    collapsed = true;
    placements = [];
    layoutWorkbenchButtonRowInto(
      placements,
      [{
        label: `Terminals (${items.length}) ▾`,
        action: { kind: "sessions" },
      }],
      bounds,
      bounds.row,
      { gap: 0 },
    );
  }
  const commands: WorkbenchButtonRowRenderCommand<MuxstoneTerminalBarAction>[] = [];
  workbenchButtonRowRenderCommandsInto(commands, placements);
  return { bounds: { ...bounds }, collapsed, commands };
}

type MuxstoneTouchTarget =
  | Readonly<{ kind: "menu"; id: MuxstoneMenuId; hitRect: Rectangle }>
  | Readonly<{ kind: "start-item"; id: MuxstoneMenuId; hitRect: Rectangle }>
  | Readonly<{
    kind: "modal";
    action:
      | "close-help"
      | "cancel-kill"
      | "confirm-kill"
      | "cancel-quit"
      | "detach-quit"
      | "terminate-quit"
      | "cancel-scp"
      | "paste-scp"
      | "send-scp";
    sessionId?: string;
    hitRect: Rectangle;
  }>
  | Readonly<{ kind: "window-command"; command: WorkbenchWindowHostCommand; hitRect: Rectangle }>
  | Readonly<{ kind: "terminal-bar"; action: MuxstoneTerminalBarAction; hitRect: Rectangle }>
  | Readonly<{ kind: "client"; windowId: string }>;

interface MuxstoneTouchGesture {
  readonly target: MuxstoneTouchTarget;
  readonly startColumn: number;
  readonly startRow: number;
  readonly startLocalX?: number;
  readonly startLocalY?: number;
  lastColumn: number;
  lastRow: number;
  moved: boolean;
}

interface MuxstonePointerMoveExcursion {
  minColumn?: number;
  maxColumn?: number;
  minRow?: number;
  maxRow?: number;
  minLocalX?: number;
  maxLocalX?: number;
  minLocalY?: number;
  maxLocalY?: number;
}

interface MuxstonePointerMoveSlot {
  event: PointerInputEvent;
  readonly ingressRevision: number;
  readonly excursion: MuxstonePointerMoveExcursion;
  readonly result: Promise<boolean>;
  readonly settle: (handled: boolean) => void;
  started: boolean;
}

interface MuxstoneManagerSessionHit {
  readonly session: MuxstoneSessionSummary;
  readonly index: number;
}

/**
 * Binds a browser/mobile host's normalized pointer stream. Browser callers
 * must not also bind its compatibility `mousePress` stream.
 */
export function bindMuxstonePointerInput(
  mount: MuxstoneAppMount,
  source: MuxstonePointerInputSource,
): () => void {
  const stopPointer = source.on("pointerInput", async (event) => {
    await mount.handlePointer(event);
  });
  const stopScroll = source.on("mouseScroll", async (event) => {
    await mount.handleScroll(event);
  });
  return () => {
    stopScroll();
    stopPointer();
  };
}

/** Creates an initialized Muxstone app definition around a detached-host controller. */
export async function createMuxstoneAppDefinition(
  options: CreateMuxstoneAppDefinitionOptions,
): Promise<MuxstoneAppDefinition> {
  const controller = options.controller ??
    (options.controllerOptions ? await createMuxstoneController(options.controllerOptions) : undefined);
  if (!controller) throw new TypeError("Muxstone requires a controller or controllerOptions.");
  await controller.ready;
  const mount: MuxstoneAppMountRef = {};
  return {
    controller,
    mount,
    terminalOptions: createMuxstoneTerminalOptions(controller, mount),
  };
}

/** Creates and mounts the real terminal app without starting its input reader. */
export async function createMuxstoneTerminalApp(
  options: CreateMuxstoneAppDefinitionOptions,
): Promise<MuxstoneTerminalAppRuntime> {
  const definition = await createMuxstoneAppDefinition(options);
  const app = createTerminalApp(definition.terminalOptions);
  const mount = definition.mount.current;
  if (!mount) {
    app.destroy();
    await definition.controller.dispose();
    throw new Error("Muxstone desktop did not mount.");
  }
  return {
    app,
    controller: definition.controller,
    mount,
    start: () => app.start(),
    destroy: async () => {
      app.destroy();
      await definition.controller.dispose();
    },
  };
}

/** Builds the declarative TerminalApp contract around one controller. */
export function createMuxstoneTerminalOptions(
  controller: MuxstoneController,
  mount: MuxstoneAppMountRef = {},
): TerminalAppOptions<MuxstoneAppAction> {
  return {
    id: "muxstone",
    label: "Muxstone",
    exitOnSignal: false,
    tuiOptions: { refreshRate: 1000 / 60 },
    commands: muxstoneCommands(),
    onAction: (action) => handleMuxstoneAction(action, mount),
    setup(app) {
      const mounted = mountMuxstoneDesktop(app, controller);
      mount.current = mounted;
      return () => {
        if (mount.current === mounted) mount.current = undefined;
        mounted.dispose();
        void controller.dispose();
      };
    },
  };
}

/** Mounts the retained terminal desktop, window routing, and serialized input queue. */
export function mountMuxstoneDesktop(
  app: TerminalApp<MuxstoneAppAction>,
  controller: MuxstoneController,
): MuxstoneAppMount {
  const owned: Array<{ dispose(): void }> = [];
  const unsubscribers: Array<() => void> = [];
  const subscriptions = new AbortController();
  const own = <T extends { dispose(): void }>(value: T): T => {
    owned.push(value);
    return value;
  };
  const selectedSessionIndex = own(new Signal(0));
  const metaballRevision = own(new Signal(0));
  const metaballs = new MuxstoneMetaballField();
  const backgroundFields = new Map<MuxstoneBackgroundId, MuxstoneAnimatedBackground>();
  const activeBackgroundField = (): MuxstoneAnimatedBackground | undefined => {
    const id = controller.backgroundId.peek();
    if (id === "metaballs") return undefined;
    let field = backgroundFields.get(id);
    if (!field) {
      field = id === "matrix"
        ? new MuxstoneMatrixRainField()
        : id === "circuit"
        ? new MuxstoneCircuitField()
        : id === "biomech"
        ? new MuxstoneBiomechField()
        : id === "vaporwave"
        ? new MuxstoneVaporwaveField()
        : id === "skull"
        ? new MuxstoneSkullField()
        : id === "ivy"
        ? new MuxstoneIvyField()
        : new MuxstoneJungleField();
      backgroundFields.set(id, field);
    }
    return field;
  };
  const backgroundSetPointer = (point: { column: number; row: number }): void => {
    metaballs.setPointer(point);
    activeBackgroundField()?.setPointer(point);
  };
  const backgroundClearPointer = (): void => {
    metaballs.clearPointer();
    activeBackgroundField()?.clearPointer();
  };
  let lastInputActivityAt = performance.now();
  const bodyRect = own(
    new Computed<Rectangle>(() => ({
      column: 0,
      row: Math.min(HEADER_ROWS, Math.max(0, app.tui.rectangle.value.height - 1)),
      width: Math.max(1, app.tui.rectangle.value.width),
      height: Math.max(1, app.tui.rectangle.value.height - HEADER_ROWS - FOOTER_ROWS),
    })),
  );
  // The window taskbar shares the top bar: it starts just past the start button
  // and stops short of the quick quit control on the right.
  const shelfBounds = own(
    new Computed<Rectangle>(() => {
      const width = app.tui.rectangle.value.width;
      const column = START_BUTTON.width + 1;
      const available = Math.max(0, width - column - MENU_QUIT_WIDTH - 1);
      return { column, row: 0, width: Math.max(1, available), height: 1 };
    }),
  );
  const projectionOptions = (): WorkbenchWindowHostProjectionOptions => ({
    separatorHitSize: 3,
    shelfBounds: shelfBounds.peek(),
  });
  const windowProjection = own(
    new Computed(() =>
      controller.windowHost.project(bodyRect.value, {
        separatorHitSize: 3,
        shelfBounds: shelfBounds.value,
      })
    ),
  );

  let disposed = false;
  // Consecutive raw bytes share a bounded, protocol-sized pipeline. Every
  // control/window operation is a barrier: it waits for preceding input ACKs,
  // then blocks later input until the operation is complete.
  const reportInputError = (error: unknown): void => {
    if (!disposed) controller.status.value = `Muxstone input failed: ${safeErrorMessage(error)}`;
  };
  const operationQueue = new MuxstoneOperationQueue({
    write: (sessionId, data) => controller.writeSession(sessionId, data),
    reportError: reportInputError,
  });
  let ingressRevision = 0;
  const enqueue = (operation: () => void | Promise<unknown>): Promise<void> => {
    ingressRevision += 1;
    return disposed ? operationQueue.whenIdle() : operationQueue.enqueueBarrier(operation);
  };
  const enqueueRaw = (
    data: string | Uint8Array,
    sessionId = controller.activeRuntime()?.sessionId,
  ): Promise<void> => {
    ingressRevision += 1;
    lastInputActivityAt = performance.now();
    return disposed || !sessionId ? operationQueue.whenIdle() : operationQueue.enqueueInput(sessionId, data);
  };
  const enqueueGuardedRaw = (
    data: string | Uint8Array,
    shouldWrite: () => boolean | Promise<boolean>,
    sessionId = controller.activeRuntime()?.sessionId,
  ): Promise<void> => {
    ingressRevision += 1;
    lastInputActivityAt = performance.now();
    return disposed || !sessionId
      ? operationQueue.whenIdle()
      : operationQueue.enqueueGuardedInput(sessionId, data, shouldWrite);
  };
  const syncWindows = async (): Promise<void> => {
    await controller.syncWindowVisibility(bodyRect.peek());
    const projection = controller.windowHost.project(bodyRect.peek(), projectionOptions());
    controller.syncTerminalGeometry(projection);
  };
  const runWindowCommand = async (
    command: WorkbenchWindowHostCommand,
    alreadyExecuted: boolean,
    fallbackWindowId?: string,
  ): Promise<void> => {
    const closeWindowId = command.kind === "close"
      ? command.id ?? fallbackWindowId ?? controller.windowHost.controller.inspect().activeWindowId
      : undefined;
    const closeSessionId = muxstoneSessionIdFromWindow(closeWindowId);
    if (closeSessionId && controller.runtime(closeSessionId)) {
      const killed = await controller.killSession(closeSessionId);
      if (!killed && alreadyExecuted && controller.runtime(closeSessionId)) {
        // Pointer/key chrome has already committed the generic close. Restore
        // the view when the daemon rejects termination so a live PTY never
        // becomes a hidden or frozen orphan.
        controller.windowHost.execute({ kind: "restore", id: closeWindowId }, bodyRect.peek());
        controller.windowHost.execute({ kind: "focus", id: closeWindowId }, bodyRect.peek());
      }
    } else if (!alreadyExecuted) {
      controller.windowHost.execute(command, bodyRect.peek(), projectionOptions());
    }
    await syncWindows();
  };

  // Computed captures its dependency set when it is constructed. A desktop
  // mounted with zero sessions therefore cannot discover render signals for a
  // terminal spawned later. Bridge the changing runtime set through one stable
  // signal so every attached/spawned terminal can invalidate the retained
  // desktop immediately.
  const terminalRenderRevision = own(new Signal(0));
  const terminalRenderSubscriptions = new Map<
    string,
    { signal: Signal<number>; listener: () => void }
  >();
  const syncTerminalRenderSubscriptions = (
    sessions = controller.sessions.peek(),
  ): void => {
    const liveIds = new Set(sessions.map((session) => session.id));
    for (const [sessionId, subscription] of terminalRenderSubscriptions) {
      const runtime = controller.runtime(sessionId);
      if (liveIds.has(sessionId) && runtime?.renderRevision === subscription.signal) continue;
      subscription.signal.unsubscribe(subscription.listener);
      terminalRenderSubscriptions.delete(sessionId);
    }
    for (const session of sessions) {
      if (terminalRenderSubscriptions.has(session.id)) continue;
      const signal = controller.runtime(session.id)?.renderRevision;
      if (!signal) continue;
      const listener = () => {
        terminalRenderRevision.value += 1;
      };
      signal.subscribe(listener, subscriptions.signal);
      terminalRenderSubscriptions.set(session.id, { signal, listener });
    }
  };
  syncTerminalRenderSubscriptions();
  controller.sessions.subscribe(syncTerminalRenderSubscriptions, subscriptions.signal);
  unsubscribers.push(() => {
    for (const subscription of terminalRenderSubscriptions.values()) {
      subscription.signal.unsubscribe(subscription.listener);
    }
    terminalRenderSubscriptions.clear();
  });

  const overgrowthTracker = new MuxstoneOvergrowthTracker();
  let overgrowthRatios: ReadonlyMap<string, number> = new Map();

  /** True when the active background reclaims idle windows and the user wants it. */
  const overgrowthEnabled = (): boolean =>
    controller.globalSettings.peek().overgrowInactive &&
    muxstoneBackgroundOvergrows(controller.backgroundId.peek());

  /** Recomputes per-window reclaim ratios; returns true when any of them moved. */
  const syncOvergrowth = (
    projection: WorkbenchWindowHostProjection,
    activeWindowId: string | undefined,
    now: number,
  ): boolean => {
    if (!overgrowthEnabled()) {
      if (overgrowthRatios.size === 0) return false;
      overgrowthTracker.clear();
      overgrowthRatios = new Map();
      return true;
    }
    const fullMs = controller.globalSettings.peek().overgrowFullMs;
    overgrowthTracker.sync(projection.windows.map((window) => window.id), activeWindowId, now);
    const next = new Map<string, number>();
    let changed = overgrowthRatios.size !== 0 && projection.windows.length === 0;
    for (const window of projection.windows) {
      const ratio = muxstoneOvergrowthRatio(overgrowthTracker.idleMs(window.id, now), fullMs);
      if (ratio > 0) next.set(window.id, ratio);
      // Quantize the comparison so only visible steps trigger a repaint.
      const before = Math.round((overgrowthRatios.get(window.id) ?? 0) * 64);
      if (before !== Math.round(ratio * 64)) changed = true;
    }
    overgrowthRatios = next;
    return changed;
  };

  const animateMetaballs = (): void => {
    if (disposed || !app.started) return;
    const projection = windowProjection.peek();
    const now = performance.now();
    // Overgrowth keeps advancing even when windows fully occlude the desktop —
    // that is precisely the case where the background is creeping over them.
    const backdropVisible = muxstoneMetaballBackgroundVisible(projection, bodyRect.peek());
    if (!backdropVisible && !overgrowthEnabled()) {
      // Nothing left to animate, but reclaim state from a previous background
      // must still be retired or those windows stay overgrown forever.
      if (syncOvergrowth(projection, undefined, now)) metaballRevision.value += 1;
      return;
    }
    if (!muxstoneMetaballsMayAdvance(now, lastInputActivityAt, operationQueue.hasPendingBarrier())) return;
    const activeWindowId = controller.windowHost.controller.inspect().activeWindowId;
    const activeRect = projection.windows.find((window) => window.id === activeWindowId)?.rect;
    // A window the background has begun reclaiming is no longer an obstacle to
    // it: circuits route their traces straight over idle windows so there is
    // something to see once the overgrowth exposes the board underneath.
    const reclaiming = overgrowthEnabled();
    const obstacles = projection.windows
      .filter((window) => !reclaiming || (overgrowthRatios.get(window.id) ?? 0) <= 0)
      .map((window) => window.rect);
    const frame = {
      bounds: bodyRect.peek(),
      obstacles,
      ...(activeRect ? { activeObstacle: activeRect } : {}),
      now,
    };
    const advanced = activeBackgroundField()?.advance(frame) ?? metaballs.advance(frame);
    // Both sides must run every tick: `||` would short-circuit the overgrowth
    // sync away on the (near-universal) frames where the field also advanced.
    const overgrew = syncOvergrowth(projection, activeWindowId, now);
    if (advanced || overgrew) metaballRevision.value += 1;
  };
  const metaballTimer = setInterval(animateMetaballs, MUXSTONE_METABALL_FRAME_INTERVAL_MS);
  unsubscribers.push(() => clearInterval(metaballTimer));

  const renderRevision = own(
    new Computed(() => {
      const projection = windowProjection.value;
      const sessions = controller.sessions.value;
      const fragments: Array<string | number | boolean | undefined> = [
        app.tui.rectangle.value.width,
        app.tui.rectangle.value.height,
        projection.windows.length,
        projection.shelf.length,
        controller.themeRevision.value,
        controller.prefixPending.value,
        controller.helpVisible.value,
        controller.pendingKillSessionId.value,
        controller.status.value,
        selectedSessionIndex.value,
        controller.windowHost.viewRevision.value,
        controller.windowHost.commitRevision.value,
        terminalRenderRevision.value,
        metaballRevision.value,
      ];
      for (const session of sessions) {
        const runtime = controller.runtime(session.id);
        fragments.push(
          session.id,
          session.title,
          session.sequence,
          session.status,
          runtime?.renderRevision.peek(),
          runtime?.attached.peek(),
          runtime?.warning.peek(),
        );
      }
      return fragments.join("|");
    }),
  );

  const desktop = new MuxstoneDesktopSurface({
    parent: app.tui,
    theme: { base: identityStyle },
    zIndex: 1,
    rectangle: app.tui.rectangle,
    revision: renderRevision,
    render: () =>
      renderMuxstoneDesktop({
        bounds: app.tui.rectangle.peek(),
        body: bodyRect.peek(),
        projection: windowProjection.peek(),
        controller,
        selectedSessionIndex: selectedSessionIndex.peek(),
        shelf: shelfBounds.peek(),
        metaballs,
        backgroundField: activeBackgroundField(),
        ...(overgrowthRatios.size > 0 ? { overgrowth: { ratios: overgrowthRatios } } : {}),
      }),
  });
  void desktop;

  const terminalMouse = new MuxstoneTerminalMouseRouter(controller);
  const touchGestures = new Map<number, MuxstoneTouchGesture>();
  let pendingPointerMove: MuxstonePointerMoveSlot | undefined;
  const modalOpen = (): boolean =>
    controller.helpVisible.peek() || controller.pendingKillSessionId.peek() !== undefined ||
    controller.quitModalVisible.peek() || controller.pendingScp.peek() !== undefined ||
    controller.configSessionId.peek() !== undefined || controller.globalConfigVisible.peek() ||
    controller.startMenuVisible.peek();

  let exitRequested = false;
  const requestClientExit = (terminateHost: boolean): void => {
    if (exitRequested || disposed) return;
    exitRequested = true;
    controller.cancelQuitModal();
    void (async () => {
      if (terminateHost) {
        try {
          await controller.shutdownHost();
        } catch {
          // The client still exits; an unreachable host cannot block quitting.
        }
      }
      // The launcher's shutdown binding listens for this event; emitting it is
      // the same exit path as SIGINT and must precede the listener teardown
      // that app.destroy() performs.
      app.tui.emit("destroy");
      app.destroy();
    })();
  };

  const performMenu = async (id: MuxstoneMenuId): Promise<void> => {
    switch (id) {
      case "new":
        await controller.spawn({ bounds: bodyRect.peek() });
        break;
      case "sessions":
        controller.openSessionManager(bodyRect.peek());
        break;
      case "network":
        controller.toggleNetworkPanel(bodyRect.peek());
        break;
      case "config":
        controller.openGlobalConfig();
        break;
      case "help":
        controller.openHelp();
        break;
      case "quit":
        controller.openQuitModal();
        break;
    }
    await syncWindows();
  };

  const activateNetworkNode = async (row: TreeRow): Promise<void> => {
    const sessionId = muxstoneNetworkNodeSessionId(row.id);
    if (sessionId) {
      await controller.openSession(sessionId, bodyRect.peek());
      await syncWindows();
      return;
    }
    const hostShellTarget = muxstoneNetworkNodeHostShellTarget(row.id);
    if (hostShellTarget) {
      await controller.spawnNetworkShell(hostShellTarget, hostShellTarget, bodyRect.peek());
      await syncWindows();
      return;
    }
    if (!row.id.startsWith("act:shell:")) return;
    const device = controller.networkDevice(row.id);
    if (!device) return;
    const target = MuxstoneController.tailnetSshTarget(device);
    if (!target) {
      controller.status.value = `No reachable SSH target for ${device.shortName}.`;
      return;
    }
    await controller.spawnNetworkShell(target, device.shortName, bodyRect.peek());
    await syncWindows();
  };

  const networkRowAt = (column: number, row: number): TreeRow | undefined => {
    const projection = windowProjection.peek();
    const window = projection.windows.find((candidate) => candidate.id === MUXSTONE_NETWORK_WINDOW_ID);
    if (!window || !contains(window.clientRect, column, row)) return undefined;
    const relative = row - window.clientRect.row - NETWORK_LIST_START;
    if (relative < 0) return undefined;
    const tree = controller.networkTree;
    const height = Math.max(1, window.clientRect.height - NETWORK_LIST_START);
    const visible = tree.visible(height);
    const target = visible[relative];
    if (!target) return undefined;
    tree.setSelectedIndex(target.index);
    return target;
  };

  const activateNetworkHit = async (row: TreeRow): Promise<void> => {
    if (row.hasChildren) {
      controller.networkTree.toggleActive();
      return;
    }
    await activateNetworkNode(row);
  };

  const activateMenu = (id: MuxstoneMenuId): Promise<void> =>
    enqueue(async () => {
      if (modalOpen()) return;
      await performMenu(id);
    });

  const terminalBar = (): MuxstoneTerminalBarProjection =>
    projectMuxstoneTerminalBar(controller, windowProjection.peek(), shelfBounds.peek());
  const terminalBarCommandAt = (column: number, row: number) =>
    terminalBar().commands.find((command) => contains(command.hitRect, column, row));
  const performTerminalBarAction = async (action: MuxstoneTerminalBarAction): Promise<void> => {
    if (action.kind === "sessions") {
      controller.openSessionManager(bodyRect.peek());
    } else {
      await controller.openSession(action.sessionId, bodyRect.peek());
    }
    await syncWindows();
  };

  const cancelActiveWindowGesture = (event?: PointerInputEvent, legacy?: MousePressEvent): boolean => {
    const inspection = controller.windowHost.inspect();
    const pointerId = inspection.interaction.active?.pointerId ?? inspection.separatorResize?.pointerId;
    if (pointerId === undefined) return false;
    const result = controller.windowHost.handlePointer(
      pointerCancellationEvent(pointerId, event, legacy),
      bodyRect.peek(),
      projectionOptions(),
    );
    touchGestures.delete(pointerId);
    return result.handled;
  };

  const activateManagerHit = async (hit: MuxstoneManagerSessionHit): Promise<void> => {
    selectedSessionIndex.value = hit.index;
    await controller.openSession(hit.session.id, bodyRect.peek());
    await syncWindows();
  };

  const scrollClientWindow = (windowId: string, delta: number): boolean => {
    if (!Number.isFinite(delta) || delta === 0 || modalOpen()) return modalOpen();
    if (windowId === MUXSTONE_SESSIONS_WINDOW_ID) {
      const sessions = controller.sessions.peek();
      if (sessions.length === 0) return true;
      selectedSessionIndex.value = clampIndex(selectedSessionIndex.peek() + Math.trunc(delta), sessions.length);
      return true;
    }
    if (windowId === MUXSTONE_NETWORK_WINDOW_ID) {
      controller.networkTree.move(Math.sign(delta));
      return true;
    }
    const sessionId = muxstoneSessionIdFromWindow(windowId);
    const runtime = sessionId ? controller.runtime(sessionId) : undefined;
    if (!runtime) return false;
    // Full-screen apps own their viewport: translate wheel motion into cursor
    // keys instead of trapping the window in workbench copy mode. Children
    // with mouse tracking already consumed the wheel before this fallback.
    const screenInspection = runtime.screen.inspect();
    if (screenInspection.alternate && runtime.scrollback.mode === "live") {
      if (runtime.attached.peek() && runtime.summary.peek().running) {
        const bytes = wheelFallbackKeyBytes(delta, screenInspection.privateModes.includes(1));
        if (bytes) void enqueueRaw(bytes, runtime.sessionId);
      }
      return true;
    }
    const before = runtime.scrollback.inspectViewport();
    if (before.totalRows <= before.viewportRows) return true;
    if (delta > 0 && before.mode === "live") return true;
    runtime.scrollback.scrollLines(Math.trunc(delta));
    const after = runtime.scrollback.inspectViewport();
    if (delta > 0 && after.offset >= after.maxOffset) runtime.scrollback.exitCopyMode();
    runtime.renderRevision.value += 1;
    const current = runtime.scrollback.inspectViewport();
    controller.status.value = current.mode === "copy"
      ? `Copy mode · row ${current.offset + 1}/${Math.max(1, current.totalRows)} · scroll down for live`
      : `Live terminal · ${runtime.summary.peek().title}`;
    return true;
  };

  const scrollWindowAt = (column: number, row: number, delta: number): boolean => {
    const window = clientWindowAt(windowProjection.peek(), column, row);
    return window ? scrollClientWindow(window.id, delta) : false;
  };

  /** Wheel notches scale by the target window's own `Wheel scroll` setting. */
  const wheelDeltaAt = (column: number, row: number, notches: number): number => {
    const window = clientWindowAt(windowProjection.peek(), column, row);
    const sessionId = window ? muxstoneSessionIdFromWindow(window.id) : undefined;
    const lines = sessionId ? controller.windowSettingsFor(sessionId).wheelLines : SCROLL_LINES_PER_NOTCH;
    return notches * lines;
  };

  const performModalActivation = async (column: number, row: number): Promise<boolean> => {
    if (controller.startMenuVisible.peek()) {
      const layout = muxstoneStartMenuLayout(app.tui.rectangle.peek());
      const item = layout.items.find((candidate) => contains(candidate.rect, column, row));
      if (item) {
        controller.closeStartMenu();
        await performMenu(item.id);
        return true;
      }
      // Anywhere else — including the start button itself — simply dismisses.
      controller.closeStartMenu();
      return true;
    }
    if (controller.helpVisible.peek()) {
      if (contains(muxstoneHelpLayout(windowProjection.peek().bounds).closeRect, column, row)) {
        controller.closeHelp();
      }
      return true;
    }
    if (controller.pendingKillSessionId.peek()) {
      const layout = muxstoneKillLayout(windowProjection.peek().bounds);
      if (contains(layout.confirmRect, column, row)) {
        await controller.confirmKillSession();
        await syncWindows();
      } else if (contains(layout.cancelRect, column, row)) {
        controller.cancelKillSession();
      }
      return true;
    }
    if (controller.quitModalVisible.peek()) {
      const layout = muxstoneQuitLayout(windowProjection.peek().bounds);
      if (contains(layout.terminateRect, column, row)) requestClientExit(true);
      else if (contains(layout.detachRect, column, row)) requestClientExit(false);
      else if (contains(layout.cancelRect, column, row)) controller.cancelQuitModal();
      return true;
    }
    if (controller.globalConfigVisible.peek()) {
      const themeIndex = Math.max(0, MUXSTONE_THEMES.findIndex((entry) => entry.id === controller.themeId.peek()));
      const backgroundIndex = Math.max(0, MUXSTONE_BACKGROUND_IDS.indexOf(controller.backgroundId.peek()));
      const layout = muxstoneGlobalConfigLayout(windowProjection.peek().bounds, themeIndex, backgroundIndex);
      if (contains(layout.closeRect, column, row)) {
        controller.closeGlobalConfig();
        return true;
      }
      for (const entry of layout.themeRows) {
        if (!contains(entry.rect, column, row)) continue;
        controller.globalConfigPane.value = "theme";
        controller.setTheme(MUXSTONE_THEMES[entry.index]!.id);
        return true;
      }
      for (const entry of layout.backgroundRows) {
        if (!contains(entry.rect, column, row)) continue;
        controller.globalConfigPane.value = "background";
        controller.setBackground(MUXSTONE_BACKGROUND_IDS[entry.index]!);
        return true;
      }
      for (let index = 0; index < layout.optionRows.length; index += 1) {
        if (!contains(layout.optionRows[index]!, column, row)) continue;
        controller.globalConfigPane.value = "options";
        controller.globalConfigOptionIndex.value = index;
        controller.cycleGlobalSetting(MUXSTONE_GLOBAL_SETTING_SPECS[index]!.id, 1);
        return true;
      }
      return true;
    }
    const configSessionId = controller.configSessionId.peek();
    if (configSessionId) {
      const layout = muxstoneWindowConfigLayout(windowProjection.peek().bounds);
      if (contains(layout.closeRect, column, row)) {
        controller.closeWindowConfig();
      } else if (contains(layout.resetRect, column, row)) {
        controller.resetWindowSettings(configSessionId);
      } else {
        for (let index = 0; index < layout.rowRects.length; index += 1) {
          if (!contains(layout.rowRects[index]!, column, row)) continue;
          controller.configRowIndex.value = index;
          controller.cycleWindowSetting(configSessionId, MUXSTONE_WINDOW_SETTING_SPECS[index]!.id, 1);
          break;
        }
      }
      return true;
    }
    const scpRequest = controller.pendingScp.peek();
    if (scpRequest) {
      const layout = muxstoneScpLayout(windowProjection.peek().bounds);
      if (contains(layout.sendRect, column, row)) {
        void controller.confirmScpTransfer(bodyRect.peek());
      } else if (contains(layout.pasteRect, column, row)) {
        const text = controller.cancelScpTransfer(true);
        if (text) void controller.writeSession(scpRequest.sessionId, new TextEncoder().encode(text));
      } else if (contains(layout.cancelRect, column, row)) {
        controller.cancelScpTransfer(false);
      }
      return true;
    }
    return false;
  };

  const routeModalActivation = (column: number, row: number): Promise<boolean> => {
    let handled = false;
    return enqueue(async () => {
      if (!modalOpen()) return;
      cancelActiveWindowGesture();
      handled = await performModalActivation(column, row);
    }).then(() => handled);
  };

  const routeWindowPointer = async (event: MousePressEvent): Promise<boolean> => {
    backgroundSetPointer({ column: event.x, row: event.y });
    if (modalOpen()) {
      if (terminalMouse.hasLegacyCapture) {
        const packet = terminalMouse.routeLegacyPress(
          { ...event, drag: false, release: true },
          windowProjection.peek(),
        );
        if (packet) void enqueueRaw(packet.bytes, packet.sessionId);
      }
      let handled = false;
      await enqueue(async () => {
        cancelActiveWindowGesture(undefined, event);
        if (!event.drag && !event.release && event.button === 0) {
          await performModalActivation(event.x, event.y);
        }
        handled = true;
      });
      return handled;
    }

    if (contains(shelfBounds.peek(), event.x, event.y)) {
      if (!event.drag && !event.release && event.button === 0) {
        const command = terminalBarCommandAt(event.x, event.y);
        if (command) await enqueue(() => performTerminalBarAction(command.item.action));
      }
      return true;
    }

    // Geometry gestures are local and synchronous. Do not make title-bar
    // motion wait behind PTY ACKs; child bytes retain their own ordered lane.
    const projectionBefore = windowProjection.peek();
    // The `config` titlebar button carries no built-in window command, so claim
    // its press here before the host treats the title bar as a move gesture.
    if (!event.drag && !event.release && event.button === 0) {
      const configSessionId = configControlSessionAt(projectionBefore, event.x, event.y);
      if (configSessionId) {
        await enqueue(() => {
          controller.openWindowConfig(configSessionId);
        });
        return true;
      }
    }
    const clientWindow = clientWindowAt(projectionBefore, event.x, event.y);
    // Bare desktop: the background gets first refusal, which is how ripe ivy
    // fruit is picked. It only claims the click when something was actually
    // there, so an ordinary desktop click still falls through.
    if (!clientWindow && !event.drag && !event.release && event.button === 0) {
      const field = activeBackgroundField();
      if (muxstoneBackgroundAcceptsPicks(field) && contains(bodyRect.peek(), event.x, event.y)) {
        if (field.pick(event.x, event.y)) {
          metaballRevision.value += 1;
          return true;
        }
      }
    }
    const result = controller.windowHost.handleMouse(
      "terminal",
      event,
      bodyRect.peek(),
      projectionOptions(),
    );
    let handled = result.handled;
    if (!result.handled || terminalMouse.hasLegacyCapture) {
      const packet = terminalMouse.routeLegacyPress(event, projectionBefore);
      if (packet) {
        void enqueueRaw(packet.bytes, packet.sessionId);
        handled = true;
      }
    }
    if (!event.drag && !event.release && event.button === 0) {
      const hit = managerSessionAt(
        controller,
        projectionBefore,
        selectedSessionIndex.peek(),
        event.x,
        event.y,
      );
      if (hit && clientWindow?.id === MUXSTONE_SESSIONS_WINDOW_ID) {
        await enqueue(() => activateManagerHit(hit));
        return true;
      }
      if (clientWindow?.id === MUXSTONE_NETWORK_WINDOW_ID) {
        const networkRow = networkRowAt(event.x, event.y);
        if (networkRow) {
          await enqueue(() => activateNetworkHit(networkRow));
          return true;
        }
      }
      if (clientWindow) handled = true;
      if (clientWindow && clientWindow.id !== MUXSTONE_SESSIONS_WINDOW_ID) controller.syncActiveSession();
    }
    if (result.handled) controller.syncTerminalGeometry(windowProjection.peek());
    if (result.command) {
      const command = result.command;
      void enqueue(() => runWindowCommand(command, true));
    }
    return handled;
  };

  const routeWindowScroll = (event: MouseScrollEvent): Promise<boolean> => {
    backgroundSetPointer({ column: event.x, row: event.y });
    if (modalOpen()) return Promise.resolve(true);
    if (contains(shelfBounds.peek(), event.x, event.y)) return Promise.resolve(true);
    const packet = terminalMouse.routeLegacyScroll(event, windowProjection.peek());
    if (packet) {
      void enqueueRaw(packet.bytes, packet.sessionId);
      return Promise.resolve(true);
    }
    return Promise.resolve(scrollWindowAt(event.x, event.y, wheelDeltaAt(event.x, event.y, event.scroll)));
  };

  const routeTerminalPointer = (
    event: PointerInputEvent,
    projection = windowProjection.peek(),
  ): boolean => {
    const packet = terminalMouse.routePointer(event, projection);
    if (!packet) return false;
    void enqueueRaw(packet.bytes, packet.sessionId);
    return true;
  };

  const routeSemanticPointerFast = (event: PointerInputEvent): boolean | undefined => {
    const projection = windowProjection.peek();
    if (modalOpen()) {
      for (const packet of terminalMouse.cancelPointerCaptures(projection, event)) {
        void enqueueRaw(packet.bytes, packet.sessionId);
      }
      return undefined;
    }
    if (terminalMouse.hasPointerCapture(event.pointerId)) {
      routeTerminalPointer(event, projection);
      return true;
    }
    const hostInspection = controller.windowHost.inspect();
    const activePointerId = hostInspection.interaction.active?.pointerId ??
      hostInspection.separatorResize?.pointerId;
    if (activePointerId === event.pointerId) {
      const result = controller.windowHost.handlePointer(event, bodyRect.peek(), projectionOptions());
      if (result.handled) controller.syncTerminalGeometry(windowProjection.peek());
      return result.handled;
    }
    if (
      event.kind === "wheel" ||
      (event.kind === "move" && event.device === "mouse" && event.buttons === 0)
    ) {
      if (routeTerminalPointer(event, projection)) return true;
      const point = event.coordinates.cell;
      const direction = Math.sign(event.wheel?.deltaY ?? 0);
      return event.kind === "wheel" && point && direction !== 0
        ? scrollWindowAt(point.x, point.y, wheelDeltaAt(point.x, point.y, direction)) || undefined
        : undefined;
    }
    const point = event.coordinates.cell;
    if (point && contains(shelfBounds.peek(), point.x, point.y)) {
      if (event.device !== "mouse") return undefined;
      if (event.kind === "down" && primaryPointerActivation(event)) {
        const command = terminalBarCommandAt(point.x, point.y);
        if (command) void enqueue(() => performTerminalBarAction(command.item.action));
      }
      return true;
    }
    if (event.kind !== "down" || !point) return undefined;
    const clientWindow = clientWindowAt(projection, point.x, point.y);
    if (clientWindow && clientWindow.id !== MUXSTONE_SESSIONS_WINDOW_ID) {
      controller.windowHost.handlePointer(event, bodyRect.peek(), projectionOptions());
      if (routeTerminalPointer(event, projection) || event.device === "mouse") {
        controller.syncActiveSession();
        return true;
      }
      return undefined;
    }
    if (
      primaryPointerActivation(event) &&
      !touchWindowCommandAt(projection, point.x, point.y)
    ) {
      const result = controller.windowHost.handlePointer(event, bodyRect.peek(), projectionOptions());
      if (result.handled) {
        controller.syncTerminalGeometry(windowProjection.peek());
        return true;
      }
    }
    return undefined;
  };

  const modalTouchTargetAt = (column: number, row: number): MuxstoneTouchTarget | undefined => {
    if (controller.startMenuVisible.peek()) {
      const layout = muxstoneStartMenuLayout(app.tui.rectangle.peek());
      const item = layout.items.find((candidate) => contains(candidate.rect, column, row));
      return item ? { kind: "start-item", id: item.id, hitRect: item.rect } : undefined;
    }
    if (controller.helpVisible.peek()) {
      const hitRect = muxstoneHelpLayout(windowProjection.peek().bounds).closeRect;
      return contains(hitRect, column, row) ? { kind: "modal", action: "close-help", hitRect } : undefined;
    }
    const sessionId = controller.pendingKillSessionId.peek();
    if (sessionId) {
      const layout = muxstoneKillLayout(windowProjection.peek().bounds);
      if (contains(layout.confirmRect, column, row)) {
        return { kind: "modal", action: "confirm-kill", sessionId, hitRect: layout.confirmRect };
      }
      if (contains(layout.cancelRect, column, row)) {
        return { kind: "modal", action: "cancel-kill", sessionId, hitRect: layout.cancelRect };
      }
      return undefined;
    }
    if (controller.quitModalVisible.peek()) {
      const layout = muxstoneQuitLayout(windowProjection.peek().bounds);
      if (contains(layout.terminateRect, column, row)) {
        return { kind: "modal", action: "terminate-quit", hitRect: layout.terminateRect };
      }
      if (contains(layout.detachRect, column, row)) {
        return { kind: "modal", action: "detach-quit", hitRect: layout.detachRect };
      }
      if (contains(layout.cancelRect, column, row)) {
        return { kind: "modal", action: "cancel-quit", hitRect: layout.cancelRect };
      }
      return undefined;
    }
    if (controller.pendingScp.peek()) {
      const layout = muxstoneScpLayout(windowProjection.peek().bounds);
      if (contains(layout.sendRect, column, row)) {
        return { kind: "modal", action: "send-scp", hitRect: layout.sendRect };
      }
      if (contains(layout.pasteRect, column, row)) {
        return { kind: "modal", action: "paste-scp", hitRect: layout.pasteRect };
      }
      if (contains(layout.cancelRect, column, row)) {
        return { kind: "modal", action: "cancel-scp", hitRect: layout.cancelRect };
      }
    }
    return undefined;
  };

  const performTouchTarget = async (
    gesture: MuxstoneTouchGesture,
    point: { x: number; y: number } | undefined,
  ): Promise<boolean> => {
    if (!point || gesture.moved) return true;
    const target = gesture.target;
    if ("hitRect" in target && !contains(target.hitRect, point.x, point.y)) return true;
    switch (target.kind) {
      case "menu":
        if (!modalOpen()) await performMenu(target.id);
        return true;
      case "start-item":
        if (controller.startMenuVisible.peek()) {
          controller.closeStartMenu();
          await performMenu(target.id);
        }
        return true;
      case "modal":
        if (target.action === "close-help" && controller.helpVisible.peek()) {
          controller.closeHelp();
        } else if (
          target.action === "cancel-kill" && controller.pendingKillSessionId.peek() === target.sessionId
        ) {
          controller.cancelKillSession();
        } else if (
          target.action === "confirm-kill" && controller.pendingKillSessionId.peek() === target.sessionId
        ) {
          await controller.confirmKillSession();
          await syncWindows();
        } else if (target.action === "cancel-quit" && controller.quitModalVisible.peek()) {
          controller.cancelQuitModal();
        } else if (target.action === "detach-quit" && controller.quitModalVisible.peek()) {
          requestClientExit(false);
        } else if (target.action === "terminate-quit" && controller.quitModalVisible.peek()) {
          requestClientExit(true);
        } else if (target.action === "send-scp" && controller.pendingScp.peek()) {
          void controller.confirmScpTransfer(bodyRect.peek());
        } else if (target.action === "paste-scp" && controller.pendingScp.peek()) {
          const scpRequest = controller.pendingScp.peek()!;
          const text = controller.cancelScpTransfer(true);
          if (text) void controller.writeSession(scpRequest.sessionId, new TextEncoder().encode(text));
        } else if (target.action === "cancel-scp" && controller.pendingScp.peek()) {
          controller.cancelScpTransfer(false);
        }
        return true;
      case "window-command":
        if (!modalOpen()) {
          await runWindowCommand(target.command, false);
        }
        return true;
      case "terminal-bar":
        if (!modalOpen()) await performTerminalBarAction(target.action);
        return true;
      case "client": {
        if (modalOpen()) return true;
        const projection = windowProjection.peek();
        const window = clientWindowAt(projection, point.x, point.y);
        if (window?.id !== target.windowId) return true;
        if (window.id === MUXSTONE_SESSIONS_WINDOW_ID) {
          const hit = managerSessionAt(
            controller,
            projection,
            selectedSessionIndex.peek(),
            point.x,
            point.y,
          );
          if (hit) await activateManagerHit(hit);
        } else if (window.id === MUXSTONE_NETWORK_WINDOW_ID) {
          const networkRow = networkRowAt(point.x, point.y);
          if (networkRow) await activateNetworkHit(networkRow);
        }
        return true;
      }
    }
  };

  const routeSemanticPointerInBarrier = async (
    event: PointerInputEvent,
    excursion?: MuxstonePointerMoveExcursion,
  ): Promise<boolean> => {
    let handled = false;
    const point = event.coordinates.cell;
    const gesture = touchGestures.get(event.pointerId);
    const touchLike = event.device !== "mouse";
    const activation = primaryPointerActivation(event);

    if (modalOpen()) {
      cancelActiveWindowGesture(event);
      if (!touchLike) {
        if (event.kind === "down" && activation && point) {
          await performModalActivation(point.x, point.y);
        }
        return true;
      }
      if (event.kind === "down") {
        if (activation && point) {
          const target = modalTouchTargetAt(point.x, point.y);
          if (target) rememberTouchGesture(touchGestures, event, point, target);
        }
        return true;
      }
      // Start-menu rows complete on release just like any other modal button.
      if (gesture?.target.kind !== "modal" && gesture?.target.kind !== "start-item") {
        touchGestures.delete(event.pointerId);
        return true;
      }
      if (event.kind === "move") updateTouchGesture(gesture, event, point, excursion);
      if (event.kind === "up" || event.kind === "cancel") {
        updateTouchGesture(gesture, event, point);
        touchGestures.delete(event.pointerId);
        if (event.kind === "up") await performTouchTarget(gesture, point);
      }
      return true;
    }

    if (!event.primary && !gesture) return false;
    if (event.kind === "wheel") {
      if (!point) return false;
      const direction = Math.sign(event.wheel?.deltaY ?? 0);
      return direction !== 0 && scrollWindowAt(point.x, point.y, wheelDeltaAt(point.x, point.y, direction));
    }

    if (!point) {
      if (touchLike && gesture) updateTouchGesture(gesture, event, undefined, excursion);
      const result = controller.windowHost.handlePointer(event, bodyRect.peek(), projectionOptions());
      if (event.kind === "up" || event.kind === "cancel") touchGestures.delete(event.pointerId);
      if (result.handled) {
        if (result.command) await runWindowCommand(result.command, true);
        else await syncWindows();
      }
      return result.handled || gesture !== undefined;
    }

    const projectionBefore = windowProjection.peek();
    const inTerminalBar = contains(shelfBounds.peek(), point.x, point.y);
    if (inTerminalBar) {
      if (!touchLike) {
        if (event.kind === "down" && activation) {
          const command = terminalBarCommandAt(point.x, point.y);
          if (command) await performTerminalBarAction(command.item.action);
        }
        return true;
      }
      if (event.kind === "down") {
        if (!activation) return true;
        const command = terminalBarCommandAt(point.x, point.y);
        if (command) {
          rememberTouchGesture(touchGestures, event, point, {
            kind: "terminal-bar",
            action: command.item.action,
            hitRect: command.hitRect,
          });
        }
        return true;
      }
    }
    // The start button is not a command, it toggles the dropdown, so it is
    // resolved before the direct-command menu targets.
    if (event.kind === "down" && activation) {
      const startRect = touchLike ? coarseMenuRect(START_BUTTON) : START_BUTTON;
      if (contains(startRect, point.x, point.y)) {
        controller.toggleStartMenu();
        return true;
      }
    }
    if (!touchLike && event.kind === "down" && activation) {
      const menu = menuAt(point.x, point.y, false, app.tui.rectangle.peek());
      if (menu) {
        await performMenu(menu);
        return true;
      }
    }

    if (touchLike && event.kind === "down") {
      if (!activation) return false;
      const menu = menuAt(point.x, point.y, true, app.tui.rectangle.peek());
      if (menu) {
        rememberTouchGesture(touchGestures, event, point, {
          kind: "menu",
          id: menu,
          hitRect: coarseMenuRect(menuRect(menu, app.tui.rectangle.peek())),
        });
        return true;
      }
      const commandTarget = touchWindowCommandAt(projectionBefore, point.x, point.y);
      if (commandTarget) {
        rememberTouchGesture(touchGestures, event, point, commandTarget);
        return true;
      }
    }

    if (touchLike && gesture) {
      if (event.kind === "move") {
        const previousRow = gesture.lastRow;
        updateTouchGesture(gesture, event, point, excursion);
        if (gesture.target.kind === "client") {
          const rowDelta = previousRow - point.y;
          if (rowDelta !== 0) {
            if (gesture.target.windowId === MUXSTONE_SESSIONS_WINDOW_ID) {
              const sessions = controller.sessions.peek();
              selectedSessionIndex.value = clampIndex(
                selectedSessionIndex.peek() + rowDelta,
                sessions.length,
              );
            } else {
              scrollClientWindow(gesture.target.windowId, rowDelta);
            }
          }
        }
        return true;
      }
      if (event.kind === "up" || event.kind === "cancel") {
        updateTouchGesture(gesture, event, point);
        touchGestures.delete(event.pointerId);
        if (event.kind === "up") await performTouchTarget(gesture, point);
        return true;
      }
    }

    const clientWindow = clientWindowAt(projectionBefore, point.x, point.y);
    const result = controller.windowHost.handlePointer(event, bodyRect.peek(), projectionOptions());
    handled = result.handled;
    if (!touchLike && event.kind === "down" && activation && clientWindow) {
      const hit = managerSessionAt(
        controller,
        projectionBefore,
        selectedSessionIndex.peek(),
        point.x,
        point.y,
      );
      if (hit && clientWindow.id === MUXSTONE_SESSIONS_WINDOW_ID) await activateManagerHit(hit);
      if (clientWindow.id === MUXSTONE_NETWORK_WINDOW_ID) {
        const networkRow = networkRowAt(point.x, point.y);
        if (networkRow) await activateNetworkHit(networkRow);
      }
      handled = true;
    } else if (touchLike && event.kind === "down" && activation && clientWindow) {
      rememberTouchGesture(touchGestures, event, point, { kind: "client", windowId: clientWindow.id });
      handled = true;
    }
    if (result.command) await runWindowCommand(result.command, true);
    else if (result.handled || clientWindow) await syncWindows();
    return handled;
  };

  const routeSemanticPointer = (event: PointerInputEvent): Promise<boolean> => {
    if (disposed) return Promise.resolve(false);
    const pointerCell = event.coordinates.cell;
    if (event.kind === "cancel") backgroundClearPointer();
    else if (pointerCell) backgroundSetPointer({ column: pointerCell.x, row: pointerCell.y });
    const fastResult = routeSemanticPointerFast(event);
    if (fastResult !== undefined) return Promise.resolve(fastResult);
    if (
      event.kind === "move" && pendingPointerMove && !pendingPointerMove.started &&
      pendingPointerMove.event.pointerId === event.pointerId &&
      pendingPointerMove.ingressRevision === ingressRevision
    ) {
      mergePointerExcursion(pendingPointerMove.excursion, event);
      pendingPointerMove.event = event;
      return pendingPointerMove.result;
    }
    let settle!: (handled: boolean) => void;
    const result = new Promise<boolean>((resolve) => settle = resolve);
    const slot: MuxstonePointerMoveSlot | undefined = event.kind === "move"
      ? {
        event,
        ingressRevision: ingressRevision + 1,
        excursion: pointerExcursion(event),
        result,
        settle,
        started: false,
      }
      : undefined;
    if (slot) pendingPointerMove = slot;
    let ran = false;
    const queued = enqueue(async () => {
      ran = true;
      if (slot) {
        slot.started = true;
        if (pendingPointerMove === slot) pendingPointerMove = undefined;
      }
      try {
        const handled = await routeSemanticPointerInBarrier(slot?.event ?? event, slot?.excursion);
        settle(handled);
      } catch (error) {
        if (!disposed) controller.status.value = `Muxstone pointer failed: ${safeErrorMessage(error)}`;
        settle(false);
      }
    });
    const settleSkipped = () => {
      if (ran) return;
      if (slot && pendingPointerMove === slot) pendingPointerMove = undefined;
      settle(false);
    };
    void queued.then(settleSkipped, settleSkipped);
    return result;
  };

  unsubscribers.push(app.mouse.register({
    id: "muxstone-window-desktop",
    // Spans the whole screen because the window taskbar now shares the top bar
    // with the start button. The start and quit targets sit at a higher zIndex,
    // so they still win their own cells.
    bounds: () => ({
      column: 0,
      row: 0,
      width: Math.max(1, app.tui.rectangle.peek().width),
      height: Math.max(1, app.tui.rectangle.peek().height),
    }),
    zIndex: 10_000,
    captureDrag: true,
    onPress: routeWindowPointer,
    onDrag: routeWindowPointer,
    onRelease: routeWindowPointer,
    onScroll: routeWindowScroll,
  }));
  unsubscribers.push(app.mouse.register({
    id: "muxstone-modal",
    bounds: () => app.tui.rectangle.peek(),
    zIndex: 30_000,
    disabled: () => !modalOpen(),
    captureDrag: true,
    onPress: (event) => event.button === 0 ? routeModalActivation(event.x, event.y) : true,
    onDrag: () => true,
    onRelease: () => true,
    onScroll: () => true,
  }));
  // Only two always-live top-bar controls remain: the start button and quit.
  // Everything else is a row inside the dropdown, handled by the modal catcher.
  unsubscribers.push(
    registerMenuTarget(app, "start", START_BUTTON, () =>
      enqueue(() => {
        controller.toggleStartMenu();
      }), modalOpen),
  );
  unsubscribers.push(
    registerMenuTarget(
      app,
      "quit",
      () => menuQuitRect(app.tui.rectangle.peek()),
      () => activateMenu("quit"),
      modalOpen,
    ),
  );

  const handleNetworkKey = async (event: KeyPressEvent): Promise<boolean> => {
    if (controller.windowHost.controller.inspect().activeWindowId !== MUXSTONE_NETWORK_WINDOW_ID) return false;
    const tree = controller.networkTree;
    if (event.key.toLowerCase() === "r" && !event.ctrl && !event.meta) {
      void controller.refreshNetwork().catch(() => undefined);
      return true;
    }
    if (event.key === "return") {
      const row = tree.selected();
      if (!row) return true;
      if (row.hasChildren) tree.toggleActive();
      else await activateNetworkNode(row);
      return true;
    }
    if (event.key === "delete") {
      const target = muxstoneNetworkNodeHostTarget(tree.selected()?.id ?? "");
      if (target) controller.forgetHost(target);
      return true;
    }
    const networkWindow = windowProjection.peek().windows.find(
      (candidate) => candidate.id === MUXSTONE_NETWORK_WINDOW_ID,
    );
    const height = Math.max(1, (networkWindow?.clientRect.height ?? 10) - NETWORK_LIST_START);
    return tree.handleKeyPress(event, height) !== undefined;
  };

  const routeKeyInBarrier = async (
    event: KeyPressEvent,
    forwardTerminalInput: (bytes: Uint8Array) => void | Promise<unknown> = (bytes) => controller.writeActive(bytes),
  ): Promise<void> => {
    if (controller.startMenuVisible.peek()) {
      if (event.key === "escape" || event.key.toLowerCase() === "q") controller.closeStartMenu();
      return;
    }
    if (controller.helpVisible.peek()) {
      if (event.key === "escape" || event.key === "?" || event.key.toLowerCase() === "q") {
        controller.closeHelp();
      }
      return;
    }
    if (controller.pendingKillSessionId.peek()) {
      if (event.key === "return" || event.key.toLowerCase() === "y") {
        await controller.confirmKillSession();
        await syncWindows();
      } else if (event.key === "escape" || event.key.toLowerCase() === "n") {
        controller.cancelKillSession();
      }
      return;
    }
    if (controller.quitModalVisible.peek()) {
      if (event.key === "escape" || event.key.toLowerCase() === "c") {
        controller.cancelQuitModal();
      } else if (event.key === "return" || event.key.toLowerCase() === "d") {
        requestClientExit(false);
      } else if (event.key.toLowerCase() === "t") {
        requestClientExit(true);
      }
      return;
    }
    if (controller.globalConfigVisible.peek()) {
      const optionId = MUXSTONE_GLOBAL_SETTING_SPECS[controller.globalConfigOptionIndex.peek()]?.id;
      const inOptions = controller.globalConfigPane.peek() === "options";
      if (event.key === "escape" || event.key.toLowerCase() === "q") {
        controller.closeGlobalConfig();
      } else if (event.key === "tab") {
        controller.moveGlobalConfigPane(event.shift ? -1 : 1);
      } else if (event.key === "up") {
        controller.moveGlobalConfigSelection(-1);
      } else if (event.key === "down") {
        controller.moveGlobalConfigSelection(1);
      } else if (event.key === "left") {
        if (inOptions && optionId) controller.cycleGlobalSetting(optionId, -1);
        else controller.moveGlobalConfigPane(-1);
      } else if (event.key === "right") {
        if (inOptions && optionId) controller.cycleGlobalSetting(optionId, 1);
        else controller.moveGlobalConfigPane(1);
      } else if ((event.key === "return" || event.key === "space") && inOptions && optionId) {
        controller.cycleGlobalSetting(optionId, 1);
      }
      return;
    }
    const configSessionId = controller.configSessionId.peek();
    if (configSessionId) {
      const settingId = MUXSTONE_WINDOW_SETTING_SPECS[controller.configRowIndex.peek()]?.id;
      if (event.key === "escape" || event.key.toLowerCase() === "q") {
        controller.closeWindowConfig();
      } else if (event.key === "up") {
        controller.moveWindowConfigRow(-1);
      } else if (event.key === "down") {
        controller.moveWindowConfigRow(1);
      } else if (event.key === "left" && settingId) {
        controller.cycleWindowSetting(configSessionId, settingId, -1);
      } else if ((event.key === "right" || event.key === "return" || event.key === "space") && settingId) {
        controller.cycleWindowSetting(configSessionId, settingId, 1);
      } else if (event.key.toLowerCase() === "r") {
        controller.resetWindowSettings(configSessionId);
      }
      return;
    }
    if (controller.pendingScp.peek()) {
      // The modal hosts a password field, so printable keys type into it;
      // only Enter/Escape/Backspace act. "Paste path" stays on its button.
      if (event.key === "return") {
        void controller.confirmScpTransfer(bodyRect.peek());
      } else if (event.key === "escape") {
        controller.cancelScpTransfer(false);
      } else if (event.key === "backspace") {
        controller.backspaceScpPassword();
      } else if (event.key === "space") {
        controller.appendScpPassword(" ");
      } else if (!event.ctrl && !event.meta && event.key.length === 1) {
        controller.appendScpPassword(event.shift ? event.key.toUpperCase() : event.key);
      }
      return;
    }
    if (event.ctrl && !event.meta && event.key.toLowerCase() === "n") {
      if (controller.prefixPending.peek()) {
        controller.cancelPrefix();
        await forwardTerminalInput(new Uint8Array([14]));
      } else {
        controller.beginPrefix();
      }
      return;
    }
    if (controller.prefixPending.peek()) {
      await controller.handlePrefixKey(event.key, bodyRect.peek());
      await syncWindows();
      return;
    }
    if (shouldRouteAsWorkbenchKey(controller, event)) {
      const activeWindowId = controller.windowHost.controller.inspect().activeWindowId;
      const hostResult = controller.windowHost.handleKey(event, bodyRect.peek(), projectionOptions());
      if (hostResult.handled) {
        if (hostResult.command) await runWindowCommand(hostResult.command, true, activeWindowId);
        else await syncWindows();
        return;
      }
      if (await handleNetworkKey(event)) {
        await syncWindows();
        return;
      }
      if (await handleManagerKey(controller, selectedSessionIndex, event, bodyRect.peek())) {
        await syncWindows();
        return;
      }
    }
    const bytes = encodeTerminalKeyPress(event);
    if (bytes) await forwardTerminalInput(bytes);
  };

  type ClassifiedInputSegment = {
    readonly sessionId: string;
    readonly parts: Uint8Array[];
    bytes: number;
  };
  type ClassifiedKeyBatch = {
    readonly events: KeyPressEvent[];
    reservedBytes: number;
    started: boolean;
    tailRevision: number;
  };
  let pendingClassifiedKeyBatch: ClassifiedKeyBatch | undefined;
  let classifiedInputBytes = 0;
  const appendClassifiedInput = (
    segments: ClassifiedInputSegment[],
    sessionId: string,
    bytes: Uint8Array,
  ): void => {
    let offset = 0;
    while (offset < bytes.byteLength) {
      let segment = segments.at(-1);
      if (
        !segment || segment.sessionId !== sessionId ||
        segment.bytes >= MUXSTONE_PROTOCOL_LIMITS.inputBytes
      ) {
        segment = { sessionId, parts: [], bytes: 0 };
        segments.push(segment);
      }
      const take = Math.min(
        bytes.byteLength - offset,
        MUXSTONE_PROTOCOL_LIMITS.inputBytes - segment.bytes,
      );
      segment.parts.push(bytes.slice(offset, offset + take));
      segment.bytes += take;
      offset += take;
    }
  };
  const flushClassifiedInput = async (segments: ClassifiedInputSegment[]): Promise<void> => {
    if (segments.length === 0) return;
    const writes = segments.splice(0).map((segment) => {
      const bytes = new Uint8Array(segment.bytes);
      let offset = 0;
      for (const part of segment.parts) {
        bytes.set(part, offset);
        offset += part.byteLength;
      }
      return { sessionId: segment.sessionId, bytes };
    });
    for (let offset = 0; offset < writes.length; offset += CLASSIFIED_INPUT_PIPELINE_DEPTH) {
      await Promise.all(
        writes.slice(offset, offset + CLASSIFIED_INPUT_PIPELINE_DEPTH).map(async (write) => {
          try {
            await controller.writeSession(write.sessionId, write.bytes);
          } catch (error) {
            reportInputError(error);
          }
        }),
      );
    }
  };
  const drainClassifiedKeys = async (batch: ClassifiedKeyBatch): Promise<void> => {
    batch.started = true;
    const segments: ClassifiedInputSegment[] = [];
    const appendToActive = (bytes: Uint8Array): void => {
      const sessionId = controller.activeRuntime()?.sessionId;
      if (sessionId) appendClassifiedInput(segments, sessionId, bytes);
    };
    for (const event of batch.events) {
      const prefixKey = event.ctrl && !event.meta && event.key.toLowerCase() === "n";
      const needsWorkbenchClassification = prefixKey || modalOpen() || controller.prefixPending.peek() ||
        shouldRouteAsWorkbenchKey(controller, event);
      if (needsWorkbenchClassification) {
        await flushClassifiedInput(segments);
        await routeKeyInBarrier(event, appendToActive);
        continue;
      }
      const bytes = encodeTerminalKeyPress(event);
      if (bytes) appendToActive(bytes);
    }
    await flushClassifiedInput(segments);
  };
  const snapshotKeyPress = (event: KeyPressEvent): KeyPressEvent => ({
    ...event,
    buffer: new Uint8Array(event.buffer),
  });
  const classifiedKeyReservationBytes = (event: KeyPressEvent): number => {
    const encodedBytes = event.buffer.byteLength > 0
      ? event.buffer.byteLength
      : encodeTerminalKeyPress(event)?.byteLength ?? 0;
    return Math.max(MIN_CLASSIFIED_KEY_RESERVATION_BYTES, event.key.length * 2, encodedBytes);
  };
  const enqueueClassifiedKey = (event: KeyPressEvent): void => {
    const reservedBytes = classifiedKeyReservationBytes(event);
    if (reservedBytes > MAX_CLASSIFIED_INPUT_BYTES - classifiedInputBytes) {
      reportInputError(
        new RangeError(`raw input buffer limit exceeded (${MAX_CLASSIFIED_INPUT_BYTES} bytes)`),
      );
      return;
    }
    classifiedInputBytes += reservedBytes;
    const current = pendingClassifiedKeyBatch;
    if (current && !current.started && current.tailRevision === ingressRevision) {
      ingressRevision += 1;
      current.tailRevision = ingressRevision;
      current.events.push(event);
      current.reservedBytes += reservedBytes;
      return;
    }
    const batch: ClassifiedKeyBatch = {
      events: [event],
      reservedBytes,
      started: false,
      tailRevision: -1,
    };
    pendingClassifiedKeyBatch = batch;
    const completed = enqueue(() => drainClassifiedKeys(batch));
    batch.tailRevision = ingressRevision;
    void completed.finally(() => {
      classifiedInputBytes = Math.max(0, classifiedInputBytes - batch.reservedBytes);
      if (pendingClassifiedKeyBatch === batch) pendingClassifiedKeyBatch = undefined;
    });
  };
  const enqueueKeyBarrier = (event: KeyPressEvent): void => {
    void enqueue(() => routeKeyInBarrier(event));
  };

  const allowPasteInBarrier = (): boolean => {
    if (modalOpen()) return false;
    // A paste is one atomic terminal payload, not a mux command. If it follows
    // an armed prefix, cancel the prefix before forwarding the complete paste.
    if (controller.prefixPending.peek()) controller.cancelPrefix();
    return true;
  };

  let prefixIngressPending = false;
  unsubscribers.push(app.tui.on("keyPress", (readerEvent) => {
    // InputReader deliberately reuses one KeyPressEvent and aliases its read
    // buffer. Snapshot at the synchronous ingress boundary before any queued
    // prefix/control work can observe the next decoded key instead.
    const event = snapshotKeyPress(readerEvent);
    if (prefixIngressPending) {
      prefixIngressPending = false;
      enqueueKeyBarrier(event);
      return;
    }
    const prefixKey = event.ctrl && !event.meta && event.key.toLowerCase() === "n";
    const classificationBarrier = operationQueue.hasPendingBarrier();
    if (
      prefixKey && !classificationBarrier && !modalOpen() &&
      !controller.prefixPending.peek()
    ) {
      prefixIngressPending = true;
      enqueueKeyBarrier(event);
      return;
    }
    if (
      prefixKey || modalOpen() || controller.prefixPending.peek() || shouldRouteAsWorkbenchKey(controller, event)
    ) {
      enqueueKeyBarrier(event);
      return;
    }
    if (classificationBarrier) {
      enqueueClassifiedKey(event);
      return;
    }
    const bytes = encodeTerminalKeyPress(event);
    if (bytes) void enqueueRaw(bytes);
  }));
  unsubscribers.push(app.tui.on("paste", (event) => {
    // Preserve the reader's raw bytes when available and let the operation
    // queue perform the sole bounded copy/encoding step at ingress.
    const paste = event.buffer.byteLength > 0 ? event.buffer : event.text;
    // A pasted local file path aimed at a network-panel SSH shell becomes a
    // transfer offer instead of literal input; every other paste flows through.
    const activeSessionId = controller.activeRuntime()?.sessionId;
    const scpCandidate = event.text.length > 0 && !modalOpen() &&
      activeSessionId !== undefined && controller.scpEligibleTarget(activeSessionId) !== undefined &&
      muxstoneScpCandidatePath(event.text) !== undefined;
    if (scpCandidate) {
      const text = event.text;
      prefixIngressPending = false;
      void enqueue(async () => {
        if (modalOpen()) return;
        if (controller.prefixPending.peek()) controller.cancelPrefix();
        const intercepted = await controller.maybeInterceptScpPaste(text);
        if (!intercepted) void enqueueRaw(paste);
      });
      return;
    }
    if (
      !prefixIngressPending && !operationQueue.hasPendingBarrier() && !modalOpen() &&
      !controller.prefixPending.peek()
    ) {
      void enqueueRaw(paste);
      return;
    }
    prefixIngressPending = false;
    void enqueueGuardedRaw(paste, allowPasteInBarrier);
  }));

  const scheduleGeometry = (): void => {
    if (disposed) return;
    controller.syncTerminalGeometry(windowProjection.peek());
  };
  windowProjection.subscribe(scheduleGeometry, subscriptions.signal);
  controller.sessions.subscribe((sessions) => {
    selectedSessionIndex.value = clampIndex(selectedSessionIndex.peek(), sessions.length);
  }, subscriptions.signal);
  scheduleGeometry();

  return {
    app,
    controller,
    bodyRect,
    shelfBounds,
    windowProjection,
    selectedSessionIndex,
    enqueue,
    handlePointer: routeSemanticPointer,
    handleScroll: routeWindowScroll,
    metaballFrameRevision: () => metaballRevision.peek(),
    overgrowthRatios: () => overgrowthRatios,
    whenIdle: () => operationQueue.whenIdle(),
    dispose() {
      if (disposed) return;
      const projection = windowProjection.peek();
      for (const packet of terminalMouse.cancelAllCaptures(projection)) {
        void controller.writeSession(packet.sessionId, packet.bytes).catch(() => false);
      }
      disposed = true;
      touchGestures.clear();
      terminalMouse.clear();
      if (pendingPointerMove && !pendingPointerMove.started) {
        pendingPointerMove.settle(false);
        pendingPointerMove = undefined;
      }
      operationQueue.dispose();
      subscriptions.abort();
      for (let index = unsubscribers.length - 1; index >= 0; index -= 1) unsubscribers[index]!();
      for (let index = owned.length - 1; index >= 0; index -= 1) owned[index]!.dispose();
    },
  };
}

function muxstoneCommands(): TerminalAppOptions<MuxstoneAppAction>["commands"] {
  return [
    { id: "muxstone.new", label: "New terminal", group: "sessions", action: { type: "muxstone.new" } },
    {
      id: "muxstone.sessions",
      label: "Show session manager",
      group: "sessions",
      action: { type: "muxstone.sessions" },
    },
    { id: "muxstone.theme", label: "Cycle theme", group: "appearance", action: { type: "muxstone.theme" } },
    { id: "muxstone.help", label: "Show help", group: "global", action: { type: "muxstone.help" } },
    { id: "muxstone.detach", label: "Detach active terminal", group: "sessions", action: { type: "muxstone.detach" } },
    { id: "muxstone.kill", label: "Kill active terminal", group: "sessions", action: { type: "muxstone.kill" } },
    { id: "muxstone.quit", label: "Quit Muxstone", group: "global", action: { type: "muxstone.quit" } },
  ];
}

async function handleMuxstoneAction(action: MuxstoneAppAction, mount: MuxstoneAppMountRef): Promise<void> {
  const mounted = mount.current;
  if (!mounted) return;
  const { controller, bodyRect } = mounted;
  await mounted.enqueue(async () => {
    switch (action.type) {
      case "muxstone.new":
        await controller.spawn({ bounds: bodyRect.peek() });
        break;
      case "muxstone.sessions":
        controller.windowHost.execute({ kind: "restore", id: MUXSTONE_SESSIONS_WINDOW_ID }, bodyRect.peek());
        controller.windowHost.execute({ kind: "focus", id: MUXSTONE_SESSIONS_WINDOW_ID }, bodyRect.peek());
        break;
      case "muxstone.theme":
        controller.cycleTheme();
        break;
      case "muxstone.help":
        controller.openHelp();
        break;
      case "muxstone.detach":
        await controller.closeActive(bodyRect.peek());
        break;
      case "muxstone.kill": {
        const runtime = controller.activeRuntime();
        if (runtime) controller.requestKillSession(runtime.sessionId);
        break;
      }
      case "muxstone.quit":
        mounted.app.destroy();
        await controller.dispose();
        return;
    }
    await controller.syncWindowVisibility(bodyRect.peek());
    controller.syncTerminalGeometry(mounted.windowProjection.peek());
  });
}

function wheelFallbackKeyBytes(delta: number, applicationCursorKeys: boolean): Uint8Array | undefined {
  const lines = Math.min(12, Math.abs(Math.trunc(delta)));
  if (lines === 0) return undefined;
  const key = delta < 0 ? (applicationCursorKeys ? "\x1bOA" : "\x1b[A") : applicationCursorKeys ? "\x1bOB" : "\x1b[B";
  return new TextEncoder().encode(key.repeat(lines));
}

function registerMenuTarget(
  app: TerminalApp<MuxstoneAppAction>,
  id: string,
  bounds: Rectangle | (() => Rectangle),
  activate: () => void | Promise<void>,
  disabled: () => boolean,
): () => void {
  return app.mouse.register({
    id: `muxstone-menu-${id}`,
    bounds,
    zIndex: 20_000,
    disabled,
    onPress: (event) => {
      if (event.button !== 0 || event.release) return false;
      void activate();
      return true;
    },
  });
}

async function handleManagerKey(
  controller: MuxstoneController,
  selected: Signal<number>,
  event: KeyPressEvent,
  bounds: Rectangle,
): Promise<boolean> {
  if (controller.windowHost.controller.inspect().activeWindowId !== MUXSTONE_SESSIONS_WINDOW_ID) return false;
  const sessions = controller.sessions.peek();
  if (event.key === "up" || event.key === "down") {
    const delta = event.key === "up" ? -1 : 1;
    selected.value = wrapIndex(selected.peek() + delta, sessions.length);
    return true;
  }
  const session = sessions[clampIndex(selected.peek(), sessions.length)];
  if (!session) return event.key === "return" || event.key === "delete";
  if (event.key === "return" || event.key === "space") {
    await controller.openSession(session.id, bounds);
    return true;
  }
  if (event.key === "delete") {
    controller.requestKillSession(session.id);
    return true;
  }
  return false;
}

function shouldRouteAsWorkbenchKey(controller: MuxstoneController, event: KeyPressEvent): boolean {
  if (event.meta || controller.windowHost.inspect().switcherOpen) return true;
  const activeWindowId = controller.windowHost.controller.inspect().activeWindowId;
  if (activeWindowId === MUXSTONE_NETWORK_WINDOW_ID) {
    return event.key === "up" || event.key === "down" || event.key === "left" || event.key === "right" ||
      event.key === "return" || event.key === "space" || event.key === "delete" || event.key === "pageup" ||
      event.key === "pagedown" || event.key === "home" || event.key === "end" || event.key.toLowerCase() === "r";
  }
  if (activeWindowId !== MUXSTONE_SESSIONS_WINDOW_ID) return false;
  return event.key === "up" || event.key === "down" || event.key === "return" || event.key === "space" ||
    event.key === "delete";
}

interface RenderMuxstoneDesktopOptions {
  bounds: Rectangle;
  body: Rectangle;
  projection: WorkbenchWindowHostProjection;
  controller: MuxstoneController;
  selectedSessionIndex: number;
  /** Top-bar region the window taskbar is laid out into. */
  shelf: Rectangle;
  metaballs: MuxstoneMetaballField;
  backgroundField?: MuxstoneAnimatedBackground;
  overgrowth?: MuxstoneOvergrowthPass;
}

/** The desktop effect remains visible unless a terminal owns the maximized surface. */
export function muxstoneMetaballBackgroundVisible(
  projection: WorkbenchWindowHostProjection,
  bounds: Rectangle = projection.bounds,
): boolean {
  if (muxstoneSessionIdFromWindow(projection.core.maximizedWindowId) !== undefined) return false;
  const covers = [
    ...projection.windows.map((window) => window.rect),
    ...projection.separators.map((item) => item.rect),
  ];
  for (let row = bounds.row; row < bounds.row + bounds.height; row += 1) {
    for (let column = bounds.column; column < bounds.column + bounds.width; column += 1) {
      if (!covers.some((rect) => contains(rect, column, row))) return true;
    }
  }
  return false;
}

/** Paints one complete desktop into pre-styled terminal-cell strings. */
function renderMuxstoneDesktop(options: RenderMuxstoneDesktopOptions): string[][] {
  const { bounds, body, projection, controller } = options;
  const theme = controller.theme.peek();
  const painter = new DesktopPainter(bounds, theme);
  painter.fill(bounds, " ", { foreground: theme.text, background: theme.background });
  // Single top bar: start-menu button, then the window taskbar, then quit.
  painter.fill({ column: 0, row: 0, width: bounds.width, height: 1 }, " ", {
    foreground: theme.text,
    background: theme.surfaceStrong,
  });
  const prefixPending = controller.prefixPending.peek();
  const startLabel = prefixPending ? START_BUTTON_PREFIX_LABEL : START_BUTTON_IDLE_LABEL;
  painter.write(START_BUTTON.column, 0, fitText(startLabel, START_BUTTON.width), {
    foreground: theme.background,
    // The prefix cue lives on the start button now that the status bars are gone.
    background: prefixPending ? theme.warning : theme.accent,
    bold: true,
  });
  paintTerminalBar(
    painter,
    projectMuxstoneTerminalBar(controller, projection, options.shelf),
    theme,
  );
  const quitRect = menuQuitRect(bounds);
  painter.write(quitRect.column, 0, "[ ✕ ]", {
    foreground: theme.background,
    background: theme.danger,
    bold: true,
  });
  painter.fill(body, " ", { foreground: theme.text, background: theme.background });
  // One rasterization serves both the desktop backdrop and the overgrowth pass,
  // so reclaimed cells line up exactly with the background behind the window.
  const backgroundGrid = options.backgroundField?.rasterizeCells(body, theme);
  if (muxstoneMetaballBackgroundVisible(projection, body)) {
    if (backgroundGrid) paintBackgroundGrid(painter, body, backgroundGrid, theme);
    else paintMetaballBackground(painter, body, options.metaballs, theme);
  }

  for (const window of projection.tiledWindows) {
    paintWindow(painter, window, controller, options.selectedSessionIndex);
  }
  const borderGlyphs = muxstoneBorderGlyphs(controller.globalSettings.peek().borderStyle);
  for (const separator of projection.separators) {
    painter.fill(
      separator.rect,
      separator.direction === "row" ? borderGlyphs.verticalSeparator : borderGlyphs.horizontalSeparator,
      { foreground: theme.border, background: theme.background },
    );
  }
  for (const window of projection.floatingWindows) {
    paintWindow(painter, window, controller, options.selectedSessionIndex);
  }
  if (backgroundGrid && options.overgrowth) {
    paintOvergrowth(painter, body, backgroundGrid, theme, projection, options.overgrowth);
  }
  if (projection.snapPreview) {
    painter.frame(projection.snapPreview.rect, ".", {
      foreground: theme.accent,
      background: theme.background,
      bold: true,
    });
  }
  if (projection.switcher) paintSwitcher(painter, projection, theme);
  if (controller.startMenuVisible.peek()) paintStartMenu(painter, bounds, theme, controller);
  if (controller.helpVisible.peek()) paintHelp(painter, projection, theme);
  if (controller.quitModalVisible.peek()) paintQuitModal(painter, projection, theme);
  const scpRequest = controller.pendingScp.peek();
  if (scpRequest) paintScpModal(painter, projection, theme, scpRequest);
  const configSessionId = controller.configSessionId.peek();
  if (configSessionId) paintWindowConfigModal(painter, projection, theme, controller, configSessionId);
  if (controller.globalConfigVisible.peek()) paintGlobalConfigModal(painter, projection, theme, controller);
  const pendingKillSessionId = controller.pendingKillSessionId.peek();
  if (pendingKillSessionId) paintKillConfirmation(painter, projection, controller, pendingKillSessionId);

  return painter.rows;
}

/** Paints the start-menu dropdown below the top-left button. */
function paintStartMenu(
  painter: DesktopPainter,
  bounds: Rectangle,
  theme: MuxstoneThemeSpec,
  _controller: MuxstoneController,
): void {
  const { panelRect, items } = muxstoneStartMenuLayout(bounds);
  painter.fill(panelRect, " ", { foreground: theme.text, background: theme.surfaceStrong });
  painter.borderBox(panelRect, muxstoneBorderGlyphs("thin"), {
    foreground: theme.accent,
    background: theme.surfaceStrong,
    bold: true,
  });
  for (const item of items) {
    if (item.rect.row >= panelRect.row + panelRect.height - 1) break;
    painter.write(item.rect.column, item.rect.row, fitText(item.label, item.rect.width), {
      foreground: item.danger ? theme.danger : theme.text,
      background: theme.surfaceStrong,
      bold: item.danger,
    });
  }
}

/** Per-window reclaim ratios handed to the overgrowth pass. */
export interface MuxstoneOvergrowthPass {
  /** Window id → reclaim ratio in [0, 1]; absent or 0 leaves the window intact. */
  readonly ratios: ReadonlyMap<string, number>;
}

/**
 * Redraws background cells over windows that have lost focus. Only the client
 * area is reclaimed — chrome stays legible so an overgrown window can still be
 * found and clicked back to life.
 */
function paintOvergrowth(
  painter: DesktopPainter,
  bounds: Rectangle,
  grid: ReturnType<MuxstoneAnimatedBackground["rasterizeCells"]>,
  theme: MuxstoneThemeSpec,
  projection: WorkbenchWindowHostProjection,
  pass: MuxstoneOvergrowthPass,
): void {
  // Same order the windows were painted in, so anything later in the list is
  // stacked above and must not be drawn over.
  const stack = [...projection.tiledWindows, ...projection.floatingWindows];
  for (let index = 0; index < stack.length; index += 1) {
    const window = stack[index]!;
    const ratio = pass.ratios.get(window.id) ?? 0;
    if (ratio <= 0) continue;
    const client = window.clientRect;
    const above = stack.slice(index + 1).map((other) => other.rect);
    for (let row = client.row; row < client.row + client.height; row += 1) {
      const gridRow = grid[row - bounds.row];
      if (!gridRow) continue;
      for (let column = client.column; column < client.column + client.width; column += 1) {
        const cell = gridRow[column - bounds.column];
        if (!cell) continue;
        // An idle window's overgrowth stops at whatever is stacked on top of it,
        // so reclaiming a window below never bleeds onto the focused one.
        if (!muxstoneOvergrowthVisible(column, row, client, ratio, above)) continue;
        painter.write(column, row, cell.char, {
          foreground: cell.foreground,
          background: theme.background,
          ...(cell.bold ? { bold: true } : {}),
        });
      }
    }
  }
}

function paintBackgroundGrid(
  painter: DesktopPainter,
  bounds: Rectangle,
  grid: ReturnType<MuxstoneAnimatedBackground["rasterizeCells"]>,
  theme: MuxstoneThemeSpec,
): void {
  for (let row = 0; row < grid.length; row += 1) {
    const cells = grid[row]!;
    for (let column = 0; column < cells.length; column += 1) {
      const cell = cells[column];
      if (!cell) continue;
      painter.write(bounds.column + column, bounds.row + row, cell.char, {
        foreground: cell.foreground,
        background: theme.background,
        ...(cell.bold ? { bold: true } : {}),
      });
    }
  }
}

function paintMetaballBackground(
  painter: DesktopPainter,
  bounds: Rectangle,
  metaballs: MuxstoneMetaballField,
  theme: MuxstoneThemeSpec,
): void {
  const levels = metaballs.rasterize(bounds, MUXSTONE_METABALL_LEVELS);
  const palette = muxstoneMetaballPalette(theme);
  let offset = 0;
  for (let row = bounds.row; row < bounds.row + bounds.height; row += 1) {
    for (let column = bounds.column; column < bounds.column + bounds.width; column += 1) {
      const level = levels[offset++] ?? 0;
      if (level === 0) continue;
      // recordMyScreen overlays horizontal scanlines. Quantizing alternate
      // rows preserves that texture while bounding distinct ANSI styles.
      const scanlineLevel = row % 2 === 0 ? level : Math.max(1, level - 1);
      const color = palette[scanlineLevel] ?? theme.surface;
      painter.cell(column, row, " ", { foreground: color, background: color });
    }
  }
}

function muxstoneMetaballPalette(theme: MuxstoneThemeSpec): readonly MuxstoneRgb[] {
  const glowTarget = mixMuxstoneRgb(theme.accent, theme.success, 0.35);
  return Array.from({ length: MUXSTONE_METABALL_LEVELS }, (_, level) => {
    if (level === 0) return theme.background;
    const progress = level / (MUXSTONE_METABALL_LEVELS - 1);
    return progress <= 0.55
      ? mixMuxstoneRgb(theme.background, theme.surface, progress / 0.55)
      : mixMuxstoneRgb(theme.surface, glowTarget, ((progress - 0.55) / 0.45) * 0.78);
  });
}

function mixMuxstoneRgb(from: MuxstoneRgb, to: MuxstoneRgb, amount: number): MuxstoneRgb {
  const progress = Math.max(0, Math.min(1, amount));
  return [
    Math.round(from[0] + (to[0] - from[0]) * progress),
    Math.round(from[1] + (to[1] - from[1]) * progress),
    Math.round(from[2] + (to[2] - from[2]) * progress),
  ];
}

function paintWindow(
  painter: DesktopPainter,
  window: WorkbenchWindowChromeProjection,
  controller: MuxstoneController,
  selectedSessionIndex: number,
): void {
  const theme = controller.theme.peek();
  const border = window.active ? theme.accent : theme.border;
  painter.fill(window.rect, " ", { foreground: theme.text, background: theme.surface });
  // Focus reads through colour and weight, so both states share one frame
  // vocabulary rather than swapping the glyphs out underneath the window.
  painter.borderBox(window.rect, muxstoneBorderGlyphs(controller.globalSettings.peek().borderStyle), {
    foreground: border,
    background: theme.surfaceStrong,
    bold: window.active,
  });
  painter.fill(window.titleBarRect, " ", {
    foreground: window.active ? theme.background : theme.text,
    background: window.active ? theme.accent : theme.surfaceStrong,
    bold: window.active,
  });
  const firstControl = window.controls.reduce(
    (minimum, control) => Math.min(minimum, control.rect.column),
    window.titleBarRect.column + window.titleBarRect.width,
  );
  const titleWidth = Math.max(0, firstControl - window.titleBarRect.column - 2);
  const sessionId = muxstoneSessionIdFromWindow(window.id);
  const runtime = sessionId ? controller.runtime(sessionId) : undefined;
  const copyMode = runtime?.scrollback.mode === "copy" ? " [SCROLL]" : "";
  // Mouse reporting off is otherwise invisible and looks exactly like broken
  // passthrough, so the window says so rather than leaving you to guess.
  const noMouse = sessionId && !controller.windowSettingsFor(sessionId).mouseReporting ? " [NO MOUSE]" : "";
  painter.write(
    window.titleBarRect.column + 1,
    window.titleBarRect.row,
    fitText(
      `${window.placement === "floating" ? "~" : "="} ${
        runtime?.summary.peek().title ?? window.title
      }${copyMode}${noMouse}`,
      titleWidth,
    ),
    {
      foreground: window.active ? theme.background : theme.text,
      background: window.active ? theme.accent : theme.surfaceStrong,
      bold: window.active,
    },
  );
  for (const control of window.controls) {
    const danger = control.kind === "close";
    painter.write(control.rect.column, control.rect.row, fitText(control.text, control.rect.width), {
      foreground: danger ? theme.danger : window.active ? theme.background : theme.text,
      background: window.active ? theme.accent : theme.surfaceStrong,
      bold: danger || window.active,
    });
  }
  painter.fill(window.clientRect, " ", { foreground: theme.text, background: theme.surface });
  if (window.id === MUXSTONE_SESSIONS_WINDOW_ID) {
    paintSessionManager(painter, window.clientRect, controller, selectedSessionIndex, window.active);
    return;
  }
  if (window.id === MUXSTONE_NETWORK_WINDOW_ID) {
    paintNetworkPanel(painter, window.clientRect, controller, window.active);
    return;
  }
  if (runtime && sessionId) {
    paintTerminal(painter, window.clientRect, runtime, theme, window.active, controller.windowSettingsFor(sessionId));
  }
}

function paintNetworkPanel(
  painter: DesktopPainter,
  rect: Rectangle,
  controller: MuxstoneController,
  active: boolean,
): void {
  const theme = controller.theme.peek();
  painter.write(
    rect.column + 1,
    rect.row,
    fitText("Enter open · ←/→ fold · Del forget · r refresh", Math.max(0, rect.width - 2)),
    {
      foreground: theme.muted,
      background: theme.surface,
    },
  );
  const tree = controller.networkTree;
  const height = Math.max(0, rect.height - NETWORK_LIST_START);
  const visible = tree.visible(height);
  const selected = tree.selected();
  for (let visibleIndex = 0; visibleIndex < visible.length; visibleIndex += 1) {
    const row = visible[visibleIndex]!;
    const paintRow = rect.row + NETWORK_LIST_START + visibleIndex;
    const width = Math.max(0, rect.width - 2);
    const isSelected = active && selected?.index === row.index;
    const note = row.id.startsWith("note:");
    const heading = row.depth === 0;
    const offline = controller.networkDevice(row.id)?.online === false;
    const foreground = isSelected
      ? theme.background
      : heading
      ? theme.accent
      : note || offline
      ? theme.muted
      : theme.text;
    if (isSelected) {
      painter.fill({ column: rect.column, row: paintRow, width: rect.width, height: 1 }, " ", {
        foreground,
        background: theme.accent,
        bold: true,
      });
    }
    painter.write(rect.column + 1, paintRow, fitText(row.text, width), {
      foreground,
      background: isSelected ? theme.accent : theme.surface,
      bold: isSelected || heading,
    });
  }
}

function paintSessionManager(
  painter: DesktopPainter,
  rect: Rectangle,
  controller: MuxstoneController,
  selectedSessionIndex: number,
  active: boolean,
): void {
  const theme = controller.theme.peek();
  painter.write(rect.column + 1, rect.row, "Detached host sessions", {
    foreground: theme.accent,
    background: theme.surface,
    bold: true,
  });
  painter.write(rect.column + 1, rect.row + 1, "Enter attach | Del kill | sessions survive UI exit", {
    foreground: theme.muted,
    background: theme.surface,
  });
  const sessions = controller.sessions.peek();
  if (sessions.length === 0) {
    painter.write(rect.column + 1, rect.row + SESSION_LIST_START, "No terminals. Ctrl-N c creates one.", {
      foreground: theme.muted,
      background: theme.surface,
    });
    return;
  }
  const selected = clampIndex(selectedSessionIndex, sessions.length);
  const available = Math.max(0, rect.height - SESSION_LIST_START);
  const offset = Math.max(0, Math.min(selected - Math.floor(available / 2), sessions.length - available));
  for (let visibleIndex = 0; visibleIndex < available; visibleIndex += 1) {
    const index = offset + visibleIndex;
    const session = sessions[index];
    if (!session) break;
    const runtime = controller.runtime(session.id);
    const isSelected = active && index === selected;
    const attached = runtime?.attached.peek() ?? false;
    const status = session.running ? (attached ? "LIVE" : "HOLD") : session.status.toUpperCase();
    const row = rect.row + SESSION_LIST_START + visibleIndex;
    painter.fill({ column: rect.column, row, width: rect.width, height: 1 }, " ", {
      foreground: isSelected ? theme.background : session.running ? theme.text : theme.muted,
      background: isSelected ? theme.accent : theme.surface,
      bold: isSelected,
    });
    painter.write(
      rect.column + 1,
      row,
      fitText(
        `${isSelected ? ">" : " "} [${status}] ${session.title} :: ${session.commandLine}`,
        Math.max(0, rect.width - 2),
      ),
      {
        foreground: isSelected ? theme.background : session.running ? theme.text : theme.muted,
        background: isSelected ? theme.accent : theme.surface,
        bold: isSelected,
      },
    );
  }
}

/** Unthemed terminal defaults used when a window opts out of theme recoloring. */
const RAW_TERMINAL_BACKGROUND: MuxstoneRgb = [0, 0, 0];
const RAW_TERMINAL_FOREGROUND: MuxstoneRgb = [229, 229, 229];

/** Fades one color toward the surface so unfocused windows recede. */
function dimTowards(color: MuxstoneRgb, towards: MuxstoneRgb): MuxstoneRgb {
  return [
    Math.round(color[0] + (towards[0] - color[0]) * 0.45),
    Math.round(color[1] + (towards[1] - color[1]) * 0.45),
    Math.round(color[2] + (towards[2] - color[2]) * 0.45),
  ];
}

function paintTerminal(
  painter: DesktopPainter,
  rect: Rectangle,
  runtime: MuxstoneTerminalRuntime,
  theme: MuxstoneThemeSpec,
  active: boolean,
  settings: MuxstoneWindowSettings,
): void {
  const inspection = runtime.screen.inspect();
  const scrollback = runtime.scrollback.inspectViewport();
  const rows = scrollback.mode === "copy"
    ? runtime.screen.cellRowsRange(scrollback.offset, scrollback.viewportRows)
    : runtime.screen.cellRows();
  const cursorActive = scrollback.mode === "live" && active && runtime.attached.peek() &&
    runtime.summary.peek().running && inspection.cursorVisible;
  // Theme-off keeps the child's true ANSI colors over a plain terminal ground;
  // theme-on maps unset colors onto the theme and lifts ANSI text to contrast.
  const themed = settings.themed;
  const defaultBackground = themed ? theme.surface : RAW_TERMINAL_BACKGROUND;
  const defaultForeground = themed ? theme.text : RAW_TERMINAL_FOREGROUND;
  const dim = settings.dimInactive && !active;
  for (let row = 0; row < rect.height; row += 1) {
    const cells = rows[row] ?? [];
    for (let column = 0; column < rect.width; column += 1) {
      const cell = cells[column] ?? { char: " " };
      const cursor = cursorActive && inspection.cursor.row === row && inspection.cursor.column === column;
      let background = cursor ? theme.accent : muxstoneTerminalRgb(cell.background, true) ?? defaultBackground;
      let foreground = cursor
        ? theme.background
        : cell.background === undefined && themed
        ? muxstoneTerminalForegroundRgb(cell.foreground, theme.surface, theme.text) ?? defaultForeground
        : muxstoneTerminalRgb(cell.foreground, false) ?? defaultForeground;
      if (dim) {
        background = dimTowards(background, theme.surface);
        foreground = dimTowards(foreground, theme.surface);
      }
      const rawGlyph = cell.char || " ";
      // A double-width glyph on the last content column would put its follower
      // on the window border, so it degrades to a blank inside the client area.
      const glyph = muxstoneGlyphColumns(rawGlyph) === 2 && column + 1 >= rect.width ? " " : rawGlyph;
      painter.cell(rect.column + column, rect.row + row, glyph, {
        foreground,
        background,
        bold: cursor || cell.bold,
      });
      // The screen model stores a blank in the second column of a wide glyph.
      // Painting it would retire the glyph we just placed, so step over it and
      // let the painter own both columns.
      if (muxstoneGlyphColumns(glyph) === 2) column += 1;
    }
  }
  const warning = runtime.warning.peek();
  if (warning && rect.height > 0) {
    painter.write(rect.column, rect.row + rect.height - 1, fitText(`! ${warning}`, rect.width), {
      foreground: theme.warning,
      background: theme.surfaceStrong,
      bold: true,
    });
  }
}

function paintTerminalBar(
  painter: DesktopPainter,
  projection: MuxstoneTerminalBarProjection,
  theme: MuxstoneThemeSpec,
): void {
  painter.fill(projection.bounds, " ", {
    foreground: theme.text,
    background: theme.surfaceStrong,
  });
  for (const command of projection.commands) {
    const active = command.state === "active";
    painter.fill(command.rect, " ", {
      foreground: active ? theme.background : theme.text,
      background: active ? theme.accent : theme.surfaceStrong,
      bold: active,
    });
    painter.write(command.rect.column, command.rect.row, command.text, {
      foreground: active ? theme.background : theme.text,
      background: active ? theme.accent : theme.surfaceStrong,
      bold: active,
    });
  }
}

function paintSwitcher(
  painter: DesktopPainter,
  projection: WorkbenchWindowHostProjection,
  theme: MuxstoneThemeSpec,
): void {
  const switcher = projection.switcher!;
  const width = Math.min(48, Math.max(20, projection.bounds.width - 8));
  const height = Math.min(switcher.items.length + 2, Math.max(3, projection.bounds.height - 4));
  const rect = {
    column: projection.bounds.column + Math.max(0, Math.floor((projection.bounds.width - width) / 2)),
    row: projection.bounds.row + Math.max(0, Math.floor((projection.bounds.height - height) / 2)),
    width,
    height,
  };
  painter.fill(rect, " ", { foreground: theme.text, background: theme.surfaceStrong });
  painter.frame(rect, "#", { foreground: theme.accent, background: theme.surfaceStrong, bold: true });
  for (let index = 0; index < Math.min(switcher.items.length, Math.max(0, height - 2)); index += 1) {
    const item = switcher.items[index]!;
    painter.write(
      rect.column + 1,
      rect.row + 1 + index,
      fitText(`${item.selected ? ">" : " "} ${item.title}`, width - 2),
      {
        foreground: item.selected ? theme.background : theme.text,
        background: item.selected ? theme.accent : theme.surfaceStrong,
        bold: item.selected,
      },
    );
  }
}

function paintHelp(
  painter: DesktopPainter,
  projection: WorkbenchWindowHostProjection,
  theme: MuxstoneThemeSpec,
): void {
  const lines = [
    "MUXSTONE KEY REFERENCE",
    'Ctrl-N c        new floating term  Ctrl-N % / "   split right / below',
    "Ctrl-N f/Space  float or tile      Ctrl-N z         maximize / restore",
    "Ctrl-N arrows   snap to edge       Ctrl-N m         minimize to shelf",
    "Ctrl-N n / p    next / previous    Ctrl-N w         window switcher",
    "Ctrl-N s        session manager    Ctrl-N r         refresh and recover",
    "Ctrl-N t        cycle theme        Ctrl-N Ctrl-N    send literal prefix",
    "Ctrl-N b        cycle background   Start menu       every command lives there",
    "Ctrl-N d / x    detach window      Ctrl-N &         request terminal kill",
    "Wheel terminals or swipe vertically for styled history; [SCROLL] marks copy mode.",
    "Title-bar X / Meta-C kills that terminal; Ctrl-N d/x and quitting only detach.",
    "Ctrl-N & asks before killing. Drag title bars; drag borders to resize.",
    "Top bar: start menu at the left, open terminals beside it, quit at the right.",
    "Press Escape, q, or ? to close help. Mouse and touch can use Close.",
  ];
  const { rect, closeRect } = muxstoneHelpLayout(projection.bounds);
  painter.fill(rect, " ", { foreground: theme.text, background: theme.surfaceStrong });
  painter.frame(rect, "#", { foreground: theme.accent, background: theme.surfaceStrong, bold: true });
  for (let index = 0; index < Math.min(lines.length, Math.max(0, rect.height - 3)); index += 1) {
    painter.write(rect.column + 1, rect.row + 1 + index, fitText(lines[index]!, rect.width - 2), {
      foreground: index === 0 ? theme.accent : theme.text,
      background: theme.surfaceStrong,
      bold: index === 0,
    });
  }
  painter.write(closeRect.column, closeRect.row, "[ Close ]", {
    foreground: theme.background,
    background: theme.accent,
    bold: true,
  });
}

function paintKillConfirmation(
  painter: DesktopPainter,
  projection: WorkbenchWindowHostProjection,
  controller: MuxstoneController,
  sessionId: string,
): void {
  const theme = controller.theme.peek();
  const title = controller.runtime(sessionId)?.summary.peek().title ?? sessionId;
  const { rect, cancelRect, confirmRect } = muxstoneKillLayout(projection.bounds);
  painter.fill(rect, " ", { foreground: theme.text, background: theme.surfaceStrong });
  painter.frame(rect, "!", { foreground: theme.danger, background: theme.surfaceStrong, bold: true });
  painter.write(rect.column + 2, rect.row + 1, fitText("TERMINATE HOST SESSION?", rect.width - 4), {
    foreground: theme.danger,
    background: theme.surfaceStrong,
    bold: true,
  });
  painter.write(
    rect.column + 2,
    rect.row + Math.min(3, Math.max(1, rect.height - 2)),
    fitText(`${title} (${sessionId})`, rect.width - 4),
    {
      foreground: theme.text,
      background: theme.surfaceStrong,
    },
  );
  painter.write(cancelRect.column, cancelRect.row, "[ Cancel ]", {
    foreground: theme.text,
    background: theme.surface,
    bold: true,
  });
  painter.write(confirmRect.column, confirmRect.row, "[ Kill ]", {
    foreground: theme.background,
    background: theme.danger,
    bold: true,
  });
}

function paintQuitModal(
  painter: DesktopPainter,
  projection: WorkbenchWindowHostProjection,
  theme: MuxstoneThemeSpec,
): void {
  const { rect, cancelRect, detachRect, terminateRect } = muxstoneQuitLayout(projection.bounds);
  painter.fill(rect, " ", { foreground: theme.text, background: theme.surfaceStrong });
  painter.frame(rect, "!", { foreground: theme.warning, background: theme.surfaceStrong, bold: true });
  painter.write(rect.column + 2, rect.row + 1, fitText("END MUXSTONE SESSION?", rect.width - 4), {
    foreground: theme.warning,
    background: theme.surfaceStrong,
    bold: true,
  });
  painter.write(
    rect.column + 2,
    rect.row + Math.min(3, Math.max(1, rect.height - 2)),
    fitText("Detach keeps terminals running · Terminate kills the host and every terminal", rect.width - 4),
    {
      foreground: theme.text,
      background: theme.surfaceStrong,
    },
  );
  painter.write(cancelRect.column, cancelRect.row, "[ Cancel ]", {
    foreground: theme.text,
    background: theme.surface,
    bold: true,
  });
  painter.write(detachRect.column, detachRect.row, "[ Detach ]", {
    foreground: theme.background,
    background: theme.accent,
    bold: true,
  });
  painter.write(terminateRect.column, terminateRect.row, "[ Terminate ]", {
    foreground: theme.background,
    background: theme.danger,
    bold: true,
  });
}

interface MuxstoneHelpLayout {
  readonly rect: Rectangle;
  readonly closeRect: Rectangle;
}

function muxstoneHelpLayout(bounds: Rectangle): MuxstoneHelpLayout {
  const width = Math.min(84, Math.max(24, bounds.width - 4));
  const height = Math.min(15, Math.max(3, bounds.height - 2));
  const rect = centeredRect(bounds, width, height);
  return {
    rect,
    closeRect: {
      column: rect.column + Math.max(1, rect.width - 10),
      row: rect.row + Math.max(1, rect.height - 2),
      width: Math.min(9, Math.max(0, rect.width - 2)),
      height: 1,
    },
  };
}

interface MuxstoneKillLayout {
  readonly rect: Rectangle;
  readonly cancelRect: Rectangle;
  readonly confirmRect: Rectangle;
}

function muxstoneKillLayout(bounds: Rectangle): MuxstoneKillLayout {
  const width = Math.min(62, Math.max(24, bounds.width - 6));
  const rect = centeredRect(bounds, width, Math.min(8, Math.max(3, bounds.height - 2)));
  const buttonRow = rect.row + Math.max(1, rect.height - 2);
  return {
    rect,
    cancelRect: { column: rect.column + 2, row: buttonRow, width: 10, height: 1 },
    confirmRect: {
      column: rect.column + Math.max(13, rect.width - 10),
      row: buttonRow,
      width: 8,
      height: 1,
    },
  };
}

export interface MuxstoneQuitLayout {
  readonly rect: Rectangle;
  readonly cancelRect: Rectangle;
  readonly detachRect: Rectangle;
  readonly terminateRect: Rectangle;
}

/** Layout for the end-session modal; exported for deterministic pointer tests. */
export function muxstoneQuitLayout(bounds: Rectangle): MuxstoneQuitLayout {
  const width = Math.min(82, Math.max(40, bounds.width - 6));
  const rect = centeredRect(bounds, width, Math.min(8, Math.max(5, bounds.height - 2)));
  const buttonRow = rect.row + Math.max(1, rect.height - 2);
  return {
    rect,
    cancelRect: { column: rect.column + 2, row: buttonRow, width: 10, height: 1 },
    detachRect: {
      column: rect.column + Math.max(13, Math.floor((rect.width - 10) / 2)),
      row: buttonRow,
      width: 10,
      height: 1,
    },
    terminateRect: {
      column: rect.column + Math.max(26, rect.width - 15),
      row: buttonRow,
      width: 13,
      height: 1,
    },
  };
}

/** Layout for the global config modal; exported for deterministic pointer tests. */
export interface MuxstoneGlobalConfigLayout {
  readonly rect: Rectangle;
  /** Visible theme rows, paired with the theme index each row shows. */
  readonly themeRows: readonly { readonly rect: Rectangle; readonly index: number }[];
  /** Visible background rows, paired with the background index each row shows. */
  readonly backgroundRows: readonly { readonly rect: Rectangle; readonly index: number }[];
  /** One hit row per entry in MUXSTONE_GLOBAL_SETTING_SPECS, in declaration order. */
  readonly optionRows: readonly Rectangle[];
  readonly closeRect: Rectangle;
}

/** Scrolls a select list so the selected row stays visible. */
function selectListStart(selected: number, total: number, visible: number): number {
  if (total <= visible) return 0;
  return clampNumber(selected - Math.floor(visible / 2), 0, total - visible);
}

function clampNumber(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Layout for the global config modal; exported for deterministic pointer tests. */
export function muxstoneGlobalConfigLayout(
  bounds: Rectangle,
  themeIndex: number,
  backgroundIndex: number,
): MuxstoneGlobalConfigLayout {
  const width = Math.min(78, Math.max(52, bounds.width - 6));
  const optionCount = MUXSTONE_GLOBAL_SETTING_SPECS.length;
  // Frame + title + headers + lists + gap + options + buttons + frame.
  const desired = MUXSTONE_THEMES.length + optionCount + 6;
  const height = Math.min(Math.max(12, bounds.height - 2), desired);
  const rect = centeredRect(bounds, width, height);
  const listTop = rect.row + 2;
  const visibleRows = Math.max(1, rect.height - optionCount - 5);
  const columnWidth = Math.max(8, Math.floor((rect.width - 5) / 2));
  const themeStart = selectListStart(themeIndex, MUXSTONE_THEMES.length, visibleRows);
  const backgroundStart = selectListStart(backgroundIndex, MUXSTONE_BACKGROUND_IDS.length, visibleRows);
  const themeRows: { rect: Rectangle; index: number }[] = [];
  const backgroundRows: { rect: Rectangle; index: number }[] = [];
  for (let offset = 0; offset < visibleRows; offset += 1) {
    const row = listTop + offset;
    if (themeStart + offset < MUXSTONE_THEMES.length) {
      themeRows.push({
        rect: { column: rect.column + 2, row, width: columnWidth, height: 1 },
        index: themeStart + offset,
      });
    }
    if (backgroundStart + offset < MUXSTONE_BACKGROUND_IDS.length) {
      backgroundRows.push({
        rect: { column: rect.column + 3 + columnWidth, row, width: columnWidth, height: 1 },
        index: backgroundStart + offset,
      });
    }
  }
  const optionTop = rect.row + rect.height - optionCount - 2;
  const optionRows: Rectangle[] = [];
  for (let index = 0; index < optionCount; index += 1) {
    optionRows.push({ column: rect.column + 2, row: optionTop + index, width: Math.max(0, rect.width - 4), height: 1 });
  }
  return {
    rect,
    themeRows,
    backgroundRows,
    optionRows,
    closeRect: {
      column: rect.column + Math.max(2, rect.width - 11),
      row: rect.row + rect.height - 1,
      width: 9,
      height: 1,
    },
  };
}

function paintGlobalConfigModal(
  painter: DesktopPainter,
  projection: WorkbenchWindowHostProjection,
  theme: MuxstoneThemeSpec,
  controller: MuxstoneController,
): void {
  const themeIndex = Math.max(0, MUXSTONE_THEMES.findIndex((entry) => entry.id === controller.themeId.peek()));
  const backgroundIndex = Math.max(0, MUXSTONE_BACKGROUND_IDS.indexOf(controller.backgroundId.peek()));
  const layout = muxstoneGlobalConfigLayout(projection.bounds, themeIndex, backgroundIndex);
  const { rect, themeRows, backgroundRows, optionRows, closeRect } = layout;
  const pane = controller.globalConfigPane.peek();
  const settings = controller.globalSettings.peek();
  const optionIndex = controller.globalConfigOptionIndex.peek();

  painter.fill(rect, " ", { foreground: theme.text, background: theme.surfaceStrong });
  painter.frame(rect, "#", { foreground: theme.accent, background: theme.surfaceStrong, bold: true });
  painter.write(rect.column + 2, rect.row, " Muxstone settings ", {
    foreground: theme.background,
    background: theme.accent,
    bold: true,
  });

  const columnWidth = themeRows[0]?.rect.width ?? Math.max(8, Math.floor((rect.width - 5) / 2));
  const headerRow = rect.row + 1;
  const header = (column: number, text: string, focused: boolean) => {
    painter.write(column, headerRow, fitText(text, columnWidth), {
      foreground: focused ? theme.accent : theme.muted,
      background: theme.surfaceStrong,
      bold: focused,
    });
  };
  header(rect.column + 2, "Theme", pane === "theme");
  header(rect.column + 3 + columnWidth, "Background", pane === "background");

  const paintRow = (rowRect: Rectangle, label: string, selected: boolean, focused: boolean) => {
    painter.fill(rowRect, " ", {
      foreground: selected ? theme.background : theme.text,
      background: selected ? (focused ? theme.accent : theme.surface) : theme.surfaceStrong,
      bold: selected,
    });
    painter.write(rowRect.column, rowRect.row, fitText(`${selected ? ">" : " "} ${label}`, rowRect.width), {
      foreground: selected ? (focused ? theme.background : theme.accent) : theme.text,
      background: selected ? (focused ? theme.accent : theme.surface) : theme.surfaceStrong,
      bold: selected,
    });
  };
  for (const row of themeRows) {
    paintRow(row.rect, MUXSTONE_THEMES[row.index]!.label, row.index === themeIndex, pane === "theme");
  }
  for (const row of backgroundRows) {
    const id = MUXSTONE_BACKGROUND_IDS[row.index]!;
    const grows = muxstoneBackgroundOvergrows(id) ? " *" : "";
    paintRow(row.rect, `${id}${grows}`, row.index === backgroundIndex, pane === "background");
  }

  for (let index = 0; index < optionRows.length; index += 1) {
    const rowRect = optionRows[index]!;
    const spec = MUXSTONE_GLOBAL_SETTING_SPECS[index]!;
    const focused = pane === "options" && index === optionIndex;
    const value = spec.format(settings[spec.id]);

    const valueColumn = rowRect.column + Math.max(0, rowRect.width - textWidth(value) - 1);
    painter.fill(rowRect, " ", {
      foreground: focused ? theme.background : theme.text,
      background: focused ? theme.accent : theme.surfaceStrong,
      bold: focused,
    });
    painter.write(
      rowRect.column,
      rowRect.row,
      fitText(`${focused ? ">" : " "} ${spec.label}`, Math.max(0, valueColumn - rowRect.column - 1)),
      {
        foreground: focused ? theme.background : theme.text,
        background: focused ? theme.accent : theme.surfaceStrong,
        bold: focused,
      },
    );
    painter.write(valueColumn, rowRect.row, value, {
      foreground: focused ? theme.background : theme.accent,
      background: focused ? theme.accent : theme.surfaceStrong,
      bold: true,
    });
  }

  painter.write(rect.column + 2, rect.row + rect.height - 1, fitText(" * overgrows idle windows ", rect.width - 14), {
    foreground: theme.muted,
    background: theme.surfaceStrong,
  });
  painter.write(closeRect.column, closeRect.row, "[ Close ]", {
    foreground: theme.background,
    background: theme.accent,
    bold: true,
  });
}

/** Layout for the per-window config modal; exported for deterministic pointer tests. */
export interface MuxstoneWindowConfigLayout {
  readonly rect: Rectangle;
  /** One hit row per entry in MUXSTONE_WINDOW_SETTING_SPECS, in declaration order. */
  readonly rowRects: readonly Rectangle[];
  readonly resetRect: Rectangle;
  readonly closeRect: Rectangle;
}

/** Layout for the per-window config modal; exported for deterministic pointer tests. */
export function muxstoneWindowConfigLayout(bounds: Rectangle): MuxstoneWindowConfigLayout {
  const width = Math.min(72, Math.max(44, bounds.width - 6));
  const rowCount = MUXSTONE_WINDOW_SETTING_SPECS.length;
  // Frame + title + blank + rows + blank + buttons + frame.
  const height = Math.min(Math.max(8, bounds.height - 2), rowCount + 6);
  const rect = centeredRect(bounds, width, height);
  const firstRow = rect.row + 2;
  const usableRows = Math.max(0, rect.height - 5);
  const rowRects: Rectangle[] = [];
  for (let index = 0; index < Math.min(rowCount, usableRows); index += 1) {
    rowRects.push({ column: rect.column + 2, row: firstRow + index, width: Math.max(0, rect.width - 4), height: 1 });
  }
  const buttonRow = rect.row + Math.max(1, rect.height - 2);
  return {
    rect,
    rowRects,
    resetRect: { column: rect.column + 2, width: 9, row: buttonRow, height: 1 },
    closeRect: { column: rect.column + Math.max(13, rect.width - 11), width: 9, row: buttonRow, height: 1 },
  };
}

function paintWindowConfigModal(
  painter: DesktopPainter,
  projection: WorkbenchWindowHostProjection,
  theme: MuxstoneThemeSpec,
  controller: MuxstoneController,
  sessionId: string,
): void {
  const { rect, rowRects, resetRect, closeRect } = muxstoneWindowConfigLayout(projection.bounds);
  const settings = controller.windowSettingsFor(sessionId);
  const selected = controller.configRowIndex.peek();
  const title = controller.runtime(sessionId)?.summary.peek().title ?? sessionId;
  painter.fill(rect, " ", { foreground: theme.text, background: theme.surfaceStrong });
  painter.frame(rect, "#", { foreground: theme.accent, background: theme.surfaceStrong, bold: true });
  painter.write(rect.column + 2, rect.row, fitText(` ${title} settings `, Math.max(0, rect.width - 4)), {
    foreground: theme.background,
    background: theme.accent,
    bold: true,
  });
  for (let index = 0; index < rowRects.length; index += 1) {
    const rowRect = rowRects[index]!;
    const spec = MUXSTONE_WINDOW_SETTING_SPECS[index]!;
    const active = index === selected;
    const value = spec.format(settings[spec.id]);
    const label = `${active ? ">" : " "} ${spec.label}`;
    // Right-align the value so the column of settings reads as a table.
    const valueColumn = rowRect.column + Math.max(0, rowRect.width - textWidth(value) - 1);
    painter.fill(rowRect, " ", {
      foreground: active ? theme.background : theme.text,
      background: active ? theme.accent : theme.surfaceStrong,
      bold: active,
    });
    painter.write(rowRect.column, rowRect.row, fitText(label, Math.max(0, valueColumn - rowRect.column - 1)), {
      foreground: active ? theme.background : theme.text,
      background: active ? theme.accent : theme.surfaceStrong,
      bold: active,
    });
    painter.write(valueColumn, rowRect.row, value, {
      foreground: active ? theme.background : theme.accent,
      background: active ? theme.accent : theme.surfaceStrong,
      bold: true,
    });
  }
  const detail = MUXSTONE_WINDOW_SETTING_SPECS[selected]?.detail ?? "";
  const detailRow = rect.row + Math.max(1, rect.height - 3);
  painter.write(rect.column + 2, detailRow, fitText(detail, Math.max(0, rect.width - 4)), {
    foreground: theme.muted,
    background: theme.surfaceStrong,
  });
  painter.write(resetRect.column, resetRect.row, "[ Reset ]", {
    foreground: theme.text,
    background: theme.surface,
    bold: true,
  });
  painter.write(closeRect.column, closeRect.row, "[ Close ]", {
    foreground: theme.background,
    background: theme.accent,
    bold: true,
  });
}

interface MuxstoneScpLayout {
  readonly rect: Rectangle;
  readonly cancelRect: Rectangle;
  readonly pasteRect: Rectangle;
  readonly sendRect: Rectangle;
}

/** Layout for the paste-to-scp modal; exported for deterministic pointer tests. */
export function muxstoneScpLayout(bounds: Rectangle): MuxstoneScpLayout {
  const width = Math.min(84, Math.max(44, bounds.width - 6));
  const rect = centeredRect(bounds, width, Math.min(9, Math.max(6, bounds.height - 2)));
  const buttonRow = rect.row + Math.max(1, rect.height - 2);
  return {
    rect,
    cancelRect: { column: rect.column + 2, row: buttonRow, width: 10, height: 1 },
    pasteRect: {
      column: rect.column + Math.max(13, Math.floor((rect.width - 14) / 2)),
      row: buttonRow,
      width: 14,
      height: 1,
    },
    sendRect: {
      column: rect.column + Math.max(29, rect.width - 10),
      row: buttonRow,
      width: 8,
      height: 1,
    },
  };
}

function paintScpModal(
  painter: DesktopPainter,
  projection: WorkbenchWindowHostProjection,
  theme: MuxstoneThemeSpec,
  request: MuxstoneScpRequest,
): void {
  const { rect, cancelRect, pasteRect, sendRect } = muxstoneScpLayout(projection.bounds);
  painter.fill(rect, " ", { foreground: theme.text, background: theme.surfaceStrong });
  painter.frame(rect, "=", { foreground: theme.accent, background: theme.surfaceStrong, bold: true });
  painter.write(rect.column + 2, rect.row + 1, fitText("SEND FILE OVER SCP?", rect.width - 4), {
    foreground: theme.accent,
    background: theme.surfaceStrong,
    bold: true,
  });
  painter.write(
    rect.column + 2,
    rect.row + 2,
    fitText(`${request.localPath} → ${muxstoneScpDestinationLabel(request)}`, rect.width - 4),
    {
      foreground: theme.text,
      background: theme.surfaceStrong,
    },
  );
  const passwordRow = rect.row + Math.max(3, rect.height - 3);
  const masked = request.password.length > 0 ? "•".repeat(Math.min(request.password.length, rect.width - 16)) : "";
  const passwordHint = masked || "(key/agent auth)";
  painter.write(rect.column + 2, passwordRow, fitText(`Password: ${passwordHint}`, rect.width - 4), {
    foreground: request.password.length > 0 ? theme.text : theme.muted,
    background: theme.surfaceStrong,
  });
  painter.write(cancelRect.column, cancelRect.row, "[ Cancel ]", {
    foreground: theme.text,
    background: theme.surface,
    bold: true,
  });
  painter.write(pasteRect.column, pasteRect.row, "[ Paste path ]", {
    foreground: theme.text,
    background: theme.surface,
    bold: true,
  });
  painter.write(sendRect.column, sendRect.row, "[ Send ]", {
    foreground: theme.background,
    background: theme.accent,
    bold: true,
  });
}

function centeredRect(bounds: Rectangle, width: number, height: number): Rectangle {
  return {
    column: bounds.column + Math.max(0, Math.floor((bounds.width - width) / 2)),
    row: bounds.row + Math.max(0, Math.floor((bounds.height - height) / 2)),
    width,
    height,
  };
}

interface PaintedStyle {
  foreground: MuxstoneRgb;
  background: MuxstoneRgb;
  bold?: boolean;
}

/** Small paint buffer that caches ANSI style functions by exact cell style. */
/**
 * Marks the second column of a double-width glyph. An empty cell makes the ANSI
 * sink emit nothing there, which is exactly right: the glyph itself already
 * moved the real cursor across both columns.
 */
const MUXSTONE_WIDE_GLYPH_FOLLOWER = "";

/**
 * Terminal columns one glyph occupies. The desktop is modelled one column per
 * cell, so a double-width glyph that is not accounted for shifts every later
 * cell on the row and — because the canvas repaints differentially — the damage
 * persists until something forces a full repaint.
 */
export function muxstoneGlyphColumns(glyph: string): 1 | 2 {
  const code = glyph.codePointAt(0);
  if (code === undefined || code < 0x80) return 1;
  return textWidth(glyph) > 1 ? 2 : 1;
}

class DesktopPainter {
  readonly rows: string[][];
  readonly #styles = new Map<string, Style>();

  constructor(readonly bounds: Rectangle, readonly theme: MuxstoneThemeSpec) {
    this.rows = Array.from(
      { length: Math.max(0, bounds.height) },
      () => Array.from({ length: Math.max(0, bounds.width) }, () => " "),
    );
  }

  cell(column: number, row: number, char: string, style: PaintedStyle): void {
    const localColumn = Math.floor(column - this.bounds.column);
    const localRow = Math.floor(row - this.bounds.row);
    if (localRow < 0 || localRow >= this.rows.length || localColumn < 0 || localColumn >= this.bounds.width) return;
    const target = this.rows[localRow]!;
    const glyph = char || " ";
    const paint = this.#style(style);
    // Overwriting either half of an existing double-width glyph has to retire
    // the other half, or its two-column render desynchronises every later cell.
    this.#retireWideGlyphAt(target, localColumn);
    if (muxstoneGlyphColumns(glyph) === 1) {
      target[localColumn] = paint(glyph);
      return;
    }
    // A double-width glyph on the final column has nowhere to put its follower,
    // so it degrades to a blank rather than spilling past the desktop edge.
    if (localColumn + 1 >= this.bounds.width) {
      target[localColumn] = paint(" ");
      return;
    }
    // The follower is left empty so the sink emits nothing for it and the real
    // cursor, already advanced two columns by the glyph, stays in step.
    this.#retireWideGlyphAt(target, localColumn + 1);
    target[localColumn] = paint(glyph);
    target[localColumn + 1] = MUXSTONE_WIDE_GLYPH_FOLLOWER;
  }

  write(column: number, row: number, text: string, style: PaintedStyle): void {
    let cursor = column;
    for (const char of text) {
      this.cell(cursor, row, char, style);
      cursor += muxstoneGlyphColumns(char);
    }
  }

  /** Blanks whichever half of a straddling double-width glyph touches `column`. */
  #retireWideGlyphAt(target: string[], column: number): void {
    if (target[column] === MUXSTONE_WIDE_GLYPH_FOLLOWER) {
      if (column > 0) target[column - 1] = " ";
    } else if (target[column + 1] === MUXSTONE_WIDE_GLYPH_FOLLOWER) {
      target[column + 1] = " ";
    }
  }

  writeRight(row: number, text: string, style: PaintedStyle): void {
    const fitted = fitText(text, this.bounds.width);
    this.write(this.bounds.column + Math.max(0, this.bounds.width - fitted.length), row, fitted, style);
  }

  fill(rect: Rectangle, char: string, style: PaintedStyle): void {
    for (let row = rect.row; row < rect.row + rect.height; row += 1) {
      for (let column = rect.column; column < rect.column + rect.width; column += 1) {
        this.cell(column, row, char, style);
      }
    }
  }

  /** Draws a box frame with distinct corner and edge glyphs. */
  borderBox(rect: Rectangle, glyphs: MuxstoneBorderGlyphs, style: PaintedStyle): void {
    if (rect.width <= 0 || rect.height <= 0) return;
    const right = rect.column + rect.width - 1;
    const bottom = rect.row + rect.height - 1;
    for (let column = rect.column + 1; column < right; column += 1) {
      this.cell(column, rect.row, glyphs.top, style);
      this.cell(column, bottom, glyphs.bottom, style);
    }
    for (let row = rect.row + 1; row < bottom; row += 1) {
      this.cell(rect.column, row, glyphs.left, style);
      this.cell(right, row, glyphs.right, style);
    }
    this.cell(rect.column, rect.row, glyphs.topLeft, style);
    this.cell(right, rect.row, glyphs.topRight, style);
    this.cell(rect.column, bottom, glyphs.bottomLeft, style);
    this.cell(right, bottom, glyphs.bottomRight, style);
  }

  frame(rect: Rectangle, char: string, style: PaintedStyle): void {
    if (rect.width <= 0 || rect.height <= 0) return;
    for (let column = rect.column; column < rect.column + rect.width; column += 1) {
      this.cell(column, rect.row, char, style);
      this.cell(column, rect.row + rect.height - 1, char, style);
    }
    for (let row = rect.row; row < rect.row + rect.height; row += 1) {
      this.cell(rect.column, row, char, style);
      this.cell(rect.column + rect.width - 1, row, char, style);
    }
  }

  #style(spec: PaintedStyle): Style {
    const key = `${spec.foreground.join(",")}|${spec.background.join(",")}|${spec.bold ? 1 : 0}`;
    let style = this.#styles.get(key);
    if (!style) {
      style = createAnsiStyle({
        foreground: spec.foreground,
        background: spec.background,
        bold: spec.bold,
      });
      this.#styles.set(key, style);
    }
    return style;
  }
}

interface MuxstoneDesktopSurfaceOptions extends ComponentOptions {
  readonly revision: Computed<string>;
  readonly render: () => string[][];
}

/** One component/one draw object for the complete dynamic multiplexer desktop. */
class MuxstoneDesktopSurface extends Component {
  declare drawnObjects: { desktop: MuxstoneDesktopDrawObject };

  constructor(private readonly options: MuxstoneDesktopSurfaceOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();
    const desktop = new MuxstoneDesktopDrawObject({
      canvas: this.tui.canvas,
      view: this.view,
      style: this.style,
      zIndex: this.zIndex,
      rectangle: this.rectangle,
      revision: this.options.revision,
      render: this.options.render,
    });
    this.drawnObjects.desktop = desktop;
    desktop.draw();
  }
}

interface MuxstoneDesktopDrawObjectOptions {
  canvas: DrawObject["canvas"];
  view: DrawObject["view"];
  style: DrawObject["style"];
  zIndex: DrawObject["zIndex"];
  rectangle: SignalOfObject<Rectangle>;
  revision: Computed<string>;
  render: () => string[][];
}

/** Retained canvas primitive that updates the desktop as coalesced row ranges. */
class MuxstoneDesktopDrawObject extends DrawObject<"muxstone-desktop"> {
  declare rectangle: SignalOfObject<Rectangle>;
  readonly #revision: Computed<string>;
  readonly #renderDesktop: () => string[][];
  readonly #lifecycle = new AbortController();
  #previousRows: string[][] = [];
  #forceFullPaint = true;

  constructor(options: MuxstoneDesktopDrawObjectOptions) {
    super("muxstone-desktop", options);
    this.rectangle = options.rectangle;
    this.#revision = options.revision;
    this.#renderDesktop = options.render;
  }

  override draw(): void {
    this.rectangle.subscribe(() => this.#invalidate(true), this.#lifecycle.signal);
    this.#revision.subscribe(() => this.#invalidate(false), this.#lifecycle.signal);
    super.draw();
  }

  override erase(): void {
    this.#lifecycle.abort();
    super.erase();
  }

  override render(): void {
    this.#forceFullPaint = true;
    this.rerender();
  }

  override rerender(): void {
    const rectangle = this.rectangle.peek();
    const rows = this.#renderDesktop();
    const previousRows = this.#previousRows;
    const canvasSize = this.canvas.size.peek();
    const rowEnd = Math.min(canvasSize.rows, rectangle.row + rectangle.height);
    const columnEnd = Math.min(canvasSize.columns, rectangle.column + rectangle.width);
    for (let row = Math.max(0, rectangle.row); row < rowEnd; row += 1) {
      const source = rows[row - rectangle.row] ?? [];
      const previous = previousRows[row - rectangle.row] ?? [];
      const frameRow = this.canvas.frameBuffer[row] ??= [];
      const omitted = this.omitCells[row];
      const forced = this.rerenderCells[row];
      let rangeStart = -1;
      for (let column = Math.max(0, rectangle.column); column < columnEnd; column += 1) {
        const sourceColumn = column - rectangle.column;
        const value = source[sourceColumn] ?? " ";
        const changed = this.#forceFullPaint || forced?.has(column) || previous[sourceColumn] !== value;
        if (!changed || omitted?.has(column)) {
          if (rangeStart !== -1) {
            (this.canvas.rerenderRanges[row] ??= []).push({ row, startColumn: rangeStart, endColumn: column });
            rangeStart = -1;
          }
          continue;
        }
        frameRow[column] = value;
        if (rangeStart === -1) rangeStart = column;
      }
      if (rangeStart !== -1) {
        (this.canvas.rerenderRanges[row] ??= []).push({ row, startColumn: rangeStart, endColumn: columnEnd });
      }
      forced?.clear();
    }
    this.#previousRows = rows;
    this.#forceFullPaint = false;
  }

  #invalidate(moved: boolean): void {
    if (moved) {
      this.moved = true;
      this.#forceFullPaint = true;
    }
    if (!this.updated) return;
    this.updated = false;
    this.canvas.updateObjects.push(this);
    for (const objectUnder of this.objectsUnder) {
      if (!objectUnder.updated) continue;
      objectUnder.updated = false;
      this.canvas.updateObjects.push(objectUnder);
    }
  }
}

function managerSessionAt(
  controller: MuxstoneController,
  projection: WorkbenchWindowHostProjection,
  selectedSessionIndex: number,
  column: number,
  row: number,
): MuxstoneManagerSessionHit | undefined {
  const manager = projection.windows.find((window) => window.id === MUXSTONE_SESSIONS_WINDOW_ID);
  if (!manager || !contains(manager.clientRect, column, row)) return undefined;
  const sessions = controller.sessions.peek();
  const available = Math.max(0, manager.clientRect.height - SESSION_LIST_START);
  const relativeRow = row - manager.clientRect.row;
  if (relativeRow < SESSION_LIST_START || relativeRow >= SESSION_LIST_START + available) return undefined;
  const selected = clampIndex(selectedSessionIndex, sessions.length);
  const offset = Math.max(0, Math.min(selected - Math.floor(available / 2), sessions.length - available));
  const index = offset + relativeRow - SESSION_LIST_START;
  const session = sessions[index];
  return session ? { session, index } : undefined;
}

function clientWindowAt(
  projection: WorkbenchWindowHostProjection,
  column: number,
  row: number,
): WorkbenchWindowChromeProjection | undefined {
  for (let index = projection.floatingWindows.length - 1; index >= 0; index -= 1) {
    const window = projection.floatingWindows[index]!;
    if (!contains(window.rect, column, row)) continue;
    return contains(window.clientRect, column, row) ? window : undefined;
  }
  for (let index = projection.tiledWindows.length - 1; index >= 0; index -= 1) {
    const window = projection.tiledWindows[index]!;
    if (!contains(window.rect, column, row)) continue;
    return contains(window.clientRect, column, row) ? window : undefined;
  }
  return undefined;
}

/**
 * Widens a top-bar target for touch without growing it vertically. The header
 * is a single row now, so a vertical expansion would reach into the window
 * title bars immediately beneath it and swallow their controls.
 */
function coarseMenuRect(rect: Rectangle): Rectangle {
  return { column: rect.column - 1, row: rect.row, width: rect.width + 2, height: rect.height };
}

function menuAt(column: number, row: number, coarse: boolean, bounds: Rectangle): MuxstoneMenuId | undefined {
  // Only quit is still a direct top-bar command; the rest live in the dropdown.
  const entries = [["quit", menuQuitRect(bounds)]] as const;
  for (const [id, rect] of entries) {
    if (contains(coarse ? coarseMenuRect(rect) : rect, column, row)) return id;
  }
  return undefined;
}

function menuRect(id: MuxstoneMenuId, bounds: Rectangle): Rectangle {
  switch (id) {
    case "quit":
      return menuQuitRect(bounds);
    default:
      return START_BUTTON;
  }
}

/** Returns the session whose `config` titlebar button covers one cell, when any. */
function configControlSessionAt(
  projection: WorkbenchWindowHostProjection,
  column: number,
  row: number,
): string | undefined {
  const windows = [...projection.tiledWindows, ...projection.floatingWindows];
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    const window = windows[index]!;
    if (!contains(window.rect, column, row)) continue;
    for (const control of window.controls) {
      if (control.kind === "config" && contains(control.hitRect, column, row)) {
        return muxstoneSessionIdFromWindow(window.id);
      }
    }
    return undefined;
  }
  return undefined;
}

function touchWindowCommandAt(
  projection: WorkbenchWindowHostProjection,
  column: number,
  row: number,
): Extract<MuxstoneTouchTarget, { kind: "window-command" }> | undefined {
  for (let index = projection.shelf.length - 1; index >= 0; index -= 1) {
    const item = projection.shelf[index]!;
    if (item.rect && contains(item.rect, column, row)) {
      return { kind: "window-command", command: item.command, hitRect: item.rect };
    }
  }
  const windows = [...projection.tiledWindows, ...projection.floatingWindows];
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    const window = windows[index]!;
    if (!contains(window.rect, column, row)) continue;
    for (let controlIndex = window.controls.length - 1; controlIndex >= 0; controlIndex -= 1) {
      const control = window.controls[controlIndex]!;
      if (control.command && contains(control.hitRect, column, row)) {
        return { kind: "window-command", command: control.command, hitRect: control.hitRect };
      }
    }
    return undefined;
  }
  return undefined;
}

function expandedRect(rect: Rectangle, amount: number): Rectangle {
  const safeAmount = Math.max(0, Math.floor(amount));
  return {
    column: rect.column - safeAmount,
    row: rect.row - safeAmount,
    width: rect.width + safeAmount * 2,
    height: rect.height + safeAmount * 2,
  };
}

function rememberTouchGesture(
  gestures: Map<number, MuxstoneTouchGesture>,
  event: PointerInputEvent,
  point: { x: number; y: number },
  target: MuxstoneTouchTarget,
): void {
  if (!gestures.has(event.pointerId) && gestures.size >= MAX_TOUCH_GESTURES) {
    const oldest = gestures.keys().next().value;
    if (oldest !== undefined) gestures.delete(oldest);
  }
  gestures.set(event.pointerId, {
    target,
    startColumn: point.x,
    startRow: point.y,
    startLocalX: event.coordinates.local?.x,
    startLocalY: event.coordinates.local?.y,
    lastColumn: point.x,
    lastRow: point.y,
    moved: false,
  });
}

function updateTouchGesture(
  gesture: MuxstoneTouchGesture,
  event: PointerInputEvent,
  point: { x: number; y: number } | undefined,
  excursion?: MuxstonePointerMoveExcursion,
): void {
  if (point) {
    if (point.x !== gesture.startColumn || point.y !== gesture.startRow) gesture.moved = true;
    gesture.lastColumn = point.x;
    gesture.lastRow = point.y;
  }
  const local = event.coordinates.local;
  if (
    local && gesture.startLocalX !== undefined && gesture.startLocalY !== undefined &&
    Math.hypot(local.x - gesture.startLocalX, local.y - gesture.startLocalY) >= 8
  ) {
    gesture.moved = true;
  }
  if (
    excursion?.minColumn !== undefined && excursion.maxColumn !== undefined &&
    (excursion.minColumn !== gesture.startColumn || excursion.maxColumn !== gesture.startColumn)
  ) {
    gesture.moved = true;
  }
  if (
    excursion?.minRow !== undefined && excursion.maxRow !== undefined &&
    (excursion.minRow !== gesture.startRow || excursion.maxRow !== gesture.startRow)
  ) {
    gesture.moved = true;
  }
  if (
    gesture.startLocalX !== undefined && excursion?.minLocalX !== undefined && excursion.maxLocalX !== undefined &&
    Math.max(
        Math.abs(excursion.minLocalX - gesture.startLocalX),
        Math.abs(excursion.maxLocalX - gesture.startLocalX),
      ) >= 8
  ) {
    gesture.moved = true;
  }
  if (
    gesture.startLocalY !== undefined && excursion?.minLocalY !== undefined && excursion.maxLocalY !== undefined &&
    Math.max(
        Math.abs(excursion.minLocalY - gesture.startLocalY),
        Math.abs(excursion.maxLocalY - gesture.startLocalY),
      ) >= 8
  ) {
    gesture.moved = true;
  }
}

function pointerExcursion(event: PointerInputEvent): MuxstonePointerMoveExcursion {
  const excursion: MuxstonePointerMoveExcursion = {};
  mergePointerExcursion(excursion, event);
  return excursion;
}

function mergePointerExcursion(excursion: MuxstonePointerMoveExcursion, event: PointerInputEvent): void {
  const cell = event.coordinates.cell;
  if (cell) {
    excursion.minColumn = Math.min(excursion.minColumn ?? cell.x, cell.x);
    excursion.maxColumn = Math.max(excursion.maxColumn ?? cell.x, cell.x);
    excursion.minRow = Math.min(excursion.minRow ?? cell.y, cell.y);
    excursion.maxRow = Math.max(excursion.maxRow ?? cell.y, cell.y);
  }
  const local = event.coordinates.local;
  if (local) {
    excursion.minLocalX = Math.min(excursion.minLocalX ?? local.x, local.x);
    excursion.maxLocalX = Math.max(excursion.maxLocalX ?? local.x, local.x);
    excursion.minLocalY = Math.min(excursion.minLocalY ?? local.y, local.y);
    excursion.maxLocalY = Math.max(excursion.maxLocalY ?? local.y, local.y);
  }
}

function primaryPointerActivation(event: PointerInputEvent): boolean {
  return event.primary && (event.button === 0 || (event.device !== "mouse" && event.button === null));
}

function contains(rect: Rectangle, column: number, row: number): boolean {
  return column >= rect.column && row >= rect.row && column < rect.column + rect.width && row < rect.row + rect.height;
}

/**
 * Truncates to a terminal-column budget, not a code-unit count. Measuring by
 * `length` let a double-width title overflow its region, and slicing by index
 * could cut a surrogate pair in half; iterating by code point avoids both.
 */
function fitText(value: string, width: number): string {
  const safeWidth = Math.max(0, Math.floor(width));
  if (safeWidth === 0) return "";
  let columns = 0;
  for (const char of value) columns += muxstoneGlyphColumns(char);
  if (columns <= safeWidth) return value;
  const ellipsis = safeWidth > 3 ? "..." : "";
  const budget = safeWidth - ellipsis.length;
  let fitted = "";
  let used = 0;
  for (const char of value) {
    const glyphWidth = muxstoneGlyphColumns(char);
    if (used + glyphWidth > budget) break;
    fitted += char;
    used += glyphWidth;
  }
  return fitted + ellipsis;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, Math.floor(index)));
}

function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((Math.floor(index) % length) + length) % length;
}

function identityStyle(value: string): string {
  return value;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
