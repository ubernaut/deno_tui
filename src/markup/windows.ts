// Copyright 2023 Im-Beast. MIT license.
import { overlayLayerZIndex, type OverlayStackController, type OverlaySurfaceInspection } from "../layout/overlay.ts";
import type { LayoutNode } from "../layout/solver.ts";
import {
  TILED_WORKSPACE_SNAPSHOT_VERSION,
  type TiledWorkspaceController,
  type TiledWorkspaceDockEdge,
  type TiledWorkspaceInspection,
  type TiledWorkspaceLayoutInspection,
  type TiledWorkspaceLayoutNode,
  type TiledWorkspaceLayoutOptions,
  type TiledWorkspaceSnapshot,
  type TiledWorkspaceWindow,
} from "../layout/tiled_workspace.ts";
import type { Rectangle } from "../types.ts";

/** Current serialized declarative-window integration snapshot version. */
export const MARKUP_WINDOW_SNAPSHOT_VERSION = 2;

/** Legacy declarative-window snapshot version accepted by the V2 migration. */
export const MARKUP_WINDOW_SNAPSHOT_V1_VERSION = 1;

/** Compact projection policy for constrained declarative workspaces. */
export type MarkupWindowCompactMode = "auto" | "always" | "never";

/** Logical state of a declaratively managed tiled or floating window. */
export type MarkupWindowState = "normal" | "minimized" | "maximized" | "closed";

/** Durable placement policy for one declaratively managed window. */
export type MarkupWindowPlacement = "tiled" | "floating";

/** Corner names shared by resize and workspace-snap operations. */
export type MarkupWindowCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** Border or corner moved by a floating-window resize operation. */
export type MarkupWindowResizeEdge =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | MarkupWindowCorner;

/** Integer terminal-cell displacement used by floating move and resize operations. */
export interface MarkupWindowMoveDelta {
  columns: number;
  rows: number;
}

/** Explicit semantic target accepted by floating snap and tiled dock transitions. */
export type MarkupWindowSnapTarget =
  | { kind: "workspace"; edge: TiledWorkspaceDockEdge }
  | { kind: "corner"; corner: MarkupWindowCorner }
  | { kind: "dock"; targetId: string; edge: TiledWorkspaceDockEdge; ratio?: number };

/** Options for switching a window between latent tiled and floating placement. */
export interface SetMarkupWindowPlacementOptions {
  rect?: Rectangle;
}

/** Bounds-recovery policy for keeping floating chrome reachable. */
export interface RecoverMarkupWindowBoundsOptions {
  margin?: number;
  titleBarHeight?: number;
}

/** Actions exposed by the renderer-neutral declarative-window controller. */
export type MarkupWindowAction =
  | "close"
  | "dock"
  | "focus"
  | "maximize"
  | "minimize"
  | "move"
  | "move-by"
  | "recover-bounds"
  | "resize"
  | "resize-window"
  | "resize-ratio"
  | "restore"
  | "restore-snapshot"
  | "set-always-on-top"
  | "set-floating-rect"
  | "set-group"
  | "set-placement"
  | "snap"
  | "swap";

/** Explicit outcome classification for declarative-window actions. */
export type MarkupWindowActionStatus =
  | "applied"
  | "blocked"
  | "disposed"
  | "invalid"
  | "not-found"
  | "unchanged"
  | "unsupported";

/** Stable diagnostic codes emitted while discovering or integrating markup surfaces. */
export type MarkupWindowDiagnosticCode =
  | "duplicate-surface-id"
  | "empty-surface-id"
  | "invalid-surface-id"
  | "missing-modal-geometry"
  | "multiple-maximized-windows"
  | "overlay-id-conflict"
  | "layout-cycle-detected"
  | "layout-depth-exceeded"
  | "layout-node-limit-exceeded"
  | "surface-limit-exceeded"
  | "workspace-id-conflict";

/** Layout lookup sufficient to project a modal into the existing overlay stack. */
export interface MarkupWindowLayoutLookup {
  byId: ReadonlyMap<string, { rect: Rectangle }>;
}

/** Options for constructing the declarative-window integration controller. */
export interface MarkupWindowControllerOptions {
  root: LayoutNode;
  workspace: TiledWorkspaceController;
  overlays: OverlayStackController;
  layout?: MarkupWindowLayoutLookup;
  compactMode?: MarkupWindowCompactMode;
}

/** Options accepted when markup or solved modal geometry changes. */
export interface ReconcileMarkupWindowsOptions {
  layout?: MarkupWindowLayoutLookup;
}

/** Options for projecting declarative windows into renderer coordinates. */
export interface ProjectMarkupWindowsOptions extends Pick<TiledWorkspaceLayoutOptions, "gap" | "separatorHitSize"> {
  compactMode?: MarkupWindowCompactMode;
  /** Optional renderer policy for projecting only a subset of eligible tiled windows. Floating windows are unaffected. */
  visibleWindowIds?: readonly string[];
}

/** One clone-safe controller action result. */
export interface MarkupWindowActionResult {
  action: MarkupWindowAction;
  status: MarkupWindowActionStatus;
  ok: boolean;
  id?: string;
  targetId?: string;
  reason?: string;
}

/** Clone-safe declarative integration diagnostic. */
export interface MarkupWindowDiagnostic {
  code: MarkupWindowDiagnosticCode;
  severity: "warning" | "error";
  message: string;
  id?: string;
}

/** Clone-safe inspection of one declaratively managed tiled or floating window. */
export interface MarkupWindowInspection {
  id: string;
  title?: string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  declaredVisible: boolean;
  state: MarkupWindowState;
  placement: MarkupWindowPlacement;
  floatingRect?: Rectangle;
  restoreRect?: Rectangle;
  snapTarget?: MarkupWindowSnapTarget;
  alwaysOnTop: boolean;
  groupId?: string;
  /** Stable zero-based position in the durable back-to-front focus order. */
  focusOrder: number;
  active: boolean;
  visible: boolean;
}

/** Clone-safe inspection of one declaratively managed modal surface. */
export interface MarkupModalInspection {
  id: string;
  title?: string;
  ownerId?: string;
  declaredVisible: boolean;
  requestedOpen: boolean;
  registered: boolean;
  visible: boolean;
  closeOnOutsideClick: boolean;
  rect?: Rectangle;
  surface?: OverlaySurfaceInspection;
}

/** Clone-safe logical inspection of declarative windows and their shared controllers. */
export interface MarkupWindowControllerInspection {
  disposed: boolean;
  compactMode: MarkupWindowCompactMode;
  activeWindowId?: string;
  maximizedWindowId?: string;
  windows: MarkupWindowInspection[];
  modals: MarkupModalInspection[];
  diagnostics: MarkupWindowDiagnostic[];
  workspace: TiledWorkspaceInspection;
}

/** One floating surface projected for renderer drawing and hit testing. */
export interface MarkupFloatingWindowProjection {
  id: string;
  /** Bounds-recovered rectangle used for the current render. */
  rect: Rectangle;
  /** Detached durable rectangle, unchanged by viewport-only recovery. */
  floatingRect: Rectangle;
  restoreRect?: Rectangle;
  snapTarget?: MarkupWindowSnapTarget;
  state: MarkupWindowState;
  active: boolean;
  visible: boolean;
  alwaysOnTop: boolean;
  groupId?: string;
  focusOrder: number;
  zIndex: number;
  constraintsSatisfied: boolean;
}

/** Renderer-neutral visible projection backed by the shared tiled workspace and overlay stack. */
export interface MarkupWindowProjection {
  compact: boolean;
  compactMode: MarkupWindowCompactMode;
  compactWindowId?: string;
  maximizedWindowId?: string;
  eligibleWindowIds: string[];
  visibleWindowIds: string[];
  hiddenWindowIds: string[];
  workspace: TiledWorkspaceLayoutInspection;
  /** Floating windows in declaration order. */
  floatingWindows: MarkupFloatingWindowProjection[];
  /** Visible floating windows ordered back-to-front, normal tier before always-on-top. */
  floatingZOrder: MarkupFloatingWindowProjection[];
  /** Visible declarative modals owned by this controller. */
  modals: OverlaySurfaceInspection[];
  /** Global shared-stack blocker; an externally owned id need not occur in `modals`. */
  topModalId?: string;
}

/** Persisted visibility state for one declarative modal. */
export interface MarkupModalSnapshot {
  id: string;
  open: boolean;
}

/** Durable V2 placement data for one declared window. */
export interface MarkupWindowPlacementSnapshot {
  id: string;
  placement: MarkupWindowPlacement;
  floatingRect?: Rectangle;
  restoreRect?: Rectangle;
  snapTarget?: MarkupWindowSnapTarget;
  alwaysOnTop: boolean;
  groupId?: string;
}

/** Legacy V1 state accepted for bounded, deterministic migration. */
export interface MarkupWindowSnapshotV1 {
  version: typeof MARKUP_WINDOW_SNAPSHOT_V1_VERSION;
  compactMode: MarkupWindowCompactMode;
  windowIds: string[];
  minimizedWindowIds: string[];
  closedWindowIds: string[];
  maximizedWindowId?: string;
  modals: MarkupModalSnapshot[];
  workspace: TiledWorkspaceSnapshot;
}

/** Versioned declarative-window state composed with the existing tiled-workspace snapshot. */
export interface MarkupWindowSnapshot {
  version: typeof MARKUP_WINDOW_SNAPSHOT_VERSION;
  compactMode: MarkupWindowCompactMode;
  windowIds: string[];
  minimizedWindowIds: string[];
  closedWindowIds: string[];
  maximizedWindowId?: string;
  activeWindowId?: string;
  focusOrderWindowIds: string[];
  placements: MarkupWindowPlacementSnapshot[];
  modals: MarkupModalSnapshot[];
  workspace: TiledWorkspaceSnapshot;
}

/** Pure strict snapshot-validation result used by persistence adapters before mutating a live controller. */
export type NormalizeMarkupWindowSnapshotResult =
  | { ok: true; snapshot: MarkupWindowSnapshot }
  | { ok: false; status: "invalid" | "unsupported"; reason: string };

interface WindowDeclaration {
  id: string;
  title?: string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  declaredVisible: boolean;
  declaredState?: MarkupWindowState;
  stateToken?: string;
  declaredPlacement: MarkupWindowPlacement;
  placementToken?: string;
  declaredFloatingRect?: Rectangle;
  geometryToken?: string;
  declaredAlwaysOnTop: boolean;
  alwaysOnTopToken?: string;
  declaredGroupId?: string;
  groupToken?: string;
}

interface ModalDeclaration {
  id: string;
  title?: string;
  ownerId?: string;
  declaredVisible: boolean;
  defaultOpen: boolean;
  openToken?: string;
  closeOnOutsideClick: boolean;
  rect?: Rectangle;
  zIndex: number;
}

interface ManagedModalSignature {
  registrationGeneration: number;
  rect: Rectangle;
  layer: OverlaySurfaceInspection["layer"];
  kind: OverlaySurfaceInspection["kind"];
  modal: boolean;
  closeOnOutsideClick: boolean;
  ownerId?: string;
}

interface MarkupWindowDiscovery {
  windows: WindowDeclaration[];
  modals: ModalDeclaration[];
  diagnostics: MarkupWindowDiagnostic[];
}

interface MarkupWindowRollbackState {
  windows: Map<string, WindowDeclaration>;
  modals: Map<string, ModalDeclaration>;
  managedWindowIds: Set<string>;
  managedWindowGenerations: Map<string, number>;
  managedModalIds: Set<string>;
  managedModalSignatures: Map<string, ManagedModalSignature>;
  minimizedWindowIds: Set<string>;
  closedWindowIds: Set<string>;
  modalRequestedOpen: Map<string, boolean>;
  placements: Map<string, MarkupWindowPlacement>;
  floatingRects: Map<string, Rectangle>;
  restoreRects: Map<string, Rectangle>;
  snapTargets: Map<string, MarkupWindowSnapTarget>;
  alwaysOnTopWindowIds: Set<string>;
  windowGroups: Map<string, string>;
  focusOrderWindowIds: string[];
  activeWindowId?: string;
  maximizedWindowId?: string;
  compactMode: MarkupWindowCompactMode;
  diagnostics: MarkupWindowDiagnostic[];
  workspace: TiledWorkspaceSnapshot;
  overlays: ReturnType<OverlayStackController["snapshot"]>;
}

const ZERO_RECT: Rectangle = { column: 0, row: 0, width: 0, height: 0 };
const MAX_WINDOW_CELL = 1_000_000;
const MAX_WINDOW_ID_LENGTH = 256;
const MAX_WINDOW_GROUP_ID_LENGTH = 128;
const MAX_WINDOW_SURFACES = 1_024;
const MAX_WINDOW_LAYOUT_NODES = 4_096;
const MAX_WINDOW_LAYOUT_DEPTH = 64;

interface NormalizedRecoveryOptions {
  margin: number;
  titleBarHeight: number;
}

const DEFAULT_RECOVERY_OPTIONS: NormalizedRecoveryOptions = { margin: 0, titleBarHeight: 1 };

/**
 * Connects declarative `<window>` and `<modal>` nodes to existing imperative controllers.
 *
 * Tiled-tree geometry remains in `TiledWorkspaceController`, while modal
 * placement and z-order remain in `OverlayStackController`. This integration
 * owns declarative identity and visibility plus floating placement, detached
 * rectangles, snap/restore metadata, groups, and floating focus order. Injected
 * controllers are never disposed by this class.
 */
export class MarkupWindowController {
  readonly workspace: TiledWorkspaceController;
  readonly overlays: OverlayStackController;

  #windows = new Map<string, WindowDeclaration>();
  #modals = new Map<string, ModalDeclaration>();
  #managedWindowIds = new Set<string>();
  #managedWindowGenerations = new Map<string, number>();
  #managedModalIds = new Set<string>();
  #managedModalSignatures = new Map<string, ManagedModalSignature>();
  #minimizedWindowIds = new Set<string>();
  #closedWindowIds = new Set<string>();
  #modalRequestedOpen = new Map<string, boolean>();
  #placements = new Map<string, MarkupWindowPlacement>();
  #floatingRects = new Map<string, Rectangle>();
  #restoreRects = new Map<string, Rectangle>();
  #snapTargets = new Map<string, MarkupWindowSnapTarget>();
  #alwaysOnTopWindowIds = new Set<string>();
  #windowGroups = new Map<string, string>();
  #focusOrderWindowIds: string[] = [];
  #activeWindowId?: string;
  #maximizedWindowId?: string;
  #compactMode: MarkupWindowCompactMode;
  #diagnostics: MarkupWindowDiagnostic[] = [];
  #mutationInProgress = false;
  #disposed = false;

  constructor(options: MarkupWindowControllerOptions) {
    this.workspace = options.workspace;
    this.overlays = options.overlays;
    this.#compactMode = normalizeCompactMode(options.compactMode);
    this.reconcile(options.root, { layout: options.layout });
  }

  /** Cheap lifecycle probe for hosts that must avoid full inspection on hot paths. */
  get disposed(): boolean {
    return this.#disposed;
  }

  /** True only while a transactional reconcile or snapshot restore is publishing shared state. */
  get mutationInProgress(): boolean {
    return this.#mutationInProgress;
  }

  /** Re-discovers markup surfaces while preserving surviving controller state and geometry. */
  reconcile(root: LayoutNode, options: ReconcileMarkupWindowsOptions = {}): MarkupWindowControllerInspection {
    this.#assertActive("reconcile");
    const rollback = this.#captureRollbackState();
    this.#mutationInProgress = true;
    try {
      try {
        return this.#reconcileUnsafe(root, options);
      } catch (error) {
        try {
          this.#forceRollback(rollback);
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], "Window reconciliation and rollback publication failed.");
        }
        throw error;
      }
    } finally {
      this.#mutationInProgress = false;
    }
  }

  #reconcileUnsafe(
    root: LayoutNode,
    options: ReconcileMarkupWindowsOptions,
  ): MarkupWindowControllerInspection {
    this.#auditManagedWindowOwnership();
    this.#captureModalControllerState();
    const discovery = discoverMarkupWindows(root, options.layout);
    const previousWindows = this.#windows;
    const previousModals = this.#modals;
    const previousManagedWindowIds = this.#managedWindowIds;
    const previousManagedModalIds = this.#managedModalIds;
    const diagnostics = discovery.diagnostics.slice();
    const externalWorkspaceIds = new Set(
      this.workspace.inspect().windows
        .filter((entry) => !previousManagedWindowIds.has(entry.id))
        .map((entry) => entry.id),
    );

    const nextWindows = new Map<string, WindowDeclaration>();
    for (const declaration of discovery.windows) {
      if (externalWorkspaceIds.has(declaration.id)) {
        diagnostics.push({
          code: "workspace-id-conflict",
          severity: "error",
          id: declaration.id,
          message: `Workspace window id "${declaration.id}" is already owned outside the declarative integration.`,
        });
        continue;
      }
      const previous = previousWindows.get(declaration.id);
      nextWindows.set(declaration.id, declaration);
      if (!previous) {
        this.#applyDeclaredWindowState(declaration, diagnostics);
        this.#applyDeclaredWindowPlacement(declaration);
      } else if (declaration.stateToken !== undefined && declaration.stateToken !== previous.stateToken) {
        this.#applyDeclaredWindowState(declaration, diagnostics);
      }
      if (previous) {
        if (declaration.placementToken !== undefined && declaration.placementToken !== previous.placementToken) {
          this.#placements.set(declaration.id, declaration.declaredPlacement);
        }
        if (declaration.geometryToken !== undefined && declaration.geometryToken !== previous.geometryToken) {
          this.#setStoredFloatingRect(
            declaration.id,
            declaration.declaredFloatingRect ?? defaultFloatingRect(declaration),
          );
        }
        if (
          declaration.alwaysOnTopToken !== undefined &&
          declaration.alwaysOnTopToken !== previous.alwaysOnTopToken
        ) {
          this.#setStoredAlwaysOnTop(declaration.id, declaration.declaredAlwaysOnTop);
        }
        if (declaration.groupToken !== undefined && declaration.groupToken !== previous.groupToken) {
          this.#setStoredGroup(declaration.id, declaration.declaredGroupId);
        }
      }
    }
    this.#windows = nextWindows;
    this.#retainCurrentWindowState();
    this.#retainCurrentWindowPlacement();

    const nextModals = new Map<string, ModalDeclaration>();
    for (const discovered of discovery.modals) {
      const previous = previousModals.get(discovered.id);
      const declaration = discovered.rect || !previous?.rect
        ? discovered
        : { ...discovered, rect: cloneRect(previous.rect) };
      nextModals.set(declaration.id, declaration);
      if (!previous) {
        this.#modalRequestedOpen.set(declaration.id, declaration.defaultOpen);
      } else if (declaration.openToken !== undefined && declaration.openToken !== previous.openToken) {
        this.#modalRequestedOpen.set(declaration.id, declaration.defaultOpen);
      }
    }
    this.#modals = nextModals;
    this.#retainCurrentModalState();

    this.#syncWorkspace(previousManagedWindowIds);
    this.#syncModals(previousManagedModalIds, diagnostics);
    this.#repairFocus();
    this.#diagnostics = diagnostics;
    return this.inspect();
  }

  /** Focuses one visible tiled/floating window or raises one visible declarative modal. */
  focus(id: string): MarkupWindowActionResult {
    const unavailable = this.#unavailable("focus", id);
    if (unavailable) return unavailable;
    if (this.#windows.has(id)) {
      if (!this.#isWindowEligible(id)) return actionResult("focus", "blocked", id, undefined, "window-not-visible");
      if (this.#maximizedWindowId && this.#maximizedWindowId !== id) {
        return actionResult("focus", "blocked", id, undefined, "window-hidden-by-maximized-window");
      }
      const wasActive = this.#activeWindowId === id;
      const wasFront = this.#isFrontOfFocusTier(id);
      if (this.#windowPlacement(id) === "tiled" && !this.workspace.focus(id)) {
        return actionResult("focus", "not-found", id);
      }
      this.#activateWindow(id);
      return actionResult("focus", wasActive && wasFront ? "unchanged" : "applied", id);
    }
    const modal = this.#modals.get(id);
    if (!modal) return actionResult("focus", "not-found", id);
    this.#auditManagedModalOwnership();
    const surface = this.#managedModalIds.has(id) ? this.overlays.surface(id) : undefined;
    if (!surface?.visible) return actionResult("focus", "blocked", id, undefined, "modal-not-visible");
    this.overlays.bringToFront(id);
    return actionResult("focus", "applied", id);
  }

  /** Moves one visible tiled window through the shared workspace traversal order. */
  move(id: string, delta: number): MarkupWindowActionResult {
    const unavailable = this.#availableWindowAction("move", id);
    if (unavailable) return unavailable;
    if (!Number.isFinite(delta) || Math.trunc(delta) === 0) {
      return actionResult("move", "invalid", id, undefined, "delta-must-be-a-non-zero-finite-number");
    }
    if (!this.workspace.move(id, delta)) return actionResult("move", "unchanged", id);
    this.#activateWindow(id);
    return actionResult("move", "applied", id);
  }

  /** Switches a visible window between its latent tiled pane and durable floating placement. */
  setPlacement(
    id: string,
    placement: MarkupWindowPlacement,
    options: SetMarkupWindowPlacementOptions = {},
  ): MarkupWindowActionResult {
    const unavailable = this.#availableWindowAction("set-placement", id);
    if (unavailable) return unavailable;
    if (placement !== "tiled" && placement !== "floating") {
      return actionResult("set-placement", "invalid", id, undefined, "placement-is-invalid");
    }
    const declaration = this.#windows.get(id)!;
    let rect: Rectangle | undefined;
    if (options.rect !== undefined) {
      rect = normalizeFloatingRectInput(options.rect, declaration);
      if (!rect) return actionResult("set-placement", "invalid", id, undefined, "floating-rect-is-invalid");
    }
    const current = this.#windowPlacement(id);
    const currentRect = this.#floatingRects.get(id);
    if (current === placement && (!rect || rectanglesEqual(currentRect, rect))) {
      return actionResult("set-placement", "unchanged", id);
    }
    if (rect) this.#setStoredFloatingRect(id, rect);
    else if (placement === "floating" && !currentRect) {
      this.#setStoredFloatingRect(id, defaultFloatingRect(declaration));
    }
    this.#placements.set(id, placement);
    this.#snapTargets.delete(id);
    this.#activateWindow(id);
    this.#refreshModalVisibility();
    return actionResult("set-placement", "applied", id);
  }

  /** Replaces one floating window's durable rectangle without viewport-dependent recovery. */
  setFloatingRect(id: string, rect: Rectangle): MarkupWindowActionResult {
    const unavailable = this.#availableFloatingWindowAction("set-floating-rect", id);
    if (unavailable) return unavailable;
    const next = normalizeFloatingRectInput(rect, this.#windows.get(id)!);
    if (!next) return actionResult("set-floating-rect", "invalid", id, undefined, "floating-rect-is-invalid");
    if (rectanglesEqual(this.#floatingRects.get(id), next) && !this.#snapTargets.has(id)) {
      return actionResult("set-floating-rect", "unchanged", id);
    }
    this.#setStoredFloatingRect(id, next);
    this.#snapTargets.delete(id);
    return actionResult("set-floating-rect", "applied", id);
  }

  /** Moves one floating window, and every floating member of its optional group, atomically. */
  moveBy(id: string, delta: MarkupWindowMoveDelta): MarkupWindowActionResult {
    const unavailable = this.#availableFloatingWindowAction("move-by", id);
    if (unavailable) return unavailable;
    const normalizedDelta = normalizeMoveDelta(delta);
    if (!normalizedDelta) {
      return actionResult("move-by", "invalid", id, undefined, "delta-must-use-non-zero-safe-cell-integers");
    }
    const groupId = this.#windowGroups.get(id);
    const targets = groupId
      ? [...this.#windows.keys()].filter((candidate) =>
        this.#windowGroups.get(candidate) === groupId && this.#windowPlacement(candidate) === "floating"
      )
      : [id];
    const updates = new Map<string, Rectangle>();
    for (const targetId of targets) {
      const current = this.#floatingRect(targetId);
      const next = translatedFloatingRect(current, normalizedDelta);
      if (!next) return actionResult("move-by", "invalid", id, undefined, "floating-rect-exceeds-cell-bounds");
      updates.set(targetId, next);
    }
    for (const [targetId, next] of updates) {
      this.#setStoredFloatingRect(targetId, next);
      this.#snapTargets.delete(targetId);
    }
    return actionResult("move-by", "applied", id);
  }

  /** Resizes one floating window by moving a named border or corner in terminal cells. */
  resizeWindow(
    id: string,
    edge: MarkupWindowResizeEdge,
    delta: MarkupWindowMoveDelta,
  ): MarkupWindowActionResult {
    const unavailable = this.#availableFloatingWindowAction("resize-window", id);
    if (unavailable) return unavailable;
    if (!isMarkupWindowResizeEdge(edge)) {
      return actionResult("resize-window", "invalid", id, undefined, "resize-edge-is-invalid");
    }
    const normalizedDelta = normalizeMoveDelta(delta);
    if (!normalizedDelta) {
      return actionResult("resize-window", "invalid", id, undefined, "delta-must-use-non-zero-safe-cell-integers");
    }
    const current = this.#floatingRect(id);
    const next = resizedFloatingRect(current, edge, normalizedDelta, this.#windows.get(id)!);
    if (!next) return actionResult("resize-window", "invalid", id, undefined, "floating-rect-exceeds-cell-bounds");
    if (rectanglesEqual(current, next) && !this.#snapTargets.has(id)) {
      return actionResult("resize-window", "unchanged", id);
    }
    this.#setStoredFloatingRect(id, next);
    this.#snapTargets.delete(id);
    return actionResult("resize-window", "applied", id);
  }

  /** Snaps a visible window to workspace geometry or commits it into the latent tiled tree. */
  snap(id: string, target: MarkupWindowSnapTarget, bounds: Rectangle): MarkupWindowActionResult {
    const unavailable = this.#availableWindowAction("snap", id);
    if (unavailable) return unavailable;
    const normalizedTarget = normalizeSnapTarget(target);
    if (!normalizedTarget) return actionResult("snap", "invalid", id, undefined, "snap-target-is-invalid");
    const normalizedBounds = normalizeWindowBounds(bounds);
    if (!normalizedBounds || normalizedBounds.width === 0 || normalizedBounds.height === 0) {
      return actionResult("snap", "invalid", id, undefined, "bounds-must-be-a-non-empty-finite-cell-rectangle");
    }
    if (normalizedTarget.kind === "dock") {
      if (!this.#windows.has(normalizedTarget.targetId)) {
        return actionResult("snap", "not-found", id, normalizedTarget.targetId);
      }
      if (
        !this.#isWindowEligible(normalizedTarget.targetId) ||
        this.#windowPlacement(normalizedTarget.targetId) !== "tiled"
      ) {
        return actionResult("snap", "blocked", id, normalizedTarget.targetId, "target-window-not-tiled-and-visible");
      }
      if (id === normalizedTarget.targetId) {
        return actionResult("snap", "unchanged", id, normalizedTarget.targetId);
      }
      const changed = this.workspace.dock(id, normalizedTarget.targetId, normalizedTarget.edge, {
        ratio: normalizedTarget.ratio,
      });
      if (!changed) return actionResult("snap", "unchanged", id, normalizedTarget.targetId);
      this.#placements.set(id, "tiled");
      this.#snapTargets.set(id, cloneSnapTarget(normalizedTarget));
      this.#activateWindow(id);
      this.#refreshModalVisibility();
      return actionResult("snap", "applied", id, normalizedTarget.targetId);
    }
    const declaration = this.#windows.get(id)!;
    const current = this.#floatingRect(id);
    const snapped = constrainedSnapRect(normalizedTarget, normalizedBounds, declaration);
    if (!snapped) {
      return actionResult("snap", "invalid", id, undefined, "snap-geometry-exceeds-cell-bounds");
    }
    if (!this.#snapTargets.has(id)) this.#restoreRects.set(id, cloneRect(current));
    this.#floatingRects.set(id, snapped);
    this.#placements.set(id, "floating");
    this.#snapTargets.set(id, cloneSnapTarget(normalizedTarget));
    this.#activateWindow(id);
    this.#refreshModalVisibility();
    return actionResult("snap", "applied", id);
  }

  /** Moves one window between the normal and always-on-top floating focus tiers. */
  setAlwaysOnTop(id: string, value: boolean): MarkupWindowActionResult {
    const unavailable = this.#availableWindowAction("set-always-on-top", id);
    if (unavailable) return unavailable;
    if (typeof value !== "boolean") {
      return actionResult("set-always-on-top", "invalid", id, undefined, "always-on-top-must-be-boolean");
    }
    if (this.#alwaysOnTopWindowIds.has(id) === value) {
      return actionResult("set-always-on-top", "unchanged", id);
    }
    this.#setStoredAlwaysOnTop(id, value);
    if (!this.#activateWindow(id) && this.#activeWindowId) this.#raiseWindow(this.#activeWindowId);
    return actionResult("set-always-on-top", "applied", id);
  }

  /** Assigns or clears a bounded group used by atomic floating movement. */
  setGroup(id: string, groupId?: string): MarkupWindowActionResult {
    const unavailable = this.#unavailable("set-group", id);
    if (unavailable) return unavailable;
    if (!this.#windows.has(id)) return actionResult("set-group", "not-found", id);
    const normalized = normalizeGroupId(groupId);
    if (groupId !== undefined && normalized === undefined && groupId.trim() !== "") {
      return actionResult("set-group", "invalid", id, undefined, "group-id-is-invalid-or-too-long");
    }
    if (this.#windowGroups.get(id) === normalized) return actionResult("set-group", "unchanged", id);
    this.#setStoredGroup(id, normalized);
    return actionResult("set-group", "applied", id);
  }

  /** Persists a recovered floating rectangle whose title region is reachable in current bounds. */
  recoverBounds(
    id: string,
    bounds: Rectangle,
    options: RecoverMarkupWindowBoundsOptions = {},
  ): MarkupWindowActionResult {
    const unavailable = this.#availableFloatingWindowAction("recover-bounds", id);
    if (unavailable) return unavailable;
    const normalizedBounds = normalizeWindowBounds(bounds);
    const normalizedOptions = normalizeRecoveryOptions(options);
    if (!normalizedBounds || !normalizedOptions) {
      return actionResult("recover-bounds", "invalid", id, undefined, "bounds-or-recovery-options-are-invalid");
    }
    const current = this.#floatingRect(id);
    const recovered = recoverFloatingRect(current, normalizedBounds, normalizedOptions);
    if (!recovered) {
      return actionResult("recover-bounds", "invalid", id, undefined, "recovered-geometry-exceeds-cell-bounds");
    }
    if (rectanglesEqual(current, recovered) && !this.#snapTargets.has(id)) {
      return actionResult("recover-bounds", "unchanged", id);
    }
    this.#setStoredFloatingRect(id, recovered);
    this.#snapTargets.delete(id);
    return actionResult("recover-bounds", "applied", id);
  }

  /** Swaps two visible declarative windows without changing shared split geometry. */
  swap(firstId: string, secondId: string): MarkupWindowActionResult {
    const unavailable = this.#availableWindowAction("swap", firstId, secondId);
    if (unavailable) return unavailable;
    if (!this.#windows.has(secondId)) return actionResult("swap", "not-found", firstId, secondId);
    if (!this.#isWindowEligible(secondId)) {
      return actionResult("swap", "blocked", firstId, secondId, "target-window-not-visible");
    }
    if (firstId === secondId) return actionResult("swap", "unchanged", firstId, secondId);
    if (!this.workspace.swap(firstId, secondId)) {
      return actionResult("swap", "unchanged", firstId, secondId);
    }
    this.#activateWindow(firstId);
    return actionResult("swap", "applied", firstId, secondId);
  }

  /** Docks one visible declarative window around another in the shared tiled tree. */
  dock(
    sourceId: string,
    targetId: string,
    edge: TiledWorkspaceDockEdge,
    options: { ratio?: number } = {},
  ): MarkupWindowActionResult {
    const unavailable = this.#availableWindowAction("dock", sourceId, targetId);
    if (unavailable) return unavailable;
    if (!isTiledWorkspaceDockEdge(edge)) {
      return actionResult("dock", "invalid", sourceId, targetId, "dock-edge-is-invalid");
    }
    if (!this.#windows.has(targetId)) return actionResult("dock", "not-found", sourceId, targetId);
    if (!this.#isWindowEligible(targetId) || this.#windowPlacement(targetId) !== "tiled") {
      return actionResult("dock", "blocked", sourceId, targetId, "target-window-not-visible");
    }
    if (sourceId === targetId) return actionResult("dock", "unchanged", sourceId, targetId);
    let ratio: number | undefined;
    try {
      const rawRatio = options.ratio;
      if (rawRatio !== undefined) {
        if (typeof rawRatio !== "number" || !Number.isFinite(rawRatio)) {
          return actionResult("dock", "invalid", sourceId, targetId, "dock-ratio-must-be-finite");
        }
        ratio = Math.max(0.05, Math.min(0.95, rawRatio));
      }
    } catch {
      return actionResult("dock", "invalid", sourceId, targetId, "dock-options-are-invalid");
    }
    if (!this.workspace.dock(sourceId, targetId, edge, { ratio })) {
      return actionResult("dock", "unchanged", sourceId, targetId);
    }
    this.#placements.set(sourceId, "tiled");
    this.#snapTargets.set(
      sourceId,
      ratio === undefined ? { kind: "dock", targetId, edge } : { kind: "dock", targetId, edge, ratio },
    );
    this.#activateWindow(sourceId);
    return actionResult("dock", "applied", sourceId, targetId);
  }

  /** Resizes one visible separator by terminal cells through the shared tiled controller. */
  resize(
    splitId: string,
    delta: number,
    bounds: Rectangle,
    options: ProjectMarkupWindowsOptions = {},
  ): MarkupWindowActionResult {
    const unavailable = this.#unavailable("resize", splitId);
    if (unavailable) return unavailable;
    if (!Number.isFinite(delta) || Math.trunc(delta) === 0) {
      return actionResult("resize", "invalid", splitId, undefined, "delta-must-be-a-non-zero-finite-number");
    }
    const projection = this.project(bounds, options);
    if (!projection.workspace.separators.some((separator) => separator.splitId === splitId)) {
      return actionResult("resize", "blocked", splitId, undefined, "split-not-visible");
    }
    const changed = this.workspace.resizeSplit(splitId, delta, bounds, {
      gap: options.gap,
      separatorHitSize: options.separatorHitSize,
      visibleWindowIds: projection.visibleWindowIds,
    });
    return changed ? actionResult("resize", "applied", splitId) : actionResult("resize", "unchanged", splitId);
  }

  /** Adds a normalized ratio delta to one split in the shared tiled controller. */
  resizeRatio(splitId: string, delta: number): MarkupWindowActionResult {
    const unavailable = this.#unavailable("resize-ratio", splitId);
    if (unavailable) return unavailable;
    if (!Number.isFinite(delta) || delta === 0) {
      return actionResult(
        "resize-ratio",
        "invalid",
        splitId,
        undefined,
        "delta-must-be-a-non-zero-finite-number",
      );
    }
    if (!this.#workspaceSplitIsDeclarativelyOwned(splitId)) {
      return actionResult("resize-ratio", "blocked", splitId, undefined, "split-is-not-declaratively-owned");
    }
    return this.workspace.resizeSplitRatio(splitId, delta)
      ? actionResult("resize-ratio", "applied", splitId)
      : actionResult("resize-ratio", "unchanged", splitId);
  }

  /** Hides one declarative window without removing its pane from the durable tiled tree. */
  minimize(id: string): MarkupWindowActionResult {
    const unavailable = this.#unavailable("minimize", id);
    if (unavailable) return unavailable;
    if (!this.#windows.has(id)) return actionResult("minimize", "not-found", id);
    if (this.#closedWindowIds.has(id)) {
      return actionResult("minimize", "blocked", id, undefined, "window-closed");
    }
    if (this.#minimizedWindowIds.has(id)) return actionResult("minimize", "unchanged", id);
    this.#minimizedWindowIds.add(id);
    if (this.#maximizedWindowId === id) this.#maximizedWindowId = undefined;
    if (this.#activeWindowId === id) this.#activeWindowId = undefined;
    this.#repairFocus();
    this.#refreshModalVisibility();
    return actionResult("minimize", "applied", id);
  }

  /**
   * Projects one window alone into the existing workspace bounds.
   *
   * The tiled tree is not mutated, so restoring is exact and does not require a second
   * floating/fullscreen geometry store.
   */
  maximize(id: string): MarkupWindowActionResult {
    const unavailable = this.#availableWindowAction("maximize", id);
    if (unavailable) return unavailable;
    if (this.#maximizedWindowId === id) return actionResult("maximize", "unchanged", id);
    this.#maximizedWindowId = id;
    this.#activeWindowId = id;
    this.#raiseWindow(id);
    if (this.#windowPlacement(id) === "tiled") this.workspace.focus(id);
    this.#refreshModalVisibility();
    return actionResult("maximize", "applied", id);
  }

  /** Restores a minimized, closed, maximized, or closed-modal declarative surface. */
  restore(id: string): MarkupWindowActionResult {
    const unavailable = this.#unavailable("restore", id);
    if (unavailable) return unavailable;
    const declaration = this.#windows.get(id);
    if (declaration) {
      if (!declaration.declaredVisible) {
        return actionResult("restore", "blocked", id, undefined, "window-hidden-by-declaration");
      }
      const wasClosed = this.#closedWindowIds.delete(id);
      const wasMinimized = this.#minimizedWindowIds.delete(id);
      const wasMaximized = this.#maximizedWindowId === id;
      if (wasMaximized) this.#maximizedWindowId = undefined;
      if (!wasClosed && !wasMinimized && !wasMaximized) return actionResult("restore", "unchanged", id);
      this.#activateWindow(id);
      this.#refreshModalVisibility();
      return actionResult("restore", "applied", id);
    }

    const modal = this.#modals.get(id);
    if (!modal) return actionResult("restore", "not-found", id);
    if (!modal.declaredVisible) {
      return actionResult("restore", "blocked", id, undefined, "modal-hidden-by-declaration");
    }
    if (!modal.rect) {
      return actionResult("restore", "unsupported", id, undefined, "modal-layout-geometry-unavailable");
    }
    this.#auditManagedModalOwnership();
    if (!this.#managedModalIds.has(id)) {
      return actionResult("restore", "blocked", id, undefined, "modal-overlay-id-conflict");
    }
    const surface = this.overlays.surface(id);
    if (surface?.visible) {
      this.#modalRequestedOpen.set(id, true);
      return actionResult("restore", "unchanged", id);
    }
    this.#modalRequestedOpen.set(id, true);
    this.overlays.open(id);
    return actionResult("restore", "applied", id);
  }

  /** Closes a tiled window or modal. Closed tiled panes can later be restored by id. */
  close(id: string): MarkupWindowActionResult {
    const unavailable = this.#unavailable("close", id);
    if (unavailable) return unavailable;
    if (this.#windows.has(id)) {
      if (this.#closedWindowIds.has(id)) return actionResult("close", "unchanged", id);
      this.#closedWindowIds.add(id);
      this.#minimizedWindowIds.delete(id);
      if (this.#maximizedWindowId === id) this.#maximizedWindowId = undefined;
      if (this.#activeWindowId === id) this.#activeWindowId = undefined;
      this.#repairFocus();
      this.#refreshModalVisibility();
      return actionResult("close", "applied", id);
    }
    if (!this.#modals.has(id)) return actionResult("close", "not-found", id);
    this.#auditManagedModalOwnership();
    if (!this.#managedModalIds.has(id)) {
      return actionResult("close", "blocked", id, undefined, "modal-overlay-id-conflict");
    }
    const surface = this.overlays.surface(id);
    this.#modalRequestedOpen.set(id, false);
    if (!surface?.visible) return actionResult("close", "unchanged", id);
    this.overlays.close(id);
    return actionResult("close", "applied", id);
  }

  /** Projects only eligible panes; compact mode selects the active pane when minimums do not fit. */
  project(bounds: Rectangle, options: ProjectMarkupWindowsOptions = {}): MarkupWindowProjection {
    this.#assertActive("project");
    this.#auditManagedWindowOwnership();
    this.#auditManagedModalOwnership();
    const projectedBounds = normalizeWindowBounds(bounds) ?? cloneRect(ZERO_RECT);
    const compactMode = normalizeCompactMode(options.compactMode ?? this.#compactMode);
    const eligibleWindowIds = this.#eligibleWorkspaceWindowIds();
    const requestedVisibleWindowIds = projectedVisibleWindowIds(options.visibleWindowIds, eligibleWindowIds);
    const maximizedPlacement = this.#maximizedWindowId ? this.#windowPlacement(this.#maximizedWindowId) : undefined;
    let visibleWindowIds = this.#maximizedWindowId
      ? maximizedPlacement === "tiled" && eligibleWindowIds.includes(this.#maximizedWindowId)
        ? [this.#maximizedWindowId]
        : []
      : requestedVisibleWindowIds;
    let workspace = this.workspace.layout(projectedBounds, {
      gap: options.gap,
      separatorHitSize: options.separatorHitSize,
      visibleWindowIds,
    });
    const shouldCompact = !this.#maximizedWindowId && visibleWindowIds.length > 1 &&
      (compactMode === "always" || (compactMode === "auto" && !workspace.fitsMinimumSize));
    let compactWindowId: string | undefined;
    if (shouldCompact) {
      compactWindowId = workspace.activeWindowId && visibleWindowIds.includes(workspace.activeWindowId)
        ? workspace.activeWindowId
        : visibleWindowIds[0];
      visibleWindowIds = compactWindowId ? [compactWindowId] : [];
      workspace = this.workspace.layout(projectedBounds, {
        gap: options.gap,
        separatorHitSize: options.separatorHitSize,
        visibleWindowIds,
      });
    }

    const floatingWindows: MarkupFloatingWindowProjection[] = [];
    for (const declaration of this.#windows.values()) {
      if (this.#windowPlacement(declaration.id) !== "floating") continue;
      const state = this.#windowState(declaration.id);
      const eligible = this.#isWindowEligible(declaration.id);
      const visible = eligible && (!this.#maximizedWindowId || this.#maximizedWindowId === declaration.id);
      const durableRect = this.#floatingRect(declaration.id);
      const target = this.#snapTargets.get(declaration.id);
      const requestedRect = visible && this.#maximizedWindowId === declaration.id
        ? cloneRect(projectedBounds)
        : target && target.kind !== "dock"
        ? constrainedSnapRect(target, projectedBounds, declaration) ?? durableRect
        : durableRect;
      const rect = visible && this.#maximizedWindowId === declaration.id
        ? cloneRect(projectedBounds)
        : recoverFloatingRect(requestedRect, projectedBounds, DEFAULT_RECOVERY_OPTIONS) ?? cloneRect(requestedRect);
      const focusOrder = this.#focusOrderWindowIds.indexOf(declaration.id);
      floatingWindows.push({
        id: declaration.id,
        rect,
        floatingRect: cloneRect(durableRect),
        restoreRect: cloneOptionalRect(this.#restoreRects.get(declaration.id)),
        snapTarget: target ? cloneSnapTarget(target) : undefined,
        state,
        active: this.#activeWindowId === declaration.id,
        visible,
        alwaysOnTop: this.#alwaysOnTopWindowIds.has(declaration.id),
        groupId: this.#windowGroups.get(declaration.id),
        focusOrder,
        zIndex: 0,
        constraintsSatisfied: floatingRectSatisfiesConstraints(rect, declaration),
      });
    }
    const floatingZOrder = floatingWindows.filter((entry) => entry.visible).sort(compareFloatingWindowZOrder);
    for (let index = 0; index < floatingZOrder.length; index += 1) {
      const entry = floatingZOrder[index]!;
      entry.zIndex = (entry.alwaysOnTop ? 2_000 : 1_000) + index;
    }

    const visibleSet = new Set([...visibleWindowIds, ...floatingZOrder.map((entry) => entry.id)]);
    const hiddenWindowIds: string[] = [];
    for (const id of this.#allKnownWindowIds()) {
      if (!visibleSet.has(id)) hiddenWindowIds.push(id);
    }
    const modalIds = this.#managedModalIds;
    // Compact mode is a tiled rendering policy, not modal lifecycle. Keep an
    // eligible owner's open modal in the projection so the visible overlay and
    // the shared stack's global modal blocker cannot disagree.
    const modals = this.overlays.zOrder().filter((surface) => modalIds.has(surface.id)).map(cloneOverlaySurface);
    return {
      compact: shouldCompact,
      compactMode,
      compactWindowId,
      maximizedWindowId: this.#maximizedWindowId,
      eligibleWindowIds,
      visibleWindowIds: visibleWindowIds.slice(),
      hiddenWindowIds,
      workspace,
      floatingWindows,
      floatingZOrder,
      modals,
      topModalId: this.overlays.topModal()?.id,
    };
  }

  /** Returns clone-safe controller state without exposing declaration nodes or controller signals. */
  inspect(): MarkupWindowControllerInspection {
    this.#auditManagedWindowOwnership();
    this.#captureModalControllerState();
    const workspace = this.workspace.inspect();
    const activeWindowId = this.#activeWindowId && this.#isWindowEligible(this.#activeWindowId)
      ? this.#activeWindowId
      : undefined;
    const windows: MarkupWindowInspection[] = [];
    for (const declaration of this.#windows.values()) {
      const state = this.#windowState(declaration.id);
      const placement = this.#windowPlacement(declaration.id);
      const window: MarkupWindowInspection = {
        id: declaration.id,
        title: declaration.title,
        minWidth: declaration.minWidth,
        minHeight: declaration.minHeight,
        declaredVisible: declaration.declaredVisible,
        state,
        placement,
        alwaysOnTop: this.#alwaysOnTopWindowIds.has(declaration.id),
        focusOrder: this.#focusOrderWindowIds.indexOf(declaration.id),
        active: activeWindowId === declaration.id,
        visible: this.#isWindowEligible(declaration.id) &&
          (!this.#maximizedWindowId || this.#maximizedWindowId === declaration.id),
      };
      if (declaration.maxWidth !== undefined) window.maxWidth = declaration.maxWidth;
      if (declaration.maxHeight !== undefined) window.maxHeight = declaration.maxHeight;
      if (placement === "floating") {
        window.floatingRect = this.#floatingRect(declaration.id);
        const restoreRect = this.#restoreRects.get(declaration.id);
        if (restoreRect) window.restoreRect = cloneRect(restoreRect);
      }
      const snapTarget = this.#snapTargets.get(declaration.id);
      if (snapTarget) window.snapTarget = cloneSnapTarget(snapTarget);
      const groupId = this.#windowGroups.get(declaration.id);
      if (groupId) window.groupId = groupId;
      windows.push(window);
    }
    const modals: MarkupModalInspection[] = [];
    for (const declaration of this.#modals.values()) {
      const surface = this.#managedModalIds.has(declaration.id) ? this.overlays.surface(declaration.id) : undefined;
      modals.push({
        id: declaration.id,
        title: declaration.title,
        ownerId: declaration.ownerId,
        declaredVisible: declaration.declaredVisible,
        requestedOpen: this.#modalRequestedOpen.get(declaration.id) ?? false,
        registered: this.#managedModalIds.has(declaration.id),
        visible: surface?.visible ?? false,
        closeOnOutsideClick: declaration.closeOnOutsideClick,
        rect: declaration.rect ? cloneRect(declaration.rect) : undefined,
        surface: surface ? cloneOverlaySurface(surface) : undefined,
      });
    }
    return {
      disposed: this.#disposed,
      compactMode: this.#compactMode,
      activeWindowId,
      maximizedWindowId: this.#maximizedWindowId,
      windows,
      modals,
      diagnostics: this.#diagnostics.map(cloneDiagnostic),
      workspace,
    };
  }

  /** Captures a versioned clone-safe snapshot around the existing tiled-workspace schema. */
  snapshot(): MarkupWindowSnapshot {
    this.#assertActive("snapshot");
    this.#auditManagedWindowOwnership();
    this.#captureModalControllerState();
    const windowIds = [...this.#windows.keys()];
    const workspace = this.workspace.snapshot();
    if (this.#activeWindowId && this.#windowPlacement(this.#activeWindowId) === "tiled") {
      const paneId = workspacePaneIdForWindow(workspace, this.#activeWindowId);
      if (paneId) workspace.layout.activePaneId = paneId;
    }
    const snapshot: MarkupWindowSnapshot = {
      version: MARKUP_WINDOW_SNAPSHOT_VERSION,
      compactMode: this.#compactMode,
      windowIds,
      minimizedWindowIds: windowIds.filter((id) => this.#minimizedWindowIds.has(id)),
      closedWindowIds: windowIds.filter((id) => this.#closedWindowIds.has(id)),
      maximizedWindowId: this.#maximizedWindowId,
      activeWindowId: this.#activeWindowId,
      focusOrderWindowIds: this.#focusOrderWindowIds.slice(),
      placements: windowIds.map((id) => ({
        id,
        placement: this.#windowPlacement(id),
        floatingRect: cloneOptionalRect(this.#floatingRects.get(id)),
        restoreRect: cloneOptionalRect(this.#restoreRects.get(id)),
        snapTarget: cloneOptionalSnapTarget(this.#snapTargets.get(id)),
        alwaysOnTop: this.#alwaysOnTopWindowIds.has(id),
        groupId: this.#windowGroups.get(id),
      })),
      modals: [...this.#modals.keys()].map((id) => ({
        id,
        open: this.#modalRequestedOpen.get(id) ?? false,
      })),
      workspace,
    };
    const normalized = normalizeMarkupWindowSnapshot(snapshot);
    if (!normalized.ok) {
      throw new RangeError(`Current declarative-window state is not snapshot-safe: ${normalized.reason}`);
    }
    return normalized.snapshot;
  }

  /** Safely restores supported state and reconciles it with the currently declared identities. */
  restoreSnapshot(snapshot: unknown): MarkupWindowActionResult {
    const unavailable = this.#unavailable("restore-snapshot");
    if (unavailable) return unavailable;
    this.#mutationInProgress = true;
    try {
      this.#auditManagedModalOwnership();
      const normalized = normalizeMarkupWindowSnapshot(snapshot);
      if (!normalized.ok) {
        return actionResult("restore-snapshot", normalized.status, undefined, undefined, normalized.reason);
      }
      const constraintViolation = this.#snapshotConstraintViolation(normalized.snapshot);
      if (constraintViolation) {
        return actionResult("restore-snapshot", "invalid", undefined, undefined, constraintViolation);
      }
      const rollback = this.#captureRollbackState();
      try {
        this.#applyNormalizedSnapshot(normalized.snapshot);
        return actionResult("restore-snapshot", "applied");
      } catch {
        try {
          this.#forceRollback(rollback);
        } catch {
          return actionResult(
            "restore-snapshot",
            "invalid",
            undefined,
            undefined,
            "snapshot-restore-and-rollback-failed",
          );
        }
        return actionResult("restore-snapshot", "invalid", undefined, undefined, "snapshot-restore-failed");
      }
    } finally {
      this.#mutationInProgress = false;
    }
  }

  /** Removes only workspace and overlay surfaces registered by this integration; injected controllers stay alive. */
  dispose(): void {
    if (this.#mutationInProgress) throw new Error("MarkupWindowController cannot dispose during a state mutation.");
    this.#auditManagedWindowOwnership();
    this.#auditManagedModalOwnership();
    if (this.#disposed && this.#managedWindowIds.size === 0 && this.#managedModalIds.size === 0) return;
    this.#disposed = true;
    let cleanupError: unknown;
    if (this.#managedWindowIds.size > 0) {
      const externalWindows = this.workspace.inspect().windows.filter((entry) => !this.#managedWindowIds.has(entry.id));
      try {
        this.workspace.reconcile(externalWindows);
      } catch (error) {
        cleanupError = error;
      } finally {
        this.#managedWindowIds.clear();
      }
    }
    for (const id of [...this.#managedModalIds]) {
      try {
        this.overlays.remove(id, { synchronizeFocus: true });
      } catch (error) {
        cleanupError ??= error;
      } finally {
        this.#managedModalIds.delete(id);
        this.#managedModalSignatures.delete(id);
      }
    }
    if (cleanupError !== undefined) throw cleanupError;
  }

  #applyDeclaredWindowState(
    declaration: WindowDeclaration,
    diagnostics: MarkupWindowDiagnostic[],
  ): void {
    const state = declaration.declaredState ?? "normal";
    this.#minimizedWindowIds.delete(declaration.id);
    this.#closedWindowIds.delete(declaration.id);
    if (this.#maximizedWindowId === declaration.id) this.#maximizedWindowId = undefined;
    if (state === "minimized") this.#minimizedWindowIds.add(declaration.id);
    if (state === "closed") this.#closedWindowIds.add(declaration.id);
    if (state === "maximized") {
      if (this.#maximizedWindowId && this.#maximizedWindowId !== declaration.id) {
        diagnostics.push({
          code: "multiple-maximized-windows",
          severity: "warning",
          id: declaration.id,
          message:
            `Window "${declaration.id}" requested maximize while "${this.#maximizedWindowId}" is already maximized.`,
        });
      } else {
        this.#maximizedWindowId = declaration.id;
      }
    }
  }

  #applyDeclaredWindowPlacement(declaration: WindowDeclaration): void {
    this.#placements.set(declaration.id, declaration.declaredPlacement);
    this.#setStoredFloatingRect(
      declaration.id,
      declaration.declaredFloatingRect ?? defaultFloatingRect(declaration),
    );
    this.#setStoredAlwaysOnTop(declaration.id, declaration.declaredAlwaysOnTop);
    this.#setStoredGroup(declaration.id, declaration.declaredGroupId);
    if (!this.#focusOrderWindowIds.includes(declaration.id)) this.#focusOrderWindowIds.push(declaration.id);
  }

  #retainCurrentWindowState(): void {
    const ids = new Set(this.#windows.keys());
    this.#minimizedWindowIds = new Set([...this.#minimizedWindowIds].filter((id) => ids.has(id)));
    this.#closedWindowIds = new Set([...this.#closedWindowIds].filter((id) => ids.has(id)));
    if (this.#maximizedWindowId && !ids.has(this.#maximizedWindowId)) this.#maximizedWindowId = undefined;
    if (this.#activeWindowId && !ids.has(this.#activeWindowId)) this.#activeWindowId = undefined;
  }

  #retainCurrentWindowPlacement(): void {
    const ids = new Set(this.#windows.keys());
    this.#placements = new Map([...this.#placements].filter(([id]) => ids.has(id)));
    this.#floatingRects = new Map([...this.#floatingRects].filter(([id]) => ids.has(id)));
    this.#restoreRects = new Map([...this.#restoreRects].filter(([id]) => ids.has(id)));
    this.#snapTargets = new Map([...this.#snapTargets].filter(([id]) => ids.has(id)));
    for (const [id, target] of this.#snapTargets) {
      if (target.kind === "dock" && (!ids.has(target.targetId) || target.targetId === id)) {
        this.#snapTargets.delete(id);
      }
    }
    this.#alwaysOnTopWindowIds = new Set([...this.#alwaysOnTopWindowIds].filter((id) => ids.has(id)));
    this.#windowGroups = new Map([...this.#windowGroups].filter(([id]) => ids.has(id)));
    this.#focusOrderWindowIds = this.#focusOrderWindowIds.filter((id) => ids.has(id));
    for (const declaration of this.#windows.values()) {
      if (!this.#placements.has(declaration.id)) this.#placements.set(declaration.id, declaration.declaredPlacement);
      if (!this.#floatingRects.has(declaration.id)) {
        this.#setStoredFloatingRect(
          declaration.id,
          declaration.declaredFloatingRect ?? defaultFloatingRect(declaration),
        );
      } else {
        this.#floatingRects.set(
          declaration.id,
          normalizeFloatingRectInput(this.#floatingRects.get(declaration.id)!, declaration)!,
        );
        const restoreRect = this.#restoreRects.get(declaration.id);
        if (restoreRect) {
          this.#restoreRects.set(declaration.id, normalizeFloatingRectInput(restoreRect, declaration)!);
        }
      }
      if (!this.#focusOrderWindowIds.includes(declaration.id)) this.#focusOrderWindowIds.push(declaration.id);
    }
  }

  #applyNormalizedSnapshot(value: MarkupWindowSnapshot): void {
    const currentWindowIds = new Set(this.#windows.keys());
    const snapshotWindowIds = new Set(value.windowIds);
    const inventory = this.#workspaceInventory(this.#managedWindowIds);
    this.workspace.restore(value.workspace, inventory);

    this.#compactMode = value.compactMode;
    this.#minimizedWindowIds = new Set(
      value.minimizedWindowIds.filter((id) => currentWindowIds.has(id)),
    );
    this.#closedWindowIds = new Set(value.closedWindowIds.filter((id) => currentWindowIds.has(id)));
    this.#maximizedWindowId = value.maximizedWindowId && currentWindowIds.has(value.maximizedWindowId) &&
        !this.#minimizedWindowIds.has(value.maximizedWindowId) &&
        !this.#closedWindowIds.has(value.maximizedWindowId)
      ? value.maximizedWindowId
      : undefined;

    const placements = new Map(value.placements.map((entry) => [entry.id, entry]));
    for (const declaration of this.#windows.values()) {
      if (!snapshotWindowIds.has(declaration.id)) continue;
      const entry = placements.get(declaration.id);
      this.#placements.set(declaration.id, entry?.placement ?? "tiled");
      const floatingRect = entry?.floatingRect ?? this.#floatingRects.get(declaration.id) ??
        defaultFloatingRect(declaration);
      this.#floatingRects.set(declaration.id, cloneRect(floatingRect));
      if (entry?.restoreRect) this.#restoreRects.set(declaration.id, cloneRect(entry.restoreRect));
      else this.#restoreRects.delete(declaration.id);
      if (entry?.snapTarget) this.#snapTargets.set(declaration.id, cloneSnapTarget(entry.snapTarget));
      else this.#snapTargets.delete(declaration.id);
      this.#setStoredAlwaysOnTop(declaration.id, entry?.alwaysOnTop ?? false);
      this.#setStoredGroup(declaration.id, entry?.groupId);
    }

    const focusOrder: string[] = [];
    for (const id of value.focusOrderWindowIds) {
      if (currentWindowIds.has(id) && !focusOrder.includes(id)) focusOrder.push(id);
    }
    for (const id of this.#windows.keys()) {
      if (!focusOrder.includes(id)) focusOrder.push(id);
    }
    this.#focusOrderWindowIds = focusOrder;
    this.#activeWindowId = value.activeWindowId && currentWindowIds.has(value.activeWindowId)
      ? value.activeWindowId
      : undefined;

    const currentModalIds = new Set(this.#modals.keys());
    for (const modal of value.modals) {
      if (currentModalIds.has(modal.id)) this.#modalRequestedOpen.set(modal.id, modal.open);
    }
    const diagnostics = this.#diagnostics.filter((entry) => entry.code !== "missing-modal-geometry");
    this.#syncModals(this.#managedModalIds, diagnostics, false);
    this.#diagnostics = diagnostics;
    this.#repairFocus();
  }

  #snapshotConstraintViolation(value: MarkupWindowSnapshot): string | undefined {
    const declaredIds = new Set(this.#windows.keys());
    if (value.windowIds.length !== declaredIds.size || value.windowIds.some((id) => !declaredIds.has(id))) {
      return "snapshot-window-ids-do-not-match-declarations";
    }
    const placements = new Map(value.placements.map((entry) => [entry.id, entry]));
    for (const declaration of this.#windows.values()) {
      const placement = placements.get(declaration.id);
      if (
        placement?.floatingRect && !floatingRectSatisfiesConstraints(placement.floatingRect, declaration)
      ) {
        return `snapshot-floating-rect-violates-constraints:${declaration.id}`;
      }
      if (placement?.restoreRect && !floatingRectSatisfiesConstraints(placement.restoreRect, declaration)) {
        return `snapshot-restore-rect-violates-constraints:${declaration.id}`;
      }
    }
    return undefined;
  }

  #captureRollbackState(): MarkupWindowRollbackState {
    return {
      windows: cloneWindowDeclarations(this.#windows),
      modals: cloneModalDeclarations(this.#modals),
      managedWindowIds: new Set(this.#managedWindowIds),
      managedWindowGenerations: new Map(this.#managedWindowGenerations),
      managedModalIds: new Set(this.#managedModalIds),
      managedModalSignatures: cloneManagedModalSignatures(this.#managedModalSignatures),
      minimizedWindowIds: new Set(this.#minimizedWindowIds),
      closedWindowIds: new Set(this.#closedWindowIds),
      modalRequestedOpen: new Map(this.#modalRequestedOpen),
      placements: new Map(this.#placements),
      floatingRects: cloneRectMap(this.#floatingRects),
      restoreRects: cloneRectMap(this.#restoreRects),
      snapTargets: cloneSnapTargetMap(this.#snapTargets),
      alwaysOnTopWindowIds: new Set(this.#alwaysOnTopWindowIds),
      windowGroups: new Map(this.#windowGroups),
      focusOrderWindowIds: this.#focusOrderWindowIds.slice(),
      activeWindowId: this.#activeWindowId,
      maximizedWindowId: this.#maximizedWindowId,
      compactMode: this.#compactMode,
      diagnostics: this.#diagnostics.map(cloneDiagnostic),
      workspace: this.workspace.snapshot(),
      overlays: this.overlays.snapshot(),
    };
  }

  #forceRollback(state: MarkupWindowRollbackState): void {
    this.#windows = cloneWindowDeclarations(state.windows);
    this.#modals = cloneModalDeclarations(state.modals);
    this.#managedWindowIds = new Set(state.managedWindowIds);
    this.#managedWindowGenerations = new Map(state.managedWindowGenerations);
    this.#managedModalIds = new Set(state.managedModalIds);
    this.#managedModalSignatures = cloneManagedModalSignatures(state.managedModalSignatures);
    this.#minimizedWindowIds = new Set(state.minimizedWindowIds);
    this.#closedWindowIds = new Set(state.closedWindowIds);
    this.#modalRequestedOpen = new Map(state.modalRequestedOpen);
    this.#placements = new Map(state.placements);
    this.#floatingRects = cloneRectMap(state.floatingRects);
    this.#restoreRects = cloneRectMap(state.restoreRects);
    this.#snapTargets = cloneSnapTargetMap(state.snapTargets);
    this.#alwaysOnTopWindowIds = new Set(state.alwaysOnTopWindowIds);
    this.#windowGroups = new Map(state.windowGroups);
    this.#focusOrderWindowIds = state.focusOrderWindowIds.slice();
    this.#activeWindowId = state.activeWindowId;
    this.#maximizedWindowId = state.maximizedWindowId;
    this.#compactMode = state.compactMode;
    this.#diagnostics = state.diagnostics.map(cloneDiagnostic);

    let publicationFailed = false;
    try {
      this.workspace.restore(state.workspace);
    } catch {
      this.workspace.gap.jink(state.workspace.gap);
      this.workspace.state.jink(structuredClone(state.workspace.layout));
      try {
        this.workspace.gap.propagate();
      } catch {
        publicationFailed = true;
      }
      try {
        this.workspace.state.propagate();
      } catch {
        publicationFailed = true;
      }
    }
    try {
      this.overlays.restoreSnapshot(state.overlays, { synchronizeFocus: true });
    } catch {
      // restoreSnapshot assigns its allocator before publishing signals. Force
      // both values back, then explicitly republish so a failed listener cannot
      // be mistaken for an externally coherent rollback.
      this.overlays.surfaces.jink(state.overlays.surfaces.map(cloneOverlaySurface));
      this.overlays.synchronizeActiveId(state.overlays.activeId, { propagate: false });
      try {
        this.overlays.surfaces.propagate();
      } catch {
        publicationFailed = true;
      }
      try {
        this.overlays.activeId.propagate();
      } catch {
        publicationFailed = true;
      }
    }
    this.overlays.surfaces.jink(state.overlays.surfaces.map(cloneOverlaySurface));
    this.overlays.synchronizeActiveId(state.overlays.activeId, { propagate: false });
    this.#managedWindowGenerations.clear();
    for (const id of this.#managedWindowIds) {
      const generation = this.workspace.windowRegistrationGeneration(id);
      if (generation !== undefined) this.#managedWindowGenerations.set(id, generation);
    }
    this.#managedModalSignatures.clear();
    for (const id of this.#managedModalIds) {
      const surface = this.overlays.surface(id);
      const generation = this.overlays.registrationGeneration(id);
      if (surface && generation !== undefined) {
        this.#managedModalSignatures.set(id, managedModalSignature(surface, generation));
      }
    }
    if (publicationFailed) throw new Error("rollback-signal-publication-failed");
  }

  #setStoredFloatingRect(id: string, rect: Rectangle): void {
    this.#floatingRects.set(id, cloneRect(rect));
    this.#restoreRects.set(id, cloneRect(rect));
  }

  #setStoredAlwaysOnTop(id: string, value: boolean): void {
    if (value) this.#alwaysOnTopWindowIds.add(id);
    else this.#alwaysOnTopWindowIds.delete(id);
  }

  #setStoredGroup(id: string, groupId?: string): void {
    if (groupId) this.#windowGroups.set(id, groupId);
    else this.#windowGroups.delete(id);
  }

  #retainCurrentModalState(): void {
    const ids = new Set(this.#modals.keys());
    this.#modalRequestedOpen = new Map(
      [...this.#modalRequestedOpen].filter(([id]) => ids.has(id)),
    );
  }

  #syncWorkspace(previousManagedIds: ReadonlySet<string>): void {
    this.workspace.reconcile(this.#workspaceInventory(previousManagedIds), {
      activeWindowId: this.#maximizedWindowId,
    });
    this.#managedWindowIds = new Set(this.#windows.keys());
    this.#managedWindowGenerations = new Map(
      [...this.#managedWindowIds].map((id) => [id, this.workspace.windowRegistrationGeneration(id)!]),
    );
  }

  #workspaceInventory(previousManagedIds: ReadonlySet<string>): TiledWorkspaceWindow[] {
    const declarationIds = new Set(this.#windows.keys());
    const inventory = this.workspace.inspect().windows.filter((entry) =>
      !previousManagedIds.has(entry.id) && !declarationIds.has(entry.id)
    );
    for (const declaration of this.#windows.values()) {
      inventory.push({
        id: declaration.id,
        minWidth: declaration.minWidth,
        minHeight: declaration.minHeight,
      });
    }
    return inventory;
  }

  #workspaceSplitIsDeclarativelyOwned(splitId: string): boolean {
    const root = this.workspace.inspect().layout.root;
    if (!root) return false;
    const stack: TiledWorkspaceLayoutNode[] = [root];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.kind === "pane") continue;
      if (node.id !== splitId) {
        stack.push(node.second, node.first);
        continue;
      }
      const descendants: TiledWorkspaceLayoutNode[] = [node.first, node.second];
      let paneCount = 0;
      while (descendants.length > 0) {
        const descendant = descendants.pop()!;
        if (descendant.kind === "pane") {
          paneCount += 1;
          if (!this.#managedWindowIds.has(descendant.windowId)) return false;
        } else {
          descendants.push(descendant.second, descendant.first);
        }
      }
      return paneCount >= 2;
    }
    return false;
  }

  #syncModals(
    previousManagedIds: ReadonlySet<string>,
    diagnostics: MarkupWindowDiagnostic[],
    registerUnmanaged = true,
  ): void {
    const previousActiveOverlayId = this.overlays.activeId.peek();
    const stillOwned = new Set<string>();
    for (const id of previousManagedIds) {
      const surface = this.overlays.surface(id);
      const signature = this.#managedModalSignatures.get(id);
      const owned = Boolean(
        surface && signature &&
          managedModalSignatureMatches(signature, surface, this.overlays.registrationGeneration(id)),
      );
      if (!this.#modals.has(id)) {
        if (owned) this.overlays.remove(id, { synchronizeFocus: true });
        this.#managedModalSignatures.delete(id);
        continue;
      }
      if (owned) {
        stillOwned.add(id);
        continue;
      }
      this.#managedModalSignatures.delete(id);
      if (surface) {
        pushOverlayConflict(
          diagnostics,
          id,
          `Overlay id "${id}" changed ownership after declarative registration; the replacement was preserved.`,
        );
      }
    }
    const nextManaged = new Set<string>();
    for (const declaration of this.#modals.values()) {
      const existing = this.overlays.surface(declaration.id);
      if (!existing && !stillOwned.has(declaration.id) && !registerUnmanaged) continue;
      if (existing && !stillOwned.has(declaration.id)) {
        pushOverlayConflict(
          diagnostics,
          declaration.id,
          `Overlay id "${declaration.id}" is already owned outside the declarative integration.`,
        );
        continue;
      }
      if (!declaration.rect) {
        diagnostics.push({
          code: "missing-modal-geometry",
          severity: "warning",
          id: declaration.id,
          message: `Modal "${declaration.id}" has no computed or explicit rectangle and was registered closed.`,
        });
      }
      const visible = Boolean(
        declaration.rect && declaration.declaredVisible && this.#modalOwnerCanBeVisible(declaration) &&
          this.#modalRequestedOpen.get(declaration.id),
      );
      const surface = {
        id: declaration.id,
        rect: declaration.rect ? cloneRect(declaration.rect) : cloneRect(ZERO_RECT),
        layer: "modal" as const,
        kind: "modal" as const,
        zIndex: declaration.zIndex,
        visible,
        modal: true,
        closeOnOutsideClick: declaration.closeOnOutsideClick,
        ownerId: declaration.ownerId,
      };
      const registered = stillOwned.has(declaration.id)
        ? this.overlays.update(declaration.id, surface, { synchronizeFocus: true })!
        : this.overlays.register(surface, { synchronizeFocus: true });
      if (registered.visible) this.overlays.synchronizeActiveId(registered.id);
      nextManaged.add(declaration.id);
      this.#managedModalSignatures.set(
        declaration.id,
        managedModalSignature(registered, this.overlays.registrationGeneration(declaration.id)!),
      );
    }
    this.#managedModalIds = nextManaged;
    for (const id of [...this.#managedModalSignatures.keys()]) {
      if (!nextManaged.has(id)) this.#managedModalSignatures.delete(id);
    }
    if (previousActiveOverlayId && this.overlays.surface(previousActiveOverlayId)?.visible) {
      this.overlays.synchronizeActiveId(previousActiveOverlayId);
    }
  }

  #captureModalControllerState(): void {
    this.#auditManagedModalOwnership();
    for (const id of this.#managedModalIds) {
      const declaration = this.#modals.get(id);
      const surface = this.overlays.surface(id);
      if (
        declaration?.declaredVisible && declaration.rect && this.#modalOwnerCanBeVisible(declaration) && surface
      ) {
        this.#modalRequestedOpen.set(id, surface.visible);
      }
    }
  }

  #refreshModalVisibility(): void {
    this.#auditManagedModalOwnership();
    for (const id of this.#managedModalIds) {
      const declaration = this.#modals.get(id);
      const surface = this.overlays.surface(id);
      if (!declaration || !surface) continue;
      const visible = Boolean(
        declaration.rect && declaration.declaredVisible && this.#modalOwnerCanBeVisible(declaration) &&
          this.#modalRequestedOpen.get(id),
      );
      if (visible === surface.visible) continue;
      if (visible) this.overlays.open(id, { synchronizeFocus: true });
      else this.overlays.update(id, { visible: false }, { synchronizeFocus: true });
    }
  }

  #auditManagedWindowOwnership(): void {
    const liveIds = new Set(this.workspace.windowIds());
    let changed = false;
    for (const id of [...this.#managedWindowIds]) {
      const expectedGeneration = this.#managedWindowGenerations.get(id);
      if (
        liveIds.has(id) && expectedGeneration !== undefined &&
        this.workspace.windowRegistrationGeneration(id) === expectedGeneration
      ) continue;
      this.#managedWindowIds.delete(id);
      this.#managedWindowGenerations.delete(id);
      this.#windows.delete(id);
      pushWorkspaceConflict(
        this.#diagnostics,
        id,
        `Workspace window id "${id}" changed ownership after declarative registration; the replacement was preserved.`,
      );
      changed = true;
    }
    if (!changed) return;
    this.#retainCurrentWindowState();
    this.#retainCurrentWindowPlacement();
    this.#repairFocus();
  }

  #auditManagedModalOwnership(): void {
    for (const id of [...this.#managedModalIds]) {
      const surface = this.overlays.surface(id);
      const signature = this.#managedModalSignatures.get(id);
      if (
        surface && signature &&
        managedModalSignatureMatches(signature, surface, this.overlays.registrationGeneration(id))
      ) continue;
      this.#managedModalIds.delete(id);
      this.#managedModalSignatures.delete(id);
      if (!this.#modals.has(id)) continue;
      pushOverlayConflict(
        this.#diagnostics,
        id,
        surface
          ? `Overlay id "${id}" changed ownership after declarative registration; the replacement was preserved.`
          : `Declaratively registered overlay id "${id}" was removed outside the window controller.`,
      );
    }
  }

  #modalOwnerCanBeVisible(declaration: ModalDeclaration): boolean {
    if (!declaration.ownerId || !this.#windows.has(declaration.ownerId)) return true;
    return this.#isWindowEligible(declaration.ownerId) &&
      (!this.#maximizedWindowId || this.#maximizedWindowId === declaration.ownerId);
  }

  #repairFocus(): void {
    if (this.#maximizedWindowId) {
      if (!this.#isWindowEligible(this.#maximizedWindowId)) {
        this.#maximizedWindowId = undefined;
      } else {
        this.#activeWindowId = this.#maximizedWindowId;
        this.#raiseWindow(this.#maximizedWindowId);
        if (this.#windowPlacement(this.#maximizedWindowId) === "tiled") {
          this.workspace.focus(this.#maximizedWindowId);
        }
        return;
      }
    }
    if (this.#activeWindowId && this.#isWindowEligible(this.#activeWindowId)) {
      if (this.#windowPlacement(this.#activeWindowId) === "tiled") this.workspace.focus(this.#activeWindowId);
      else this.#raiseWindow(this.#activeWindowId);
      return;
    }
    const workspaceActive = this.workspace.inspect().activeWindowId;
    if (workspaceActive) {
      if (!this.#windows.has(workspaceActive)) {
        this.#activeWindowId = undefined;
        return;
      }
      if (this.#isWindowEligible(workspaceActive) && this.#windowPlacement(workspaceActive) === "tiled") {
        this.#activeWindowId = workspaceActive;
        this.#raiseWindow(workspaceActive);
        return;
      }
    }
    for (const id of this.workspace.windowIds()) {
      if (this.#windows.has(id) && this.#isWindowEligible(id) && this.#windowPlacement(id) === "tiled") {
        this.#activeWindowId = id;
        this.#raiseWindow(id);
        this.workspace.focus(id);
        return;
      }
    }
    for (let index = this.#focusOrderWindowIds.length - 1; index >= 0; index -= 1) {
      const id = this.#focusOrderWindowIds[index]!;
      if (!this.#isWindowEligible(id)) continue;
      this.#activeWindowId = id;
      this.#raiseWindow(id);
      if (this.#windowPlacement(id) === "tiled") this.workspace.focus(id);
      return;
    }
    this.#activeWindowId = undefined;
  }

  #eligibleWorkspaceWindowIds(): string[] {
    const ids: string[] = [];
    for (const id of this.workspace.windowIds()) {
      if (
        !this.#windows.has(id) ||
        (this.#isWindowEligible(id) && this.#windowPlacement(id) === "tiled")
      ) ids.push(id);
    }
    return ids;
  }

  #allKnownWindowIds(): string[] {
    const ids = this.workspace.windowIds();
    const known = new Set(ids);
    for (const id of this.#windows.keys()) {
      if (!known.has(id)) ids.push(id);
    }
    return ids;
  }

  #isWindowEligible(id: string): boolean {
    const declaration = this.#windows.get(id);
    return Boolean(
      declaration?.declaredVisible &&
        !this.#closedWindowIds.has(id) &&
        !this.#minimizedWindowIds.has(id),
    );
  }

  #windowState(id: string): MarkupWindowState {
    if (this.#closedWindowIds.has(id)) return "closed";
    if (this.#minimizedWindowIds.has(id)) return "minimized";
    if (this.#maximizedWindowId === id) return "maximized";
    return "normal";
  }

  #windowPlacement(id: string): MarkupWindowPlacement {
    return this.#placements.get(id) ?? "tiled";
  }

  #floatingRect(id: string): Rectangle {
    const existing = this.#floatingRects.get(id);
    if (existing) return cloneRect(existing);
    const declaration = this.#windows.get(id);
    return declaration ? defaultFloatingRect(declaration) : { column: 0, row: 0, width: 1, height: 1 };
  }

  #activateWindow(id: string): boolean {
    if (this.#maximizedWindowId && this.#maximizedWindowId !== id) {
      this.#activeWindowId = this.#maximizedWindowId;
      if (this.#windowPlacement(this.#maximizedWindowId) === "tiled") {
        this.workspace.focus(this.#maximizedWindowId);
      }
      return false;
    }
    this.#activeWindowId = id;
    this.#raiseWindow(id);
    if (this.#windowPlacement(id) === "tiled") this.workspace.focus(id);
    return true;
  }

  #raiseWindow(id: string): boolean {
    const index = this.#focusOrderWindowIds.indexOf(id);
    if (index < 0) {
      this.#focusOrderWindowIds.push(id);
      return true;
    }
    if (this.#isFrontOfFocusTier(id)) return false;
    this.#focusOrderWindowIds.splice(index, 1);
    this.#focusOrderWindowIds.push(id);
    return true;
  }

  #isFrontOfFocusTier(id: string): boolean {
    const tier = this.#alwaysOnTopWindowIds.has(id);
    for (let index = this.#focusOrderWindowIds.length - 1; index >= 0; index -= 1) {
      const candidate = this.#focusOrderWindowIds[index]!;
      if (this.#alwaysOnTopWindowIds.has(candidate) === tier) return candidate === id;
    }
    return false;
  }

  #availableFloatingWindowAction(
    action: MarkupWindowAction,
    id: string,
  ): MarkupWindowActionResult | undefined {
    const unavailable = this.#availableWindowAction(action, id);
    if (unavailable) return unavailable;
    if (this.#windowPlacement(id) !== "floating") {
      return actionResult(action, "blocked", id, undefined, "window-not-floating");
    }
    return undefined;
  }

  #availableWindowAction(
    action: MarkupWindowAction,
    id: string,
    targetId?: string,
  ): MarkupWindowActionResult | undefined {
    const unavailable = this.#unavailable(action, id, targetId);
    if (unavailable) return unavailable;
    if (!this.#windows.has(id)) return actionResult(action, "not-found", id, targetId);
    if (!this.#isWindowEligible(id)) {
      return actionResult(action, "blocked", id, targetId, "window-not-visible");
    }
    return undefined;
  }

  #unavailable(
    action: MarkupWindowAction,
    id?: string,
    targetId?: string,
  ): MarkupWindowActionResult | undefined {
    if (this.#disposed) return actionResult(action, "disposed", id, targetId, "controller-disposed");
    if (this.#mutationInProgress) {
      return actionResult(action, "blocked", id, targetId, "controller-mutation-in-progress");
    }
    this.#auditManagedWindowOwnership();
    return undefined;
  }

  #assertActive(operation: string): void {
    if (this.#disposed) throw new Error(`MarkupWindowController is disposed; cannot ${operation}.`);
    if (this.#mutationInProgress) {
      throw new Error(`MarkupWindowController cannot ${operation} during a state mutation.`);
    }
  }
}

/** Creates a declarative-window integration around existing shared controllers. */
export function createMarkupWindowController(options: MarkupWindowControllerOptions): MarkupWindowController {
  return new MarkupWindowController(options);
}

/** Discovers renderer-neutral window and modal declarations without retaining LayoutNode references. */
function discoverMarkupWindows(
  root: LayoutNode,
  layout?: MarkupWindowLayoutLookup,
): MarkupWindowDiscovery {
  const windows: WindowDeclaration[] = [];
  const modals: ModalDeclaration[] = [];
  const diagnostics: MarkupWindowDiagnostic[] = [];
  const ids = new Set<string>();
  const seen = new WeakSet<object>();
  const stack: Array<{ node: LayoutNode; ancestors: LayoutNode[]; depth: number }> = [
    { node: root, ancestors: [], depth: 0 },
  ];
  let visited = 0;
  while (stack.length > 0) {
    const { node, ancestors, depth } = stack.pop()!;
    if (depth > MAX_WINDOW_LAYOUT_DEPTH) {
      pushUniqueDiscoveryDiagnostic(diagnostics, {
        code: "layout-depth-exceeded",
        severity: "error",
        message: `Declarative window discovery exceeds the bounded depth of ${MAX_WINDOW_LAYOUT_DEPTH}.`,
      });
      continue;
    }
    if (seen.has(node)) {
      pushUniqueDiscoveryDiagnostic(diagnostics, {
        code: "layout-cycle-detected",
        severity: "error",
        message: "Declarative window discovery rejected a cyclic or multiply referenced layout node.",
      });
      continue;
    }
    seen.add(node);
    visited += 1;
    if (visited > MAX_WINDOW_LAYOUT_NODES) {
      pushUniqueDiscoveryDiagnostic(diagnostics, {
        code: "layout-node-limit-exceeded",
        severity: "error",
        message: `Declarative window discovery exceeds the bounded node limit of ${MAX_WINDOW_LAYOUT_NODES}.`,
      });
      break;
    }

    const tag = normalizeTag(node.tag);
    if (tag === "window" || tag === "modal" || tag === "dialog") {
      const id = node.id.trim();
      if (!id) {
        diagnostics.push({
          code: "empty-surface-id",
          severity: "error",
          message: `Declarative <${tag}> nodes require a non-empty stable id.`,
        });
      } else if (!validWindowId(id)) {
        diagnostics.push({
          code: "invalid-surface-id",
          severity: "error",
          message:
            `Declarative <${tag}> nodes require an id of at most ${MAX_WINDOW_ID_LENGTH} non-control characters.`,
        });
      } else if (ids.has(id)) {
        diagnostics.push({
          code: "duplicate-surface-id",
          severity: "error",
          id,
          message: `Declarative surface id "${id}" is duplicated; the first declaration remains authoritative.`,
        });
      } else {
        ids.add(id);
        if (windows.length + modals.length >= MAX_WINDOW_SURFACES) {
          pushUniqueDiscoveryDiagnostic(diagnostics, {
            code: "surface-limit-exceeded",
            severity: "error",
            message: `Declarative window surfaces exceed the bounded limit of ${MAX_WINDOW_SURFACES}.`,
          });
        } else if (tag === "window") {
          windows.push(windowDeclaration(node, layout));
        } else {
          modals.push(modalDeclaration(node, tag, ancestors, layout));
        }
      }
    }

    const nextAncestors = [...ancestors, node];
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: node.children[index]!, ancestors: nextAncestors, depth: depth + 1 });
    }
  }
  return { windows, modals, diagnostics };
}

function pushUniqueDiscoveryDiagnostic(
  diagnostics: MarkupWindowDiagnostic[],
  diagnostic: MarkupWindowDiagnostic,
): void {
  if (!diagnostics.some((entry) => entry.code === diagnostic.code)) diagnostics.push(diagnostic);
}

function windowDeclaration(node: LayoutNode, layout?: MarkupWindowLayoutLookup): WindowDeclaration {
  const state = declaredWindowState(node.attributes);
  const placement = declaredWindowPlacement(node.attributes);
  const explicit = explicitRect(node.attributes);
  const solved = layout?.byId.get(node.id)?.rect;
  const minWidth = cellMinimum(node.style.minWidth);
  const minHeight = cellMinimum(node.style.minHeight);
  const rawMaxWidth = cellMaximum(node.style.maxWidth);
  const rawMaxHeight = cellMaximum(node.style.maxHeight);
  const maxWidth = rawMaxWidth === undefined ? undefined : Math.max(minWidth ?? 1, rawMaxWidth);
  const maxHeight = rawMaxHeight === undefined ? undefined : Math.max(minHeight ?? 1, rawMaxHeight);
  const requestedRect = explicit ?? (solved ? normalizeRect(solved) : undefined);
  const declaredFloatingRect = requestedRect
    ? normalizeFloatingRectInput(requestedRect, { minWidth, minHeight, maxWidth, maxHeight })
    : undefined;
  const alwaysOnTopAttribute = attributeName(node.attributes, "always-on-top", "pinned");
  const groupAttribute = attributeName(node.attributes, "group-id", "group");
  return {
    id: node.id.trim(),
    title: optionalText(node.attributes.title ?? node.attributes["aria-label"]),
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    declaredVisible: nodeVisible(node),
    declaredState: state?.state,
    stateToken: state?.token,
    declaredPlacement: placement.placement,
    placementToken: placement.token,
    declaredFloatingRect,
    geometryToken: explicit && declaredFloatingRect ? rectangleToken(declaredFloatingRect) : undefined,
    declaredAlwaysOnTop: alwaysOnTopAttribute ? booleanAttribute(node.attributes, alwaysOnTopAttribute, true) : false,
    alwaysOnTopToken: alwaysOnTopAttribute
      ? `${alwaysOnTopAttribute}:${booleanAttribute(node.attributes, alwaysOnTopAttribute, true)}`
      : undefined,
    declaredGroupId: groupAttribute ? normalizeGroupId(node.attributes[groupAttribute]) : undefined,
    groupToken: groupAttribute ? `${groupAttribute}:${node.attributes[groupAttribute]}` : undefined,
  };
}

function modalDeclaration(
  node: LayoutNode,
  tag: "modal" | "dialog",
  ancestors: readonly LayoutNode[],
  layout?: MarkupWindowLayoutLookup,
): ModalDeclaration {
  const open = declaredModalOpen(node.attributes, tag);
  const box = layout?.byId.get(node.id);
  const rect = box ? normalizeRect(box.rect) : explicitRect(node.attributes);
  const owner = findOwningWindow(ancestors);
  return {
    id: node.id.trim(),
    title: optionalText(node.attributes.title ?? node.attributes["aria-label"]),
    ownerId: optionalText(node.attributes["owner-id"] ?? owner?.id),
    declaredVisible: nodeVisible(node),
    defaultOpen: open.open,
    openToken: open.token,
    closeOnOutsideClick: booleanAttribute(node.attributes, "close-on-outside-click", false),
    rect,
    zIndex: overlayLayerZIndex("modal") + Math.floor(finiteNumber(node.style.zIndex, 0)),
  };
}

function declaredWindowState(
  attributes: Record<string, string>,
): { state: MarkupWindowState; token: string } | undefined {
  const state = attributes.state?.trim().toLowerCase();
  if (state === "normal" || state === "minimized" || state === "maximized" || state === "closed") {
    return { state, token: `state:${state}` };
  }
  for (const candidate of ["closed", "minimized", "maximized"] as const) {
    if (candidate in attributes) {
      const enabled = booleanAttribute(attributes, candidate, false);
      return { state: enabled ? candidate : "normal", token: `${candidate}:${enabled}` };
    }
  }
  return undefined;
}

function declaredModalOpen(
  attributes: Record<string, string>,
  tag: "modal" | "dialog",
): { open: boolean; token?: string } {
  const state = attributes.state?.trim().toLowerCase();
  if (state === "open" || state === "closed") return { open: state === "open", token: `state:${state}` };
  if ("open" in attributes) {
    const open = booleanAttribute(attributes, "open", true);
    return { open, token: `open:${open}` };
  }
  return { open: tag === "modal" };
}

function nodeVisible(node: LayoutNode): boolean {
  return node.style.display !== "none" && node.style.visibility !== "hidden" &&
    !booleanAttribute(node.attributes, "hidden", false) &&
    !booleanAttribute(node.attributes, "aria-hidden", false);
}

function findOwningWindow(ancestors: readonly LayoutNode[]): LayoutNode | undefined {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    if (normalizeTag(ancestors[index]!.tag) === "window") return ancestors[index];
  }
  return undefined;
}

function cellMinimum(value: LayoutNode["style"]["minWidth"]): number | undefined {
  if (value.unit !== "cell" || !Number.isFinite(value.value) || value.value <= 0) return undefined;
  return Math.min(MAX_WINDOW_CELL, Math.max(1, Math.floor(value.value)));
}

function cellMaximum(value: LayoutNode["style"]["maxWidth"]): number | undefined {
  if (value.unit !== "cell" || !Number.isFinite(value.value) || value.value <= 0) return undefined;
  return Math.min(MAX_WINDOW_CELL, Math.max(1, Math.floor(value.value)));
}

function explicitRect(attributes: Record<string, string>): Rectangle | undefined {
  const column = numberAttribute(attributes, "column") ?? numberAttribute(attributes, "x");
  const row = numberAttribute(attributes, "row") ?? numberAttribute(attributes, "y");
  const width = numberAttribute(attributes, "width");
  const height = numberAttribute(attributes, "height");
  if (column === undefined || row === undefined || width === undefined || height === undefined) return undefined;
  return normalizeRect({ column, row, width, height });
}

function declaredWindowPlacement(
  attributes: Record<string, string>,
): { placement: MarkupWindowPlacement; token?: string } {
  const value = attributes.placement?.trim().toLowerCase();
  if (value === "floating" || value === "tiled") return { placement: value, token: `placement:${value}` };
  if ("floating" in attributes) {
    const floating = booleanAttribute(attributes, "floating", true);
    return { placement: floating ? "floating" : "tiled", token: `floating:${floating}` };
  }
  return { placement: "tiled" };
}

function attributeName(attributes: Record<string, string>, ...names: string[]): string | undefined {
  return names.find((name) => name in attributes);
}

function rectangleToken(rect: Rectangle): string {
  return `${rect.column}:${rect.row}:${rect.width}:${rect.height}`;
}

function defaultFloatingRect(declaration: WindowDeclaration): Rectangle {
  const constraints = windowConstraints(declaration);
  return {
    column: 0,
    row: 0,
    width: Math.max(constraints.minWidth, Math.min(constraints.maxWidth, 40)),
    height: Math.max(constraints.minHeight, Math.min(constraints.maxHeight, 12)),
  };
}

function windowConstraints(declaration: MarkupWindowConstraints): Required<MarkupWindowConstraints> {
  const minWidth = boundedSize(declaration.minWidth ?? 1);
  const minHeight = boundedSize(declaration.minHeight ?? 1);
  return {
    minWidth,
    minHeight,
    maxWidth: Math.max(minWidth, boundedSize(declaration.maxWidth ?? MAX_WINDOW_CELL)),
    maxHeight: Math.max(minHeight, boundedSize(declaration.maxHeight ?? MAX_WINDOW_CELL)),
  };
}

interface MarkupWindowConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

function boundedSize(value: number): number {
  return Math.min(MAX_WINDOW_CELL, Math.max(1, Math.floor(value)));
}

function normalizeFloatingRectInput(rect: Rectangle, declaration: MarkupWindowConstraints): Rectangle | undefined {
  const raw = finiteBoundedRect(rect, false);
  if (!raw || raw.width <= 0 || raw.height <= 0) return undefined;
  const constraints = windowConstraints(declaration);
  return {
    column: raw.column,
    row: raw.row,
    width: Math.max(constraints.minWidth, Math.min(constraints.maxWidth, raw.width)),
    height: Math.max(constraints.minHeight, Math.min(constraints.maxHeight, raw.height)),
  };
}

function normalizeWindowBounds(rect: Rectangle): Rectangle | undefined {
  const bounds = finiteBoundedRect(rect, true);
  if (!bounds) return undefined;
  const lastColumn = bounds.width > 0 ? bounds.column + bounds.width - 1 : bounds.column;
  const lastRow = bounds.height > 0 ? bounds.row + bounds.height - 1 : bounds.row;
  if (Math.abs(lastColumn) > MAX_WINDOW_CELL || Math.abs(lastRow) > MAX_WINDOW_CELL) return undefined;
  return bounds;
}

function finiteBoundedRect(rect: Rectangle, allowEmpty: boolean): Rectangle | undefined {
  try {
    const values = [rect.column, rect.row, rect.width, rect.height];
    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) return undefined;
    const column = Math.floor(rect.column);
    const row = Math.floor(rect.row);
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    if (Math.abs(column) > MAX_WINDOW_CELL || Math.abs(row) > MAX_WINDOW_CELL) return undefined;
    if (
      width > MAX_WINDOW_CELL || height > MAX_WINDOW_CELL || width < (allowEmpty ? 0 : 1) ||
      height < (allowEmpty ? 0 : 1)
    ) return undefined;
    return { column, row, width, height };
  } catch {
    return undefined;
  }
}

function normalizeMoveDelta(delta: MarkupWindowMoveDelta): MarkupWindowMoveDelta | undefined {
  try {
    if (!Number.isSafeInteger(delta.columns) || !Number.isSafeInteger(delta.rows)) return undefined;
    if (Math.abs(delta.columns) > MAX_WINDOW_CELL || Math.abs(delta.rows) > MAX_WINDOW_CELL) return undefined;
    if (delta.columns === 0 && delta.rows === 0) return undefined;
    return { columns: delta.columns, rows: delta.rows };
  } catch {
    return undefined;
  }
}

function translatedFloatingRect(rect: Rectangle, delta: MarkupWindowMoveDelta): Rectangle | undefined {
  const column = rect.column + delta.columns;
  const row = rect.row + delta.rows;
  if (
    !Number.isSafeInteger(column) || !Number.isSafeInteger(row) || Math.abs(column) > MAX_WINDOW_CELL ||
    Math.abs(row) > MAX_WINDOW_CELL
  ) return undefined;
  return { ...rect, column, row };
}

function resizedFloatingRect(
  rect: Rectangle,
  edge: MarkupWindowResizeEdge,
  delta: MarkupWindowMoveDelta,
  declaration: WindowDeclaration,
): Rectangle | undefined {
  const constraints = windowConstraints(declaration);
  const movesLeft = edge === "left" || edge === "top-left" || edge === "bottom-left";
  const movesRight = edge === "right" || edge === "top-right" || edge === "bottom-right";
  const movesTop = edge === "top" || edge === "top-left" || edge === "top-right";
  const movesBottom = edge === "bottom" || edge === "bottom-left" || edge === "bottom-right";
  let width = rect.width + (movesRight ? delta.columns : 0) - (movesLeft ? delta.columns : 0);
  let height = rect.height + (movesBottom ? delta.rows : 0) - (movesTop ? delta.rows : 0);
  width = Math.max(constraints.minWidth, Math.min(constraints.maxWidth, width));
  height = Math.max(constraints.minHeight, Math.min(constraints.maxHeight, height));
  const column = movesLeft ? rect.column + rect.width - width : rect.column;
  const row = movesTop ? rect.row + rect.height - height : rect.row;
  return finiteBoundedRect({ column, row, width, height }, false);
}

function recoverFloatingRect(
  rect: Rectangle,
  bounds: Rectangle,
  options: NormalizedRecoveryOptions,
): Rectangle | undefined {
  if (bounds.width <= 0 || bounds.height <= 0) return cloneRect(rect);
  const left = bounds.column + Math.min(options.margin, Math.max(0, bounds.width - 1));
  const right = bounds.column + bounds.width - 1 - Math.min(options.margin, Math.max(0, bounds.width - 1));
  const top = bounds.row + Math.min(options.margin, Math.max(0, bounds.height - 1));
  const bottom = bounds.row + bounds.height - 1 - Math.min(options.margin, Math.max(0, bounds.height - 1));
  const moveAffordanceOffset = Math.floor((rect.width - 1) / 2);
  const minColumn = left - moveAffordanceOffset;
  const maxColumn = right - moveAffordanceOffset;
  const titleHeight = Math.max(1, Math.min(rect.height, options.titleBarHeight));
  const maxRow = Math.max(top, bottom - titleHeight + 1);
  return finiteBoundedRect({
    ...rect,
    column: Math.max(minColumn, Math.min(maxColumn, rect.column)),
    row: Math.max(top, Math.min(maxRow, rect.row)),
  }, false);
}

function normalizeRecoveryOptions(options: RecoverMarkupWindowBoundsOptions): NormalizedRecoveryOptions | undefined {
  try {
    const margin = options.margin ?? 0;
    const titleBarHeight = options.titleBarHeight ?? 1;
    if (
      !Number.isSafeInteger(margin) || margin < 0 || margin > MAX_WINDOW_CELL ||
      !Number.isSafeInteger(titleBarHeight) || titleBarHeight < 1 || titleBarHeight > MAX_WINDOW_CELL
    ) return undefined;
    return { margin, titleBarHeight };
  } catch {
    return undefined;
  }
}

function snapRect(
  target: Exclude<MarkupWindowSnapTarget, { kind: "dock" }>,
  bounds: Rectangle,
): Rectangle {
  const leftWidth = Math.max(1, Math.ceil(bounds.width / 2));
  const rightWidth = Math.max(1, Math.floor(bounds.width / 2));
  const topHeight = Math.max(1, Math.ceil(bounds.height / 2));
  const bottomHeight = Math.max(1, Math.floor(bounds.height / 2));
  if (target.kind === "workspace") {
    switch (target.edge) {
      case "left":
        return { ...bounds, width: leftWidth };
      case "right":
        return { ...bounds, column: bounds.column + bounds.width - rightWidth, width: rightWidth };
      case "top":
        return { ...bounds, height: topHeight };
      case "bottom":
        return { ...bounds, row: bounds.row + bounds.height - bottomHeight, height: bottomHeight };
    }
  }
  const right = target.corner === "top-right" || target.corner === "bottom-right";
  const bottom = target.corner === "bottom-left" || target.corner === "bottom-right";
  const width = right ? rightWidth : leftWidth;
  const height = bottom ? bottomHeight : topHeight;
  return {
    column: right ? bounds.column + bounds.width - width : bounds.column,
    row: bottom ? bounds.row + bounds.height - height : bounds.row,
    width,
    height,
  };
}

function constrainedSnapRect(
  target: Exclude<MarkupWindowSnapTarget, { kind: "dock" }>,
  bounds: Rectangle,
  declaration: WindowDeclaration,
): Rectangle | undefined {
  const constrained = normalizeFloatingRectInput(snapRect(target, bounds), declaration);
  if (!constrained) return undefined;
  const right = target.kind === "workspace"
    ? target.edge === "right"
    : target.corner === "top-right" || target.corner === "bottom-right";
  const bottom = target.kind === "workspace"
    ? target.edge === "bottom"
    : target.corner === "bottom-left" || target.corner === "bottom-right";
  if (right) constrained.column = bounds.column + bounds.width - constrained.width;
  else constrained.column = bounds.column;
  if (bottom) constrained.row = bounds.row + bounds.height - constrained.height;
  else constrained.row = bounds.row;
  return finiteBoundedRect(constrained, false);
}

function normalizeSnapTarget(value: MarkupWindowSnapTarget): MarkupWindowSnapTarget | undefined {
  try {
    if (!value || typeof value !== "object") return undefined;
    if (value.kind === "workspace" && isTiledWorkspaceDockEdge(value.edge)) {
      return { kind: "workspace", edge: value.edge };
    }
    if (value.kind === "corner" && isMarkupWindowCorner(value.corner)) {
      return { kind: "corner", corner: value.corner };
    }
    if (
      value.kind === "dock" && validWindowId(value.targetId) && isTiledWorkspaceDockEdge(value.edge) &&
      (value.ratio === undefined || (Number.isFinite(value.ratio) && value.ratio >= 0.05 && value.ratio <= 0.95))
    ) {
      return value.ratio === undefined
        ? { kind: "dock", targetId: value.targetId.trim(), edge: value.edge }
        : { kind: "dock", targetId: value.targetId.trim(), edge: value.edge, ratio: value.ratio };
    }
  } catch {
    // Invalid host objects are classified rather than observed further.
  }
  return undefined;
}

function cloneSnapTarget(target: MarkupWindowSnapTarget): MarkupWindowSnapTarget {
  return target.kind === "dock" && target.ratio !== undefined ? { ...target } : { ...target };
}

function cloneOptionalSnapTarget(target: MarkupWindowSnapTarget | undefined): MarkupWindowSnapTarget | undefined {
  return target ? cloneSnapTarget(target) : undefined;
}

function cloneOptionalRect(rect: Rectangle | undefined): Rectangle | undefined {
  return rect ? cloneRect(rect) : undefined;
}

function cloneRectMap(source: ReadonlyMap<string, Rectangle>): Map<string, Rectangle> {
  return new Map([...source].map(([id, rect]) => [id, cloneRect(rect)]));
}

function cloneSnapTargetMap(
  source: ReadonlyMap<string, MarkupWindowSnapTarget>,
): Map<string, MarkupWindowSnapTarget> {
  return new Map([...source].map(([id, target]) => [id, cloneSnapTarget(target)]));
}

function managedModalSignature(
  surface: OverlaySurfaceInspection,
  registrationGeneration: number,
): ManagedModalSignature {
  return {
    registrationGeneration,
    rect: cloneRect(surface.rect),
    layer: surface.layer,
    kind: surface.kind,
    modal: surface.modal,
    closeOnOutsideClick: surface.closeOnOutsideClick,
    ownerId: surface.ownerId,
  };
}

function managedModalSignatureMatches(
  signature: ManagedModalSignature,
  surface: OverlaySurfaceInspection,
  registrationGeneration: number | undefined,
): boolean {
  return signature.registrationGeneration === registrationGeneration && rectanglesEqual(signature.rect, surface.rect) &&
    signature.layer === surface.layer &&
    signature.kind === surface.kind && signature.modal === surface.modal &&
    signature.closeOnOutsideClick === surface.closeOnOutsideClick && signature.ownerId === surface.ownerId;
}

function cloneManagedModalSignatures(
  source: ReadonlyMap<string, ManagedModalSignature>,
): Map<string, ManagedModalSignature> {
  return new Map([...source].map(([id, signature]) => [id, { ...signature, rect: cloneRect(signature.rect) }]));
}

function pushOverlayConflict(diagnostics: MarkupWindowDiagnostic[], id: string, message: string): void {
  if (diagnostics.some((entry) => entry.code === "overlay-id-conflict" && entry.id === id)) return;
  diagnostics.push({ code: "overlay-id-conflict", severity: "error", id, message });
}

function pushWorkspaceConflict(diagnostics: MarkupWindowDiagnostic[], id: string, message: string): void {
  if (diagnostics.some((entry) => entry.code === "workspace-id-conflict" && entry.id === id)) return;
  diagnostics.push({ code: "workspace-id-conflict", severity: "error", id, message });
}

function cloneWindowDeclarations(source: ReadonlyMap<string, WindowDeclaration>): Map<string, WindowDeclaration> {
  return new Map([...source].map(([id, declaration]) => [
    id,
    {
      ...declaration,
      declaredFloatingRect: cloneOptionalRect(declaration.declaredFloatingRect),
    },
  ]));
}

function cloneModalDeclarations(source: ReadonlyMap<string, ModalDeclaration>): Map<string, ModalDeclaration> {
  return new Map([...source].map(([id, declaration]) => [
    id,
    { ...declaration, rect: cloneOptionalRect(declaration.rect) },
  ]));
}

function rectanglesEqual(left: Rectangle | undefined, right: Rectangle | undefined): boolean {
  return Boolean(
    left && right && left.column === right.column && left.row === right.row && left.width === right.width &&
      left.height === right.height,
  );
}

function floatingRectSatisfiesConstraints(rect: Rectangle, declaration: WindowDeclaration): boolean {
  const constraints = windowConstraints(declaration);
  return rect.width >= constraints.minWidth && rect.width <= constraints.maxWidth &&
    rect.height >= constraints.minHeight && rect.height <= constraints.maxHeight;
}

function compareFloatingWindowZOrder(
  left: MarkupFloatingWindowProjection,
  right: MarkupFloatingWindowProjection,
): number {
  return Number(left.alwaysOnTop) - Number(right.alwaysOnTop) || left.focusOrder - right.focusOrder ||
    left.id.localeCompare(right.id);
}

function normalizeGroupId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.length > MAX_WINDOW_GROUP_ID_LENGTH || hasControlCharacters(normalized)) {
    return undefined;
  }
  return normalized;
}

function validWindowId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= MAX_WINDOW_ID_LENGTH &&
    !hasControlCharacters(value);
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isTiledWorkspaceDockEdge(value: unknown): value is TiledWorkspaceDockEdge {
  return value === "left" || value === "right" || value === "top" || value === "bottom";
}

function isMarkupWindowCorner(value: unknown): value is MarkupWindowCorner {
  return value === "top-left" || value === "top-right" || value === "bottom-left" || value === "bottom-right";
}

function isMarkupWindowResizeEdge(value: unknown): value is MarkupWindowResizeEdge {
  return isTiledWorkspaceDockEdge(value) || isMarkupWindowCorner(value);
}

/**
 * Validates and normalizes an untrusted window snapshot without mutating controller state.
 *
 * Version-one snapshots are migrated to the current shape; malformed or unsupported
 * payloads return an explicit failure result instead of throwing.
 */
export function normalizeMarkupWindowSnapshot(value: unknown): NormalizeMarkupWindowSnapshotResult {
  try {
    const root = strictDataRecord(
      value,
      [
        "version",
        "compactMode",
        "windowIds",
        "minimizedWindowIds",
        "closedWindowIds",
        "maximizedWindowId",
        "activeWindowId",
        "focusOrderWindowIds",
        "placements",
        "modals",
        "workspace",
      ],
      [
        "version",
        "compactMode",
        "windowIds",
        "minimizedWindowIds",
        "closedWindowIds",
        "modals",
        "workspace",
      ],
      "markup window snapshot",
    );
    const version = root.version;
    if (version !== MARKUP_WINDOW_SNAPSHOT_VERSION && version !== MARKUP_WINDOW_SNAPSHOT_V1_VERSION) {
      return { ok: false, status: "unsupported", reason: `unsupported-snapshot-version:${String(version)}` };
    }
    const compactMode = strictCompactMode(root.compactMode);
    const windowIds = strictIdArray(root.windowIds, "windowIds");
    const inventory = new Set(windowIds);
    const minimizedWindowIds = strictIdArray(root.minimizedWindowIds, "minimizedWindowIds", inventory);
    const closedWindowIds = strictIdArray(root.closedWindowIds, "closedWindowIds", inventory);
    if (minimizedWindowIds.some((id) => closedWindowIds.includes(id))) {
      throw new TypeError("minimized and closed window ids must be disjoint");
    }
    const maximizedWindowId = strictOptionalInventoryId(root.maximizedWindowId, inventory, "maximizedWindowId");
    if (
      maximizedWindowId && (minimizedWindowIds.includes(maximizedWindowId) ||
        closedWindowIds.includes(maximizedWindowId))
    ) {
      throw new TypeError("maximized window cannot also be hidden");
    }
    const modals = strictModalSnapshots(root.modals);
    const workspace = strictWorkspaceSnapshot(root.workspace);

    if (version === MARKUP_WINDOW_SNAPSHOT_V1_VERSION) {
      if (
        Object.hasOwn(root, "activeWindowId") || Object.hasOwn(root, "focusOrderWindowIds") ||
        Object.hasOwn(root, "placements")
      ) {
        throw new TypeError("V1 snapshot contains V2-only state");
      }
      const workspaceActiveId = workspaceActiveWindowId(workspace);
      const activeWindowId = maximizedWindowId ?? workspaceActiveId;
      return {
        ok: true,
        snapshot: {
          version: MARKUP_WINDOW_SNAPSHOT_VERSION,
          compactMode,
          windowIds,
          minimizedWindowIds,
          closedWindowIds,
          maximizedWindowId,
          activeWindowId: activeWindowId && inventory.has(activeWindowId) &&
              !minimizedWindowIds.includes(activeWindowId) && !closedWindowIds.includes(activeWindowId)
            ? activeWindowId
            : undefined,
          focusOrderWindowIds: windowIds.slice(),
          placements: windowIds.map((id) => ({ id, placement: "tiled", alwaysOnTop: false })),
          modals,
          workspace,
        },
      };
    }

    if (!("focusOrderWindowIds" in root) || !("placements" in root)) {
      throw new TypeError("V2 snapshot is missing focus or placement state");
    }
    const focusOrderWindowIds = strictIdArray(root.focusOrderWindowIds, "focusOrderWindowIds", inventory);
    if (focusOrderWindowIds.length !== windowIds.length) {
      throw new TypeError("focus order must contain every window exactly once");
    }
    const activeWindowId = strictOptionalInventoryId(root.activeWindowId, inventory, "activeWindowId");
    if (activeWindowId && (minimizedWindowIds.includes(activeWindowId) || closedWindowIds.includes(activeWindowId))) {
      throw new TypeError("active window cannot also be hidden");
    }
    if (maximizedWindowId && activeWindowId !== maximizedWindowId) {
      throw new TypeError("maximized window must be the active window");
    }
    const placements = strictPlacementSnapshots(root.placements, inventory);
    if (placements.length !== windowIds.length) {
      throw new TypeError("placements must contain every window exactly once");
    }
    const activePlacement = activeWindowId
      ? placements.find((entry) => entry.id === activeWindowId)?.placement
      : undefined;
    if (activeWindowId && activePlacement === "tiled" && workspaceActiveWindowId(workspace) !== activeWindowId) {
      throw new TypeError("active tiled window must match workspace active pane");
    }
    if (activeWindowId && activePlacement === "floating") {
      const byId = new Map(placements.map((entry) => [entry.id, entry]));
      const activeEntry = byId.get(activeWindowId)!;
      const activeIndex = focusOrderWindowIds.indexOf(activeWindowId);
      for (let index = activeIndex + 1; index < focusOrderWindowIds.length; index += 1) {
        const later = byId.get(focusOrderWindowIds[index]!);
        if (later?.placement === "floating" && later.alwaysOnTop === activeEntry.alwaysOnTop) {
          throw new TypeError("active floating window must be frontmost in its z-order tier");
        }
      }
    }
    return {
      ok: true,
      snapshot: {
        version: MARKUP_WINDOW_SNAPSHOT_VERSION,
        compactMode,
        windowIds,
        minimizedWindowIds,
        closedWindowIds,
        maximizedWindowId,
        activeWindowId,
        focusOrderWindowIds,
        placements,
        modals,
        workspace,
      },
    };
  } catch {
    return { ok: false, status: "invalid", reason: "snapshot-schema-is-invalid" };
  }
}

function strictPlacementSnapshots(value: unknown, inventory: ReadonlySet<string>): MarkupWindowPlacementSnapshot[] {
  const values = strictDenseArray(value, "placements");
  if (values.length > MAX_WINDOW_SURFACES) throw new RangeError("too many placements");
  const result: MarkupWindowPlacementSnapshot[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const record = strictDataRecord(
      values[index],
      ["id", "placement", "floatingRect", "restoreRect", "snapTarget", "alwaysOnTop", "groupId"],
      ["id", "placement", "alwaysOnTop"],
      `placement ${index}`,
    );
    const id = strictInventoryId(record.id, inventory, `placement ${index} id`);
    if (ids.has(id)) throw new TypeError("duplicate placement id");
    ids.add(id);
    if (record.placement !== "tiled" && record.placement !== "floating") {
      throw new TypeError("invalid placement");
    }
    if (typeof record.alwaysOnTop !== "boolean") throw new TypeError("invalid alwaysOnTop");
    const floatingRect = record.floatingRect === undefined ? undefined : strictSnapshotRect(record.floatingRect);
    if (record.placement === "floating" && !floatingRect) throw new TypeError("floating placement requires rect");
    const restoreRect = record.restoreRect === undefined ? undefined : strictSnapshotRect(record.restoreRect);
    const snapTarget = record.snapTarget === undefined ? undefined : strictSnapTarget(record.snapTarget);
    if (snapTarget?.kind === "dock") {
      if (record.placement !== "tiled" || !inventory.has(snapTarget.targetId) || snapTarget.targetId === id) {
        throw new TypeError("dock snap requires a distinct tiled inventory target");
      }
    } else if (snapTarget && record.placement !== "floating") {
      throw new TypeError("workspace and corner snaps require floating placement");
    }
    const groupId = record.groupId === undefined ? undefined : strictGroupId(record.groupId);
    result.push({
      id,
      placement: record.placement,
      floatingRect,
      restoreRect,
      snapTarget,
      alwaysOnTop: record.alwaysOnTop,
      groupId,
    });
  }
  return result;
}

function strictSnapTarget(value: unknown): MarkupWindowSnapTarget {
  const record = strictDataRecord(value, ["kind", "edge", "corner", "targetId", "ratio"], ["kind"], "snapTarget");
  if (record.kind === "workspace") {
    if (
      !isTiledWorkspaceDockEdge(record.edge) || record.corner !== undefined || record.targetId !== undefined ||
      record.ratio !== undefined
    ) throw new TypeError("invalid workspace snap");
    return { kind: "workspace", edge: record.edge };
  }
  if (record.kind === "corner") {
    if (
      !isMarkupWindowCorner(record.corner) || record.edge !== undefined || record.targetId !== undefined ||
      record.ratio !== undefined
    ) throw new TypeError("invalid corner snap");
    return { kind: "corner", corner: record.corner };
  }
  if (record.kind === "dock") {
    const targetId = strictId(record.targetId, "dock targetId");
    if (!isTiledWorkspaceDockEdge(record.edge) || record.corner !== undefined) throw new TypeError("invalid dock snap");
    if (
      record.ratio !== undefined &&
      (typeof record.ratio !== "number" || !Number.isFinite(record.ratio) || record.ratio < 0.05 ||
        record.ratio > 0.95)
    ) throw new TypeError("invalid dock ratio");
    return record.ratio === undefined
      ? { kind: "dock", targetId, edge: record.edge }
      : { kind: "dock", targetId, edge: record.edge, ratio: record.ratio as number };
  }
  throw new TypeError("invalid snap kind");
}

function strictModalSnapshots(value: unknown): MarkupModalSnapshot[] {
  const values = strictDenseArray(value, "modals");
  if (values.length > MAX_WINDOW_SURFACES) throw new RangeError("too many modals");
  const result: MarkupModalSnapshot[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const record = strictDataRecord(values[index], ["id", "open"], ["id", "open"], `modal ${index}`);
    const id = strictId(record.id, `modal ${index} id`);
    if (ids.has(id) || typeof record.open !== "boolean") throw new TypeError("invalid modal snapshot");
    ids.add(id);
    result.push({ id, open: record.open });
  }
  return result;
}

function strictWorkspaceSnapshot(value: unknown): TiledWorkspaceSnapshot {
  const record = strictDataRecord(value, ["version", "gap", "layout"], ["version", "gap", "layout"], "workspace");
  if (record.version !== TILED_WORKSPACE_SNAPSHOT_VERSION) throw new TypeError("unsupported workspace version");
  if (!Number.isSafeInteger(record.gap) || (record.gap as number) < 0 || (record.gap as number) > MAX_WINDOW_CELL) {
    throw new TypeError("invalid workspace gap");
  }
  const layout = strictDataRecord(record.layout, ["root", "activePaneId"], [], "workspace layout");
  const ids = new Set<string>();
  const windowIds = new Set<string>();
  const seen = new WeakSet<object>();
  const count = { value: 0 };
  const root = layout.root === undefined ? undefined : strictWorkspaceNode(layout.root, 0, count, seen, ids, windowIds);
  let activePaneId: string | undefined;
  if (layout.activePaneId !== undefined) {
    activePaneId = strictId(layout.activePaneId, "activePaneId");
    if (!ids.has(activePaneId)) throw new TypeError("active pane is missing");
  }
  return {
    version: TILED_WORKSPACE_SNAPSHOT_VERSION,
    gap: record.gap as number,
    layout: { root, activePaneId },
  };
}

function strictWorkspaceNode(
  value: unknown,
  depth: number,
  count: { value: number },
  seen: WeakSet<object>,
  ids: Set<string>,
  windowIds: Set<string>,
): TiledWorkspaceLayoutNode {
  if (depth > MAX_WINDOW_LAYOUT_DEPTH || ++count.value > MAX_WINDOW_LAYOUT_NODES) {
    throw new RangeError("workspace layout limit exceeded");
  }
  if (!value || typeof value !== "object" || seen.has(value)) throw new TypeError("invalid or cyclic workspace node");
  seen.add(value);
  const record = strictDataRecord(
    value,
    ["kind", "id", "windowId", "minWidth", "minHeight", "direction", "ratio", "first", "second"],
    ["kind", "id"],
    "workspace node",
  );
  const id = strictId(record.id, "workspace node id");
  if (ids.has(id)) throw new TypeError("duplicate workspace node id");
  ids.add(id);
  if (record.kind === "pane") {
    const windowId = strictId(record.windowId, "workspace window id");
    if (
      windowIds.has(windowId) || record.direction !== undefined || record.ratio !== undefined ||
      record.first !== undefined || record.second !== undefined
    ) throw new TypeError("invalid workspace pane");
    windowIds.add(windowId);
    return {
      kind: "pane",
      id,
      windowId,
      minWidth: strictOptionalPositiveCell(record.minWidth, "pane minWidth"),
      minHeight: strictOptionalPositiveCell(record.minHeight, "pane minHeight"),
    };
  }
  if (
    record.kind !== "split" || (record.direction !== "row" && record.direction !== "column") ||
    typeof record.ratio !== "number" || !Number.isFinite(record.ratio) || record.ratio < 0.05 || record.ratio > 0.95 ||
    record.windowId !== undefined || record.minWidth !== undefined || record.minHeight !== undefined ||
    record.first === undefined || record.second === undefined
  ) throw new TypeError("invalid workspace split");
  return {
    kind: "split",
    id,
    direction: record.direction,
    ratio: record.ratio,
    first: strictWorkspaceNode(record.first, depth + 1, count, seen, ids, windowIds),
    second: strictWorkspaceNode(record.second, depth + 1, count, seen, ids, windowIds),
  };
}

function workspaceActiveWindowId(snapshot: TiledWorkspaceSnapshot): string | undefined {
  const paneId = snapshot.layout.activePaneId;
  if (!paneId || !snapshot.layout.root) return undefined;
  const stack: TiledWorkspaceLayoutNode[] = [snapshot.layout.root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === "pane") {
      if (node.id === paneId) return node.windowId;
    } else {
      stack.push(node.second, node.first);
    }
  }
  return undefined;
}

function workspacePaneIdForWindow(snapshot: TiledWorkspaceSnapshot, windowId: string): string | undefined {
  if (!snapshot.layout.root) return undefined;
  const stack: TiledWorkspaceLayoutNode[] = [snapshot.layout.root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === "pane") {
      if (node.windowId === windowId) return node.id;
    } else {
      stack.push(node.second, node.first);
    }
  }
  return undefined;
}

function strictSnapshotRect(value: unknown): Rectangle {
  const record = strictDataRecord(
    value,
    ["column", "row", "width", "height"],
    ["column", "row", "width", "height"],
    "rect",
  );
  const rect = finiteBoundedRect(record as unknown as Rectangle, false);
  if (!rect) throw new TypeError("invalid rect");
  return rect;
}

function strictIdArray(value: unknown, label: string, inventory?: ReadonlySet<string>): string[] {
  const values = strictDenseArray(value, label);
  if (values.length > MAX_WINDOW_SURFACES) throw new RangeError(`${label} is too large`);
  const result: string[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    const id = inventory ? strictInventoryId(value, inventory, label) : strictId(value, label);
    if (ids.has(id)) throw new TypeError(`${label} contains duplicates`);
    ids.add(id);
    result.push(id);
  }
  return result;
}

function strictOptionalInventoryId(
  value: unknown,
  inventory: ReadonlySet<string>,
  label: string,
): string | undefined {
  return value === undefined ? undefined : strictInventoryId(value, inventory, label);
}

function strictInventoryId(value: unknown, inventory: ReadonlySet<string>, label: string): string {
  const id = strictId(value, label);
  if (!inventory.has(id)) throw new TypeError(`${label} is outside the snapshot inventory`);
  return id;
}

function strictId(value: unknown, label: string): string {
  if (!validWindowId(value)) throw new TypeError(`${label} is invalid`);
  return value.trim();
}

function strictGroupId(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("group id must be a string");
  const id = normalizeGroupId(value);
  if (!id) throw new TypeError("group id is invalid");
  return id;
}

function strictOptionalPositiveCell(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > MAX_WINDOW_CELL) {
    throw new TypeError(`${label} is invalid`);
  }
  return value as number;
}

function strictCompactMode(value: unknown): MarkupWindowCompactMode {
  if (value !== "auto" && value !== "always" && value !== "never") throw new TypeError("invalid compact mode");
  return value;
}

function strictDenseArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${label} must be a plain array`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${label} must be dense data`);
    }
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
      throw new TypeError(`${label} has an unexpected property`);
    }
  }
  return value;
}

function strictDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== "string" || !allowed.has(key)) throw new TypeError(`${label} has an unexpected property`);
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${label} properties must be enumerable data`);
    }
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(record, key)) throw new TypeError(`${label} is missing ${key}`);
  }
  return record;
}

function actionResult(
  action: MarkupWindowAction,
  status: MarkupWindowActionStatus,
  id?: string,
  targetId?: string,
  reason?: string,
): MarkupWindowActionResult {
  const result: MarkupWindowActionResult = {
    action,
    status,
    ok: status === "applied" || status === "unchanged",
  };
  if (id !== undefined) result.id = id;
  if (targetId !== undefined) result.targetId = targetId;
  if (reason !== undefined) result.reason = reason;
  return result;
}

function cloneDiagnostic(diagnostic: MarkupWindowDiagnostic): MarkupWindowDiagnostic {
  return { ...diagnostic };
}

function cloneOverlaySurface(surface: OverlaySurfaceInspection): OverlaySurfaceInspection {
  return { ...surface, rect: cloneRect(surface.rect) };
}

function cloneRect(rect: Rectangle): Rectangle {
  return { column: rect.column, row: rect.row, width: rect.width, height: rect.height };
}

function normalizeRect(rect: Rectangle): Rectangle {
  return {
    column: Math.floor(finiteNumber(rect.column, 0)),
    row: Math.floor(finiteNumber(rect.row, 0)),
    width: Math.max(0, Math.floor(finiteNumber(rect.width, 0))),
    height: Math.max(0, Math.floor(finiteNumber(rect.height, 0))),
  };
}

function normalizeCompactMode(value: MarkupWindowCompactMode | undefined): MarkupWindowCompactMode {
  return value === "always" || value === "never" ? value : "auto";
}

function projectedVisibleWindowIds(
  requested: readonly string[] | undefined,
  eligible: readonly string[],
): string[] {
  if (requested === undefined) return eligible.slice();
  if (!Array.isArray(requested)) return [];
  const eligibleSet = new Set(eligible);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of requested) {
    if (typeof id !== "string" || !eligibleSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function numberAttribute(attributes: Record<string, string>, name: string): number | undefined {
  const value = attributes[name];
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanAttribute(
  attributes: Record<string, string>,
  name: string,
  fallback: boolean,
): boolean {
  if (!(name in attributes)) return fallback;
  const value = attributes[name]?.trim().toLowerCase();
  return value !== "false" && value !== "0" && value !== "no" && value !== "off";
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function finiteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
