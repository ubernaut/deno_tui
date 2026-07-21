// Copyright 2023 Im-Beast. MIT license.
import type { HistoryInspection, HistoryStack, HistoryTransactionOptions } from "../app/history.ts";
import type { OverlayStackController, OverlaySurfaceInspection } from "../layout/overlay.ts";
import {
  reconcileTiledWorkspaceLayout,
  type TiledWorkspaceController,
  type TiledWorkspaceDockEdge,
  type TiledWorkspaceLayoutNode,
  type TiledWorkspacePaneNode,
  type TiledWorkspaceWindow,
} from "../layout/tiled_workspace.ts";
import type { Rectangle } from "../types.ts";
import type {
  MarkupWindowAction,
  MarkupWindowActionResult,
  MarkupWindowController,
  MarkupWindowMoveDelta,
  MarkupWindowPlacement,
  MarkupWindowResizeEdge,
  MarkupWindowSnapshot,
  MarkupWindowSnapTarget,
  ProjectMarkupWindowsOptions,
  RecoverMarkupWindowBoundsOptions,
  SetMarkupWindowPlacementOptions,
} from "./windows.ts";

/** Window actions that can be executed and recorded by the history adapter. */
export type MarkupWindowHistoryAction = Exclude<MarkupWindowAction, "restore-snapshot">;

/** Clone-safe description of one adapter operation. */
export interface MarkupWindowHistoryOperationInspection {
  action: MarkupWindowHistoryAction;
  id?: string;
  targetId?: string;
  parameters?: Record<string, string | number>;
}

/** Clone-safe lifetime inspection for one window-history adapter. */
export interface MarkupWindowHistoryInspection {
  disposed: boolean;
  idPrefix: string;
  group: string;
  attemptedActions: number;
  recordedActions: number;
  skippedActions: number;
  failedActions: number;
  lastOperation?: MarkupWindowHistoryOperationInspection;
  lastResult?: MarkupWindowActionResult;
  lastEntry?: HistoryTransactionOptions;
  history: HistoryInspection;
}

/** Lifecycle state of one live window-history gesture. */
export type MarkupWindowHistoryGestureState =
  | "active"
  | "committed"
  | "cancelled"
  | "failed"
  | "unavailable";

/** Clone-safe inspection of one live or completed window-history gesture. */
export interface MarkupWindowHistoryGestureInspection {
  state: MarkupWindowHistoryGestureState;
  operation: MarkupWindowHistoryOperationInspection;
  changed?: boolean;
  reason?: string;
}

/**
 * One already-applied pointer or keyboard gesture awaiting a single history
 * decision. Live controller updates happen outside `HistoryStack`; commit
 * records their exact before/after snapshots once, while cancel restores the
 * original snapshot without recording an entry.
 */
export interface MarkupWindowHistoryGesture {
  commit(): boolean;
  cancel(): boolean;
  inspect(): MarkupWindowHistoryGestureInspection;
}

/** Why restoring an exact adapter snapshot failed. */
export type MarkupWindowHistoryRestoreFailure =
  | "controller-rejected"
  | "controller-threw"
  | "overlay-threw"
  | "managed-overlay-missing"
  | "active-overlay-missing"
  | "snapshot-mismatch";

/** Typed failure raised to HistoryStack when exact state restoration is impossible. */
export class MarkupWindowHistoryRestoreError extends Error {
  constructor(
    readonly code: MarkupWindowHistoryRestoreFailure,
    message: string,
    readonly result?: MarkupWindowActionResult,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MarkupWindowHistoryRestoreError";
  }
}

class MarkupWindowHistoryReplayConflictError extends MarkupWindowHistoryRestoreError {
  constructor(message: string) {
    super("snapshot-mismatch", message);
    this.name = "MarkupWindowHistoryReplayConflictError";
  }
}

/**
 * Snapshot restoration hook. Returning an `ok` result is only a claim: the
 * adapter independently captures and compares the resulting state.
 */
export type MarkupWindowSnapshotRestorer = (snapshot: MarkupWindowSnapshot) => MarkupWindowActionResult;

/** Options for the renderer-neutral window-history adapter. */
export interface MarkupWindowHistoryAdapterOptions {
  controller: MarkupWindowController;
  history: HistoryStack;
  idPrefix?: string;
  group?: string;
  /** Deterministic, side-effect-free label formatter invoked before an action is recorded. */
  label?: (operation: Readonly<MarkupWindowHistoryOperationInspection>) => string;
  /** Test/host seam for restoring controller snapshots; exact restoration is still verified. */
  restoreSnapshot?: MarkupWindowSnapshotRestorer;
}

interface ManagedOverlayHistorySnapshot {
  activeId?: string;
  /** Exact global focus when it belongs to a surface outside the managed roots. */
  externalActiveId?: string;
  nextOrder: number;
  rootIds: string[];
  registrations: Array<{ id: string; generation: number }>;
  surfaces: OverlaySurfaceInspection[];
}

interface MarkupWindowHistorySnapshot {
  controller: MarkupWindowSnapshot;
  workspaceRegistrations: Array<{ id: string; generation: number }>;
  overlays: ManagedOverlayHistorySnapshot;
}

interface SharedWindowHistoryLease {
  token: symbol;
  kind: "action" | "gesture" | "replay";
}

interface SharedWindowHistoryCoordinator {
  lease?: SharedWindowHistoryLease;
}

const MAX_HISTORY_TEXT_LENGTH = 128;
const MAX_HISTORY_LABEL_LENGTH = 512;
const MAX_HISTORY_PARAMETERS = 32;
const MAX_SEMANTIC_SURFACE_ID_LENGTH = 256;
const HISTORY_SEMANTIC_ID = Symbol("MarkupWindowHistorySemanticId");
const SHARED_WINDOW_HISTORY = new WeakMap<MarkupWindowController, SharedWindowHistoryCoordinator>();

/**
 * Executes MarkupWindowController actions and records exact before/after state
 * in an injected HistoryStack. It owns neither injected controller and uses no
 * renderer APIs, subscriptions, clocks, or timers.
 */
export class MarkupWindowHistoryAdapter {
  readonly controller: MarkupWindowController;
  readonly history: HistoryStack;

  readonly #idPrefix: string;
  readonly #group: string;
  readonly #label?: MarkupWindowHistoryAdapterOptions["label"];
  readonly #restoreControllerSnapshot: MarkupWindowSnapshotRestorer;
  readonly #coordinator: SharedWindowHistoryCoordinator;
  #disposed = false;
  #attemptedActions = 0;
  #recordedActions = 0;
  #skippedActions = 0;
  #failedActions = 0;
  #lastOperation?: MarkupWindowHistoryOperationInspection;
  #lastResult?: MarkupWindowActionResult;
  #lastEntry?: HistoryTransactionOptions;
  #activeGesture?: symbol;
  #activeGestureCancellation?: () => boolean;

  constructor(options: MarkupWindowHistoryAdapterOptions) {
    this.controller = options.controller;
    this.history = options.history;
    this.#idPrefix = normalizedText(options.idPrefix, "window", MAX_HISTORY_TEXT_LENGTH);
    this.#group = normalizedText(options.group, "windows", MAX_HISTORY_TEXT_LENGTH);
    this.#label = options.label;
    this.#coordinator = sharedWindowHistoryCoordinator(this.controller);
    this.#restoreControllerSnapshot = options.restoreSnapshot ??
      ((snapshot) => this.controller.restoreSnapshot(snapshot));
  }

  /** Cheap lifecycle probe for interaction hosts sharing this adapter. */
  get disposed(): boolean {
    return this.#disposed;
  }

  focus(id: string): MarkupWindowActionResult {
    const operation = windowOperation("focus", id);
    return this.#execute(operation, () => this.controller.focus(id));
  }

  move(id: string, delta: number): MarkupWindowActionResult {
    const operation = windowOperation("move", id, undefined, { delta });
    return this.#execute(operation, () => this.controller.move(id, delta));
  }

  swap(firstId: string, secondId: string): MarkupWindowActionResult {
    const operation = windowOperation("swap", firstId, secondId);
    return this.#execute(operation, () => this.controller.swap(firstId, secondId));
  }

  dock(
    sourceId: string,
    targetId: string,
    edge: TiledWorkspaceDockEdge,
    options: { ratio?: number } = {},
  ): MarkupWindowActionResult {
    const parameters: Record<string, string | number> = { edge };
    if (options.ratio !== undefined) parameters.ratio = options.ratio;
    const operation = windowOperation("dock", sourceId, targetId, parameters);
    return this.#execute(operation, () => this.controller.dock(sourceId, targetId, edge, options));
  }

  resize(
    splitId: string,
    delta: number,
    bounds: Rectangle,
    options: ProjectMarkupWindowsOptions = {},
  ): MarkupWindowActionResult {
    const parameters: Record<string, string | number> = {
      delta,
      column: bounds.column,
      row: bounds.row,
      width: bounds.width,
      height: bounds.height,
    };
    if (options.gap !== undefined) parameters.gap = options.gap;
    if (options.separatorHitSize !== undefined) parameters.separatorHitSize = options.separatorHitSize;
    if (options.compactMode !== undefined) parameters.compactMode = options.compactMode;
    const operation = windowOperation("resize", splitId, undefined, parameters);
    return this.#execute(operation, () => this.controller.resize(splitId, delta, bounds, options));
  }

  resizeRatio(splitId: string, delta: number): MarkupWindowActionResult {
    const operation = windowOperation("resize-ratio", splitId, undefined, { delta });
    return this.#execute(operation, () => this.controller.resizeRatio(splitId, delta));
  }

  minimize(id: string): MarkupWindowActionResult {
    const operation = windowOperation("minimize", id);
    return this.#execute(operation, () => this.controller.minimize(id));
  }

  maximize(id: string): MarkupWindowActionResult {
    const operation = windowOperation("maximize", id);
    return this.#execute(operation, () => this.controller.maximize(id));
  }

  restore(id: string): MarkupWindowActionResult {
    const operation = windowOperation("restore", id);
    return this.#execute(operation, () => this.controller.restore(id));
  }

  close(id: string): MarkupWindowActionResult {
    const operation = windowOperation("close", id);
    return this.#execute(operation, () => this.controller.close(id));
  }

  /** Switches one window between tiled and floating placement as one history entry. */
  setPlacement(
    id: string,
    placement: MarkupWindowPlacement,
    options: SetMarkupWindowPlacementOptions = {},
  ): MarkupWindowActionResult {
    const operation = windowOperation("set-placement", id, undefined, {
      placement,
      ...optionalRectangleParameters(options.rect),
    });
    return this.#execute(operation, () => this.controller.setPlacement(id, placement, options));
  }

  /** Replaces one floating rectangle as one history entry. */
  setFloatingRect(id: string, rect: Rectangle): MarkupWindowActionResult {
    const operation = windowOperation("set-floating-rect", id, undefined, rectangleParameters(rect));
    return this.#execute(operation, () => this.controller.setFloatingRect(id, rect));
  }

  /** Moves one floating window or group by a cell delta as one history entry. */
  moveBy(id: string, delta: MarkupWindowMoveDelta): MarkupWindowActionResult {
    const operation = windowOperation("move-by", id, undefined, deltaParameters(delta));
    return this.#execute(operation, () => this.controller.moveBy(id, delta));
  }

  /** Resizes one floating edge or corner as one history entry. */
  resizeWindow(
    id: string,
    edge: MarkupWindowResizeEdge,
    delta: MarkupWindowMoveDelta,
  ): MarkupWindowActionResult {
    const operation = windowOperation("resize-window", id, undefined, { edge, ...deltaParameters(delta) });
    return this.#execute(operation, () => this.controller.resizeWindow(id, edge, delta));
  }

  /** Applies a workspace, corner, or dock snap as one history entry. */
  snap(
    id: string,
    target: MarkupWindowSnapTarget,
    bounds: Rectangle,
  ): MarkupWindowActionResult {
    const targetId = target.kind === "dock" ? target.targetId : undefined;
    const parameters: Record<string, string | number> = {
      targetKind: target.kind,
      ...rectangleParameters(bounds, "bounds"),
    };
    if (target.kind === "corner") parameters.corner = target.corner;
    else parameters.edge = target.edge;
    if (target.kind === "dock" && target.ratio !== undefined) parameters.ratio = target.ratio;
    const operation = windowOperation("snap", id, targetId, parameters);
    return this.#execute(operation, () => this.controller.snap(id, target, bounds));
  }

  /** Changes one window's always-on-top tier as one history entry. */
  setAlwaysOnTop(id: string, value: boolean): MarkupWindowActionResult {
    const operation = windowOperation("set-always-on-top", id, undefined, { value: value ? 1 : 0 });
    return this.#execute(operation, () => this.controller.setAlwaysOnTop(id, value));
  }

  /** Assigns or clears one floating movement group as one history entry. */
  setGroup(id: string, groupId?: string): MarkupWindowActionResult {
    const operation = windowOperation("set-group", id, undefined, { groupId: groupId ?? "" });
    return this.#execute(operation, () => this.controller.setGroup(id, groupId));
  }

  /** Recovers floating chrome into viewport bounds as one history entry. */
  recoverBounds(
    id: string,
    bounds: Rectangle,
    options: RecoverMarkupWindowBoundsOptions = {},
  ): MarkupWindowActionResult {
    const parameters: Record<string, string | number> = rectangleParameters(bounds, "bounds");
    if (options.margin !== undefined) parameters.margin = options.margin;
    if (options.titleBarHeight !== undefined) parameters.titleBarHeight = options.titleBarHeight;
    const operation = windowOperation("recover-bounds", id, undefined, parameters);
    return this.#execute(operation, () => this.controller.recoverBounds(id, bounds, options));
  }

  /**
   * Begins one live gesture whose controller updates are already applied by the
   * caller. Only one gesture or adapter action may be active for a shared
   * controller across every adapter. A successful commit pushes one exact
   * before/after transaction without replaying the updates. Hosts must defer
   * direct controller mutations (including its shared workspace/overlay
   * signals) and HistoryStack mutations until the gesture finishes.
   */
  beginGesture(operation: MarkupWindowHistoryOperationInspection): MarkupWindowHistoryGesture {
    const normalized = normalizeHistoryOperation(operation);
    this.#attemptedActions += 1;
    this.#lastOperation = cloneOperation(normalized);
    this.#lastEntry = undefined;

    if (
      this.#disposed || this.controller.disposed || this.controller.mutationInProgress || this.#coordinator.lease
    ) {
      const reason = this.#disposed
        ? "window-history-adapter-disposed"
        : this.controller.disposed
        ? "window-controller-disposed"
        : this.controller.mutationInProgress
        ? "window-controller-mutation-in-progress"
        : sharedLeaseReason(this.#coordinator.lease!.kind);
      this.#skippedActions += 1;
      this.#lastResult = gestureUnavailableResult(
        normalized,
        reason,
        this.#disposed || this.controller.disposed ? "disposed" : "blocked",
      );
      return inertGesture(normalized, reason);
    }

    const token = Symbol("MarkupWindowHistoryGesture");
    this.#coordinator.lease = { token, kind: "gesture" };
    this.#activeGesture = token;
    let before: MarkupWindowHistorySnapshot;
    try {
      before = cloneHistorySnapshot(this.#captureSnapshot());
    } catch (error) {
      if (this.#activeGesture === token) this.#activeGesture = undefined;
      this.#activeGestureCancellation = undefined;
      if (this.#coordinator.lease?.token === token) this.#coordinator.lease = undefined;
      this.#failedActions += 1;
      throw error;
    }
    const preserveExternalFocus = shouldPreserveExternalFocus(normalized, before);
    let state: MarkupWindowHistoryGestureState = "active";
    let changed: boolean | undefined;
    let reason: string | undefined;
    let settling: "commit" | "cancel" | undefined;
    let cancelRequested = false;

    const finish = (nextState: MarkupWindowHistoryGestureState): void => {
      state = nextState;
      if (this.#activeGesture === token) this.#activeGesture = undefined;
      this.#activeGestureCancellation = undefined;
      if (this.#coordinator.lease?.token === token) this.#coordinator.lease = undefined;
    };
    const fail = (error: unknown): never => {
      this.#failedActions += 1;
      this.#lastEntry = undefined;
      reason = errorMessage(error);
      finish("failed");
      throw error;
    };

    const gesture: MarkupWindowHistoryGesture = Object.freeze({
      commit: (): boolean => {
        if (state !== "active" || settling) return false;
        settling = "commit";
        try {
          if (this.#disposed) {
            try {
              const current = cloneHistorySnapshot(this.#captureSnapshot());
              this.#restoreSnapshotWithCompensation(
                gestureCancellationTarget(before, current, normalized),
                current,
                preserveExternalFocus,
              );
            } catch (error) {
              return fail(error);
            }
            changed = false;
            reason = "window-history-adapter-disposed";
            this.#skippedActions += 1;
            this.#lastResult = unavailableResult(normalized, reason);
            finish("cancelled");
            return false;
          }

          let after: MarkupWindowHistorySnapshot;
          try {
            after = cloneHistorySnapshot(this.#captureSnapshot());
          } catch (error) {
            return fail(error);
          }
          changed = !historySnapshotsEqual(before, after);
          if (!changed) {
            this.#skippedActions += 1;
            this.#lastResult = gestureResult(normalized, "unchanged", "gesture-produced-no-state-change");
            finish("committed");
            return false;
          }

          let entry: HistoryTransactionOptions;
          try {
            entry = this.#metadata(normalized);
            if (state !== "active" || this.#coordinator.lease?.token !== token) return false;
            const afterMetadata = cloneHistorySnapshot(this.#captureSnapshot());
            if (cancelRequested) {
              this.#restoreSnapshotWithCompensation(
                gestureCancellationTarget(before, afterMetadata, normalized),
                afterMetadata,
                preserveExternalFocus,
              );
              changed = false;
              reason = "gesture-cancelled-during-commit";
              this.#skippedActions += 1;
              this.#lastResult = gestureResult(normalized, "unchanged", reason);
              finish("cancelled");
              return false;
            }
            if (!historySnapshotsEqual(after, afterMetadata)) {
              this.#restoreSnapshotWithCompensation(before, afterMetadata, preserveExternalFocus);
              throw new Error("window-history-metadata-mutated-managed-state");
            }
            const undoSnapshot = cloneHistorySnapshot(before);
            const redoSnapshot = cloneHistorySnapshot(after);
            const replay = this.#replayPair(undoSnapshot, redoSnapshot, preserveExternalFocus, token);
            this.history.push({
              ...entry,
              ...replay,
            });
          } catch (error) {
            if (state !== "active") return false;
            try {
              this.#restoreSnapshotWithCompensation(before, after, preserveExternalFocus);
            } catch (restoreError) {
              return fail(combinedGestureError(error, restoreError));
            }
            return fail(error);
          }

          this.#recordedActions += 1;
          this.#lastEntry = { ...entry };
          this.#lastResult = gestureResult(normalized, "applied");
          finish("committed");
          return true;
        } finally {
          settling = undefined;
        }
      },
      cancel: (): boolean => {
        if (state !== "active") return false;
        if (settling === "commit") {
          cancelRequested = true;
          return false;
        }
        if (settling) return false;
        settling = "cancel";
        try {
          const current = cloneHistorySnapshot(this.#captureSnapshot());
          if (!historySnapshotsEqual(before, current)) {
            this.#restoreSnapshotWithCompensation(
              gestureCancellationTarget(before, current, normalized),
              current,
              preserveExternalFocus,
            );
          }
        } catch (error) {
          return fail(error);
        } finally {
          settling = undefined;
        }
        changed = false;
        reason = "gesture-cancelled";
        this.#skippedActions += 1;
        this.#lastResult = gestureResult(normalized, "unchanged", reason);
        finish("cancelled");
        return true;
      },
      inspect: (): MarkupWindowHistoryGestureInspection => ({
        state,
        operation: cloneOperation(normalized),
        ...(changed === undefined ? {} : { changed }),
        ...(reason === undefined ? {} : { reason }),
      }),
    });
    this.#activeGestureCancellation = gesture.cancel;
    return gesture;
  }

  /** Clone-safe counters and last-operation diagnostics. */
  inspect(): MarkupWindowHistoryInspection {
    return {
      disposed: this.#disposed,
      idPrefix: this.#idPrefix,
      group: this.#group,
      attemptedActions: this.#attemptedActions,
      recordedActions: this.#recordedActions,
      skippedActions: this.#skippedActions,
      failedActions: this.#failedActions,
      lastOperation: this.#lastOperation ? structuredClone(this.#lastOperation) : undefined,
      lastResult: this.#lastResult ? { ...this.#lastResult } : undefined,
      lastEntry: this.#lastEntry ? { ...this.#lastEntry } : undefined,
      history: this.history.inspect(),
    };
  }

  /** Stops new adapter actions without disposing the injected controller or history. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#activeGestureCancellation?.();
  }

  #execute(
    operation: MarkupWindowHistoryOperationInspection,
    execute: () => MarkupWindowActionResult,
  ): MarkupWindowActionResult {
    this.#attemptedActions += 1;
    this.#lastOperation = structuredClone(operation);
    if (this.#disposed) {
      const result = unavailableResult(operation, "window-history-adapter-disposed");
      this.#skippedActions += 1;
      this.#lastResult = result;
      this.#lastEntry = undefined;
      return result;
    }
    if (this.controller.disposed) {
      const result = unavailableResult(operation, "window-controller-disposed");
      this.#skippedActions += 1;
      this.#lastResult = result;
      this.#lastEntry = undefined;
      return result;
    }
    if (this.controller.mutationInProgress) {
      const result = gestureUnavailableResult(operation, "window-controller-mutation-in-progress", "blocked");
      this.#skippedActions += 1;
      this.#lastResult = result;
      this.#lastEntry = undefined;
      return result;
    }
    if (this.#coordinator.lease) {
      const reason = sharedLeaseReason(this.#coordinator.lease.kind);
      const result = gestureUnavailableResult(operation, reason, "blocked");
      this.#skippedActions += 1;
      this.#lastResult = result;
      this.#lastEntry = undefined;
      return result;
    }

    const token = Symbol("MarkupWindowHistoryAction");
    this.#coordinator.lease = { token, kind: "action" };
    let entry: HistoryTransactionOptions | undefined;
    let result: MarkupWindowActionResult | undefined;
    let recorded = false;
    let before: MarkupWindowHistorySnapshot | undefined;
    let preserveExternalFocus = true;
    try {
      before = cloneHistorySnapshot(this.#captureSnapshot());
      preserveExternalFocus = shouldPreserveExternalFocus(operation, before);
      entry = this.#metadata(operation);
      const afterMetadata = cloneHistorySnapshot(this.#captureSnapshot());
      if (!historySnapshotsEqual(before, afterMetadata)) {
        this.#restoreSnapshotWithCompensation(before, afterMetadata, preserveExternalFocus);
        throw new Error("window-history-metadata-mutated-managed-state");
      }
      const actionBefore = before;
      const actionEntry = entry;
      this.history.transactionSync(actionEntry, (scope) => {
        const undoSnapshot = cloneHistorySnapshot(actionBefore);
        let effectiveUndo = cloneHistorySnapshot(undoSnapshot);
        let firstRedo = true;
        let redoSnapshot: MarkupWindowHistorySnapshot | undefined;
        let effectiveRedo: MarkupWindowHistorySnapshot | undefined;
        let restoreBefore = true;
        let undoCompensation: "noop" | "restore" | undefined;
        let redoCompensation: "noop" | "restore" | undefined;
        scope.apply({
          ...actionEntry,
          undo: () => {
            if (undoCompensation) {
              const compensation = undoCompensation;
              undoCompensation = undefined;
              if (compensation === "restore") {
                effectiveUndo = this.#restoreReplaySnapshot(
                  effectiveUndo,
                  undefined,
                  preserveExternalFocus,
                  token,
                );
              }
              return;
            }
            if (!restoreBefore) return;
            try {
              effectiveUndo = this.#restoreReplaySnapshot(
                undoSnapshot,
                effectiveRedo,
                preserveExternalFocus,
                token,
              );
            } catch (error) {
              redoCompensation = error instanceof MarkupWindowHistoryReplayConflictError ? "noop" : "restore";
              throw error;
            }
          },
          redo: () => {
            if (redoCompensation) {
              const compensation = redoCompensation;
              redoCompensation = undefined;
              if (compensation === "restore" && effectiveRedo) {
                effectiveRedo = this.#restoreReplaySnapshot(
                  effectiveRedo,
                  undefined,
                  preserveExternalFocus,
                  token,
                );
              }
              return;
            }
            if (firstRedo) {
              firstRedo = false;
              result = execute();
              redoSnapshot = cloneHistorySnapshot(this.#captureSnapshot());
              effectiveRedo = cloneHistorySnapshot(redoSnapshot);
              restoreBefore = !historySnapshotsEqual(undoSnapshot, redoSnapshot);
              return;
            }
            if (!redoSnapshot) {
              throw new Error(`Window action ${operation.action} has no captured redo snapshot.`);
            }
            try {
              effectiveRedo = this.#restoreReplaySnapshot(
                redoSnapshot,
                effectiveUndo,
                preserveExternalFocus,
                token,
              );
            } catch (error) {
              undoCompensation = error instanceof MarkupWindowHistoryReplayConflictError ? "noop" : "restore";
              throw error;
            }
          },
        });

        if (result?.status !== "applied" || !restoreBefore) {
          if (result?.status === "applied") {
            result = { ...result, status: "unchanged", ok: true };
          }
          scope.discard();
          return;
        }
        recorded = true;
      });
    } catch (error) {
      let failure = error;
      if (before && !this.history.isPoisoned()) {
        try {
          const current = cloneHistorySnapshot(this.#captureSnapshot());
          if (!historySnapshotsEqual(before, current)) {
            this.#restoreSnapshotWithCompensation(before, current, preserveExternalFocus);
          }
        } catch (restoreError) {
          failure = combinedGestureError(error, restoreError);
        }
      }
      this.#failedActions += 1;
      this.#lastResult = result ? { ...result } : undefined;
      this.#lastEntry = undefined;
      throw failure;
    } finally {
      if (this.#coordinator.lease?.token === token) this.#coordinator.lease = undefined;
    }

    const completed = result ?? unavailableResult(operation, "controller-returned-no-result");
    this.#lastResult = { ...completed };
    if (recorded) {
      this.#recordedActions += 1;
      this.#lastEntry = { ...entry! };
    } else {
      this.#skippedActions += 1;
      this.#lastEntry = undefined;
    }
    return completed;
  }

  #metadata(operation: MarkupWindowHistoryOperationInspection): HistoryTransactionOptions {
    const customLabel = normalizedText(
      this.#label?.(cloneOperation(operation)),
      "",
      MAX_HISTORY_LABEL_LENGTH,
    );
    return {
      id: operationHistoryId(this.#idPrefix, operation),
      label: customLabel || boundedHistoryLabel(defaultOperationLabel(operation)),
      group: this.#group,
    };
  }

  #captureSnapshot(): MarkupWindowHistorySnapshot {
    const controller = structuredClone(this.controller.snapshot());
    const managedRootIds = this.controller.inspect().modals.filter((modal) => modal.registered).map((modal) =>
      modal.id
    );
    return {
      controller,
      workspaceRegistrations: controller.windowIds.map((id) => ({
        id,
        generation: this.controller.workspace.windowRegistrationGeneration(id)!,
      })),
      overlays: captureManagedOverlaySnapshot(
        managedRootIds,
        this.controller.overlays,
        this.controller.overlays.snapshot(),
      ),
    };
  }

  #restoreSnapshot(
    snapshot: MarkupWindowHistorySnapshot,
    expectedCurrent?: MarkupWindowHistorySnapshot,
    preserveExternalFocus = false,
  ): MarkupWindowHistorySnapshot {
    const activeMutationRevision = this.controller.overlays.activeMutationRevision();
    const liveOverlays = this.controller.overlays.snapshot();
    const liveOverlayGenerations = new Map(
      liveOverlays.surfaces.map((surface) => [
        surface.id,
        this.controller.overlays.registrationGeneration(surface.id),
      ]),
    );
    const effectiveSnapshot = cloneHistorySnapshot(snapshot);
    preserveWorkspaceRegistrationTakeovers(
      effectiveSnapshot,
      expectedCurrent,
      this.controller.workspace,
    );
    preserveOverlayRegistrationTakeovers(
      effectiveSnapshot.overlays,
      expectedCurrent?.overlays,
      liveOverlays,
      this.controller.overlays,
    );
    preserveOverlayFocus(
      effectiveSnapshot.overlays,
      expectedCurrent?.overlays,
      liveOverlays,
      preserveExternalFocus,
    );
    let result: MarkupWindowActionResult;
    try {
      result = this.#restoreControllerSnapshot(structuredClone(effectiveSnapshot.controller));
    } catch (error) {
      throw new MarkupWindowHistoryRestoreError(
        "controller-threw",
        "Markup window controller threw while restoring a history snapshot.",
        undefined,
        error,
      );
    }
    if (!result.ok) {
      throw new MarkupWindowHistoryRestoreError(
        "controller-rejected",
        `Markup window controller rejected history restoration with status ${result.status}.`,
        { ...result },
      );
    }

    preserveWorkspaceRegistrationTakeovers(
      effectiveSnapshot,
      expectedCurrent,
      this.controller.workspace,
    );
    const refreshedOverlays = this.controller.overlays.snapshot();
    preserveOverlayRegistrationTakeovers(
      effectiveSnapshot.overlays,
      expectedCurrent?.overlays,
      refreshedOverlays,
      this.controller.overlays,
    );
    preserveLateOverlayFocus(
      effectiveSnapshot.overlays,
      liveOverlays,
      liveOverlayGenerations,
      refreshedOverlays,
      this.controller.overlays,
    );

    try {
      restoreManagedOverlaySnapshot(this.controller.overlays, effectiveSnapshot.overlays, refreshedOverlays);
      if (this.controller.overlays.activeMutationRevision() !== activeMutationRevision) {
        const finalOverlays = this.controller.overlays.snapshot();
        const externallyAssignedActiveId = this.controller.overlays.lastExternallyAssignedActiveId();
        const activeId = externallyAssignedActiveId && finalOverlays.surfaces.some((surface) =>
            surface.id === externallyAssignedActiveId
          )
          ? externallyAssignedActiveId
          : undefined;
        this.controller.overlays.synchronizeActiveId(activeId);
        const settledOverlays = this.controller.overlays.snapshot();
        assignOverlayFocus(
          effectiveSnapshot.overlays,
          settledOverlays.activeId,
          collectManagedOverlayIds(settledOverlays.surfaces, effectiveSnapshot.overlays.rootIds),
        );
      }
    } catch (error) {
      throw new MarkupWindowHistoryRestoreError(
        "overlay-threw",
        "Overlay stack threw while restoring managed window-history surfaces.",
        undefined,
        error,
      );
    }

    const restored = this.#captureSnapshot();
    if (!historySnapshotsEqual(restored, effectiveSnapshot)) {
      throw new MarkupWindowHistoryRestoreError(
        "snapshot-mismatch",
        "Markup window history restoration did not reproduce the required exact snapshot.",
      );
    }
    return cloneHistorySnapshot(restored);
  }

  #restoreReplaySnapshot(
    snapshot: MarkupWindowHistorySnapshot,
    expectedCurrent: MarkupWindowHistorySnapshot | undefined,
    preserveExternalFocus: boolean,
    allowedLeaseToken?: symbol,
  ): MarkupWindowHistorySnapshot {
    if (this.#coordinator.lease) {
      if (this.#coordinator.lease.token === allowedLeaseToken) {
        return this.#restoreSnapshot(snapshot, expectedCurrent, preserveExternalFocus);
      }
      throw new MarkupWindowHistoryReplayConflictError(
        `Markup window replay is blocked by ${sharedLeaseReason(this.#coordinator.lease.kind)}.`,
      );
    }
    if (expectedCurrent) {
      let liveController: MarkupWindowSnapshot;
      try {
        liveController = this.controller.snapshot();
      } catch (error) {
        throw new MarkupWindowHistoryRestoreError(
          "controller-threw",
          "Markup window controller threw while checking replay ownership.",
          undefined,
          error,
        );
      }
      if (JSON.stringify(liveController) !== JSON.stringify(expectedCurrent.controller)) {
        throw new MarkupWindowHistoryReplayConflictError(
          "Markup window replay was rejected because managed controller or shared workspace state diverged.",
        );
      }
    }
    const token = Symbol("MarkupWindowHistoryReplay");
    this.#coordinator.lease = { token, kind: "replay" };
    try {
      return this.#restoreSnapshot(snapshot, expectedCurrent, preserveExternalFocus);
    } finally {
      if (this.#coordinator.lease?.token === token) this.#coordinator.lease = undefined;
    }
  }

  #replayPair(
    undoSnapshot: MarkupWindowHistorySnapshot,
    redoSnapshot: MarkupWindowHistorySnapshot,
    preserveExternalFocus: boolean,
    allowedLeaseToken?: symbol,
  ): Pick<HistoryTransactionOptions & { undo: () => void; redo: () => void }, "undo" | "redo"> {
    let effectiveUndo = cloneHistorySnapshot(undoSnapshot);
    let effectiveRedo = cloneHistorySnapshot(redoSnapshot);
    let undoCompensation: "noop" | "restore" | undefined;
    let redoCompensation: "noop" | "restore" | undefined;
    return {
      undo: () => {
        if (undoCompensation) {
          const compensation = undoCompensation;
          undoCompensation = undefined;
          if (compensation === "restore") {
            effectiveUndo = this.#restoreReplaySnapshot(
              effectiveUndo,
              undefined,
              preserveExternalFocus,
              allowedLeaseToken,
            );
          }
          return;
        }
        try {
          effectiveUndo = this.#restoreReplaySnapshot(
            undoSnapshot,
            effectiveRedo,
            preserveExternalFocus,
            allowedLeaseToken,
          );
        } catch (error) {
          redoCompensation = error instanceof MarkupWindowHistoryReplayConflictError ? "noop" : "restore";
          throw error;
        }
      },
      redo: () => {
        if (redoCompensation) {
          const compensation = redoCompensation;
          redoCompensation = undefined;
          if (compensation === "restore") {
            effectiveRedo = this.#restoreReplaySnapshot(
              effectiveRedo,
              undefined,
              preserveExternalFocus,
              allowedLeaseToken,
            );
          }
          return;
        }
        try {
          effectiveRedo = this.#restoreReplaySnapshot(
            redoSnapshot,
            effectiveUndo,
            preserveExternalFocus,
            allowedLeaseToken,
          );
        } catch (error) {
          undoCompensation = error instanceof MarkupWindowHistoryReplayConflictError ? "noop" : "restore";
          throw error;
        }
      },
    };
  }

  #restoreSnapshotWithCompensation(
    target: MarkupWindowHistorySnapshot,
    compensation: MarkupWindowHistorySnapshot,
    preserveExternalFocus = false,
  ): void {
    try {
      this.#restoreSnapshot(target, compensation, preserveExternalFocus);
    } catch (error) {
      try {
        this.#restoreSnapshot(compensation, target, preserveExternalFocus);
      } catch (compensationError) {
        throw combinedGestureError(error, compensationError);
      }
      throw error;
    }
  }
}

/** Creates a host-neutral history adapter around injected shared controllers. */
export function createMarkupWindowHistoryAdapter(
  options: MarkupWindowHistoryAdapterOptions,
): MarkupWindowHistoryAdapter {
  return new MarkupWindowHistoryAdapter(options);
}

function sharedWindowHistoryCoordinator(controller: MarkupWindowController): SharedWindowHistoryCoordinator {
  let coordinator = SHARED_WINDOW_HISTORY.get(controller);
  if (!coordinator) {
    coordinator = {};
    SHARED_WINDOW_HISTORY.set(controller, coordinator);
  }
  return coordinator;
}

function sharedLeaseReason(kind: SharedWindowHistoryLease["kind"]): string {
  if (kind === "gesture") return "window-history-gesture-active";
  if (kind === "replay") return "window-history-replay-active";
  return "window-history-operation-active";
}

function shouldPreserveExternalFocus(
  operation: MarkupWindowHistoryOperationInspection,
  snapshot: MarkupWindowHistorySnapshot,
): boolean {
  const semanticId = (operation as MarkupWindowHistoryOperationInspection & { [HISTORY_SEMANTIC_ID]?: string })[
    HISTORY_SEMANTIC_ID
  ] ?? operation.id;
  const targetsManagedModal = semanticId !== undefined && snapshot.overlays.rootIds.includes(semanticId);
  return !targetsManagedModal ||
    (operation.action !== "focus" && operation.action !== "close" && operation.action !== "restore");
}

function windowOperation(
  action: MarkupWindowHistoryAction,
  id?: string,
  targetId?: string,
  parameters?: Record<string, string | number>,
): MarkupWindowHistoryOperationInspection {
  return normalizeHistoryOperation({
    action,
    id,
    targetId,
    parameters: parameters ? { ...parameters } : undefined,
  });
}

function unavailableResult(
  operation: MarkupWindowHistoryOperationInspection,
  reason: string,
): MarkupWindowActionResult {
  return {
    action: operation.action,
    status: "disposed",
    ok: false,
    id: operation.id,
    targetId: operation.targetId,
    reason,
  };
}

function gestureUnavailableResult(
  operation: MarkupWindowHistoryOperationInspection,
  reason: string,
  status: "blocked" | "disposed",
): MarkupWindowActionResult {
  return {
    action: operation.action,
    status,
    ok: false,
    id: operation.id,
    targetId: operation.targetId,
    reason,
  };
}

function operationHistoryId(
  prefix: string,
  operation: MarkupWindowHistoryOperationInspection,
): string {
  const parts = [prefix, operation.action];
  if (operation.id) parts.push(historyIdPart(operation.id));
  if (operation.targetId) parts.push(historyIdPart(operation.targetId));
  if (operation.action === "dock" && operation.parameters?.edge) {
    parts.push(historyIdPart(String(operation.parameters.edge)));
  }
  return parts.join(".");
}

function defaultOperationLabel(operation: MarkupWindowHistoryOperationInspection): string {
  const id = quoted(operation.id ?? "unknown");
  const target = quoted(operation.targetId ?? "unknown");
  switch (operation.action) {
    case "focus":
      return `Focus surface ${id}`;
    case "move":
      return `Move window ${id}`;
    case "swap":
      return `Swap windows ${id} and ${target}`;
    case "dock":
      return `Dock window ${id} ${String(operation.parameters?.edge ?? "beside")} ${target}`;
    case "resize":
      return `Resize split ${id}`;
    case "resize-ratio":
      return `Resize split ratio ${id}`;
    case "minimize":
      return `Minimize surface ${id}`;
    case "maximize":
      return `Maximize window ${id}`;
    case "restore":
      return `Restore surface ${id}`;
    case "close":
      return `Close surface ${id}`;
    case "set-placement":
      return `${operation.parameters?.placement === "floating" ? "Float" : "Tile"} window ${id}`;
    case "set-floating-rect":
      return `Set floating rectangle ${id}`;
    case "move-by":
      return `Move floating window ${id}`;
    case "resize-window":
      return `Resize floating window ${id}`;
    case "snap":
      return `Snap window ${id}`;
    case "set-always-on-top":
      return `${operation.parameters?.value === 1 ? "Pin" : "Unpin"} window ${id}`;
    case "set-group":
      return `${operation.parameters?.groupId ? "Group" : "Ungroup"} window ${id}`;
    case "recover-bounds":
      return `Recover window bounds ${id}`;
    default:
      return `Update window ${id}`;
  }
}

function rectangleParameters(rect: Rectangle, prefix = ""): Record<string, number> {
  const name = (field: string): string => prefix ? `${prefix}${field[0]!.toUpperCase()}${field.slice(1)}` : field;
  return {
    [name("column")]: rect.column,
    [name("row")]: rect.row,
    [name("width")]: rect.width,
    [name("height")]: rect.height,
  };
}

function optionalRectangleParameters(rect: Rectangle | undefined): Record<string, number> {
  return rect ? rectangleParameters(rect) : {};
}

function deltaParameters(delta: MarkupWindowMoveDelta): Record<string, number> {
  return { columns: delta.columns, rows: delta.rows };
}

function cloneHistorySnapshot(snapshot: MarkupWindowHistorySnapshot): MarkupWindowHistorySnapshot {
  return structuredClone(snapshot);
}

function gestureCancellationTarget(
  before: MarkupWindowHistorySnapshot,
  current: MarkupWindowHistorySnapshot,
  operation: MarkupWindowHistoryOperationInspection,
): MarkupWindowHistorySnapshot {
  const target = cloneHistorySnapshot(before);
  if (operation.action !== "move-by" && operation.action !== "resize-window") return target;
  target.controller.workspace = structuredClone(current.controller.workspace);
  target.controller.modals = current.controller.modals.map((modal) => ({ ...modal }));
  target.overlays = structuredClone(current.overlays);
  return target;
}

function historySnapshotsEqual(
  left: MarkupWindowHistorySnapshot,
  right: MarkupWindowHistorySnapshot,
): boolean {
  return JSON.stringify(left.controller) === JSON.stringify(right.controller) &&
    JSON.stringify(left.workspaceRegistrations) === JSON.stringify(right.workspaceRegistrations) &&
    JSON.stringify({
        activeId: left.overlays.activeId,
        externalActiveId: left.overlays.externalActiveId,
        rootIds: left.overlays.rootIds,
        registrations: left.overlays.registrations,
        surfaces: left.overlays.surfaces,
      }) ===
      JSON.stringify({
        activeId: right.overlays.activeId,
        externalActiveId: right.overlays.externalActiveId,
        rootIds: right.overlays.rootIds,
        registrations: right.overlays.registrations,
        surfaces: right.overlays.surfaces,
      });
}

function normalizedText(value: string | undefined, fallback: string, limit: number): string {
  return boundedSafeText(value, limit) || fallback;
}

function historyIdPart(value: string): string {
  return encodeURIComponent(boundedSafeText(value, MAX_HISTORY_TEXT_LENGTH)).replaceAll(".", "%2E");
}

function quoted(value: string): string {
  return JSON.stringify(boundedSafeText(value, MAX_HISTORY_TEXT_LENGTH));
}

function normalizeHistoryOperation(
  operation: MarkupWindowHistoryOperationInspection,
): MarkupWindowHistoryOperationInspection {
  const parameters: Record<string, string | number> = {};
  let count = 0;
  let examined = 0;
  const source = operation.parameters ?? {};
  for (const rawKey in source) {
    if (examined >= MAX_HISTORY_PARAMETERS) break;
    examined += 1;
    if (!Object.hasOwn(source, rawKey)) continue;
    const rawValue = source[rawKey]!;
    const key = boundedSafeText(rawKey, MAX_HISTORY_TEXT_LENGTH);
    if (!key) continue;
    if (typeof rawValue === "number") {
      if (!Number.isFinite(rawValue)) continue;
      parameters[key] = rawValue;
    } else {
      parameters[key] = boundedSafeText(String(rawValue), MAX_HISTORY_TEXT_LENGTH);
    }
    count += 1;
  }
  const semanticId = typeof operation.id === "string"
    ? operation.id.trim().slice(0, MAX_SEMANTIC_SURFACE_ID_LENGTH)
    : undefined;
  const result: MarkupWindowHistoryOperationInspection = {
    action: operation.action,
    id: semanticId === undefined ? undefined : boundedSafeText(semanticId, MAX_HISTORY_TEXT_LENGTH),
    targetId: operation.targetId === undefined
      ? undefined
      : boundedSafeText(operation.targetId, MAX_HISTORY_TEXT_LENGTH),
    ...(count === 0 ? {} : { parameters }),
  };
  if (semanticId !== undefined) {
    Object.defineProperty(result, HISTORY_SEMANTIC_ID, { value: semanticId });
  }
  return result;
}

function cloneOperation(
  operation: MarkupWindowHistoryOperationInspection,
): MarkupWindowHistoryOperationInspection {
  return {
    ...operation,
    ...(operation.parameters ? { parameters: { ...operation.parameters } } : {}),
  };
}

function boundedHistoryLabel(value: string): string {
  return boundedSafeText(value, MAX_HISTORY_LABEL_LENGTH) || "Update window";
}

function boundedSafeText(value: string | undefined, limit: number): string {
  if (typeof value !== "string" || limit <= 0) return "";
  const scanLimit = Math.min(value.length, limit * 4);
  let result = "";
  for (let index = 0; index < scanLimit && result.length < limit; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = index + 1 < scanLimit ? value.charCodeAt(index + 1) : -1;
      if (next >= 0xdc00 && next <= 0xdfff && result.length + 2 <= limit) {
        result += value[index]! + value[index + 1]!;
        index += 1;
      } else {
        result += "\ufffd";
      }
      continue;
    }
    result += unit >= 0xdc00 && unit <= 0xdfff ? "\ufffd" : value[index]!;
  }
  return result.trim();
}

function gestureResult(
  operation: MarkupWindowHistoryOperationInspection,
  status: "applied" | "unchanged",
  reason?: string,
): MarkupWindowActionResult {
  return {
    action: operation.action,
    status,
    ok: true,
    id: operation.id,
    targetId: operation.targetId,
    ...(reason === undefined ? {} : { reason }),
  };
}

function inertGesture(
  operation: MarkupWindowHistoryOperationInspection,
  reason: string,
): MarkupWindowHistoryGesture {
  const inspection: MarkupWindowHistoryGestureInspection = {
    state: "unavailable",
    operation: cloneOperation(operation),
    changed: false,
    reason,
  };
  return Object.freeze({
    commit: () => false,
    cancel: () => false,
    inspect: () => structuredClone(inspection),
  });
}

function preserveWorkspaceRegistrationTakeovers(
  target: MarkupWindowHistorySnapshot,
  expectedCurrent: MarkupWindowHistorySnapshot | undefined,
  workspace: TiledWorkspaceController,
): void {
  const expectedRegistrations = new Map(
    (expectedCurrent?.workspaceRegistrations ?? target.workspaceRegistrations).map((entry) => [
      entry.id,
      entry.generation,
    ]),
  );
  const removedIds = new Set<string>();
  for (const registration of target.workspaceRegistrations) {
    const expectedGeneration = expectedRegistrations.get(registration.id) ?? registration.generation;
    if (workspace.windowRegistrationGeneration(registration.id) !== expectedGeneration) {
      removedIds.add(registration.id);
    }
  }
  const liveWorkspace = workspace.snapshot();
  const livePanes = new Map<string, TiledWorkspaceLayoutNode>();
  const liveWindows: TiledWorkspaceWindow[] = [];
  const stack = liveWorkspace.layout.root ? [liveWorkspace.layout.root] : [];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.kind === "pane") {
      livePanes.set(node.windowId, structuredClone(node));
      liveWindows.push({ id: node.windowId, minWidth: node.minWidth, minHeight: node.minHeight });
    } else stack.push(node.second, node.first);
  }
  const targetPaneIds = new Set(
    workspaceWindowsForHistory(target.controller.workspace.layout.root).map(({ id }) => id),
  );
  const knownManagedIds = new Set([
    ...target.workspaceRegistrations.map(({ id }) => id),
    ...(expectedCurrent?.workspaceRegistrations.map(({ id }) => id) ?? []),
  ]);
  const additions = liveWindows.filter(({ id }) => !targetPaneIds.has(id) && !knownManagedIds.has(id));
  if (removedIds.size === 0 && additions.length === 0) return;

  if (removedIds.size > 0) {
    target.controller.workspace.layout.root = replaceTakenOverWorkspacePanes(
      target.controller.workspace.layout.root,
      removedIds,
      livePanes,
    );

    const remainingIds = new Set(target.controller.windowIds.filter((id) => !removedIds.has(id)));
    target.controller.windowIds = target.controller.windowIds.filter((id) => remainingIds.has(id));
    target.controller.minimizedWindowIds = target.controller.minimizedWindowIds.filter((id) => remainingIds.has(id));
    target.controller.closedWindowIds = target.controller.closedWindowIds.filter((id) => remainingIds.has(id));
    target.controller.focusOrderWindowIds = target.controller.focusOrderWindowIds.filter((id) => remainingIds.has(id));
    target.controller.placements = target.controller.placements.filter((entry) => remainingIds.has(entry.id)).map(
      (entry) =>
        entry.snapTarget?.kind === "dock" && removedIds.has(entry.snapTarget.targetId)
          ? { ...entry, snapTarget: undefined }
          : entry,
    );
    target.workspaceRegistrations = target.workspaceRegistrations.filter((entry) => remainingIds.has(entry.id));
    if (target.controller.maximizedWindowId && removedIds.has(target.controller.maximizedWindowId)) {
      target.controller.maximizedWindowId = undefined;
    }
    if (!target.controller.activeWindowId || removedIds.has(target.controller.activeWindowId)) {
      const expectedActive = expectedCurrent?.controller.activeWindowId;
      target.controller.activeWindowId = expectedActive && remainingIds.has(expectedActive)
        ? expectedActive
        : [...target.controller.focusOrderWindowIds].reverse().find((id) =>
          !target.controller.minimizedWindowIds.includes(id) && !target.controller.closedWindowIds.includes(id)
        );
    }
  }

  const addedIds = new Set(additions.map(({ id }) => id));
  if (additions.length > 0) {
    target.controller.workspace.layout.root = rebaseAddedWorkspaceGrafts(
      target.controller.workspace.layout.root,
      liveWorkspace.layout.root,
      addedIds,
    );
  }
  const liveActiveWindowId = workspaceWindowIdForPaneId(
    liveWorkspace.layout.root,
    liveWorkspace.layout.activePaneId,
  );
  const preservedExternalActiveWindowId = liveActiveWindowId && addedIds.has(liveActiveWindowId)
    ? liveActiveWindowId
    : undefined;
  if (additions.length > 0) {
    const retainedWindows = workspaceWindowsForHistory(target.controller.workspace.layout.root);
    const retainedIds = new Set(retainedWindows.map(({ id }) => id));
    target.controller.workspace.layout = reconcileTiledWorkspaceLayout(
      target.controller.workspace.layout,
      [...retainedWindows, ...additions.filter(({ id }) => !retainedIds.has(id))],
      { activeWindowId: preservedExternalActiveWindowId },
    );
  }
  const activeId = target.controller.activeWindowId;
  const activePlacement = target.controller.placements.find((entry) => entry.id === activeId)?.placement;
  const activePaneId = preservedExternalActiveWindowId
    ? workspacePaneIdForHistory(target.controller.workspace.layout.root, preservedExternalActiveWindowId)
    : activeId && activePlacement === "tiled"
    ? workspacePaneIdForHistory(
      target.controller.workspace.layout.root,
      activeId,
    )
    : undefined;
  const retainedPaneId = workspaceHistoryPaneExists(
      target.controller.workspace.layout.root,
      target.controller.workspace.layout.activePaneId,
    )
    ? target.controller.workspace.layout.activePaneId
    : undefined;
  const livePaneId = workspaceHistoryPaneExists(
      target.controller.workspace.layout.root,
      liveWorkspace.layout.activePaneId,
    )
    ? liveWorkspace.layout.activePaneId
    : undefined;
  target.controller.workspace.layout.activePaneId = activePaneId ?? retainedPaneId ?? livePaneId ??
    firstWorkspaceHistoryPaneId(target.controller.workspace.layout.root);
}

function workspaceWindowsForHistory(
  node: TiledWorkspaceLayoutNode | undefined,
): TiledWorkspaceWindow[] {
  const windows: TiledWorkspaceWindow[] = [];
  const stack = node ? [node] : [];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.kind === "pane") {
      windows.push({ id: current.windowId, minWidth: current.minWidth, minHeight: current.minHeight });
    } else stack.push(current.second, current.first);
  }
  return windows;
}

interface WorkspaceGraftSummary {
  hasAddition: boolean;
  anchors: Set<string>;
  unsafe: boolean;
}

function rebaseAddedWorkspaceGrafts(
  targetRoot: TiledWorkspaceLayoutNode | undefined,
  liveRoot: TiledWorkspaceLayoutNode | undefined,
  addedIds: ReadonlySet<string>,
): TiledWorkspaceLayoutNode | undefined {
  if (!targetRoot || !liveRoot || addedIds.size === 0) return targetRoot;
  const targetPanes = new Map<string, TiledWorkspaceLayoutNode>();
  for (const node of workspacePaneNodes(targetRoot)) targetPanes.set(node.windowId, node);
  const usedAnchors = new Set<string>();
  let rebasedRoot = targetRoot;

  const visit = (node: TiledWorkspaceLayoutNode): void => {
    if (node.kind === "pane") return;
    const summary = summarizeWorkspaceGraft(node, targetPanes, addedIds);
    if (summary.hasAddition && !summary.unsafe && summary.anchors.size === 1) {
      const anchorId = summary.anchors.values().next().value as string;
      const targetPane = targetPanes.get(anchorId);
      if (targetPane && !usedAnchors.has(anchorId)) {
        const anchorIds = new Set([anchorId]);
        const graft = replaceTakenOverWorkspacePanes(
          structuredClone(node),
          anchorIds,
          new Map([[anchorId, targetPane]]),
        );
        if (graft) {
          rebasedRoot = replaceTakenOverWorkspacePanes(
            rebasedRoot,
            anchorIds,
            new Map([[anchorId, graft]]),
          ) ?? rebasedRoot;
          usedAnchors.add(anchorId);
        }
      }
      return;
    }
    visit(node.first);
    visit(node.second);
  };

  visit(liveRoot);
  return rebasedRoot;
}

function summarizeWorkspaceGraft(
  node: TiledWorkspaceLayoutNode,
  targetPanes: ReadonlyMap<string, TiledWorkspaceLayoutNode>,
  addedIds: ReadonlySet<string>,
): WorkspaceGraftSummary {
  if (node.kind === "pane") {
    if (addedIds.has(node.windowId)) return { hasAddition: true, anchors: new Set(), unsafe: false };
    if (targetPanes.has(node.windowId)) {
      return { hasAddition: false, anchors: new Set([node.windowId]), unsafe: false };
    }
    return { hasAddition: false, anchors: new Set(), unsafe: true };
  }
  const first = summarizeWorkspaceGraft(node.first, targetPanes, addedIds);
  const second = summarizeWorkspaceGraft(node.second, targetPanes, addedIds);
  return {
    hasAddition: first.hasAddition || second.hasAddition,
    anchors: new Set([...first.anchors, ...second.anchors]),
    unsafe: first.unsafe || second.unsafe,
  };
}

function workspacePaneNodes(node: TiledWorkspaceLayoutNode | undefined): TiledWorkspacePaneNode[] {
  const panes: TiledWorkspacePaneNode[] = [];
  const stack = node ? [node] : [];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.kind === "pane") panes.push(current);
    else stack.push(current.second, current.first);
  }
  return panes;
}

function workspaceWindowIdForPaneId(
  node: TiledWorkspaceLayoutNode | undefined,
  paneId: string | undefined,
): string | undefined {
  if (!node || !paneId) return undefined;
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.kind === "pane") {
      if (current.id === paneId) return current.windowId;
    } else stack.push(current.second, current.first);
  }
  return undefined;
}

function replaceTakenOverWorkspacePanes(
  node: TiledWorkspaceLayoutNode | undefined,
  takenOverIds: ReadonlySet<string>,
  livePanes: ReadonlyMap<string, TiledWorkspaceLayoutNode>,
): TiledWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") {
    return takenOverIds.has(node.windowId) ? structuredClone(livePanes.get(node.windowId)) : node;
  }
  const first = replaceTakenOverWorkspacePanes(node.first, takenOverIds, livePanes);
  const second = replaceTakenOverWorkspacePanes(node.second, takenOverIds, livePanes);
  if (!first || !second) return first ?? second;
  return {
    ...node,
    first,
    second,
  };
}

function workspacePaneIdForHistory(
  node: TiledWorkspaceLayoutNode | undefined,
  windowId: string,
): string | undefined {
  if (!node) return undefined;
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.kind === "pane") {
      if (current.windowId === windowId) return current.id;
    } else stack.push(current.second, current.first);
  }
  return undefined;
}

function workspaceHistoryPaneExists(
  node: TiledWorkspaceLayoutNode | undefined,
  paneId: string | undefined,
): boolean {
  if (!node || !paneId) return false;
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.kind === "pane") {
      if (current.id === paneId) return true;
    } else stack.push(current.second, current.first);
  }
  return false;
}

function firstWorkspaceHistoryPaneId(node: TiledWorkspaceLayoutNode | undefined): string | undefined {
  if (!node) return undefined;
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.kind === "pane") return current.id;
    stack.push(current.second, current.first);
  }
  return undefined;
}

function captureManagedOverlaySnapshot(
  rootIdsValue: readonly string[],
  controller: OverlayStackController,
  overlays: ReturnType<OverlayStackController["snapshot"]>,
): ManagedOverlayHistorySnapshot {
  const rootIds = rootIdsValue.slice();
  const managedIds = collectManagedOverlayIds(overlays.surfaces, rootIds);
  const activeId = overlays.activeId && managedIds.has(overlays.activeId) ? overlays.activeId : undefined;
  return {
    activeId,
    externalActiveId: overlays.activeId !== undefined && activeId === undefined ? overlays.activeId : undefined,
    nextOrder: overlays.nextOrder,
    rootIds: rootIds.slice(),
    registrations: overlays.surfaces.filter((surface) => managedIds.has(surface.id)).map((surface) => ({
      id: surface.id,
      generation: controller.registrationGeneration(surface.id)!,
    })),
    surfaces: overlays.surfaces.filter((surface) => managedIds.has(surface.id)).map(cloneOverlaySurface),
  };
}

function preserveOverlayRegistrationTakeovers(
  target: ManagedOverlayHistorySnapshot,
  expectedCurrent: ManagedOverlayHistorySnapshot | undefined,
  live: ReturnType<OverlayStackController["snapshot"]>,
  controller: OverlayStackController,
): void {
  const historicalActiveId = target.activeId;
  const targetRegistrations = new Map(target.registrations.map((entry) => [entry.id, entry.generation]));
  const expectedById = expectedCurrent
    ? new Map(expectedCurrent.surfaces.map((surface) => [surface.id, surface]))
    : undefined;
  const liveById = new Map(live.surfaces.map((surface) => [surface.id, surface]));
  const targetById = new Map(target.surfaces.map((surface) => [surface.id, surface]));
  const removedIds = new Set<string>();
  const takeoverIds = new Set<string>();

  for (const rootId of target.rootIds) {
    const liveSurface = liveById.get(rootId);
    const targetGeneration = targetRegistrations.get(rootId);
    const expectedSurface = expectedById?.get(rootId);
    if (
      liveSurface && controller.registrationGeneration(rootId) === targetGeneration &&
      (!expectedById || (expectedSurface && overlayRootOwnershipMatches(expectedSurface, liveSurface)))
    ) continue;
    for (const id of collectManagedOverlayIds(target.surfaces, [rootId])) {
      removedIds.add(id);
      takeoverIds.add(id);
    }
  }

  if (removedIds.size > 0) {
    target.rootIds = target.rootIds.filter((id) => !removedIds.has(id));
    target.surfaces = target.surfaces.filter((surface) => !removedIds.has(surface.id));
    target.registrations = target.registrations.filter((entry) => !removedIds.has(entry.id));
    if (target.activeId && removedIds.has(target.activeId)) target.activeId = undefined;
  }

  const liveManagedIds = collectManagedOverlayIds(live.surfaces, target.rootIds);
  const targetManagedIds = collectManagedOverlayIds(target.surfaces, target.rootIds);
  for (const id of targetManagedIds) {
    if (target.rootIds.includes(id)) continue;
    const liveSurface = liveById.get(id);
    if (!liveSurface) {
      for (const descendantId of collectManagedOverlayIds(target.surfaces, [id])) {
        removedIds.add(descendantId);
        takeoverIds.add(descendantId);
      }
      continue;
    }
    const liveGeneration = controller.registrationGeneration(id);
    const targetGeneration = targetRegistrations.get(id);
    const expectedSurface = expectedById?.get(id);
    if (
      liveGeneration === targetGeneration &&
      (!expectedById || (expectedSurface && overlayRegistrationIdentityMatches(expectedSurface, liveSurface)))
    ) continue;
    takeoverIds.add(id);
    if (liveManagedIds.has(id) && liveGeneration !== undefined) {
      targetById.set(id, cloneOverlaySurface(liveSurface));
      targetRegistrations.set(id, liveGeneration);
    } else {
      for (const descendantId of collectManagedOverlayIds(target.surfaces, [id])) {
        removedIds.add(descendantId);
        takeoverIds.add(descendantId);
      }
    }
  }
  for (const surface of live.surfaces) {
    if (!liveManagedIds.has(surface.id) || targetManagedIds.has(surface.id)) continue;
    const generation = controller.registrationGeneration(surface.id);
    if (generation === undefined) continue;
    takeoverIds.add(surface.id);
    target.surfaces.push(cloneOverlaySurface(surface));
    target.registrations.push({ id: surface.id, generation });
    targetById.set(surface.id, cloneOverlaySurface(surface));
    targetRegistrations.set(surface.id, generation);
  }
  if (removedIds.size > 0) {
    target.surfaces = target.surfaces.filter((surface) => !removedIds.has(surface.id));
    target.registrations = target.registrations.filter((entry) => !removedIds.has(entry.id));
  }
  target.surfaces = target.surfaces.map((surface) => targetById.get(surface.id) ?? surface);
  target.registrations = target.registrations.map((entry) => ({
    id: entry.id,
    generation: targetRegistrations.get(entry.id) ?? entry.generation,
  }));
  const effectiveManagedIds = collectManagedOverlayIds(target.surfaces, target.rootIds);
  const historicalActiveRemoved = historicalActiveId !== undefined && !effectiveManagedIds.has(historicalActiveId);
  if (target.activeId && !effectiveManagedIds.has(target.activeId)) {
    target.activeId = undefined;
  }
  if (live.activeId && takeoverIds.has(live.activeId)) {
    if (effectiveManagedIds.has(live.activeId)) {
      target.activeId = live.activeId;
      target.externalActiveId = undefined;
    } else {
      target.activeId = undefined;
      target.externalActiveId = live.activeId;
    }
  } else if (historicalActiveRemoved && live.activeId && effectiveManagedIds.has(live.activeId)) {
    target.activeId = live.activeId;
    target.externalActiveId = undefined;
  }
}

function preserveOverlayFocus(
  target: ManagedOverlayHistorySnapshot,
  expectedCurrent: ManagedOverlayHistorySnapshot | undefined,
  live: ReturnType<OverlayStackController["snapshot"]>,
  preserveExternalFocus: boolean,
): void {
  const liveManagedIds = collectManagedOverlayIds(live.surfaces, target.rootIds);
  const expectedActiveId = expectedCurrent?.externalActiveId ?? expectedCurrent?.activeId;
  const focusDiverged = expectedCurrent !== undefined && live.activeId !== expectedActiveId;
  if (preserveExternalFocus || focusDiverged) {
    assignOverlayFocus(target, live.activeId, liveManagedIds);
  } else if (
    target.externalActiveId &&
    !live.surfaces.some((surface) => surface.id === target.externalActiveId)
  ) {
    target.externalActiveId = undefined;
  }
}

function preserveLateOverlayFocus(
  target: ManagedOverlayHistorySnapshot,
  beforeRestore: ReturnType<OverlayStackController["snapshot"]>,
  beforeGenerations: ReadonlyMap<string, number | undefined>,
  live: ReturnType<OverlayStackController["snapshot"]>,
  controller: OverlayStackController,
): void {
  if (target.externalActiveId && !live.surfaces.some((surface) => surface.id === target.externalActiveId)) {
    target.externalActiveId = undefined;
  }
  const activeId = live.activeId;
  if (!activeId || activeId === beforeRestore.activeId) return;
  const beforeSurface = beforeRestore.surfaces.find((surface) => surface.id === activeId);
  const liveSurface = live.surfaces.find((surface) => surface.id === activeId);
  const registrationChanged = controller.registrationGeneration(activeId) !== beforeGenerations.get(activeId);
  if (
    beforeSurface && liveSurface && !registrationChanged &&
    overlayRegistrationIdentityMatches(beforeSurface, liveSurface)
  ) return;
  assignOverlayFocus(target, activeId, collectManagedOverlayIds(live.surfaces, target.rootIds));
}

function assignOverlayFocus(
  target: ManagedOverlayHistorySnapshot,
  activeId: string | undefined,
  managedIds: ReadonlySet<string>,
): void {
  if (activeId && managedIds.has(activeId)) {
    target.activeId = activeId;
    target.externalActiveId = undefined;
  } else {
    target.activeId = undefined;
    target.externalActiveId = activeId;
  }
}

function restoreManagedOverlaySnapshot(
  controller: OverlayStackController,
  target: ManagedOverlayHistorySnapshot,
  liveSnapshot: ReturnType<OverlayStackController["snapshot"]> = controller.snapshot(),
): void {
  const current = liveSnapshot;
  const managedIds = collectManagedOverlayIds(current.surfaces, target.rootIds);
  const merged: OverlaySurfaceInspection[] = [];
  let inserted = false;
  for (const surface of current.surfaces) {
    if (managedIds.has(surface.id)) {
      if (!inserted) {
        for (const managed of target.surfaces) merged.push(cloneOverlaySurface(managed));
        inserted = true;
      }
      continue;
    }
    merged.push(cloneOverlaySurface(surface));
  }
  if (!inserted) {
    for (const managed of target.surfaces) merged.push(cloneOverlaySurface(managed));
  }

  let nextOrder = target.nextOrder;
  for (const surface of merged) nextOrder = Math.max(nextOrder, surface.order + 1);
  const targetIds = new Set(target.surfaces.map((surface) => surface.id));
  const externalTarget = target.externalActiveId && merged.some((surface) => surface.id === target.externalActiveId)
    ? target.externalActiveId
    : undefined;
  const activeId = externalTarget ?? (target.activeId && targetIds.has(target.activeId) ? target.activeId : undefined);
  controller.restoreSnapshot(
    { activeId, nextOrder, surfaces: merged },
    { synchronizeFocus: true },
  );
}

function collectManagedOverlayIds(
  surfaces: readonly OverlaySurfaceInspection[],
  rootIds: readonly string[],
): Set<string> {
  const ids = new Set(rootIds);
  const children = new Map<string, string[]>();
  for (const surface of surfaces) {
    if (!surface.ownerId) continue;
    const owned = children.get(surface.ownerId);
    if (owned) owned.push(surface.id);
    else children.set(surface.ownerId, [surface.id]);
  }
  const queue = [...ids];
  for (let index = 0; index < queue.length; index += 1) {
    for (const childId of children.get(queue[index]!) ?? []) {
      if (ids.has(childId)) continue;
      ids.add(childId);
      queue.push(childId);
    }
  }
  return ids;
}

function cloneOverlaySurface(surface: OverlaySurfaceInspection): OverlaySurfaceInspection {
  return { ...surface, rect: { ...surface.rect } };
}

function overlayRootOwnershipMatches(
  left: OverlaySurfaceInspection,
  right: OverlaySurfaceInspection,
): boolean {
  return overlayRegistrationIdentityMatches(left, right) && left.rect.column === right.rect.column &&
    left.rect.row === right.rect.row && left.rect.width === right.rect.width &&
    left.rect.height === right.rect.height &&
    left.closeOnOutsideClick === right.closeOnOutsideClick;
}

function overlayRegistrationIdentityMatches(
  left: OverlaySurfaceInspection,
  right: OverlaySurfaceInspection,
): boolean {
  return left.id === right.id && left.layer === right.layer && left.kind === right.kind && left.modal === right.modal &&
    left.ownerId === right.ownerId;
}

function combinedGestureError(error: unknown, compensationError: unknown): MarkupWindowHistoryRestoreError {
  return new MarkupWindowHistoryRestoreError(
    "snapshot-mismatch",
    "Window gesture restoration failed and compensation could not restore the prior snapshot.",
    undefined,
    new AggregateError([error, compensationError], "Window gesture restoration and compensation both failed."),
  );
}

function errorMessage(error: unknown): string {
  return boundedSafeText(error instanceof Error ? error.message : String(error), MAX_HISTORY_LABEL_LENGTH) ||
    "window-history-gesture-failed";
}
