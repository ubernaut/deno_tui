// Copyright 2023 Im-Beast. MIT license.

/** Largest exactly representable monotonic timestamp or duration. */
export const MAX_MONOTONIC_TIME = Number.MAX_SAFE_INTEGER;

/** A dependency-free source of non-decreasing milliseconds. */
export interface MonotonicClock {
  now(): number;
}

/** Lifecycle state of one scheduled timer. */
export type TimerStatus =
  | "scheduled"
  | "running"
  | "awaiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "disposed";

/** Phase in which an isolated timer error occurred. */
export type TimerSchedulerErrorPhase =
  | "clock"
  | "schedule"
  | "cancel"
  | "dispose"
  | "callback"
  | "async-callback"
  | "advance-limit";

/** Callback accepted by a timer scheduler. Async results are observed, not awaited. */
export type TimerCallback = () => unknown;

/** Clone-safe state for one timer. */
export interface TimerInspection {
  id: number;
  sequence: number;
  deadlineMs: number;
  status: TimerStatus;
}

/** Cancellable handle for one timer. */
export interface TimerHandle {
  readonly id: number;
  readonly deadlineMs: number;
  cancel(): boolean;
  inspect(): TimerInspection;
}

/** Clone-safe context supplied to the optional error observer. */
export interface TimerSchedulerErrorContext {
  scheduler: "host" | "virtual";
  phase: TimerSchedulerErrorPhase;
  timer?: TimerInspection;
}

/** Bounded, clone-safe scheduler state. */
export interface TimerSchedulerInspection {
  scheduler: "host" | "virtual";
  now: number;
  disposed: boolean;
  pending: number;
  running: number;
  awaiting: number;
  scheduled: number;
  completed: number;
  failed: number;
  cancelled: number;
  disposedTimers: number;
  clockRegressions: number;
  advanceLimitHits: number;
  inspectionLimit: number;
  truncated: number;
  timers: TimerInspection[];
}

/** Common renderer-neutral timer scheduler contract. */
export interface TimerScheduler extends MonotonicClock {
  readonly disposed: boolean;
  scheduleAt(deadlineMs: number, callback: TimerCallback): TimerHandle;
  scheduleAfter(delayMs: number, callback: TimerCallback): TimerHandle;
  inspect(): TimerSchedulerInspection;
  dispose(): void;
}

/** Shared construction options for host and virtual schedulers. */
export interface TimerSchedulerOptions {
  maxInspectionEntries?: number;
  onError?: (error: unknown, context: TimerSchedulerErrorContext) => void;
}

/** Injected host timing primitives. Defaults are read only when an instance is constructed. */
export interface HostTimerSchedulerOptions extends TimerSchedulerOptions {
  now?: () => number;
  setTimeout?: (callback: () => void, delayMs: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  /** Long deadlines are re-armed in chunks no larger than this value. */
  maxHostDelayMs?: number;
}

/** Deterministic virtual scheduler construction options. */
export interface VirtualTimerSchedulerOptions extends TimerSchedulerOptions {
  startTimeMs?: number;
  maxCallbacksPerAdvance?: number;
}

/** Optional per-advance callback bound. */
export interface VirtualTimerAdvanceOptions {
  maxCallbacks?: number;
}

/** Result of one deterministic virtual-time advance. */
export interface VirtualTimerAdvanceResult {
  fromMs: number;
  requestedToMs: number;
  reachedMs: number;
  callbacks: number;
  limitReached: boolean;
  disposed: boolean;
  pending: number;
  nextDeadlineMs?: number;
}

/** Raised when scheduling is attempted after scheduler disposal. */
export class TimerSchedulerDisposedError extends Error {
  constructor() {
    super("Timer scheduler is disposed.");
    this.name = "TimerSchedulerDisposedError";
  }
}

/** Raised when virtual time is advanced recursively from a running advance. */
export class TimerSchedulerReentrancyError extends Error {
  constructor() {
    super("Virtual timer advancement cannot be re-entered.");
    this.name = "TimerSchedulerReentrancyError";
  }
}

/** Reported when a virtual advance stops at its callback safety bound. */
export class TimerAdvanceLimitError extends Error {
  constructor(
    readonly maxCallbacks: number,
    readonly reachedMs: number,
  ) {
    super(`Virtual timer advance stopped after ${maxCallbacks} callbacks at ${reachedMs}ms.`);
    this.name = "TimerAdvanceLimitError";
  }
}

/** Reported when an injected host clock moves backwards. The public clock remains clamped. */
export class MonotonicClockRegressionError extends Error {
  constructor(
    readonly previousMs: number,
    readonly observedMs: number,
  ) {
    super(`Injected clock moved backwards from ${previousMs}ms to ${observedMs}ms.`);
    this.name = "MonotonicClockRegressionError";
  }
}

interface InternalTimer {
  id: number;
  sequence: number;
  deadlineMs: number;
  status: TimerStatus;
  callback?: TimerCallback;
  hostHandle?: unknown;
  hostHandleActive?: boolean;
}

const DEFAULT_INSPECTION_LIMIT = 100;
const DEFAULT_MAX_CALLBACKS_PER_ADVANCE = 10_000;
const DEFAULT_MAX_HOST_DELAY_MS = 2_147_483_647;

abstract class TimerSchedulerBase implements TimerScheduler {
  readonly #scheduler: "host" | "virtual";
  readonly #maxInspectionEntries: number;
  readonly #onError?: (error: unknown, context: TimerSchedulerErrorContext) => void;
  readonly #active = new Map<number, InternalTimer>();
  #nextId = 1;
  #nextSequence = 0;
  #disposed = false;
  #scheduled = 0;
  #completed = 0;
  #failed = 0;
  #cancelled = 0;
  #disposedTimers = 0;
  #running = 0;
  #awaiting = 0;
  #clockRegressions = 0;
  #advanceLimitHits = 0;

  constructor(scheduler: "host" | "virtual", options: TimerSchedulerOptions) {
    this.#scheduler = scheduler;
    this.#maxInspectionEntries = validateNonNegativeInteger(
      options.maxInspectionEntries ?? DEFAULT_INSPECTION_LIMIT,
      "maxInspectionEntries",
    );
    this.#onError = options.onError;
  }

  abstract now(): number;

  get disposed(): boolean {
    return this.#disposed;
  }

  scheduleAt(deadlineMs: number, callback: TimerCallback): TimerHandle {
    this.assertOpen();
    const requestedDeadline = validateTime(deadlineMs, "deadlineMs");
    const effectiveDeadline = Math.max(this.now(), requestedDeadline);
    return this.schedule(effectiveDeadline, callback);
  }

  scheduleAfter(delayMs: number, callback: TimerCallback): TimerHandle {
    this.assertOpen();
    const delay = validateTime(delayMs, "delayMs");
    const deadline = addTime(this.now(), delay, "delayMs");
    return this.schedule(deadline, callback);
  }

  inspect(): TimerSchedulerInspection {
    const active = [...this.#active.values()].sort(compareTimers);
    const timers = active.slice(0, this.#maxInspectionEntries).map(inspectTimer);
    let pending = 0;
    for (const timer of active) {
      if (timer.status === "scheduled") pending += 1;
    }
    return {
      scheduler: this.#scheduler,
      now: this.now(),
      disposed: this.#disposed,
      pending,
      running: this.#running,
      awaiting: this.#awaiting,
      scheduled: this.#scheduled,
      completed: this.#completed,
      failed: this.#failed,
      cancelled: this.#cancelled,
      disposedTimers: this.#disposedTimers,
      clockRegressions: this.#clockRegressions,
      advanceLimitHits: this.#advanceLimitHits,
      inspectionLimit: this.#maxInspectionEntries,
      truncated: Math.max(0, active.length - timers.length),
      timers,
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const timer of [...this.#active.values()]) {
      if (timer.status === "scheduled") {
        this.cancelTimer(timer, "disposed", "dispose");
      }
    }
  }

  protected abstract enqueue(timer: InternalTimer): void;
  protected abstract dequeue(timer: InternalTimer): void;

  protected invoke(timer: InternalTimer): boolean {
    if (timer.status !== "scheduled") return false;
    const callback = timer.callback!;
    timer.callback = undefined;
    timer.status = "running";
    this.#running += 1;

    let result: unknown;
    try {
      result = callback();
    } catch (error) {
      this.#running -= 1;
      this.settleFailure(timer, error, "callback");
      return true;
    }
    this.#running -= 1;

    let asyncResult: Promise<unknown> | undefined;
    try {
      asyncResult = assimilatePromiseLike(result);
    } catch (error) {
      this.settleFailure(timer, error, "callback");
      return true;
    }

    if (!asyncResult) {
      this.settleCompleted(timer);
      return true;
    }

    timer.status = "awaiting";
    this.#awaiting += 1;
    asyncResult.then(
      () => this.settleAsyncCompleted(timer),
      (error) => this.settleAsyncFailure(timer, error),
    );
    return true;
  }

  protected failScheduledTimer(
    timer: InternalTimer,
    error: unknown,
    phase: TimerSchedulerErrorPhase,
  ): void {
    if (timer.status !== "scheduled") return;
    timer.callback = undefined;
    timer.status = "failed";
    this.#active.delete(timer.id);
    this.#failed += 1;
    this.reportError(error, phase, timer);
  }

  protected reportClockError(error: unknown, regression = false): void {
    if (regression) this.#clockRegressions += 1;
    this.reportError(error, "clock");
  }

  protected reportAdvanceLimit(error: TimerAdvanceLimitError, timer?: InternalTimer): void {
    this.#advanceLimitHits += 1;
    this.reportError(error, "advance-limit", timer);
  }

  protected assertOpen(): void {
    if (this.#disposed) throw new TimerSchedulerDisposedError();
  }

  protected get pendingTimerCount(): number {
    let count = 0;
    for (const timer of this.#active.values()) {
      if (timer.status === "scheduled") count += 1;
    }
    return count;
  }

  private schedule(deadlineMs: number, callback: TimerCallback): TimerHandle {
    if (typeof callback !== "function") {
      throw new TypeError("Timer callback must be a function.");
    }
    if (this.#nextId > Number.MAX_SAFE_INTEGER || this.#nextSequence > Number.MAX_SAFE_INTEGER) {
      throw new RangeError("Timer identifier space is exhausted.");
    }
    const timer: InternalTimer = {
      id: this.#nextId++,
      sequence: this.#nextSequence++,
      deadlineMs,
      status: "scheduled",
      callback,
    };
    this.#active.set(timer.id, timer);
    this.#scheduled += 1;

    try {
      this.enqueue(timer);
    } catch (error) {
      this.failScheduledTimer(timer, error, "schedule");
      throw error;
    }

    return Object.freeze({
      id: timer.id,
      deadlineMs: timer.deadlineMs,
      cancel: (): boolean => this.cancelTimer(timer, "cancelled", "cancel"),
      inspect: (): TimerInspection => inspectTimer(timer),
    });
  }

  private cancelTimer(
    timer: InternalTimer,
    status: "cancelled" | "disposed",
    phase: "cancel" | "dispose",
  ): boolean {
    if (timer.status !== "scheduled") return false;
    try {
      this.dequeue(timer);
    } catch (error) {
      this.reportError(error, phase, timer);
    }
    timer.callback = undefined;
    timer.status = status;
    this.#active.delete(timer.id);
    if (status === "cancelled") this.#cancelled += 1;
    else this.#disposedTimers += 1;
    return true;
  }

  private settleCompleted(timer: InternalTimer): void {
    timer.status = "completed";
    this.#active.delete(timer.id);
    this.#completed += 1;
  }

  private settleFailure(
    timer: InternalTimer,
    error: unknown,
    phase: "callback" | "async-callback",
  ): void {
    timer.status = "failed";
    this.#active.delete(timer.id);
    this.#failed += 1;
    this.reportError(error, phase, timer);
  }

  private settleAsyncCompleted(timer: InternalTimer): void {
    if (timer.status !== "awaiting") return;
    this.#awaiting -= 1;
    this.settleCompleted(timer);
  }

  private settleAsyncFailure(timer: InternalTimer, error: unknown): void {
    if (timer.status !== "awaiting") return;
    this.#awaiting -= 1;
    this.settleFailure(timer, error, "async-callback");
  }

  private reportError(
    error: unknown,
    phase: TimerSchedulerErrorPhase,
    timer?: InternalTimer,
  ): void {
    if (!this.#onError) return;
    try {
      this.#onError(error, {
        scheduler: this.#scheduler,
        phase,
        timer: timer ? inspectTimer(timer) : undefined,
      });
    } catch {
      // Error observers are diagnostic sinks and cannot break timer isolation.
    }
  }
}

/**
 * Host-backed monotonic scheduler. Long or early host wakeups are re-armed.
 * It never patches or captures global timers at module import time.
 */
export class HostTimerScheduler extends TimerSchedulerBase {
  readonly #nowProvider: () => number;
  readonly #setTimeoutProvider: (callback: () => void, delayMs: number) => unknown;
  readonly #clearTimeoutProvider: (handle: unknown) => void;
  readonly #maxHostDelayMs: number;
  #lastNow = 0;

  constructor(options: HostTimerSchedulerOptions = {}) {
    super("host", options);
    this.#nowProvider = options.now ?? defaultHostNow;
    this.#setTimeoutProvider = options.setTimeout ?? defaultHostSetTimeout;
    this.#clearTimeoutProvider = options.clearTimeout ?? defaultHostClearTimeout;
    this.#maxHostDelayMs = validatePositiveTime(
      options.maxHostDelayMs ?? DEFAULT_MAX_HOST_DELAY_MS,
      "maxHostDelayMs",
    );
  }

  now(): number {
    let observed: number;
    try {
      observed = validateTime(this.#nowProvider(), "now() result");
    } catch (error) {
      this.reportClockError(error);
      throw error;
    }
    if (observed < this.#lastNow) {
      const error = new MonotonicClockRegressionError(this.#lastNow, observed);
      this.reportClockError(error, true);
      return this.#lastNow;
    }
    this.#lastNow = observed;
    return observed;
  }

  protected enqueue(timer: InternalTimer): void {
    this.arm(timer);
  }

  protected dequeue(timer: InternalTimer): void {
    if (!timer.hostHandleActive) return;
    const handle = timer.hostHandle;
    timer.hostHandle = undefined;
    timer.hostHandleActive = false;
    this.#clearTimeoutProvider(handle);
  }

  private arm(timer: InternalTimer): void {
    const remaining = Math.max(0, timer.deadlineMs - this.now());
    const delay = Math.min(remaining, this.#maxHostDelayMs);
    let firedSynchronously = false;
    const handle = this.#setTimeoutProvider(() => {
      firedSynchronously = true;
      timer.hostHandle = undefined;
      timer.hostHandleActive = false;
      this.wake(timer);
    }, delay);
    if (!firedSynchronously && timer.status === "scheduled") {
      timer.hostHandle = handle;
      timer.hostHandleActive = true;
    }
  }

  private wake(timer: InternalTimer): void {
    if (timer.status !== "scheduled") return;
    let current: number;
    try {
      current = this.now();
    } catch (error) {
      this.failScheduledTimer(timer, error, "clock");
      return;
    }
    if (current < timer.deadlineMs) {
      try {
        this.arm(timer);
      } catch (error) {
        this.failScheduledTimer(timer, error, "schedule");
      }
      return;
    }
    this.invoke(timer);
  }
}

/**
 * Deterministic virtual scheduler. Same-deadline callbacks run FIFO. Timers
 * scheduled by a callback for the current tick join the same bounded advance.
 */
export class VirtualTimerScheduler extends TimerSchedulerBase {
  readonly #maxCallbacksPerAdvance: number;
  readonly #queue: InternalTimer[] = [];
  #currentMs: number;
  #advancing = false;

  constructor(options: VirtualTimerSchedulerOptions = {}) {
    super("virtual", options);
    this.#currentMs = validateTime(options.startTimeMs ?? 0, "startTimeMs");
    this.#maxCallbacksPerAdvance = validatePositiveInteger(
      options.maxCallbacksPerAdvance ?? DEFAULT_MAX_CALLBACKS_PER_ADVANCE,
      "maxCallbacksPerAdvance",
    );
  }

  now(): number {
    return this.#currentMs;
  }

  advanceTo(
    targetMs: number,
    options: VirtualTimerAdvanceOptions = {},
  ): VirtualTimerAdvanceResult {
    this.assertOpen();
    const target = validateTime(targetMs, "targetMs");
    if (target < this.#currentMs) {
      throw new RangeError("targetMs cannot move a monotonic clock backwards.");
    }
    const maxCallbacks = validatePositiveInteger(
      options.maxCallbacks ?? this.#maxCallbacksPerAdvance,
      "maxCallbacks",
    );
    return this.advance(target, maxCallbacks);
  }

  advanceBy(
    delayMs: number,
    options: VirtualTimerAdvanceOptions = {},
  ): VirtualTimerAdvanceResult {
    const delay = validateTime(delayMs, "delayMs");
    return this.advanceTo(addTime(this.#currentMs, delay, "delayMs"), options);
  }

  runDue(options: VirtualTimerAdvanceOptions = {}): VirtualTimerAdvanceResult {
    return this.advanceTo(this.#currentMs, options);
  }

  protected enqueue(timer: InternalTimer): void {
    const index = this.#queue.findIndex((queued) => compareTimers(queued, timer) > 0);
    if (index < 0) this.#queue.push(timer);
    else this.#queue.splice(index, 0, timer);
  }

  protected dequeue(timer: InternalTimer): void {
    const index = this.#queue.indexOf(timer);
    if (index >= 0) this.#queue.splice(index, 1);
  }

  private advance(targetMs: number, maxCallbacks: number): VirtualTimerAdvanceResult {
    if (this.#advancing) throw new TimerSchedulerReentrancyError();
    this.#advancing = true;
    const fromMs = this.#currentMs;
    let callbacks = 0;
    let limitReached = false;

    try {
      while (!this.disposed) {
        const next = this.#queue[0];
        if (!next || next.deadlineMs > targetMs) break;
        if (callbacks >= maxCallbacks) {
          limitReached = true;
          this.reportAdvanceLimit(new TimerAdvanceLimitError(maxCallbacks, this.#currentMs), next);
          break;
        }
        this.#queue.shift();
        this.#currentMs = Math.max(this.#currentMs, next.deadlineMs);
        if (this.invoke(next)) callbacks += 1;
      }
      if (!limitReached && !this.disposed) this.#currentMs = targetMs;
    } finally {
      this.#advancing = false;
    }

    return {
      fromMs,
      requestedToMs: targetMs,
      reachedMs: this.#currentMs,
      callbacks,
      limitReached,
      disposed: this.disposed,
      pending: this.pendingTimerCount,
      nextDeadlineMs: this.#queue[0]?.deadlineMs,
    };
  }
}

/** Creates a host-backed timer scheduler without module-level timer work. */
export function createHostTimerScheduler(options: HostTimerSchedulerOptions = {}): HostTimerScheduler {
  return new HostTimerScheduler(options);
}

/** Creates a deterministic virtual timer scheduler. */
export function createVirtualTimerScheduler(options: VirtualTimerSchedulerOptions = {}): VirtualTimerScheduler {
  return new VirtualTimerScheduler(options);
}

function inspectTimer(timer: InternalTimer): TimerInspection {
  return {
    id: timer.id,
    sequence: timer.sequence,
    deadlineMs: timer.deadlineMs,
    status: timer.status,
  };
}

function compareTimers(left: InternalTimer, right: InternalTimer): number {
  return left.deadlineMs - right.deadlineMs || left.sequence - right.sequence;
}

function assimilatePromiseLike(value: unknown): Promise<unknown> | undefined {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") return undefined;
  const then = (value as { then?: unknown }).then;
  if (typeof then !== "function") return undefined;
  return new Promise((resolve, reject) => {
    Reflect.apply(then, value, [resolve, reject]);
  });
}

function validateTime(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONOTONIC_TIME) {
    throw new RangeError(`${name} must be finite and between 0 and ${MAX_MONOTONIC_TIME}.`);
  }
  return value;
}

function validatePositiveTime(value: number, name: string): number {
  validateTime(value, name);
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
  return value;
}

function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return value;
}

function validateNonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

function addTime(now: number, delay: number, name: string): number {
  const deadline = now + delay;
  if (!Number.isFinite(deadline) || deadline > MAX_MONOTONIC_TIME) {
    throw new RangeError(`${name} overflows the monotonic time range.`);
  }
  return deadline;
}

function defaultHostNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function defaultHostSetTimeout(callback: () => void, delayMs: number): unknown {
  return globalThis.setTimeout(callback, delayMs);
}

function defaultHostClearTimeout(handle: unknown): void {
  globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
}
