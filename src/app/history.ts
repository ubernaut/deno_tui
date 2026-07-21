// Copyright 2023 Im-Beast. MIT license.
import type { Action } from "./actions.ts";
import type { LabeledCommandGroupOptions } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";
import type { Route, RouteManager } from "./router.ts";

/** Public interface describing a history Transaction. */
export interface HistoryTransaction {
  id?: string;
  label: string;
  group?: string;
  /** Opts this entry into adjacent, idle-bounded stream coalescing. */
  coalesce?: HistoryCoalescingMetadata;
  /** Required declaration when this entry represents an external side effect. */
  replaySafety?: HistoryReplaySafetyMetadata;
  /**
   * Compensation pair for `redo`. If `redo` throws before or after a partial
   * mutation, `undo` must either restore the exact pre-redo state or throw so
   * the stack can enter its explicit poisoned state.
   */
  undo: () => void | Promise<void>;
  /**
   * Compensation pair for `undo`. If `undo` throws before or after a partial
   * mutation, `redo` must either restore the exact pre-undo state or throw so
   * the stack can enter its explicit poisoned state.
   */
  redo: () => void | Promise<void>;
}

/** Synchronous transaction accepted by transactionSync scopes. */
export interface SynchronousHistoryTransaction extends HistoryTransaction {
  undo: () => void;
  redo: () => void;
}

/** Metadata applied to one atomically committed transaction scope. */
export interface HistoryTransactionOptions {
  id?: string;
  label: string;
  group?: string;
  /** Opts the committed composite into adjacent, idle-bounded stream coalescing. */
  coalesce?: HistoryCoalescingMetadata;
  /** Required declaration when the transaction scope represents an external side effect. */
  replaySafety?: HistoryReplaySafetyMetadata;
}

/** Per-entry stream identity used by deterministic history coalescing. */
export interface HistoryCoalescingMetadata {
  key: string;
  /** Entries only coalesce when their optional semantic boundary token is equal. */
  boundary?: string;
}

/** Replay contract supplied for an entry that performs an external side effect. */
export type HistoryReplayStrategy = "idempotent" | "compensatable" | "non-replayable";

/** Explicit side-effect declaration validated before any history callback executes. */
export interface HistoryReplaySafetyMetadata {
  sideEffectful: true;
  strategy: HistoryReplayStrategy;
}

/** Direction executed by one failure-atomic history operation. */
export type HistoryOperationDirection = "undo" | "redo";

/** Mutation phase exposed by diagnostics and busy errors. */
export type HistoryOperationPhase =
  | "apply"
  | "undo"
  | "redo"
  | "transaction-apply"
  | "transaction-rollback";

/** Stable structured history error codes. */
export type HistoryErrorCode =
  | "busy"
  | "scope-closed"
  | "operation-failed"
  | "transaction-aborted"
  | "poisoned"
  | "unsafe-replay";

/** Serializable normalized error data retained by history diagnostics. */
export interface HistoryErrorInspection {
  name: string;
  message: string;
}

/** Serializable detail for one compensation step that also failed. */
export interface HistoryCompensationFailureInspection {
  entry: HistoryEntryInspection;
  error: HistoryErrorInspection;
}

/** Serializable detail for a failed operation and its compensation result. */
export interface HistoryFailureInspection {
  phase: HistoryOperationPhase;
  direction: HistoryOperationDirection;
  entry: HistoryEntryInspection;
  failedEntry: HistoryEntryInspection;
  error: HistoryErrorInspection;
  compensationFailures: HistoryCompensationFailureInspection[];
}

/** Why the stack entered a mutation-blocking poisoned state. */
export type HistoryPoisonReason = "compensation-failed" | "rollback-failed" | "async-in-sync-scope";

/** Serializable poisoned-state diagnostic. */
export interface HistoryPoisonInspection extends HistoryFailureInspection {
  reason: HistoryPoisonReason;
}

/** Explicit policy required to recover a poisoned stack. */
export type HistoryPoisonRecoveryPolicy = "clear-history" | "retain-history";

/** Serializable state for the currently executing transaction scope. */
export interface HistoryTransactionScopeInspection extends HistoryEntryInspection {
  mode: "sync" | "async";
  depth: number;
  entryCount: number;
  discardRequested?: true;
}

/** Async transaction scope supplied to HistoryStack.transaction callbacks. */
export interface HistoryTransactionScope {
  readonly depth: number;
  readonly entry: HistoryEntryInspection;
  readonly discarded: boolean;
  push(transaction: HistoryTransaction): void;
  apply(transaction: HistoryTransaction): Promise<void>;
  /** Requests rollback instead of commit when this callback finishes. */
  discard(): void;
  transaction<T>(
    options: HistoryTransactionOptions,
    callback: (scope: HistoryTransactionScope) => T | Promise<T>,
  ): Promise<T>;
  transactionSync<T>(
    options: HistoryTransactionOptions,
    callback: (scope: SynchronousHistoryTransactionScope) => T,
  ): T;
}

/** Sync-only transaction scope supplied to HistoryStack.transactionSync callbacks. */
export interface SynchronousHistoryTransactionScope {
  readonly depth: number;
  readonly entry: HistoryEntryInspection;
  readonly discarded: boolean;
  push(transaction: SynchronousHistoryTransaction): void;
  apply(transaction: SynchronousHistoryTransaction): void;
  /** Requests rollback instead of commit when this callback finishes. */
  discard(): void;
  transaction<T>(
    options: HistoryTransactionOptions,
    callback: (scope: SynchronousHistoryTransactionScope) => T,
  ): T;
}

/** Options for configuring history Stack. */
export interface HistoryStackOptions {
  capacity?: number;
  /**
   * Enables coalescing. The clock is sampled only when an entry commits; no
   * timer, task, or scheduler is created by HistoryStack.
   */
  coalescing?: HistoryCoalescingOptions;
}

/** Deterministic, timer-free stream coalescing configuration. */
export interface HistoryCoalescingOptions {
  idleIntervalMs: number;
  now?: () => number;
}

/** Clone-safe checkpoint created by the most recent non-replayable entry. */
export interface HistoryReplayBarrierInspection {
  sequence: number;
  entry: HistoryEntryInspection;
}

/** Serializable inspection snapshot for history. */
export interface HistoryInspection {
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
  nextUndo?: HistoryEntryInspection;
  nextRedo?: HistoryEntryInspection;
  /** Present only while a transaction scope is active. */
  transaction?: HistoryTransactionScopeInspection;
  /** Present only while an asynchronous mutation step is executing. */
  operation?: HistoryOperationPhase;
  /** Present only after compensation or transactional rollback cannot restore a known state. */
  poisoned?: HistoryPoisonInspection;
  /** Present after a non-replayable side effect establishes a new checkpoint. */
  replayBarrier?: HistoryReplayBarrierInspection;
}

/** Serializable inspection snapshot for history Entry. */
export interface HistoryEntryInspection {
  id?: string;
  label: string;
  group?: string;
  composite?: true;
  operationCount?: number;
  coalesced?: true;
  coalesceKey?: string;
  coalesceBoundary?: string;
  replaySafety?: HistoryReplayStrategy;
}

/** Base typed error for deterministic history failures. */
export class HistoryStackError extends Error {
  constructor(
    readonly code: HistoryErrorCode,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "HistoryStackError";
  }
}

/** Raised when a concurrent or transaction-external mutation is ambiguous. */
export class HistoryBusyError extends HistoryStackError {
  constructor(readonly operation: string, readonly activeOperation?: string) {
    super(
      "busy",
      activeOperation
        ? `History ${operation} is blocked while ${activeOperation} is active.`
        : `History ${operation} is blocked by an active transaction.`,
    );
    this.name = "HistoryBusyError";
  }
}

/** Raised when a closed, parent, or otherwise non-current scope is used. */
export class HistoryScopeError extends HistoryStackError {
  constructor(message: string) {
    super("scope-closed", message);
    this.name = "HistoryScopeError";
  }
}

/** Raised after an operation fails, whether or not compensation succeeded. */
export class HistoryOperationError extends HistoryStackError {
  constructor(
    readonly failure: HistoryFailureInspection,
    readonly poisoned: boolean,
    cause?: unknown,
  ) {
    super(
      poisoned ? "poisoned" : "operation-failed",
      poisoned
        ? `History ${failure.phase} failed and compensation could not restore a known state.`
        : `History ${failure.phase} failed; compensation restored the prior state.`,
      cause,
    );
    this.name = "HistoryOperationError";
  }
}

/** Raised when a transaction callback aborts after a successful rollback. */
export class HistoryTransactionAbortedError extends HistoryStackError {
  constructor(readonly entry: HistoryEntryInspection, cause?: unknown) {
    super("transaction-aborted", `History transaction "${entry.label}" was rolled back.`, cause);
    this.name = "HistoryTransactionAbortedError";
  }
}

/** Raised while the stack is poisoned or when a rollback poisons it. */
export class HistoryPoisonedError extends HistoryStackError {
  constructor(readonly poison: HistoryPoisonInspection, cause?: unknown) {
    super("poisoned", "History is poisoned; call clear() or recoverPoison() before further mutation.", cause);
    this.name = "HistoryPoisonedError";
  }
}

/** Raised before an invalid side-effect declaration can execute or enter history. */
export class HistoryReplaySafetyError extends HistoryStackError {
  constructor(readonly entry: HistoryEntryInspection, reason: string) {
    super("unsafe-replay", `History entry "${entry.label}" has an unsafe replay declaration: ${reason}.`);
    this.name = "HistoryReplaySafetyError";
  }
}

const HISTORY_COMPOSITE = Symbol("HistoryStack.composite");
const HISTORY_COALESCED = Symbol("HistoryStack.coalesced");

interface CompositeHistoryTransaction extends HistoryTransaction {
  readonly [HISTORY_COMPOSITE]: readonly HistoryTransaction[];
}

interface CoalescedHistoryTransaction extends CompositeHistoryTransaction {
  readonly [HISTORY_COALESCED]: true;
}

interface NormalizedHistoryCoalescingOptions {
  readonly idleIntervalMs: number;
  readonly now: () => number;
}

interface HistoryCoalescingState extends HistoryCoalescingMetadata {
  readonly boundarySequence: number;
  readonly committedAt: number;
}

interface HistoryTransactionFrame {
  readonly options: HistoryTransactionOptions;
  readonly mode: "sync" | "async";
  readonly parent?: HistoryTransactionFrame;
  readonly entries: HistoryTransaction[];
  readonly pendingTasks: Set<HistoryFrameTask>;
  discardRequested: boolean;
  state: "active" | "closed";
}

interface HistoryFrameTask {
  readonly promise: Promise<unknown>;
  observed: boolean;
}

/** Public class implementing a history Stack. */
export class HistoryStack {
  readonly #undoStack: HistoryTransaction[] = [];
  readonly #redoStack: HistoryTransaction[] = [];
  readonly #capacity: number;
  readonly #coalescing?: NormalizedHistoryCoalescingOptions;
  readonly #coalescingStates = new WeakMap<HistoryTransaction, HistoryCoalescingState>();
  readonly #frames: HistoryTransactionFrame[] = [];
  #operation?: HistoryOperationPhase;
  #poison?: HistoryPoisonInspection;
  #coalescingBoundarySequence = 0;
  #replayBarrierSequence = 0;
  #replayBarrier?: HistoryReplayBarrierInspection;

  constructor(options: HistoryStackOptions = {}) {
    this.#capacity = Math.max(1, Math.floor(options.capacity ?? 100));
    this.#coalescing = normalizeCoalescingOptions(options.coalescing);
  }

  get undoDepth(): number {
    return this.#undoStack.length;
  }

  get redoDepth(): number {
    return this.#redoStack.length;
  }

  canUndo(): boolean {
    return !this.#poison && !this.#operation && this.#frames.length === 0 && this.#undoStack.length > 0;
  }

  canRedo(): boolean {
    return !this.#poison && !this.#operation && this.#frames.length === 0 && this.#redoStack.length > 0;
  }

  push(transaction: HistoryTransaction): void {
    this.#assertTopLevelMutation("push");
    this.#pushCommitted(prepareHistoryTransaction(transaction));
  }

  async apply(transaction: HistoryTransaction): Promise<void> {
    this.#assertTopLevelMutation("apply");
    const prepared = prepareHistoryTransaction(transaction);
    this.#operation = "apply";
    try {
      await this.#executeAtomic(prepared, "redo", "apply");
      this.#pushCommitted(prepared);
    } finally {
      this.#operation = undefined;
    }
  }

  async undo(): Promise<boolean> {
    this.#assertTopLevelMutation("undo");
    const transaction = this.#undoStack.at(-1);
    if (!transaction) return false;
    this.#operation = "undo";
    try {
      await this.#executeAtomic(transaction, "undo", "undo");
    } finally {
      this.#operation = undefined;
    }
    this.#undoStack.pop();
    this.#redoStack.push(transaction);
    this.#markCoalescingBoundary();
    return true;
  }

  async redo(): Promise<boolean> {
    this.#assertTopLevelMutation("redo");
    const transaction = this.#redoStack.at(-1);
    if (!transaction) return false;
    this.#operation = "redo";
    try {
      await this.#executeAtomic(transaction, "redo", "redo");
    } finally {
      this.#operation = undefined;
    }
    this.#redoStack.pop();
    this.#undoStack.push(transaction);
    this.#markCoalescingBoundary();
    return true;
  }

  /** Prevents a later entry from coalescing with work committed before this call. */
  markCoalescingBoundary(): void {
    this.#assertTopLevelMutation("markCoalescingBoundary");
    this.#markCoalescingBoundary();
  }

  /**
   * Runs one exclusive top-level asynchronous transaction. Nested work must use
   * the supplied scope and execute sequentially; concurrent attempts are
   * rejected. Every started scope promise is joined before commit, and an
   * unhandled rejection aborts the parent. A successful callback commits unless
   * its scope requested discard.
   */
  async transaction<T>(
    options: HistoryTransactionOptions,
    callback: (scope: HistoryTransactionScope) => T | Promise<T>,
  ): Promise<T> {
    this.#assertTopLevelMutation("transaction");
    return await this.#runAsyncTransaction(undefined, options, callback);
  }

  /**
   * Runs one exclusive synchronous transaction. A successful callback commits
   * unless its scope requested discard; promise-returning callbacks or steps
   * are rejected because they cannot be synchronously ordered.
   */
  transactionSync<T>(
    options: HistoryTransactionOptions,
    callback: (scope: SynchronousHistoryTransactionScope) => T,
  ): T {
    this.#assertTopLevelMutation("transactionSync");
    return this.#runSyncTransaction(undefined, options, callback);
  }

  clear(): void {
    this.#assertRecoveryAvailable("clear");
    this.#undoStack.length = 0;
    this.#redoStack.length = 0;
    this.#poison = undefined;
    this.#replayBarrier = undefined;
    this.#markCoalescingBoundary();
  }

  /**
   * Clears poison with an explicit policy. `clear-history` is the safe default;
   * `retain-history` asserts that the caller repaired external state to match
   * the retained stacks.
   */
  recoverPoison(policy: HistoryPoisonRecoveryPolicy): boolean {
    this.#assertRecoveryAvailable("recoverPoison");
    if (policy !== "clear-history" && policy !== "retain-history") {
      throw new TypeError(`Unknown history poison recovery policy: ${String(policy)}`);
    }
    if (!this.#poison) return false;
    if (policy === "clear-history") {
      this.#undoStack.length = 0;
      this.#redoStack.length = 0;
      this.#replayBarrier = undefined;
    }
    this.#poison = undefined;
    this.#markCoalescingBoundary();
    return true;
  }

  isPoisoned(): boolean {
    return this.#poison !== undefined;
  }

  inspect(): HistoryInspection {
    const inspection: HistoryInspection = {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDepth: this.undoDepth,
      redoDepth: this.redoDepth,
      nextUndo: inspectEntry(this.#undoStack.at(-1)),
      nextRedo: inspectEntry(this.#redoStack.at(-1)),
    };
    const frame = this.#frames.at(-1);
    if (frame) {
      const transaction: HistoryTransactionScopeInspection = {
        ...inspectOptions(frame.options),
        mode: frame.mode,
        depth: this.#frames.length,
        entryCount: frame.entries.length,
      };
      if (frame.discardRequested) transaction.discardRequested = true;
      inspection.transaction = transaction;
    }
    if (this.#operation) inspection.operation = this.#operation;
    if (this.#poison) inspection.poisoned = clonePoison(this.#poison);
    if (this.#replayBarrier) inspection.replayBarrier = cloneReplayBarrier(this.#replayBarrier);
    return inspection;
  }

  #pushCommitted(transaction: HistoryTransaction): void {
    if (isNonReplayable(transaction)) {
      this.#establishReplayBarrier(transaction);
      return;
    }

    const hadRedoDivergence = this.#redoStack.length > 0;
    const metadata = transaction.coalesce;
    const committedAt = metadata && this.#coalescing ? safeHistoryNow(this.#coalescing.now) : undefined;
    const previous = this.#undoStack.at(-1);
    const previousState = previous ? this.#coalescingStates.get(previous) : undefined;
    let committed = transaction;

    if (
      !hadRedoDivergence && metadata && committedAt !== undefined && previous && previousState &&
      previousState.key === metadata.key &&
      previousState.boundary === metadata.boundary &&
      previousState.boundarySequence === this.#coalescingBoundarySequence &&
      previous.group === transaction.group &&
      committedAt >= previousState.committedAt &&
      committedAt - previousState.committedAt <= this.#coalescing!.idleIntervalMs
    ) {
      committed = coalescedTransaction(previous, transaction);
      this.#undoStack[this.#undoStack.length - 1] = committed;
    } else {
      this.#undoStack.push(committed);
    }

    if (metadata && committedAt !== undefined) {
      this.#coalescingStates.set(committed, {
        ...metadata,
        boundarySequence: this.#coalescingBoundarySequence,
        committedAt,
      });
    }
    while (this.#undoStack.length > this.#capacity) this.#undoStack.shift();
    this.#redoStack.length = 0;
  }

  #establishReplayBarrier(transaction: HistoryTransaction): void {
    this.#undoStack.length = 0;
    this.#redoStack.length = 0;
    const entry = inspectEntry(transaction)!;
    entry.replaySafety = "non-replayable";
    this.#replayBarrier = {
      sequence: ++this.#replayBarrierSequence,
      entry,
    };
    this.#markCoalescingBoundary();
  }

  #markCoalescingBoundary(): void {
    this.#coalescingBoundarySequence += 1;
  }

  #assertTopLevelMutation(operation: string): void {
    if (this.#poison) throw new HistoryPoisonedError(clonePoison(this.#poison));
    if (this.#operation) throw new HistoryBusyError(operation, this.#operation);
    if (this.#frames.length > 0) throw new HistoryBusyError(operation);
  }

  #assertRecoveryAvailable(operation: string): void {
    if (this.#operation) throw new HistoryBusyError(operation, this.#operation);
    if (this.#frames.length > 0) throw new HistoryBusyError(operation);
  }

  #assertCurrentFrame(frame: HistoryTransactionFrame, operation: string): void {
    if (this.#poison) throw new HistoryPoisonedError(clonePoison(this.#poison));
    if (frame.state !== "active" || this.#frames.at(-1) !== frame) {
      throw new HistoryScopeError(`Cannot ${operation}: the transaction scope is closed or not current.`);
    }
    if (frame.discardRequested) {
      throw new HistoryScopeError(`Cannot ${operation}: the transaction scope is marked for discard.`);
    }
    if (this.#operation) throw new HistoryBusyError(operation, this.#operation);
  }

  #requestDiscard(frame: HistoryTransactionFrame): void {
    if (frame.state !== "active" || this.#frames.at(-1) !== frame) {
      throw new HistoryScopeError("Cannot discard: the transaction scope is closed or not current.");
    }
    if (frame.discardRequested) return;
    if (this.#operation) throw new HistoryBusyError("discard", this.#operation);
    frame.discardRequested = true;
  }

  async #runAsyncTransaction<T>(
    parent: HistoryTransactionFrame | undefined,
    options: HistoryTransactionOptions,
    callback: (scope: HistoryTransactionScope) => T | Promise<T>,
  ): Promise<T> {
    if (parent) this.#assertCurrentFrame(parent, "start a nested transaction");
    const frame = this.#enterFrame(parent, options, "async");
    const scope = this.#asyncScope(frame);
    let result: T | undefined;
    let callbackError: unknown;
    try {
      result = await callback(scope);
    } catch (error) {
      callbackError = error;
    }

    const pendingError = await this.#drainAsyncFrameTasks(frame);
    if (callbackError === undefined && pendingError !== undefined) callbackError = pendingError;

    if (callbackError === undefined && this.#poison) {
      callbackError = new HistoryPoisonedError(clonePoison(this.#poison));
    }

    if (callbackError !== undefined) {
      await this.#abortAsyncFrame(frame, callbackError);
    }
    if (frame.discardRequested) {
      await this.#discardAsyncFrame(frame);
      return result as T;
    }
    try {
      this.#commitFrame(frame);
    } catch (error) {
      // A commit-time invariant failure must never strand an active frame or
      // leave its applied entries outside history.
      if (frame.state === "active" && this.#frames.at(-1) === frame) {
        await this.#abortAsyncFrame(frame, error);
      }
      throw error;
    }
    return result as T;
  }

  async #drainAsyncFrameTasks(frame: HistoryTransactionFrame): Promise<unknown | undefined> {
    let unobservedError: unknown;
    let emptyCheckpointObserved = false;
    while (true) {
      const tasks = [...frame.pendingTasks];
      if (tasks.length === 0) {
        if (emptyCheckpointObserved) return unobservedError;
        // Promise continuations of the just-settled batch may enqueue another
        // scoped operation. Give them one checkpoint, then re-read the live set.
        emptyCheckpointObserved = true;
        await Promise.resolve();
        continue;
      }

      emptyCheckpointObserved = false;
      const settled = await Promise.allSettled(tasks.map((task) => task.promise));
      for (let index = 0; index < tasks.length; index += 1) {
        const task = tasks[index]!;
        frame.pendingTasks.delete(task);
        const result = settled[index]!;
        if (unobservedError === undefined && result.status === "rejected" && !task.observed) {
          unobservedError = result.reason;
        }
      }
    }
  }

  #runSyncTransaction<T>(
    parent: HistoryTransactionFrame | undefined,
    options: HistoryTransactionOptions,
    callback: (scope: SynchronousHistoryTransactionScope) => T,
  ): T {
    if (parent) this.#assertCurrentFrame(parent, "start a nested synchronous transaction");
    const frame = this.#enterFrame(parent, options, "sync");
    const scope = this.#syncScope(frame);
    let result: T;
    try {
      result = callback(scope);
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(noop);
        throw new HistoryScopeError("transactionSync callback returned a promise; use transaction() instead.");
      }
    } catch (error) {
      this.#abortSyncFrame(frame, error);
    }
    if (this.#poison) this.#abortSyncFrame(frame, new HistoryPoisonedError(clonePoison(this.#poison)));
    if (frame.discardRequested) {
      this.#discardSyncFrame(frame);
      return result!;
    }
    this.#commitFrame(frame);
    return result!;
  }

  #enterFrame(
    parent: HistoryTransactionFrame | undefined,
    options: HistoryTransactionOptions,
    mode: "sync" | "async",
  ): HistoryTransactionFrame {
    const normalized = normalizeTransactionOptions(options);
    const frame: HistoryTransactionFrame = {
      options: normalized,
      mode,
      parent,
      entries: [],
      pendingTasks: new Set(),
      discardRequested: false,
      state: "active",
    };
    this.#frames.push(frame);
    return frame;
  }

  #asyncScope(frame: HistoryTransactionFrame): HistoryTransactionScope {
    return Object.freeze({
      depth: this.#frames.length,
      entry: inspectOptions(frame.options),
      get discarded(): boolean {
        return frame.discardRequested;
      },
      push: (transaction: HistoryTransaction): void => {
        this.#assertCurrentFrame(frame, "push");
        frame.entries.push(prepareHistoryTransaction(transaction));
      },
      apply: (transaction: HistoryTransaction): Promise<void> => {
        const task = this.#applyInAsyncFrame(frame, transaction);
        return trackFrameTask(frame, task);
      },
      discard: (): void => {
        this.#requestDiscard(frame);
      },
      transaction: <T>(
        options: HistoryTransactionOptions,
        callback: (scope: HistoryTransactionScope) => T | Promise<T>,
      ): Promise<T> => {
        this.#assertCurrentFrame(frame, "start a nested transaction");
        const child = this.#runAsyncTransaction(frame, options, callback);
        return trackFrameTask(frame, child);
      },
      transactionSync: <T>(
        options: HistoryTransactionOptions,
        callback: (scope: SynchronousHistoryTransactionScope) => T,
      ): T => {
        return this.#runSyncTransaction(frame, options, callback);
      },
    });
  }

  async #applyInAsyncFrame(frame: HistoryTransactionFrame, transaction: HistoryTransaction): Promise<void> {
    this.#assertCurrentFrame(frame, "apply");
    const prepared = prepareHistoryTransaction(transaction);
    this.#operation = "transaction-apply";
    try {
      await this.#executeAtomic(prepared, "redo", "transaction-apply");
      frame.entries.push(prepared);
    } finally {
      this.#operation = undefined;
    }
  }

  #syncScope(frame: HistoryTransactionFrame): SynchronousHistoryTransactionScope {
    return Object.freeze({
      depth: this.#frames.length,
      entry: inspectOptions(frame.options),
      get discarded(): boolean {
        return frame.discardRequested;
      },
      push: (transaction: SynchronousHistoryTransaction): void => {
        this.#assertCurrentFrame(frame, "push");
        frame.entries.push(prepareHistoryTransaction(transaction));
      },
      apply: (transaction: SynchronousHistoryTransaction): void => {
        this.#assertCurrentFrame(frame, "apply");
        const prepared = prepareHistoryTransaction(transaction);
        this.#operation = "transaction-apply";
        try {
          this.#executeAtomicSync(prepared, "redo", "transaction-apply");
          frame.entries.push(prepared);
        } finally {
          this.#operation = undefined;
        }
      },
      discard: (): void => {
        this.#requestDiscard(frame);
      },
      transaction: <T>(
        options: HistoryTransactionOptions,
        callback: (scope: SynchronousHistoryTransactionScope) => T,
      ): T => {
        return this.#runSyncTransaction(frame, options, callback);
      },
    });
  }

  #commitFrame(frame: HistoryTransactionFrame): void {
    this.#assertCurrentFrame(frame, "commit");
    if (frame.entries.length === 0 && frame.options.replaySafety?.strategy !== "non-replayable") {
      this.#closeFrame(frame);
      return;
    }
    const composite = compositeTransaction(frame.options, frame.entries);
    if (frame.parent) frame.parent.entries.push(composite);
    else this.#pushCommitted(composite);
    this.#closeFrame(frame);
  }

  async #abortAsyncFrame(frame: HistoryTransactionFrame, cause: unknown): Promise<never> {
    await this.#discardAsyncFrame(frame, cause);
    throw new HistoryTransactionAbortedError(inspectOptions(frame.options), cause);
  }

  async #discardAsyncFrame(frame: HistoryTransactionFrame, cause?: unknown): Promise<void> {
    this.#assertFrameTopForAbort(frame);
    let rollbackError: unknown;
    if (frame.entries.length > 0) {
      this.#operation = "transaction-rollback";
      try {
        await this.#executeAtomic(
          compositeTransaction(frame.options, frame.entries),
          "undo",
          "transaction-rollback",
        );
      } catch (error) {
        rollbackError = error;
      } finally {
        this.#operation = undefined;
      }
    }
    this.#closeFrame(frame);
    if (rollbackError) {
      this.#poisonFromRollback(frame.options, rollbackError);
      throw new HistoryPoisonedError(clonePoison(this.#poison!), rollbackError);
    }
    if (this.#poison) throw new HistoryPoisonedError(clonePoison(this.#poison), cause);
  }

  #abortSyncFrame(frame: HistoryTransactionFrame, cause: unknown): never {
    this.#discardSyncFrame(frame, cause);
    throw new HistoryTransactionAbortedError(inspectOptions(frame.options), cause);
  }

  #discardSyncFrame(frame: HistoryTransactionFrame, cause?: unknown): void {
    this.#assertFrameTopForAbort(frame);
    let rollbackError: unknown;
    if (frame.entries.length > 0) {
      this.#operation = "transaction-rollback";
      try {
        this.#executeAtomicSync(
          compositeTransaction(frame.options, frame.entries),
          "undo",
          "transaction-rollback",
        );
      } catch (error) {
        rollbackError = error;
      } finally {
        this.#operation = undefined;
      }
    }
    this.#closeFrame(frame);
    if (rollbackError) {
      this.#poisonFromRollback(frame.options, rollbackError);
      throw new HistoryPoisonedError(clonePoison(this.#poison!), rollbackError);
    }
    if (this.#poison) throw new HistoryPoisonedError(clonePoison(this.#poison), cause);
  }

  #assertFrameTopForAbort(frame: HistoryTransactionFrame): void {
    if (frame.state !== "active" || this.#frames.at(-1) !== frame) {
      throw new HistoryScopeError("Cannot abort a transaction while a nested scope is still active.");
    }
  }

  #closeFrame(frame: HistoryTransactionFrame): void {
    if (this.#frames.at(-1) !== frame) throw new HistoryScopeError("Transaction scopes must close in nesting order.");
    this.#frames.pop();
    frame.state = "closed";
  }

  async #executeAtomic(
    transaction: HistoryTransaction,
    direction: HistoryOperationDirection,
    phase: HistoryOperationPhase,
  ): Promise<void> {
    const steps = historyLeafSteps(transaction, direction);
    const completed: HistoryTransaction[] = [];
    for (const step of steps) {
      try {
        await executeHistoryStep(step, direction);
        completed.push(step);
      } catch (error) {
        const compensationFailures: HistoryCompensationFailureInspection[] = [];
        const compensation = [step, ...completed.slice().reverse()];
        for (const candidate of compensation) {
          try {
            await executeHistoryStep(candidate, oppositeDirection(direction));
          } catch (compensationError) {
            compensationFailures.push({
              entry: inspectEntry(candidate)!,
              error: inspectError(compensationError),
            });
          }
        }
        const failure = historyFailure(phase, direction, transaction, step, error, compensationFailures);
        if (compensationFailures.length > 0) {
          this.#poison = clonePoison({ ...failure, reason: "compensation-failed" });
        }
        throw new HistoryOperationError(failure, compensationFailures.length > 0, error);
      }
    }
  }

  #executeAtomicSync(
    transaction: HistoryTransaction,
    direction: HistoryOperationDirection,
    phase: HistoryOperationPhase,
  ): void {
    const steps = historyLeafSteps(transaction, direction);
    const completed: HistoryTransaction[] = [];
    for (const step of steps) {
      try {
        executeHistoryStepSync(step, direction);
        completed.push(step);
      } catch (error) {
        if (error instanceof AsyncHistoryStepInSyncScopeError) {
          const failure = historyFailure(phase, direction, transaction, step, error, [{
            entry: inspectEntry(step)!,
            error: inspectError(error),
          }]);
          this.#poison = clonePoison({ ...failure, reason: "async-in-sync-scope" });
          throw new HistoryOperationError(failure, true, error);
        }
        const compensationFailures: HistoryCompensationFailureInspection[] = [];
        for (const candidate of [step, ...completed.slice().reverse()]) {
          try {
            executeHistoryStepSync(candidate, oppositeDirection(direction));
          } catch (compensationError) {
            compensationFailures.push({
              entry: inspectEntry(candidate)!,
              error: inspectError(compensationError),
            });
          }
        }
        const failure = historyFailure(phase, direction, transaction, step, error, compensationFailures);
        if (compensationFailures.length > 0) {
          this.#poison = clonePoison({ ...failure, reason: "compensation-failed" });
        }
        throw new HistoryOperationError(failure, compensationFailures.length > 0, error);
      }
    }
  }

  #poisonFromRollback(options: HistoryTransactionOptions, error: unknown): void {
    if (this.#poison) return;
    const entry = inspectOptions(options);
    const failure = error instanceof HistoryOperationError ? error.failure : {
      phase: "transaction-rollback" as const,
      direction: "undo" as const,
      entry,
      failedEntry: entry,
      error: inspectError(error),
      compensationFailures: [],
    };
    this.#poison = clonePoison({ ...failure, reason: "rollback-failed" });
  }
}

function inspectEntry(transaction: HistoryTransaction | undefined): HistoryEntryInspection | undefined {
  if (!transaction) return undefined;
  const inspection: HistoryEntryInspection = {
    id: transaction.id,
    label: transaction.label,
    group: transaction.group,
  };
  if (transaction.coalesce) {
    inspection.coalesceKey = transaction.coalesce.key;
    if (transaction.coalesce.boundary !== undefined) {
      inspection.coalesceBoundary = transaction.coalesce.boundary;
    }
  }
  if (transaction.replaySafety) inspection.replaySafety = transaction.replaySafety.strategy;
  if (isCompositeTransaction(transaction)) {
    inspection.composite = true;
    inspection.operationCount = historyLeafSteps(transaction, "redo").length;
  }
  if (isCoalescedTransaction(transaction)) inspection.coalesced = true;
  return inspection;
}

function inspectOptions(options: HistoryTransactionOptions): HistoryEntryInspection {
  const inspection: HistoryEntryInspection = { id: options.id, label: options.label, group: options.group };
  if (options.coalesce) {
    inspection.coalesceKey = options.coalesce.key;
    if (options.coalesce.boundary !== undefined) inspection.coalesceBoundary = options.coalesce.boundary;
  }
  if (options.replaySafety) inspection.replaySafety = options.replaySafety.strategy;
  return inspection;
}

function normalizeTransactionOptions(options: HistoryTransactionOptions): HistoryTransactionOptions {
  const label = options.label.trim();
  if (!label) throw new TypeError("History transaction label must not be empty.");
  return {
    id: options.id?.trim() || undefined,
    label,
    group: options.group?.trim() || undefined,
    coalesce: normalizeCoalescingMetadata(options.coalesce),
    replaySafety: normalizeReplaySafetyMetadata(options.replaySafety, label),
  };
}

function normalizeCoalescingOptions(
  options: HistoryCoalescingOptions | undefined,
): NormalizedHistoryCoalescingOptions | undefined {
  if (options === undefined) return undefined;
  if (!Number.isFinite(options.idleIntervalMs) || options.idleIntervalMs < 0) {
    throw new TypeError("History coalescing idleIntervalMs must be a non-negative finite number.");
  }
  if (options.now !== undefined && typeof options.now !== "function") {
    throw new TypeError("History coalescing now must be a function.");
  }
  return {
    idleIntervalMs: options.idleIntervalMs,
    now: options.now ?? Date.now,
  };
}

function normalizeCoalescingMetadata(
  metadata: HistoryCoalescingMetadata | undefined,
): HistoryCoalescingMetadata | undefined {
  if (metadata === undefined) return undefined;
  if (typeof metadata !== "object" || metadata === null) {
    throw new TypeError("History coalescing metadata must be an object.");
  }
  const key = typeof metadata.key === "string" ? metadata.key.trim() : "";
  if (!key) throw new TypeError("History coalescing key must not be empty.");
  if (metadata.boundary !== undefined && typeof metadata.boundary !== "string") {
    throw new TypeError("History coalescing boundary must be a string when provided.");
  }
  const boundary = metadata.boundary?.trim() || undefined;
  return boundary === undefined ? { key } : { key, boundary };
}

function normalizeReplaySafetyMetadata(
  metadata: HistoryReplaySafetyMetadata | undefined,
  label: string,
): HistoryReplaySafetyMetadata | undefined {
  if (metadata === undefined) return undefined;
  const entry: HistoryEntryInspection = { label };
  if (typeof metadata !== "object" || metadata === null) {
    throw new HistoryReplaySafetyError(entry, "metadata must be an object");
  }
  if (metadata.sideEffectful !== true) {
    throw new HistoryReplaySafetyError(entry, "sideEffectful must be true");
  }
  if (!isReplayStrategy(metadata.strategy)) {
    throw new HistoryReplaySafetyError(
      entry,
      "strategy must be idempotent, compensatable, or non-replayable",
    );
  }
  return { sideEffectful: true, strategy: metadata.strategy };
}

function prepareHistoryTransaction<T extends HistoryTransaction>(transaction: T): T {
  const label = typeof transaction.label === "string" ? transaction.label : String(transaction.label);
  const replaySafety = normalizeReplaySafetyMetadata(transaction.replaySafety, label);
  if (
    replaySafety &&
    (typeof transaction.undo !== "function" || typeof transaction.redo !== "function")
  ) {
    throw new HistoryReplaySafetyError(
      { id: transaction.id, label, group: transaction.group, replaySafety: replaySafety.strategy },
      "side-effectful entries require both undo and redo callbacks",
    );
  }
  const prepared = {
    ...transaction,
    coalesce: normalizeCoalescingMetadata(transaction.coalesce),
    replaySafety,
    undo: () => transaction.undo(),
    redo: () => transaction.redo(),
  };
  return prepared as T;
}

function isReplayStrategy(value: unknown): value is HistoryReplayStrategy {
  return value === "idempotent" || value === "compensatable" || value === "non-replayable";
}

function compositeTransaction(
  options: HistoryTransactionOptions,
  entries: readonly HistoryTransaction[],
): CompositeHistoryTransaction {
  const children = entries.slice();
  return {
    ...options,
    [HISTORY_COMPOSITE]: children,
    async undo(): Promise<void> {
      for (let index = children.length - 1; index >= 0; index -= 1) await children[index]!.undo();
    },
    async redo(): Promise<void> {
      for (const child of children) await child.redo();
    },
  };
}

function isCompositeTransaction(transaction: HistoryTransaction): transaction is CompositeHistoryTransaction {
  return HISTORY_COMPOSITE in transaction;
}

function coalescedTransaction(
  previous: HistoryTransaction,
  transaction: HistoryTransaction,
): CoalescedHistoryTransaction {
  const children = isCoalescedTransaction(previous)
    ? [...previous[HISTORY_COMPOSITE], transaction]
    : [previous, transaction];
  return {
    ...compositeTransaction({
      id: transaction.id,
      label: transaction.label,
      group: transaction.group,
      coalesce: transaction.coalesce,
      replaySafety: transaction.replaySafety,
    }, children),
    [HISTORY_COALESCED]: true,
  };
}

function isCoalescedTransaction(transaction: HistoryTransaction): transaction is CoalescedHistoryTransaction {
  return isCompositeTransaction(transaction) && HISTORY_COALESCED in transaction;
}

function isNonReplayable(transaction: HistoryTransaction): boolean {
  if (transaction.replaySafety?.strategy === "non-replayable") return true;
  return isCompositeTransaction(transaction) && transaction[HISTORY_COMPOSITE].some(isNonReplayable);
}

function historyLeafSteps(
  transaction: HistoryTransaction,
  direction: HistoryOperationDirection,
): HistoryTransaction[] {
  if (!isCompositeTransaction(transaction)) return [transaction];
  const children = direction === "redo"
    ? transaction[HISTORY_COMPOSITE]
    : transaction[HISTORY_COMPOSITE].slice().reverse();
  const steps: HistoryTransaction[] = [];
  for (const child of children) steps.push(...historyLeafSteps(child, direction));
  return steps;
}

async function executeHistoryStep(
  transaction: HistoryTransaction,
  direction: HistoryOperationDirection,
): Promise<void> {
  await transaction[direction]();
}

function executeHistoryStepSync(
  transaction: HistoryTransaction,
  direction: HistoryOperationDirection,
): void {
  const result = transaction[direction]();
  if (isPromiseLike(result)) {
    void Promise.resolve(result).catch(noop);
    throw new AsyncHistoryStepInSyncScopeError(inspectEntry(transaction)!);
  }
}

function oppositeDirection(direction: HistoryOperationDirection): HistoryOperationDirection {
  return direction === "redo" ? "undo" : "redo";
}

function trackFrameTask<T>(frame: HistoryTransactionFrame, task: Promise<T>): Promise<T> {
  const tracked: HistoryFrameTask = { promise: task, observed: false };
  frame.pendingTasks.add(tracked);
  const observed = new ObservedHistoryPromise<T>(
    (resolve, reject) => {
      void task.then(resolve, reject);
    },
    (handlesRejection) => {
      if (handlesRejection) tracked.observed = true;
    },
  );
  observed.silenceUnhandledRejection();
  return observed;
}

/** A real Promise that records whether caller code joined or handled it. */
class ObservedHistoryPromise<T> extends Promise<T> {
  readonly #observe?: (handlesRejection: boolean) => void;

  constructor(
    executor: ConstructorParameters<typeof Promise<T>>[0],
    observe?: (handlesRejection: boolean) => void,
  ) {
    super(executor);
    this.#observe = observe;
  }

  override then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    this.#observe?.(typeof onrejected === "function");
    return super.then(onfulfilled, onrejected);
  }

  silenceUnhandledRejection(): void {
    void super.then(undefined, noop);
  }
}

function historyFailure(
  phase: HistoryOperationPhase,
  direction: HistoryOperationDirection,
  transaction: HistoryTransaction,
  failed: HistoryTransaction,
  error: unknown,
  compensationFailures: HistoryCompensationFailureInspection[],
): HistoryFailureInspection {
  return {
    phase,
    direction,
    entry: inspectEntry(transaction)!,
    failedEntry: inspectEntry(failed)!,
    error: inspectError(error),
    compensationFailures,
  };
}

function inspectError(error: unknown): HistoryErrorInspection {
  if (error instanceof Error) return { name: error.name || "Error", message: error.message };
  if (typeof error === "string") return { name: "Error", message: error };
  try {
    return { name: "Error", message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { name: "Error", message: String(error) };
  }
}

function clonePoison(poison: HistoryPoisonInspection): HistoryPoisonInspection {
  return {
    ...poison,
    entry: { ...poison.entry },
    failedEntry: { ...poison.failedEntry },
    error: { ...poison.error },
    compensationFailures: poison.compensationFailures.map((failure) => ({
      entry: { ...failure.entry },
      error: { ...failure.error },
    })),
  };
}

function cloneReplayBarrier(barrier: HistoryReplayBarrierInspection): HistoryReplayBarrierInspection {
  return {
    sequence: barrier.sequence,
    entry: { ...barrier.entry },
  };
}

function safeHistoryNow(now: () => number): number | undefined {
  try {
    const timestamp = now();
    return Number.isFinite(timestamp) ? timestamp : undefined;
  } catch {
    // Coalescing is an optimization; a broken clock cuts the stream rather than
    // leaving successfully applied state outside history.
    return undefined;
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return ((typeof value === "object" && value !== null) || typeof value === "function") && "then" in value &&
    typeof (value as { then?: unknown }).then === "function";
}

class AsyncHistoryStepInSyncScopeError extends Error {
  constructor(readonly entry: HistoryEntryInspection) {
    super(`History step "${entry.label}" returned a promise inside transactionSync.`);
    this.name = "AsyncHistoryStepInSyncScopeError";
  }
}

function noop(): void {}

/** Identifier union for history Command variants. */
export type HistoryCommandKind = "undo" | "redo" | "clear";

/** Options for configuring history Command. */
export interface HistoryCommandOptions extends LabeledCommandGroupOptions<HistoryCommandKind> {
  includeClear?: boolean;
}

/** Options for configuring route History Binding. */
export interface RouteHistoryBindingOptions<TRoute extends Route = Route> {
  group?: string;
  label?: (previousRoute: TRoute, nextRoute: TRoute) => string;
  id?: (previousRoute: TRoute, nextRoute: TRoute) => string;
  navigate?: (routeId: string) => void | Promise<void>;
}

/** Binds route History behavior and returns a disposer when applicable. */
export function bindRouteHistory<TRoute extends Route = Route>(
  routes: RouteManager<TRoute>,
  history: HistoryStack,
  options: RouteHistoryBindingOptions<TRoute> = {},
): () => void {
  let previousId = routes.activeRouteId.peek();
  let replaying = false;

  const routeById = (id: string) => routes.routes.peek().find((route) => route.id === id);
  const navigate = options.navigate ?? ((routeId: string) => routes.navigate(routeId));
  const replay = async (routeId: string) => {
    replaying = true;
    try {
      await navigate(routeId);
      previousId = routeId;
    } finally {
      replaying = false;
    }
  };

  const listener = (nextId: string) => {
    if (replaying || nextId === previousId) return;
    const previousRoute = routeById(previousId);
    const nextRoute = routeById(nextId);
    previousId = nextId;
    if (!previousRoute || !nextRoute) return;

    history.push({
      id: options.id?.(previousRoute, nextRoute) ?? `route.${previousRoute.id}.${nextRoute.id}`,
      label: options.label?.(previousRoute, nextRoute) ??
        `Route ${previousRoute.title ?? previousRoute.id} -> ${nextRoute.title ?? nextRoute.id}`,
      group: options.group ?? "routes",
      undo: () => replay(previousRoute.id),
      redo: () => replay(nextRoute.id),
    });
  };

  routes.activeRouteId.subscribe(listener);

  return () => {
    routes.activeRouteId.unsubscribe(listener);
  };
}

/** Builds command definitions for history. */
export function historyCommands<TAction extends Action = Action>(
  history: HistoryStack,
  options: HistoryCommandOptions = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "history";
  const group = options.group ?? "history";
  const label = (kind: HistoryCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const commands: Command<TAction>[] = [
    {
      id: `${idPrefix}.undo`,
      label: label("undo", "Undo"),
      group,
      binding: { key: "z", ctrl: true },
      disabled: () => !history.canUndo(),
      action: async () => {
        await history.undo();
      },
    },
    {
      id: `${idPrefix}.redo`,
      label: label("redo", "Redo"),
      group,
      binding: { key: "y", ctrl: true },
      disabled: () => !history.canRedo(),
      action: async () => {
        await history.redo();
      },
    },
  ];

  if (options.includeClear ?? false) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear History"),
      group,
      disabled: () => !history.isPoisoned() && !history.canUndo() && !history.canRedo(),
      action: () => history.clear(),
    });
  }

  return commands;
}

/** Binds history Commands behavior and returns a disposer when applicable. */
export function bindHistoryCommands<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  history: HistoryStack,
  options: HistoryCommandOptions = {},
): () => void {
  return registry.registerAll(historyCommands<TAction>(history, options));
}
