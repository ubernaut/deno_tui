// Copyright 2023 Im-Beast. MIT license.
import type { TimerHandle, TimerScheduler } from "./clock.ts";

/** Lifecycle reported by a disposable async-iterable operator. */
export type AsyncIterableOperatorStatus = "idle" | "running" | "disposed";

/** Operator names used by clone-safe inspection and diagnostics. */
export type AsyncIterableOperatorKind =
  | "map"
  | "filter"
  | "merge"
  | "switch-latest"
  | "debounce"
  | "throttle"
  | "buffer"
  | "window"
  | "retry";

/** Clone-safe error summary retained by an operator. */
export interface AsyncIterableOperatorErrorInspection {
  readonly name: string;
  readonly message: string;
}

/** Fixed-size, clone-safe state for a disposable async-iterable operator. */
export interface AsyncIterableOperatorInspection {
  readonly kind: AsyncIterableOperatorKind;
  readonly status: AsyncIterableOperatorStatus;
  readonly disposed: boolean;
  readonly maxActiveIterators: number;
  readonly maxPendingNext: number;
  readonly pendingNext: number;
  readonly activeIterators: number;
  readonly startedIterators: number;
  readonly completedIterators: number;
  readonly failedIterators: number;
  readonly cancelledIterators: number;
  readonly emitted: number;
  readonly dropped: number;
  readonly retries: number;
  readonly pendingTimers: number;
  readonly buffered: number;
  readonly lastError?: AsyncIterableOperatorErrorInspection;
}

/** Context supplied to retry factories. */
export interface AsyncIterableRetryContext {
  readonly attempt: number;
  readonly signal: AbortSignal;
}

/** Factory used to create a fresh async iterable for each retry attempt. */
export type AsyncIterableRetryFactory<Value> = (
  context: AsyncIterableRetryContext,
) => AsyncIterable<Value>;

/** Mapper accepted by {@link mapAsyncIterable}. */
export type AsyncIterableMapper<Input, Output> = (
  value: Input,
  index: number,
) => Output | PromiseLike<Output>;

/** Predicate accepted by {@link filterAsyncIterable}. */
export type AsyncIterablePredicate<Value> = (
  value: Value,
  index: number,
) => boolean | PromiseLike<boolean>;

/** Shared construction options for disposable async-iterable operators. */
export interface AsyncIterableOperatorOptions {
  /** Cancels the whole operator without transferring ownership of the signal. */
  signal?: AbortSignal;
  /** Maximum simultaneous iterators. Defaults to one. */
  maxActiveIterators?: number;
  /** Maximum unresolved next calls per iterator. Defaults to one. */
  maxPendingNext?: number;
  /** Isolated diagnostic observer. Observer failures never alter iteration. */
  onError?: (error: unknown, inspection: AsyncIterableOperatorInspection) => void;
}

/** Options for merging a fixed, bounded collection of async iterables. */
export interface MergeAsyncIterableOptions extends AsyncIterableOperatorOptions {
  /** Maximum sources accepted at construction. Defaults to 256. */
  maxSources?: number;
}

/** Options for scheduler-backed debounce. */
export interface DebounceAsyncIterableOptions extends AsyncIterableOperatorOptions {
  scheduler: TimerScheduler;
  delayMs: number;
}

/** Options for scheduler-backed leading/trailing throttle. */
export interface ThrottleAsyncIterableOptions extends AsyncIterableOperatorOptions {
  scheduler: TimerScheduler;
  intervalMs: number;
  leading?: boolean;
  trailing?: boolean;
}

/** Options for count-bounded buffering. */
export interface BufferAsyncIterableOptions extends AsyncIterableOperatorOptions {
  size: number;
}

/** Options for time windows with an optional item safety bound. */
export interface WindowAsyncIterableOptions extends AsyncIterableOperatorOptions {
  scheduler: TimerScheduler;
  durationMs: number;
  /** Flushes a window early at this count. Defaults to 1024. */
  maxItems?: number;
}

/** Options for bounded retry with caller-owned scheduling. */
export interface RetryAsyncIterableOptions extends AsyncIterableOperatorOptions {
  /** Number of retries after the first attempt. Defaults to three. */
  maxRetries?: number;
  /** Initial delay between attempts. Defaults to zero. */
  delayMs?: number;
  /** Required when a non-zero retry delay is configured. */
  scheduler?: TimerScheduler;
  /** Multiplier applied after each failed attempt. Defaults to one. */
  backoffMultiplier?: number;
  /** Upper bound for retry delay. Defaults to Number.MAX_SAFE_INTEGER. */
  maxDelayMs?: number;
  /** Optional failure classifier. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/** Async iterator with explicit idempotent cancellation. */
export interface DisposableAsyncIterator<Value> extends AsyncIterableIterator<Value> {
  readonly disposed: boolean;
  next(): Promise<IteratorResult<Value>>;
  return(): Promise<IteratorResult<Value>>;
  throw(error?: unknown): Promise<IteratorResult<Value>>;
  dispose(reason?: unknown): boolean;
}

/** Async iterable with bounded inspection and explicit idempotent disposal. */
export interface DisposableAsyncIterable<Value> extends AsyncIterable<Value> {
  readonly disposed: boolean;
  dispose(reason?: unknown): boolean;
  inspect(): AsyncIterableOperatorInspection;
  [Symbol.asyncIterator](): DisposableAsyncIterator<Value>;
}

/** Raised when iteration is requested after operator disposal. */
export class AsyncIterableOperatorDisposedError extends Error {
  readonly code = "ASYNC_ITERABLE_OPERATOR_DISPOSED";

  constructor() {
    super("Async-iterable operator is disposed.");
    this.name = "AsyncIterableOperatorDisposedError";
  }
}

/** Raised when an operator or iterator is cancelled. */
export class AsyncIterableOperatorAbortedError extends Error {
  readonly code = "ASYNC_ITERABLE_OPERATOR_ABORTED";

  constructor(override readonly cause?: unknown) {
    super("Async-iterable operator was aborted.", { cause });
    this.name = "AsyncIterableOperatorAbortedError";
  }
}

/** Raised when an operator's simultaneous iterator bound is exhausted. */
export class AsyncIterableOperatorConcurrencyError extends Error {
  readonly code = "ASYNC_ITERABLE_OPERATOR_CONCURRENCY";

  constructor(readonly maxActiveIterators: number) {
    super(`Async-iterable operator allows at most ${maxActiveIterators} active iterator(s).`);
    this.name = "AsyncIterableOperatorConcurrencyError";
  }
}

/** Raised when one iterator exceeds its unresolved next-call bound. */
export class AsyncIterableOperatorPendingNextError extends Error {
  readonly code = "ASYNC_ITERABLE_OPERATOR_PENDING_NEXT";

  constructor(readonly maxPendingNext: number) {
    super(`Async-iterable iterator allows at most ${maxPendingNext} unresolved next call(s).`);
    this.name = "AsyncIterableOperatorPendingNextError";
  }
}

/** Raised for invalid operator options or source collections. */
export class AsyncIterableOperatorConfigurationError extends Error {
  readonly code = "ASYNC_ITERABLE_OPERATOR_CONFIGURATION";

  constructor(message: string) {
    super(message);
    this.name = "AsyncIterableOperatorConfigurationError";
  }
}

interface OperatorMetrics {
  emitted: number;
  dropped: number;
  retries: number;
  pendingTimers: number;
  buffered: number;
}

interface OperatorRunnerContext {
  readonly signal: AbortSignal;
  readonly metrics: OperatorMetrics;
  report(error: unknown): void;
  setBuffered(count: number): void;
}

type OperatorRunner<Value> = (context: OperatorRunnerContext) => AsyncGenerator<Value, void, unknown>;

const DEFAULT_MAX_ACTIVE_ITERATORS = 1;
const DEFAULT_MAX_PENDING_NEXT = 1;
const DEFAULT_MAX_MERGE_SOURCES = 256;
const DEFAULT_WINDOW_MAX_ITEMS = 1024;

class ManagedAsyncIterable<Value> implements DisposableAsyncIterable<Value> {
  readonly #kind: AsyncIterableOperatorKind;
  readonly #runner: OperatorRunner<Value>;
  readonly #maxActiveIterators: number;
  readonly #maxPendingNext: number;
  readonly #onError?: (error: unknown, inspection: AsyncIterableOperatorInspection) => void;
  readonly #controller = new AbortController();
  readonly #active = new Set<DisposableAsyncIterator<Value>>();
  readonly #metrics: OperatorMetrics = {
    emitted: 0,
    dropped: 0,
    retries: 0,
    pendingTimers: 0,
    buffered: 0,
  };
  #removeExternalAbort?: () => void;
  #startedIterators = 0;
  #pendingNext = 0;
  #completedIterators = 0;
  #failedIterators = 0;
  #cancelledIterators = 0;
  #lastError?: AsyncIterableOperatorErrorInspection;
  #disposed = false;

  constructor(
    kind: AsyncIterableOperatorKind,
    runner: OperatorRunner<Value>,
    options: AsyncIterableOperatorOptions,
  ) {
    this.#kind = kind;
    this.#runner = runner;
    this.#maxActiveIterators = validatePositiveInteger(
      options.maxActiveIterators ?? DEFAULT_MAX_ACTIVE_ITERATORS,
      "maxActiveIterators",
    );
    this.#maxPendingNext = validatePositiveInteger(
      options.maxPendingNext ?? DEFAULT_MAX_PENDING_NEXT,
      "maxPendingNext",
    );
    this.#onError = options.onError;
    if (options.signal) this.#attachExternalSignal(options.signal);
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  [Symbol.asyncIterator](): DisposableAsyncIterator<Value> {
    if (this.#disposed) throw new AsyncIterableOperatorDisposedError();
    if (this.#active.size >= this.#maxActiveIterators) {
      throw new AsyncIterableOperatorConcurrencyError(this.#maxActiveIterators);
    }

    const localController = new AbortController();
    const onGlobalAbort = () => localController.abort(safeSignalReason(this.#controller.signal));
    this.#controller.signal.addEventListener("abort", onGlobalAbort, { once: true });
    let localBuffered = 0;
    const context: OperatorRunnerContext = {
      signal: localController.signal,
      metrics: this.#metrics,
      report: (error) => this.#report(error),
      setBuffered: (count) => {
        if (!Number.isSafeInteger(count) || count < 0) {
          throw new RangeError("Async-iterable buffered count must be a non-negative safe integer.");
        }
        const nextTotal = this.#metrics.buffered - localBuffered + count;
        if (!Number.isSafeInteger(nextTotal) || nextTotal < 0) {
          throw new RangeError("Async-iterable buffered counter is exhausted.");
        }
        localBuffered = count;
        this.#metrics.buffered = nextTotal;
      },
    };
    const generator = this.#runner(context);
    let closed = false;
    let finalized = false;
    let pendingNext = 0;

    const finalize = (outcome: "completed" | "failed" | "cancelled", error?: unknown) => {
      if (finalized) return;
      finalized = true;
      closed = true;
      context.setBuffered(0);
      this.#controller.signal.removeEventListener("abort", onGlobalAbort);
      this.#active.delete(iterator);
      if (outcome === "completed") this.#completedIterators += 1;
      else if (outcome === "cancelled") this.#cancelledIterators += 1;
      else {
        this.#failedIterators += 1;
        this.#recordError(error);
      }
    };

    const iterator: DisposableAsyncIterator<Value> = {
      get disposed(): boolean {
        return closed;
      },
      next: async (): Promise<IteratorResult<Value>> => {
        if (closed) return { done: true, value: undefined };
        if (pendingNext >= this.#maxPendingNext) {
          throw new AsyncIterableOperatorPendingNextError(this.#maxPendingNext);
        }
        const nextPendingTotal = incrementCounter(this.#pendingNext, "pendingNext");
        pendingNext += 1;
        this.#pendingNext = nextPendingTotal;
        try {
          const result = await generator.next();
          if (result.done) finalize("completed");
          else this.#metrics.emitted = incrementCounter(this.#metrics.emitted, "emitted");
          return result;
        } catch (error) {
          if (localController.signal.aborted || safeInstanceOf(error, AsyncIterableOperatorAbortedError)) {
            finalize("cancelled");
          } else {
            finalize("failed", error);
          }
          throw error;
        } finally {
          pendingNext -= 1;
          this.#pendingNext -= 1;
        }
      },
      return: async (): Promise<IteratorResult<Value>> => {
        if (closed) return { done: true, value: undefined };
        localController.abort(new AsyncIterableOperatorAbortedError("iterator-return"));
        try {
          const result = await generator.return(undefined);
          finalize("cancelled");
          return result;
        } catch (error) {
          finalize("cancelled");
          throw error;
        }
      },
      throw: async (error?: unknown): Promise<IteratorResult<Value>> => {
        if (closed) throw error;
        localController.abort(error);
        try {
          const result = await generator.throw(error);
          finalize("cancelled");
          return result;
        } catch (thrown) {
          finalize("cancelled");
          throw thrown;
        }
      },
      dispose: (reason?: unknown): boolean => {
        if (closed) return false;
        closed = true;
        localController.abort(reason);
        void generator.return(undefined).then(
          () => finalize("cancelled"),
          (error) => {
            this.#report(error);
            finalize("cancelled");
          },
        );
        return true;
      },
      [Symbol.asyncIterator](): DisposableAsyncIterator<Value> {
        return this;
      },
    };

    this.#active.add(iterator);
    this.#startedIterators = incrementCounter(this.#startedIterators, "startedIterators");
    return iterator;
  }

  dispose(reason?: unknown): boolean {
    if (this.#disposed) return false;
    this.#disposed = true;
    this.#removeExternalAbort?.();
    this.#removeExternalAbort = undefined;
    this.#controller.abort(reason);
    for (const iterator of [...this.#active]) iterator.dispose(reason);
    return true;
  }

  inspect(): AsyncIterableOperatorInspection {
    const lastError = this.#lastError ? Object.freeze({ ...this.#lastError }) : undefined;
    return Object.freeze({
      kind: this.#kind,
      status: this.#disposed ? "disposed" : this.#active.size > 0 ? "running" : "idle",
      disposed: this.#disposed,
      maxActiveIterators: this.#maxActiveIterators,
      maxPendingNext: this.#maxPendingNext,
      pendingNext: this.#pendingNext,
      activeIterators: this.#active.size,
      startedIterators: this.#startedIterators,
      completedIterators: this.#completedIterators,
      failedIterators: this.#failedIterators,
      cancelledIterators: this.#cancelledIterators,
      emitted: this.#metrics.emitted,
      dropped: this.#metrics.dropped,
      retries: this.#metrics.retries,
      pendingTimers: this.#metrics.pendingTimers,
      buffered: this.#metrics.buffered,
      lastError,
    });
  }

  #attachExternalSignal(signal: AbortSignal): void {
    if (signal.aborted) {
      this.dispose(safeSignalReason(signal));
      return;
    }
    const onAbort = () => this.dispose(safeSignalReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    this.#removeExternalAbort = () => signal.removeEventListener("abort", onAbort);
  }

  #recordError(error: unknown): void {
    this.#lastError = summarizeError(error);
    this.#report(error);
  }

  #report(error: unknown): void {
    if (!this.#onError) return;
    try {
      this.#onError(error, this.inspect());
    } catch {
      // Diagnostic observers are isolated from iteration and cleanup.
    }
  }
}

/** Maps source values sequentially and closes the source on early return. */
export function mapAsyncIterable<Input, Output>(
  source: AsyncIterable<Input>,
  mapper: AsyncIterableMapper<Input, Output>,
  options: AsyncIterableOperatorOptions = {},
): DisposableAsyncIterable<Output> {
  assertFunction(mapper, "mapper");
  return managed("map", options, async function* (context) {
    const iterator = getAsyncIterator(source, "source");
    let done = false;
    let index = 0;
    try {
      while (true) {
        const result = await nextWithSignal(iterator, context.signal);
        if (result.done) {
          done = true;
          return;
        }
        const currentIndex = index;
        index = incrementCounter(index, "map index");
        yield await invokeWithSignal(() => mapper(result.value, currentIndex), context.signal);
      }
    } finally {
      if (!done) await closeIterator(iterator, context);
    }
  });
}

/** Filters source values sequentially and reports rejected values as dropped. */
export function filterAsyncIterable<Value>(
  source: AsyncIterable<Value>,
  predicate: AsyncIterablePredicate<Value>,
  options: AsyncIterableOperatorOptions = {},
): DisposableAsyncIterable<Value> {
  assertFunction(predicate, "predicate");
  return managed("filter", options, async function* (context) {
    const iterator = getAsyncIterator(source, "source");
    let done = false;
    let index = 0;
    try {
      while (true) {
        const result = await nextWithSignal(iterator, context.signal);
        if (result.done) {
          done = true;
          return;
        }
        const currentIndex = index;
        index = incrementCounter(index, "filter index");
        if (await invokeWithSignal(() => predicate(result.value, currentIndex), context.signal)) yield result.value;
        else context.metrics.dropped = incrementCounter(context.metrics.dropped, "dropped");
      }
    } finally {
      if (!done) await closeIterator(iterator, context);
    }
  });
}

/** Merges a bounded source set while keeping at most one pending read per source. */
export function mergeAsyncIterables<Value>(
  sources: readonly AsyncIterable<Value>[],
  options: MergeAsyncIterableOptions = {},
): DisposableAsyncIterable<Value> {
  const maxSources = validatePositiveInteger(options.maxSources ?? DEFAULT_MAX_MERGE_SOURCES, "maxSources");
  const sourceSnapshot = snapshotSources(sources, maxSources);
  return managed("merge", options, async function* (context) {
    const iterators: AsyncIterator<Value>[] = [];
    const pending = new Map<number, Promise<TaggedNext<Value>>>();
    const completed = new Set<number>();
    try {
      for (let index = 0; index < sourceSnapshot.length; index++) {
        iterators.push(getAsyncIterator(sourceSnapshot[index]!, `sources[${index}]`));
      }
      for (let index = 0; index < iterators.length; index++) {
        pending.set(index, taggedNext(iterators[index]!, index));
      }
      while (pending.size > 0) {
        const outcome = await raceWithSignal([...pending.values()], context.signal);
        pending.delete(outcome.index);
        if (!outcome.ok) throw outcome.error;
        const result = outcome.result;
        if (result.done) {
          completed.add(outcome.index);
          continue;
        }
        pending.set(outcome.index, taggedNext(iterators[outcome.index]!, outcome.index));
        yield result.value;
      }
    } finally {
      await Promise.all(
        iterators.map((iterator, index) => completed.has(index) ? Promise.resolve() : closeIterator(iterator, context)),
      );
    }
  });
}

/** Switches to the newest inner iterable and cancels the superseded iterator. */
export function switchLatestAsyncIterable<Value>(
  source: AsyncIterable<AsyncIterable<Value>>,
  options: AsyncIterableOperatorOptions = {},
): DisposableAsyncIterable<Value> {
  return managed("switch-latest", options, async function* (context) {
    const outer = getAsyncIterator(source, "source");
    let outerDone = false;
    let outerPending: Promise<TaggedOuter<Value>> | undefined = taggedOuterNext(outer);
    let inner: AsyncIterator<Value> | undefined;
    let innerPending: Promise<TaggedInner<Value>> | undefined;
    let innerDone = true;
    try {
      while (outerPending || innerPending) {
        const candidates: Array<Promise<TaggedOuter<Value> | TaggedInner<Value>>> = [];
        if (outerPending) candidates.push(outerPending);
        if (innerPending) candidates.push(innerPending);
        const outcome = await raceWithSignal(candidates, context.signal);
        if (outcome.kind === "outer") {
          outerPending = undefined;
          if (!outcome.ok) throw outcome.error;
          if (outcome.result.done) {
            outerDone = true;
            continue;
          }
          if (inner && !innerDone) {
            const superseded = inner;
            inner = undefined;
            innerDone = true;
            context.metrics.dropped = incrementCounter(context.metrics.dropped, "dropped");
            void closeIterator(superseded, context);
          }
          inner = getAsyncIterator(outcome.result.value, "inner source");
          innerDone = false;
          innerPending = taggedInnerNext(inner);
          outerPending = taggedOuterNext(outer);
        } else {
          innerPending = undefined;
          if (!outcome.ok) throw outcome.error;
          if (outcome.result.done) {
            innerDone = true;
            inner = undefined;
            if (outerDone) return;
            continue;
          }
          yield outcome.result.value;
          if (inner) innerPending = taggedInnerNext(inner);
        }
      }
    } finally {
      if (!outerDone) await closeIterator(outer, context);
      if (inner && !innerDone) await closeIterator(inner, context);
    }
  });
}

/** Emits the newest value after a quiet scheduler interval. */
export function debounceAsyncIterable<Value>(
  source: AsyncIterable<Value>,
  options: DebounceAsyncIterableOptions,
): DisposableAsyncIterable<Value> {
  const delayMs = validateTime(options.delayMs, "delayMs");
  const scheduler = options.scheduler;
  assertScheduler(scheduler);
  return managed("debounce", options, async function* (context) {
    const iterator = getAsyncIterator(source, "source");
    let next = taggedSourceNext(iterator);
    let timer: ScheduledDelay | undefined;
    let pending: Value | undefined;
    let hasPending = false;
    let done = false;
    try {
      while (true) {
        const outcome = timer
          ? await raceWithSignal<SourceNext<Value> | TimerElapsed>([next, timer.promise], context.signal)
          : await raceWithSignal<SourceNext<Value>>([next], context.signal);
        if (outcome.kind === "timer") {
          timer = undefined;
          context.setBuffered(0);
          if (hasPending) {
            hasPending = false;
            yield pending as Value;
          }
          continue;
        }
        if (!outcome.ok) throw outcome.error;
        if (outcome.result.done) {
          done = true;
          timer?.cancel();
          context.setBuffered(0);
          if (hasPending) yield pending as Value;
          return;
        }
        pending = outcome.result.value;
        hasPending = true;
        context.setBuffered(1);
        timer?.cancel();
        timer = scheduleDelay(scheduler, delayMs, context);
        next = taggedSourceNext(iterator);
      }
    } finally {
      timer?.cancel();
      context.setBuffered(0);
      if (!done) await closeIterator(iterator, context);
    }
  });
}

/** Emits leading and/or trailing values within scheduler-owned throttle windows. */
export function throttleAsyncIterable<Value>(
  source: AsyncIterable<Value>,
  options: ThrottleAsyncIterableOptions,
): DisposableAsyncIterable<Value> {
  const intervalMs = validateTime(options.intervalMs, "intervalMs");
  const leading = options.leading ?? true;
  const trailing = options.trailing ?? true;
  if (!leading && !trailing) {
    throw new AsyncIterableOperatorConfigurationError("throttle requires leading, trailing, or both.");
  }
  const scheduler = options.scheduler;
  assertScheduler(scheduler);
  return managed("throttle", options, async function* (context) {
    const iterator = getAsyncIterator(source, "source");
    let next = taggedSourceNext(iterator);
    let timer: ScheduledDelay | undefined;
    let trailingValue: Value | undefined;
    let hasTrailing = false;
    let done = false;
    try {
      while (true) {
        // A timer may elapse while the async generator is suspended at a
        // yielded value. Apply that state before racing an already-settled
        // prefetched source read so post-window values start a new window.
        if (timer?.elapsed) {
          timer = undefined;
          if (hasTrailing) {
            hasTrailing = false;
            context.setBuffered(0);
            timer = scheduleDelay(scheduler, intervalMs, context);
            yield trailingValue as Value;
          }
          continue;
        }
        const outcome = timer
          ? await raceWithSignal<SourceNext<Value> | TimerElapsed>([next, timer.promise], context.signal)
          : await raceWithSignal<SourceNext<Value>>([next], context.signal);
        if (outcome.kind === "timer") {
          timer = undefined;
          if (hasTrailing) {
            hasTrailing = false;
            context.setBuffered(0);
            timer = scheduleDelay(scheduler, intervalMs, context);
            yield trailingValue as Value;
          }
          continue;
        }
        if (!outcome.ok) throw outcome.error;
        if (outcome.result.done) {
          done = true;
          timer?.cancel();
          context.setBuffered(0);
          if (trailing && hasTrailing) yield trailingValue as Value;
          return;
        }
        const value = outcome.result.value;
        next = taggedSourceNext(iterator);
        if (!timer) {
          if (leading) {
            timer = scheduleDelay(scheduler, intervalMs, context);
            yield value;
          } else {
            trailingValue = value;
            hasTrailing = true;
            context.setBuffered(1);
            timer = scheduleDelay(scheduler, intervalMs, context);
          }
          continue;
        }
        if (trailing) {
          if (hasTrailing) context.metrics.dropped = incrementCounter(context.metrics.dropped, "dropped");
          trailingValue = value;
          hasTrailing = true;
          context.setBuffered(1);
        } else {
          context.metrics.dropped = incrementCounter(context.metrics.dropped, "dropped");
        }
      }
    } finally {
      timer?.cancel();
      context.setBuffered(0);
      if (!done) await closeIterator(iterator, context);
    }
  });
}

/** Groups source values into fixed-size bounded arrays and flushes the tail. */
export function bufferAsyncIterable<Value>(
  source: AsyncIterable<Value>,
  options: BufferAsyncIterableOptions,
): DisposableAsyncIterable<readonly Value[]> {
  const size = validatePositiveInteger(options.size, "size");
  return managed("buffer", options, async function* (context) {
    const iterator = getAsyncIterator(source, "source");
    let buffer: Value[] = [];
    let done = false;
    try {
      while (true) {
        const result = await nextWithSignal(iterator, context.signal);
        if (result.done) {
          done = true;
          if (buffer.length > 0) yield Object.freeze(buffer.slice());
          return;
        }
        buffer.push(result.value);
        context.setBuffered(buffer.length);
        if (buffer.length === size) {
          const output = Object.freeze(buffer);
          buffer = [];
          context.setBuffered(0);
          yield output;
        }
      }
    } finally {
      buffer = [];
      context.setBuffered(0);
      if (!done) await closeIterator(iterator, context);
    }
  });
}

/** Groups values into scheduler windows with a hard per-window item bound. */
export function windowAsyncIterable<Value>(
  source: AsyncIterable<Value>,
  options: WindowAsyncIterableOptions,
): DisposableAsyncIterable<readonly Value[]> {
  const durationMs = validateTime(options.durationMs, "durationMs");
  const maxItems = validatePositiveInteger(options.maxItems ?? DEFAULT_WINDOW_MAX_ITEMS, "maxItems");
  const scheduler = options.scheduler;
  assertScheduler(scheduler);
  return managed("window", options, async function* (context) {
    const iterator = getAsyncIterator(source, "source");
    let next = taggedSourceNext(iterator);
    let timer: ScheduledDelay | undefined;
    let values: Value[] = [];
    let done = false;
    try {
      while (true) {
        const outcome = timer
          ? await raceWithSignal<SourceNext<Value> | TimerElapsed>([next, timer.promise], context.signal)
          : await raceWithSignal<SourceNext<Value>>([next], context.signal);
        if (outcome.kind === "timer") {
          timer = undefined;
          if (values.length > 0) {
            const output = Object.freeze(values);
            values = [];
            context.setBuffered(0);
            yield output;
          }
          continue;
        }
        if (!outcome.ok) throw outcome.error;
        if (outcome.result.done) {
          done = true;
          timer?.cancel();
          context.setBuffered(0);
          if (values.length > 0) yield Object.freeze(values);
          return;
        }
        values.push(outcome.result.value);
        context.setBuffered(values.length);
        next = taggedSourceNext(iterator);
        timer ??= scheduleDelay(scheduler, durationMs, context);
        if (values.length === maxItems) {
          timer.cancel();
          timer = undefined;
          const output = Object.freeze(values);
          values = [];
          context.setBuffered(0);
          yield output;
        }
      }
    } finally {
      timer?.cancel();
      values = [];
      context.setBuffered(0);
      if (!done) await closeIterator(iterator, context);
    }
  });
}

/** Recreates a source after classified failures under a bounded retry policy. */
export function retryAsyncIterable<Value>(
  factory: AsyncIterableRetryFactory<Value>,
  options: RetryAsyncIterableOptions = {},
): DisposableAsyncIterable<Value> {
  assertFunction(factory, "factory");
  const maxRetries = validateNonNegativeInteger(options.maxRetries ?? 3, "maxRetries");
  const initialDelay = validateTime(options.delayMs ?? 0, "delayMs");
  const multiplier = validatePositiveFinite(options.backoffMultiplier ?? 1, "backoffMultiplier");
  const maxDelay = validateTime(options.maxDelayMs ?? Number.MAX_SAFE_INTEGER, "maxDelayMs");
  const scheduler = options.scheduler;
  const shouldRetry = options.shouldRetry;
  if (Math.min(initialDelay, maxDelay) > 0 && !scheduler) {
    throw new AsyncIterableOperatorConfigurationError("retry scheduler is required when delayMs is non-zero.");
  }
  if (scheduler) assertScheduler(scheduler);
  if (shouldRetry) assertFunction(shouldRetry, "shouldRetry");

  return managed("retry", options, async function* (context) {
    let retry = 0;
    let delay = Math.min(initialDelay, maxDelay);
    while (true) {
      throwIfAborted(context.signal);
      let iterator: AsyncIterator<Value> | undefined;
      let done = false;
      try {
        iterator = getAsyncIterator(factory({ attempt: retry + 1, signal: context.signal }), "retry factory result");
        while (true) {
          const result = await nextWithSignal(iterator, context.signal);
          if (result.done) {
            done = true;
            return;
          }
          yield result.value;
        }
      } catch (error) {
        if (context.signal.aborted || safeInstanceOf(error, AsyncIterableOperatorAbortedError)) throw error;
        const attempt = retry + 1;
        let allowed = retry < maxRetries && !safeInstanceOf(error, AsyncIterableOperatorConfigurationError);
        if (allowed && shouldRetry) {
          const decision = shouldRetry(error, attempt);
          if (typeof decision !== "boolean") {
            throw new AsyncIterableOperatorConfigurationError("shouldRetry must return a boolean.");
          }
          allowed = decision;
        }
        if (!allowed) throw error;
        retry += 1;
        context.metrics.retries = incrementCounter(context.metrics.retries, "retries");
        if (delay > 0) {
          const wait = scheduleDelay(scheduler!, delay, context);
          await wait.promise;
        }
        delay = Math.min(maxDelay, safeMultiplyTime(delay, multiplier));
      } finally {
        if (iterator && !done) await closeIterator(iterator, context);
      }
    }
  });
}

function managed<Value>(
  kind: AsyncIterableOperatorKind,
  options: AsyncIterableOperatorOptions,
  runner: OperatorRunner<Value>,
): DisposableAsyncIterable<Value> {
  return new ManagedAsyncIterable(kind, runner, options);
}

type TaggedNext<Value> =
  | { readonly index: number; readonly ok: true; readonly result: IteratorResult<Value> }
  | { readonly index: number; readonly ok: false; readonly error: unknown };

type TaggedOuter<Value> =
  | {
    readonly kind: "outer";
    readonly ok: true;
    readonly result: IteratorResult<AsyncIterable<Value>>;
  }
  | { readonly kind: "outer"; readonly ok: false; readonly error: unknown };

type TaggedInner<Value> =
  | { readonly kind: "inner"; readonly ok: true; readonly result: IteratorResult<Value> }
  | { readonly kind: "inner"; readonly ok: false; readonly error: unknown };

type SourceNext<Value> =
  | { readonly kind: "source"; readonly ok: true; readonly result: IteratorResult<Value> }
  | { readonly kind: "source"; readonly ok: false; readonly error: unknown };

interface TimerElapsed {
  kind: "timer";
}

interface ScheduledDelay {
  readonly promise: Promise<TimerElapsed>;
  readonly elapsed: boolean;
  cancel(): boolean;
}

function taggedNext<Value>(iterator: AsyncIterator<Value>, index: number): Promise<TaggedNext<Value>> {
  return observeNext(iterator, `sources[${index}] next result`).then(
    (result): TaggedNext<Value> => ({ index, ok: true, result }),
    (error): TaggedNext<Value> => ({ index, ok: false, error }),
  );
}

function taggedOuterNext<Value>(iterator: AsyncIterator<AsyncIterable<Value>>): Promise<TaggedOuter<Value>> {
  return observeNext(iterator, "outer iterator next result").then(
    (result): TaggedOuter<Value> => ({ kind: "outer", ok: true, result }),
    (error): TaggedOuter<Value> => ({ kind: "outer", ok: false, error }),
  );
}

function taggedInnerNext<Value>(iterator: AsyncIterator<Value>): Promise<TaggedInner<Value>> {
  return observeNext(iterator, "inner iterator next result").then(
    (result): TaggedInner<Value> => ({ kind: "inner", ok: true, result }),
    (error): TaggedInner<Value> => ({ kind: "inner", ok: false, error }),
  );
}

function taggedSourceNext<Value>(iterator: AsyncIterator<Value>): Promise<SourceNext<Value>> {
  return observeNext(iterator, "source iterator next result").then(
    (result): SourceNext<Value> => ({ kind: "source", ok: true, result }),
    (error): SourceNext<Value> => ({ kind: "source", ok: false, error }),
  );
}

function scheduleDelay(
  scheduler: TimerScheduler,
  delayMs: number,
  context: OperatorRunnerContext,
): ScheduledDelay {
  throwIfAborted(context.signal);
  let handle: TimerHandle | undefined;
  let settled = false;
  let elapsed = false;
  let resolvePromise!: (value: TimerElapsed) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<TimerElapsed>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  // A timer can be aborted while its generator is suspended at `yield`, when
  // no race is currently observing it. Keep the original rejection semantics
  // for active races while permanently observing the promise for cleanup.
  void promise.catch(() => undefined);
  const cleanup = () => {
    context.signal.removeEventListener("abort", onAbort);
    if (context.metrics.pendingTimers > 0) context.metrics.pendingTimers -= 1;
  };
  const settleResolve = (didElapse: boolean) => {
    if (settled) return;
    settled = true;
    elapsed = didElapse;
    cleanup();
    resolvePromise({ kind: "timer" });
  };
  const settleReject = (error: unknown) => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectPromise(error);
  };
  const onAbort = () => {
    try {
      handle?.cancel();
    } catch (error) {
      context.report(error);
    }
    settleReject(new AsyncIterableOperatorAbortedError(safeSignalReason(context.signal)));
  };
  context.signal.addEventListener("abort", onAbort, { once: true });
  context.metrics.pendingTimers = incrementCounter(context.metrics.pendingTimers, "pendingTimers");
  try {
    handle = scheduler.scheduleAfter(delayMs, () => settleResolve(true));
  } catch (error) {
    settleReject(error);
  }
  return {
    promise,
    get elapsed(): boolean {
      return elapsed;
    },
    cancel(): boolean {
      if (settled) return false;
      try {
        handle?.cancel();
      } catch (error) {
        context.report(error);
      }
      settleResolve(false);
      return true;
    },
  };
}

function observeNext<Value>(
  iterator: AsyncIterator<Value>,
  label: string,
): Promise<IteratorResult<Value>> {
  return Promise.resolve()
    .then(() => iterator.next())
    .then((result) => snapshotIteratorResult(result, label));
}

async function nextWithSignal<Value>(
  iterator: AsyncIterator<Value>,
  signal: AbortSignal,
): Promise<IteratorResult<Value>> {
  throwIfAborted(signal);
  return await raceWithSignal([observeNext(iterator, "iterator next result")], signal);
}

function invokeWithSignal<Value>(
  invoke: () => Value | PromiseLike<Value>,
  signal: AbortSignal,
): Promise<Awaited<Value>> {
  throwIfAborted(signal);
  const pending = Promise.resolve().then(invoke) as Promise<Awaited<Value>>;
  return raceWithSignal([pending], signal);
}

async function raceWithSignal<Value>(promises: readonly Promise<Value>[], signal: AbortSignal): Promise<Value> {
  throwIfAborted(signal);
  let onAbort!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new AsyncIterableOperatorAbortedError(safeSignalReason(signal)));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([...promises, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

function getAsyncIterator<Value>(source: AsyncIterable<Value>, label: string): AsyncIterator<Value> {
  if ((typeof source !== "object" && typeof source !== "function") || source === null) {
    throw new AsyncIterableOperatorConfigurationError(`${label} must be an AsyncIterable.`);
  }
  let factory: (() => AsyncIterator<Value>) | undefined;
  try {
    factory = source[Symbol.asyncIterator];
  } catch (error) {
    throw configurationCause(`${label} Symbol.asyncIterator could not be read.`, error);
  }
  if (typeof factory !== "function") {
    throw new AsyncIterableOperatorConfigurationError(`${label} must expose Symbol.asyncIterator.`);
  }
  let iterator: AsyncIterator<Value>;
  try {
    iterator = factory.call(source);
  } catch (error) {
    throw configurationCause(`${label} iterator factory failed.`, error);
  }
  if ((typeof iterator !== "object" && typeof iterator !== "function") || iterator === null) {
    throw new AsyncIterableOperatorConfigurationError(`${label} returned an invalid iterator.`);
  }
  let next: AsyncIterator<Value>["next"];
  let close: AsyncIterator<Value>["return"];
  try {
    next = iterator.next;
    close = iterator.return;
  } catch (error) {
    throw configurationCause(`${label} iterator methods could not be read.`, error);
  }
  if (typeof next !== "function") {
    throw new AsyncIterableOperatorConfigurationError(`${label} iterator must expose next().`);
  }
  if (close !== undefined && typeof close !== "function") {
    throw new AsyncIterableOperatorConfigurationError(`${label} iterator return must be a function when present.`);
  }
  return {
    next: (...args: [] | [undefined]) => next.call(iterator, ...args),
    return: close ? (...args: [] | [unknown]) => close.call(iterator, ...args) : undefined,
  };
}

async function closeIterator(iterator: AsyncIterator<unknown>, context: OperatorRunnerContext): Promise<void> {
  const close = iterator.return;
  if (typeof close !== "function") return;
  try {
    const result = await close.call(iterator);
    snapshotIteratorResult(result, "iterator return result");
  } catch (error) {
    context.report(error);
  }
}

function snapshotSources<Value>(
  sources: readonly AsyncIterable<Value>[],
  maxSources: number,
): readonly AsyncIterable<Value>[] {
  let isArray = false;
  try {
    isArray = Array.isArray(sources);
  } catch (error) {
    throw configurationCause("merge sources could not be inspected.", error);
  }
  if (!isArray) {
    throw new AsyncIterableOperatorConfigurationError("merge sources must be an array.");
  }
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(sources, "length");
  } catch (error) {
    throw configurationCause("merge source length could not be inspected.", error);
  }
  const length = lengthDescriptor?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > maxSources) {
    throw new AsyncIterableOperatorConfigurationError(`merge sources exceed the ${maxSources} source limit.`);
  }
  const result: AsyncIterable<Value>[] = [];
  for (let index = 0; index < length; index++) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(sources, String(index));
    } catch (error) {
      throw configurationCause(`merge sources[${index}] could not be inspected.`, error);
    }
    if (!descriptor || !("value" in descriptor)) {
      throw new AsyncIterableOperatorConfigurationError(`merge sources[${index}] must be an own data property.`);
    }
    result.push(descriptor.value as AsyncIterable<Value>);
  }
  return Object.freeze(result);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new AsyncIterableOperatorAbortedError(safeSignalReason(signal));
}

function safeSignalReason(signal: AbortSignal): unknown {
  try {
    return signal.reason;
  } catch {
    return undefined;
  }
}

function summarizeError(error: unknown): AsyncIterableOperatorErrorInspection {
  let name = "Error";
  let message = "Async-iterable operator failed.";
  if (safeInstanceOf(error, Error)) {
    const candidate = error as Error;
    try {
      name = safeBoundedString(candidate.name, "Error");
    } catch {
      name = "Error";
    }
    try {
      message = safeBoundedString(candidate.message, message);
    } catch {
      message = "Async-iterable operator failed.";
    }
  }
  return Object.freeze({ name, message });
}

function safeBoundedString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.length <= 512 ? value : value.slice(0, 512);
}

function safeInstanceOf(
  value: unknown,
  constructor: abstract new (...args: never[]) => object,
): boolean {
  try {
    return value instanceof constructor;
  } catch {
    return false;
  }
}

function snapshotIteratorResult<Value>(value: unknown, label: string): IteratorResult<Value> {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    throw new AsyncIterableOperatorConfigurationError(`${label} must be an IteratorResult object.`);
  }
  let doneDescriptor: PropertyDescriptor | undefined;
  let valueDescriptor: PropertyDescriptor | undefined;
  try {
    doneDescriptor = Object.getOwnPropertyDescriptor(value, "done");
    valueDescriptor = Object.getOwnPropertyDescriptor(value, "value");
  } catch (error) {
    throw configurationCause(`${label} properties could not be inspected.`, error);
  }
  if (!doneDescriptor || !("value" in doneDescriptor) || typeof doneDescriptor.value !== "boolean") {
    throw new AsyncIterableOperatorConfigurationError(`${label}.done must be an own boolean data property.`);
  }
  if (doneDescriptor.value) {
    if (valueDescriptor && !("value" in valueDescriptor)) {
      throw new AsyncIterableOperatorConfigurationError(`${label}.value must be a data property when present.`);
    }
    return { done: true, value: valueDescriptor?.value as Value };
  }
  if (!valueDescriptor || !("value" in valueDescriptor)) {
    throw new AsyncIterableOperatorConfigurationError(`${label}.value must be an own data property.`);
  }
  return { done: false, value: valueDescriptor.value as Value };
}

function assertScheduler(scheduler: TimerScheduler): void {
  if (!scheduler || typeof scheduler.scheduleAfter !== "function" || typeof scheduler.now !== "function") {
    throw new AsyncIterableOperatorConfigurationError("scheduler must implement TimerScheduler.");
  }
}

function assertFunction(value: unknown, label: string): asserts value is (...args: never[]) => unknown {
  if (typeof value !== "function") {
    throw new AsyncIterableOperatorConfigurationError(`${label} must be a function.`);
  }
}

function validatePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AsyncIterableOperatorConfigurationError(`${label} must be a positive safe integer.`);
  }
  return value;
}

function validateNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AsyncIterableOperatorConfigurationError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function validateTime(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AsyncIterableOperatorConfigurationError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function validatePositiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AsyncIterableOperatorConfigurationError(`${label} must be a positive finite number.`);
  }
  return value;
}

function safeMultiplyTime(value: number, multiplier: number): number {
  if (value === 0) return 0;
  const result = Math.ceil(value * multiplier);
  return Number.isSafeInteger(result) && result >= 0 ? result : Number.MAX_SAFE_INTEGER;
}

function incrementCounter(value: number, label: string): number {
  if (value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`Async-iterable ${label} counter is exhausted.`);
  }
  return value + 1;
}

function configurationCause(message: string, cause: unknown): AsyncIterableOperatorConfigurationError {
  const error = new AsyncIterableOperatorConfigurationError(message);
  try {
    Object.defineProperty(error, "cause", { value: cause, configurable: true });
  } catch {
    // The typed message remains sufficient when a hostile realm rejects cause attachment.
  }
  return error;
}
