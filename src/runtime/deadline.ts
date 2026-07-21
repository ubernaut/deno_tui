// Copyright 2023 Im-Beast. MIT license.

import { MAX_MONOTONIC_TIME, type TimerHandle, type TimerScheduler } from "./clock.ts";

/** Observable lifecycle of one deadline budget. */
export type DeadlineBudgetStatus = "active" | "expired" | "cancelled" | "disposed";

/** Typed origin for non-timeout budget cancellation. */
export type DeadlineBudgetCancellationSource =
  | "cancel"
  | "dispose"
  | "parent"
  | "signal"
  | "clock"
  | "scheduler";

/** Clone-safe summary of the reason that ended a budget. */
export interface DeadlineBudgetReasonInspection {
  name: string;
  message: string;
  code: "DEADLINE_EXCEEDED" | "DEADLINE_BUDGET_CANCELLED";
  source: "deadline" | DeadlineBudgetCancellationSource;
}

/** Bounded clone-safe state for one deadline budget. */
export interface DeadlineBudgetInspection {
  status: DeadlineBudgetStatus;
  deadlineMs: number;
  requestedDeadlineMs?: number;
  remainingMs: number;
  inherited: boolean;
  limitedByParent: boolean;
  signalAborted: boolean;
  timerArmed: boolean;
  externalSignalLinked: boolean;
  childCount: number;
  reason?: DeadlineBudgetReasonInspection;
}

/** Optional child constraint. Omitting both fields inherits the parent deadline exactly. */
export interface DeadlineBudgetChildOptions {
  timeoutMs?: number;
  deadlineMs?: number;
  signal?: AbortSignal;
  onTransition?: (inspection: DeadlineBudgetInspection) => void;
}

/** Construction options for a root or explicitly parented deadline budget. */
export interface DeadlineBudgetOptions extends DeadlineBudgetChildOptions {
  /** Required for a root. A child always uses its parent's scheduler and clock domain. */
  scheduler?: TimerScheduler;
  /** Prefer `parent.createChild()`; this field supports dependency-injected factories. */
  parent?: DeadlineBudget;
}

/** Typed reason used only when a monotonic deadline is reached. */
export class DeadlineExceededError extends Error {
  readonly code = "DEADLINE_EXCEEDED";

  constructor(
    readonly deadlineMs: number,
    readonly observedMs: number,
  ) {
    super(`Deadline ${deadlineMs}ms was exceeded at ${observedMs}ms.`);
    this.name = "DeadlineExceededError";
  }
}

/** Typed reason for explicit, inherited, external, or infrastructure cancellation. */
export class DeadlineBudgetCancellationError extends Error {
  readonly code = "DEADLINE_BUDGET_CANCELLED";

  constructor(
    readonly source: DeadlineBudgetCancellationSource,
    readonly reason?: unknown,
    readonly causalError?: unknown,
  ) {
    super(cancellationMessage(source));
    this.name = "DeadlineBudgetCancellationError";
  }
}

/**
 * Renderer-neutral timeout budget backed exclusively by a caller-owned timer
 * scheduler. Children share the parent's clock domain and may only preserve or
 * tighten its immutable absolute deadline.
 */
export class DeadlineBudget {
  readonly #scheduler: TimerScheduler;
  readonly #controller = new AbortController();
  readonly #deadlineMs: number;
  readonly #requestedDeadlineMs?: number;
  readonly #inherited: boolean;
  readonly #limitedByParent: boolean;
  readonly #children = new Set<DeadlineBudget>();
  readonly #onTransition?: (inspection: DeadlineBudgetInspection) => void;
  #parent?: DeadlineBudget;
  #externalSignal?: AbortSignal;
  #externalAbort?: () => void;
  #timer?: TimerHandle;
  #timerGeneration = 0;
  #status: DeadlineBudgetStatus = "active";
  #reason?: DeadlineExceededError | DeadlineBudgetCancellationError;

  constructor(options: DeadlineBudgetOptions) {
    if (!options || typeof options !== "object") {
      throw new TypeError("Deadline budget options are required.");
    }
    validateConstraint(options.timeoutMs, options.deadlineMs);
    const parent = options.parent;
    if (!parent && !options.scheduler) {
      throw new TypeError("A root deadline budget requires a timer scheduler.");
    }
    if (!parent && options.timeoutMs === undefined && options.deadlineMs === undefined) {
      throw new TypeError("A root deadline budget requires timeoutMs or deadlineMs.");
    }
    if (parent && options.scheduler && options.scheduler !== parent.#scheduler) {
      throw new TypeError("A child deadline budget must use its parent's timer scheduler.");
    }

    this.#scheduler = parent ? parent.#scheduler : options.scheduler!;
    this.#onTransition = options.onTransition;

    const now = readNow(this.#scheduler);
    const requested = requestedDeadline(now, options.timeoutMs, options.deadlineMs);
    this.#requestedDeadlineMs = requested;
    this.#inherited = parent !== undefined && requested === undefined;
    this.#limitedByParent = parent !== undefined && (requested === undefined || requested > parent.deadlineMs);
    this.#deadlineMs = parent ? Math.min(requested ?? parent.deadlineMs, parent.deadlineMs) : requested!;

    // Read structurally supplied signal state before linking the child into its
    // parent. A throwing accessor must never strand an unreachable descendant.
    const externalSignal = options.signal;
    let externalAborted = false;
    let externalReason: unknown;
    if (externalSignal) {
      externalAborted = externalSignal.aborted;
      if (externalAborted) externalReason = externalSignal.reason;
    }

    if (parent) {
      if (parent.#status !== "active") {
        this.abortFromParent(parent.#reason!);
        return;
      }
      this.#parent = parent;
      parent.#children.add(this);
    }

    if (externalAborted) {
      this.abortFromSignal(externalReason);
      return;
    }
    if (externalSignal) {
      const abort = () => this.abortFromSignal(readAbortReason(externalSignal));
      this.#externalSignal = externalSignal;
      this.#externalAbort = abort;
      try {
        externalSignal.addEventListener("abort", abort, { once: true });
        // Native AbortSignals do not replay an event to a listener installed
        // after abort. Recheck to close the initial-read/listener-install race.
        if (this.#status === "active" && externalSignal.aborted) {
          this.abortFromSignal(readAbortReason(externalSignal));
          return;
        }
      } catch (error) {
        this.unlinkExternalSignal();
        this.unlinkParent();
        throw error;
      }
    }

    if (this.deadlineMs <= now) {
      this.transition(new DeadlineExceededError(this.deadlineMs, now), "expired");
      return;
    }

    // A deadline inherited unchanged is driven by the parent's one timer.
    if (!parent || this.deadlineMs < parent.deadlineMs) {
      try {
        this.armTimer();
      } catch (error) {
        this.unlinkExternalSignal();
        this.unlinkParent();
        throw error;
      }
    }
  }

  get status(): DeadlineBudgetStatus {
    return this.#status;
  }

  /** Immutable absolute deadline in the injected monotonic clock domain. */
  get deadlineMs(): number {
    return this.#deadlineMs;
  }

  /** Absolute deadline requested by this budget before parent tightening. */
  get requestedDeadlineMs(): number | undefined {
    return this.#requestedDeadlineMs;
  }

  /** Whether this budget inherited its parent deadline without a constraint. */
  get inherited(): boolean {
    return this.#inherited;
  }

  /** Whether the parent shortened or supplied this budget's deadline. */
  get limitedByParent(): boolean {
    return this.#limitedByParent;
  }

  /** AbortSignal that carries the exact typed terminal reason. */
  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  get expired(): boolean {
    return this.#status === "expired";
  }

  /** Returns non-negative time remaining according to the injected clock. */
  remainingMs(): number {
    if (this.#status !== "active") return 0;
    let now: number;
    try {
      now = readNow(this.#scheduler);
    } catch (error) {
      this.transition(
        new DeadlineBudgetCancellationError("clock", error, error),
        "cancelled",
      );
      return 0;
    }
    // scheduler.now() is caller-owned and may reenter lifecycle methods.
    if (this.#status !== "active") return 0;
    return Math.max(0, this.deadlineMs - now);
  }

  /** Creates a child in the same clock domain whose deadline cannot exceed this one. */
  createChild(options: DeadlineBudgetChildOptions = {}): DeadlineBudget {
    return new DeadlineBudget({ ...options, parent: this });
  }

  /** Throws the exact typed signal reason after eagerly observing a due deadline. */
  throwIfExpired(): void {
    if (this.#status === "active") {
      let now: number | undefined;
      try {
        now = readNow(this.#scheduler);
      } catch (error) {
        this.transition(
          new DeadlineBudgetCancellationError("clock", error, error),
          "cancelled",
        );
      }
      if (this.#status === "active" && now !== undefined && now >= this.deadlineMs) {
        this.transition(new DeadlineExceededError(this.deadlineMs, now), "expired");
      }
    }
    if (this.signal.aborted) throw this.signal.reason;
  }

  /** Explicitly cancels this budget and every descendant without cancelling its parent. */
  cancel(reason?: unknown): boolean {
    return this.transition(
      new DeadlineBudgetCancellationError("cancel", reason, reason),
      "cancelled",
    );
  }

  /** Disposes owned linkage and cancels every live descendant. The scheduler remains caller-owned. */
  dispose(reason?: unknown): boolean {
    return this.transition(
      new DeadlineBudgetCancellationError("dispose", reason, reason),
      "disposed",
    );
  }

  /** Returns a defensive JSON/structured-clone-safe snapshot with no raw causes. */
  inspect(): DeadlineBudgetInspection {
    const remainingMs = this.remainingMs();
    // remainingMs() may fail closed or may be reentered by a caller clock, so
    // every lifecycle field is captured only after that observation settles.
    return {
      status: this.#status,
      deadlineMs: this.deadlineMs,
      requestedDeadlineMs: this.requestedDeadlineMs,
      remainingMs,
      inherited: this.inherited,
      limitedByParent: this.limitedByParent,
      signalAborted: this.signal.aborted,
      timerArmed: this.#timer !== undefined,
      externalSignalLinked: this.#externalAbort !== undefined,
      childCount: this.#children.size,
      reason: this.#reason ? inspectReason(this.#reason) : undefined,
    };
  }

  private armTimer(): void {
    if (this.#status !== "active") return;
    const generation = ++this.#timerGeneration;
    const handle = this.#scheduler.scheduleAt(this.deadlineMs, () => {
      if (this.#status !== "active" || generation !== this.#timerGeneration) return;
      this.#timer = undefined;
      this.onTimer();
    });
    if (
      this.#status === "active" && generation === this.#timerGeneration &&
      this.#timer === undefined
    ) {
      this.#timer = handle;
    }
  }

  private onTimer(): void {
    let now: number;
    try {
      now = readNow(this.#scheduler);
    } catch (error) {
      this.transition(
        new DeadlineBudgetCancellationError("clock", error, error),
        "cancelled",
      );
      return;
    }
    if (now < this.deadlineMs) {
      try {
        this.armTimer();
      } catch (error) {
        this.transition(
          new DeadlineBudgetCancellationError("scheduler", error, error),
          "cancelled",
        );
      }
      return;
    }
    this.transition(new DeadlineExceededError(this.deadlineMs, now), "expired");
  }

  private abortFromParent(reason: DeadlineExceededError | DeadlineBudgetCancellationError): void {
    this.transition(
      new DeadlineBudgetCancellationError("parent", reason, reason),
      "cancelled",
    );
  }

  private abortFromSignal(reason: unknown): void {
    this.transition(
      new DeadlineBudgetCancellationError("signal", reason, reason),
      "cancelled",
    );
  }

  private transition(
    reason: DeadlineExceededError | DeadlineBudgetCancellationError,
    status: Exclude<DeadlineBudgetStatus, "active">,
  ): boolean {
    const descendants = this.beginTransition(reason, status);
    if (!descendants) return false;

    // Explicit frames preserve the former deterministic depth-first/post-order
    // observer behavior without using the JavaScript call stack. Deep resource
    // trees therefore cannot strand active descendants on stack overflow.
    const stack: DeadlineTransitionFrame[] = [{
      budget: this,
      reason,
      children: descendants,
      childIndex: 0,
    }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const child = frame.children[frame.childIndex];
      if (child) {
        frame.childIndex += 1;
        const childReason = new DeadlineBudgetCancellationError(
          "parent",
          frame.reason,
          frame.reason,
        );
        const grandchildren = child.beginTransition(childReason, "cancelled");
        if (grandchildren) {
          stack.push({
            budget: child,
            reason: childReason,
            children: grandchildren,
            childIndex: 0,
          });
        }
        continue;
      }
      frame.budget.notifyTransition();
      stack.pop();
    }
    return true;
  }

  private beginTransition(
    reason: DeadlineExceededError | DeadlineBudgetCancellationError,
    status: Exclude<DeadlineBudgetStatus, "active">,
  ): DeadlineBudget[] | undefined {
    if (this.#status !== "active") return undefined;
    this.#status = status;
    this.#reason = reason;

    const timer = this.#timer;
    this.#timer = undefined;
    this.#timerGeneration += 1;
    if (timer) {
      try {
        timer.cancel();
      } catch {
        // A hostile caller adapter cannot prevent fail-closed cancellation.
      }
    }
    this.unlinkExternalSignal();
    this.unlinkParent();

    const children = [...this.#children];
    this.#children.clear();

    try {
      this.#controller.abort(reason);
    } catch {
      // Abort listeners are observers and cannot prevent descendant cleanup.
    }

    return children;
  }

  private notifyTransition(): void {
    if (this.#onTransition) {
      try {
        this.#onTransition(this.inspect());
      } catch {
        // Transition observers are diagnostics only.
      }
    }
  }

  private unlinkParent(): void {
    const parent = this.#parent;
    this.#parent = undefined;
    if (parent) parent.#children.delete(this);
  }

  private unlinkExternalSignal(): void {
    const signal = this.#externalSignal;
    const abort = this.#externalAbort;
    this.#externalSignal = undefined;
    this.#externalAbort = undefined;
    if (signal && abort) {
      try {
        signal.removeEventListener("abort", abort);
      } catch {
        // Link cleanup is best effort for structurally hostile signals.
      }
    }
  }
}

interface DeadlineTransitionFrame {
  budget: DeadlineBudget;
  reason: DeadlineExceededError | DeadlineBudgetCancellationError;
  children: DeadlineBudget[];
  childIndex: number;
}

/** Creates a root or explicitly parented deadline budget. */
export function createDeadlineBudget(options: DeadlineBudgetOptions): DeadlineBudget {
  return new DeadlineBudget(options);
}

/** Returns whether an unknown value is the exact deadline timeout type. */
export function isDeadlineExceededError(error: unknown): error is DeadlineExceededError {
  return error instanceof DeadlineExceededError;
}

/** Returns whether an unknown value is the exact non-timeout cancellation type. */
export function isDeadlineBudgetCancellationError(
  error: unknown,
): error is DeadlineBudgetCancellationError {
  return error instanceof DeadlineBudgetCancellationError;
}

function validateConstraint(timeoutMs: number | undefined, deadlineMs: number | undefined): void {
  if (timeoutMs !== undefined && deadlineMs !== undefined) {
    throw new TypeError("Specify timeoutMs or deadlineMs, not both.");
  }
  if (timeoutMs !== undefined) validateTime(timeoutMs, "timeoutMs");
  if (deadlineMs !== undefined) validateTime(deadlineMs, "deadlineMs");
}

function requestedDeadline(
  now: number,
  timeoutMs: number | undefined,
  deadlineMs: number | undefined,
): number | undefined {
  if (deadlineMs !== undefined) return deadlineMs;
  if (timeoutMs === undefined) return undefined;
  if (now > MAX_MONOTONIC_TIME - timeoutMs) {
    throw new RangeError("timeoutMs overflows the monotonic time range.");
  }
  return now + timeoutMs;
}

function readNow(scheduler: TimerScheduler): number {
  return validateTime(scheduler.now(), "scheduler.now() result");
}

function readAbortReason(signal: AbortSignal): unknown {
  try {
    return signal.reason;
  } catch (error) {
    return error;
  }
}

function validateTime(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONOTONIC_TIME) {
    throw new RangeError(`${name} must be finite and between 0 and ${MAX_MONOTONIC_TIME}.`);
  }
  return value;
}

function inspectReason(
  reason: DeadlineExceededError | DeadlineBudgetCancellationError,
): DeadlineBudgetReasonInspection {
  return {
    name: reason.name,
    message: reason.message,
    code: reason.code,
    source: reason instanceof DeadlineExceededError ? "deadline" : reason.source,
  };
}

function cancellationMessage(source: DeadlineBudgetCancellationSource): string {
  switch (source) {
    case "cancel":
      return "Deadline budget was cancelled.";
    case "dispose":
      return "Deadline budget was disposed.";
    case "parent":
      return "Parent deadline budget ended.";
    case "signal":
      return "An external abort signal cancelled the deadline budget.";
    case "clock":
      return "The deadline budget clock failed.";
    case "scheduler":
      return "The deadline budget scheduler failed.";
  }
}
