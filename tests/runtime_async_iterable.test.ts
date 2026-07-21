import { assert, assertEquals, assertRejects, assertStrictEquals, assertThrows } from "./deps.ts";
import {
  AsyncIterableOperatorAbortedError,
  AsyncIterableOperatorConcurrencyError,
  AsyncIterableOperatorConfigurationError,
  AsyncIterableOperatorDisposedError,
  AsyncIterableOperatorPendingNextError,
  bufferAsyncIterable,
  debounceAsyncIterable,
  filterAsyncIterable,
  mapAsyncIterable,
  mergeAsyncIterables,
  retryAsyncIterable,
  switchLatestAsyncIterable,
  throttleAsyncIterable,
  windowAsyncIterable,
} from "../src/runtime/async_iterable.ts";
import { VirtualTimerScheduler } from "../src/runtime/clock.ts";

Deno.test("map and filter are sequential, bounded, and inspectable", async () => {
  const mapped = mapAsyncIterable(fromValues([1, 2, 3, 4]), async (value, index) => {
    await Promise.resolve();
    return value + index;
  });
  const filtered = filterAsyncIterable(mapped, (value) => value % 2 === 1);

  assertEquals(await collect(filtered), [1, 3, 5, 7]);
  assertEquals(mapped.inspect().emitted, 4);
  assertEquals(mapped.inspect().completedIterators, 1);
  assertEquals(filtered.inspect().dropped, 0);
  assertEquals(filtered.inspect().completedIterators, 1);

  const source = new ManualSource<number>();
  const bounded = mapAsyncIterable(source, (value) => value);
  const first = bounded[Symbol.asyncIterator]();
  assertThrows(() => bounded[Symbol.asyncIterator](), AsyncIterableOperatorConcurrencyError);
  const pending = first.next();
  await flushMicrotasks();
  assertEquals(first.dispose("done"), true);
  assertEquals(first.dispose("again"), false);
  await assertRejects(() => pending, AsyncIterableOperatorAbortedError);
  await flushMicrotasks();
  assertEquals(source.returnCalls, 1);
  assertEquals(bounded.inspect().cancelledIterators, 1);
});

Deno.test("filter counts rejected values and early return closes upstream exactly once", async () => {
  const source = new ManualSource<number>();
  const filtered = filterAsyncIterable(source, (value) => value > 1);
  const iterator = filtered[Symbol.asyncIterator]();
  const next = iterator.next();
  source.push(1);
  await flushMicrotasks();
  source.push(2);

  assertEquals(await next, { done: false, value: 2 });
  assertEquals(filtered.inspect().dropped, 1);
  assertEquals(await iterator.return(), { done: true, value: undefined });
  assertEquals(await iterator.return(), { done: true, value: undefined });
  assertEquals(source.returnCalls, 1);
  assertEquals(filtered.inspect().activeIterators, 0);
});

Deno.test("mapper failure closes upstream and records one sanitized failure", async () => {
  const marker = new Error("mapper failed");
  const source = new ManualSource<number>();
  const mapped = mapAsyncIterable(source, () => {
    throw marker;
  });
  const next = mapped[Symbol.asyncIterator]().next();
  source.push(1);

  assertStrictEquals(await assertRejects(() => next), marker);
  assertEquals(source.returnCalls, 1);
  assertEquals(mapped.inspect().failedIterators, 1);
  assertEquals(mapped.inspect().lastError, { name: "Error", message: "mapper failed" });
});

Deno.test("cancellation interrupts suspended mapper and predicate work without late emission", async () => {
  for (const operator of ["map", "filter"] as const) {
    const source = new ManualSource<number>();
    let release!: (value: number | boolean) => void;
    const gate = new Promise<number | boolean>((resolve) => release = resolve);
    const transformed = operator === "map"
      ? mapAsyncIterable(source, () => gate as Promise<number>)
      : filterAsyncIterable(source, () => gate as Promise<boolean>);
    const iterator = transformed[Symbol.asyncIterator]();
    const pending = iterator.next();
    source.push(1);
    await flushMicrotasks();

    assertEquals(transformed.dispose(`${operator}-cancel`), true);
    const error = await assertRejects(() => pending, AsyncIterableOperatorAbortedError);
    assertEquals(error.cause, `${operator}-cancel`);
    assertEquals(source.returnCalls, 1);
    assertEquals(transformed.inspect().activeIterators, 0);
    assertEquals(transformed.inspect().emitted, 0);

    release(operator === "map" ? 9 : true);
    await flushMicrotasks();
    assertEquals(transformed.inspect().emitted, 0);
  }
});

Deno.test("hostile proxy errors cannot escape failure finalization", async () => {
  const original = new Proxy(new Error("hidden"), {
    getPrototypeOf() {
      throw new Error("prototype trap");
    },
  });
  const source = new ManualSource<number>();
  const mapped = mapAsyncIterable(source, (value) => value);
  const iterator = mapped[Symbol.asyncIterator]();
  const pending = iterator.next();
  source.fail(original);

  assertStrictEquals(await captureRejection(pending), original);
  assertEquals(source.returnCalls, 1);
  assertEquals(mapped.inspect().activeIterators, 0);
  assertEquals(mapped.inspect().failedIterators, 1);
  assertEquals(mapped.inspect().lastError, {
    name: "Error",
    message: "Async-iterable operator failed.",
  });
});

Deno.test("each iterator bounds unresolved next calls without disturbing the first read", async () => {
  const source = new ManualSource<number>();
  const mapped = mapAsyncIterable(source, (value) => value);
  const iterator = mapped[Symbol.asyncIterator]();
  const first = iterator.next();
  await flushMicrotasks();
  await assertRejects(() => iterator.next(), AsyncIterableOperatorPendingNextError);
  source.push(7);
  assertEquals(await first, { done: false, value: 7 });
  assertEquals(mapped.inspect().maxPendingNext, 1);
  await iterator.return();
});

Deno.test("merge keeps one read per source and closes every source on cancellation", async () => {
  const left = new ManualSource<string>();
  const right = new ManualSource<string>();
  const merged = mergeAsyncIterables([left, right]);
  const iterator = merged[Symbol.asyncIterator]();

  const first = iterator.next();
  left.push("left-1");
  assertEquals(await first, { done: false, value: "left-1" });

  const second = iterator.next();
  right.push("right-1");
  assertEquals(await second, { done: false, value: "right-1" });
  assertEquals(left.maxPendingReads, 1);
  assertEquals(right.maxPendingReads, 1);

  await iterator.return();
  assertEquals(left.returnCalls, 1);
  assertEquals(right.returnCalls, 1);
  assertEquals(merged.inspect().cancelledIterators, 1);
});

Deno.test("merge propagates one source failure and still closes healthy peers", async () => {
  const marker = new Error("source failed");
  const failing = new ManualSource<number>();
  const healthy = new ManualSource<number>();
  const merged = mergeAsyncIterables([failing, healthy]);
  const iterator = merged[Symbol.asyncIterator]();
  const next = iterator.next();
  failing.fail(marker);

  assertStrictEquals(await assertRejects(() => next), marker);
  assertEquals(failing.returnCalls, 1);
  assertEquals(healthy.returnCalls, 1);
  assertEquals(merged.inspect().failedIterators, 1);
  assertEquals(merged.inspect().lastError, { name: "Error", message: "source failed" });
});

Deno.test("merge closes earlier acquisitions when a later iterator factory fails", async () => {
  const acquired = new ManualSource<number>();
  const invalid: AsyncIterable<number> = {
    [Symbol.asyncIterator](): AsyncIterator<number> {
      throw new Error("factory failed");
    },
  };
  const merged = mergeAsyncIterables([acquired, invalid]);

  await assertRejects(
    () => merged[Symbol.asyncIterator]().next(),
    AsyncIterableOperatorConfigurationError,
  );
  assertEquals(acquired.returnCalls, 1);
  assertEquals(merged.inspect().activeIterators, 0);
});

Deno.test("tagged races preserve undefined rejection identity", async () => {
  const merged = mergeAsyncIterables([rejectingSource<number>(undefined)]);
  assertStrictEquals(
    await captureRejection(merged[Symbol.asyncIterator]().next()),
    undefined,
  );

  const switched = switchLatestAsyncIterable(fromValues([rejectingSource<number>(undefined)]));
  assertStrictEquals(
    await captureRejection(switched[Symbol.asyncIterator]().next()),
    undefined,
  );

  const debounced = debounceAsyncIterable(rejectingSource<number>(undefined), {
    scheduler: new VirtualTimerScheduler(),
    delayMs: 1,
  });
  assertStrictEquals(
    await captureRejection(debounced[Symbol.asyncIterator]().next()),
    undefined,
  );
});

Deno.test("switch-latest cancels a superseded source and ignores its later values", async () => {
  const outer = new ManualSource<AsyncIterable<number>>();
  const oldSource = new ManualSource<number>();
  const newSource = new ManualSource<number>();
  const switched = switchLatestAsyncIterable(outer);
  const iterator = switched[Symbol.asyncIterator]();

  const first = iterator.next();
  outer.push(oldSource);
  await flushMicrotasks();
  oldSource.push(1);
  assertEquals(await first, { done: false, value: 1 });

  const second = iterator.next();
  outer.push(newSource);
  await flushMicrotasks();
  assertEquals(oldSource.returnCalls, 1);
  oldSource.push(999);
  newSource.push(2);
  assertEquals(await second, { done: false, value: 2 });
  assertEquals(switched.inspect().dropped, 1);

  const end = iterator.next();
  outer.close();
  newSource.close();
  assertEquals(await end, { done: true, value: undefined });
});

Deno.test("switch-latest closes a superseded source exactly once when replacement acquisition fails", async () => {
  const outer = new ManualSource<AsyncIterable<number>>();
  const oldSource = new ManualSource<number>();
  const invalid: AsyncIterable<number> = {
    [Symbol.asyncIterator](): AsyncIterator<number> {
      throw new Error("invalid replacement");
    },
  };
  const switched = switchLatestAsyncIterable(outer);
  const iterator = switched[Symbol.asyncIterator]();

  const first = iterator.next();
  outer.push(oldSource);
  await flushMicrotasks();
  oldSource.push(1);
  assertEquals(await first, { done: false, value: 1 });

  const replacement = iterator.next();
  outer.push(invalid);
  await assertRejects(() => replacement, AsyncIterableOperatorConfigurationError);
  await flushMicrotasks();
  assertEquals(oldSource.returnCalls, 1);
  assertEquals(outer.returnCalls, 1);
});

Deno.test("debounce uses only the injected scheduler and flushes the newest value", async () => {
  const scheduler = new VirtualTimerScheduler();
  const source = new ManualSource<number>();
  const debounced = debounceAsyncIterable(source, { scheduler, delayMs: 10 });
  const iterator = debounced[Symbol.asyncIterator]();
  const output = iterator.next();

  source.push(1);
  await flushMicrotasks();
  source.push(2);
  await flushMicrotasks();
  assertEquals(debounced.inspect().buffered, 1);
  assertEquals(debounced.inspect().pendingTimers, 1);
  scheduler.advanceBy(9);
  await flushMicrotasks();
  scheduler.advanceBy(1);
  assertEquals(await output, { done: false, value: 2 });
  assertEquals(debounced.inspect().pendingTimers, 0);

  const end = iterator.next();
  source.close();
  assertEquals(await end, { done: true, value: undefined });
  assertEquals(debounced.inspect().completedIterators, 1);
});

Deno.test("debounce flushes a pending value immediately when the source completes", async () => {
  const scheduler = new VirtualTimerScheduler();
  const source = new ManualSource<string>();
  const debounced = debounceAsyncIterable(source, { scheduler, delayMs: 100 });
  const iterator = debounced[Symbol.asyncIterator]();
  const output = iterator.next();
  source.push("tail");
  await flushMicrotasks();
  source.close();

  assertEquals(await output, { done: false, value: "tail" });
  assertEquals(await iterator.next(), { done: true, value: undefined });
  assertEquals(scheduler.inspect().pending, 0);
});

Deno.test("debounce snapshots its scheduler before option mutation", async () => {
  const scheduler = new VirtualTimerScheduler();
  const source = new ManualSource<number>();
  let schedulerReads = 0;
  const options = {
    delayMs: 5,
    get scheduler(): VirtualTimerScheduler {
      schedulerReads += 1;
      return scheduler;
    },
  };
  const debounced = debounceAsyncIterable(source, options);
  Object.defineProperty(options, "scheduler", {
    configurable: true,
    get(): never {
      throw new Error("mutated debounce scheduler was read");
    },
  });

  const iterator = debounced[Symbol.asyncIterator]();
  const output = iterator.next();
  source.push(1);
  await flushMicrotasks();
  assertEquals(schedulerReads, 1);
  assertEquals(debounced.inspect().pendingTimers, 1);
  scheduler.advanceBy(5);
  assertEquals(await output, { done: false, value: 1 });
  assertEquals(debounced.inspect().pendingTimers, 0);
  await iterator.return();
});

Deno.test("throttle emits leading and latest trailing values with replacement accounting", async () => {
  const scheduler = new VirtualTimerScheduler();
  const source = new ManualSource<number>();
  const throttled = throttleAsyncIterable(source, { scheduler, intervalMs: 10 });
  const iterator = throttled[Symbol.asyncIterator]();

  const first = iterator.next();
  source.push(1);
  assertEquals(await first, { done: false, value: 1 });
  assertEquals(throttled.inspect().pendingTimers, 1);

  const trailing = iterator.next();
  source.push(2);
  await flushMicrotasks();
  source.push(3);
  await flushMicrotasks();
  scheduler.advanceBy(10);
  assertEquals(await trailing, { done: false, value: 3 });
  assertEquals(throttled.inspect().dropped, 1);

  const end = iterator.next();
  source.close();
  assertEquals(await end, { done: true, value: undefined });
  assertEquals(scheduler.inspect().pending, 0);
});

Deno.test("trailing-only throttle applies the leading policy to every window", async () => {
  const scheduler = new VirtualTimerScheduler();
  const source = new ManualSource<number>();
  const throttled = throttleAsyncIterable(source, {
    scheduler,
    intervalMs: 5,
    leading: false,
    trailing: true,
  });
  const iterator = throttled[Symbol.asyncIterator]();

  const first = iterator.next();
  source.push(1);
  await flushMicrotasks();
  scheduler.advanceBy(5);
  assertEquals(await first, { done: false, value: 1 });

  const second = iterator.next();
  scheduler.advanceBy(5);
  await flushMicrotasks();
  source.push(2);
  await flushMicrotasks();
  scheduler.advanceBy(5);
  assertEquals(await second, { done: false, value: 2 });
  await iterator.return();
});

Deno.test("throttle applies elapsed virtual windows before prefetched source values", async () => {
  const scheduler = new VirtualTimerScheduler();
  const source = new ManualSource<number>();
  const throttled = throttleAsyncIterable(source, {
    scheduler,
    intervalMs: 10,
    leading: true,
    trailing: false,
  });
  const iterator = throttled[Symbol.asyncIterator]();

  const first = iterator.next();
  source.push(1);
  assertEquals(await first, { done: false, value: 1 });

  scheduler.advanceBy(10);
  await flushMicrotasks();
  source.push(2);
  await flushMicrotasks();
  assertEquals(await iterator.next(), { done: false, value: 2 });
  assertEquals(throttled.inspect().dropped, 0);
  await iterator.return();
});

Deno.test("throttle snapshots its scheduler before option mutation", async () => {
  const scheduler = new VirtualTimerScheduler();
  const source = new ManualSource<number>();
  let schedulerReads = 0;
  const options = {
    intervalMs: 5,
    get scheduler(): VirtualTimerScheduler {
      schedulerReads += 1;
      return scheduler;
    },
  };
  const throttled = throttleAsyncIterable(source, options);
  Object.defineProperty(options, "scheduler", {
    configurable: true,
    get(): never {
      throw new Error("mutated throttle scheduler was read");
    },
  });

  const iterator = throttled[Symbol.asyncIterator]();
  const output = iterator.next();
  source.push(1);
  assertEquals(await output, { done: false, value: 1 });
  assertEquals(schedulerReads, 1);
  assertEquals(throttled.inspect().pendingTimers, 1);
  await iterator.return();
  assertEquals(throttled.inspect().pendingTimers, 0);
  assertEquals(scheduler.inspect().pending, 0);
});

Deno.test("buffer emits frozen bounded chunks and a frozen tail", async () => {
  const buffered = bufferAsyncIterable(fromValues([1, 2, 3, 4, 5]), { size: 2 });
  const output = await collect(buffered);
  assertEquals(output, [[1, 2], [3, 4], [5]]);
  assert(output.every(Object.isFrozen));
  assertEquals(buffered.inspect().buffered, 0);
  assertEquals(buffered.inspect().emitted, 3);
});

Deno.test("multi-iterator buffered inspection aggregates and releases each iterator contribution", async () => {
  const buffered = bufferAsyncIterable(fromValues([1, 2]), {
    size: 3,
    maxActiveIterators: 2,
  });
  const first = buffered[Symbol.asyncIterator]();
  const second = buffered[Symbol.asyncIterator]();
  const firstTail = await first.next();
  const secondTail = await second.next();
  assertEquals(firstTail, { done: false, value: [1, 2] });
  assertEquals(secondTail, { done: false, value: [1, 2] });
  assertEquals(buffered.inspect().buffered, 4);
  assertEquals(buffered.inspect().activeIterators, 2);
  assertEquals(buffered.inspect().pendingNext, 0);

  assertEquals(await first.next(), { done: true, value: undefined });
  assertEquals(buffered.inspect().buffered, 2);
  assertEquals(await second.next(), { done: true, value: undefined });
  assertEquals(buffered.inspect().buffered, 0);
});

Deno.test("window flushes by virtual time and by the item safety bound", async () => {
  const scheduler = new VirtualTimerScheduler();
  const source = new ManualSource<number>();
  const windowed = windowAsyncIterable(source, { scheduler, durationMs: 10, maxItems: 2 });
  const iterator = windowed[Symbol.asyncIterator]();

  const full = iterator.next();
  source.push(1);
  await flushMicrotasks();
  source.push(2);
  assertEquals(await full, { done: false, value: [1, 2] });
  assertEquals(scheduler.inspect().pending, 0);

  const timed = iterator.next();
  source.push(3);
  await flushMicrotasks();
  scheduler.advanceBy(10);
  const timedResult = await timed;
  assertEquals(timedResult, { done: false, value: [3] });
  assert(Object.isFrozen(timedResult.value));

  const end = iterator.next();
  source.close();
  assertEquals(await end, { done: true, value: undefined });
});

Deno.test("window snapshots its scheduler before option mutation", async () => {
  const scheduler = new VirtualTimerScheduler();
  const source = new ManualSource<number>();
  let schedulerReads = 0;
  const options = {
    durationMs: 5,
    get scheduler(): VirtualTimerScheduler {
      schedulerReads += 1;
      return scheduler;
    },
  };
  const windowed = windowAsyncIterable(source, options);
  Object.defineProperty(options, "scheduler", {
    configurable: true,
    get(): never {
      throw new Error("mutated window scheduler was read");
    },
  });

  const iterator = windowed[Symbol.asyncIterator]();
  const output = iterator.next();
  source.push(1);
  await flushMicrotasks();
  assertEquals(schedulerReads, 1);
  assertEquals(windowed.inspect().pendingTimers, 1);
  scheduler.advanceBy(5);
  assertEquals(await output, { done: false, value: [1] });
  assertEquals(windowed.inspect().pendingTimers, 0);
  await iterator.return();
});

Deno.test("retry recreates sources deterministically and counts bounded attempts", async () => {
  let attempts = 0;
  const retried = retryAsyncIterable<number>(({ attempt }) => {
    attempts += 1;
    return (async function* () {
      yield attempt;
      if (attempt < 3) throw new Error(`attempt ${attempt}`);
    })();
  }, { maxRetries: 2 });

  assertEquals(await collect(retried), [1, 2, 3]);
  assertEquals(attempts, 3);
  assertEquals(retried.inspect().retries, 2);
  assertEquals(retried.inspect().failedIterators, 0);
});

Deno.test("retry delay and classification use the caller scheduler", async () => {
  const scheduler = new VirtualTimerScheduler();
  const marker = new Error("transient");
  let attempts = 0;
  const retried = retryAsyncIterable<number>(() => {
    attempts += 1;
    if (attempts === 1) {
      return {
        async *[Symbol.asyncIterator]() {
          yield* [] as number[];
          throw marker;
        },
      };
    }
    return fromValues([42]);
  }, {
    maxRetries: 1,
    delayMs: 5,
    scheduler,
    shouldRetry: (error, attempt) => error === marker && attempt === 1,
  });
  const iterator = retried[Symbol.asyncIterator]();
  const value = iterator.next();
  await flushMicrotasks();
  assertEquals(scheduler.inspect().pending, 1);
  scheduler.advanceBy(5);
  assertEquals(await value, { done: false, value: 42 });
  assertEquals(await iterator.next(), { done: true, value: undefined });

  const permanent = new Error("permanent");
  const stopped = retryAsyncIterable<number>(() => ({
    async *[Symbol.asyncIterator]() {
      yield* [] as number[];
      throw permanent;
    },
  }), { maxRetries: 4, shouldRetry: () => false });
  assertStrictEquals(await assertRejects(() => stopped[Symbol.asyncIterator]().next()), permanent);
  assertEquals(stopped.inspect().retries, 0);
});

Deno.test("retry treats invalid factory output as permanent and validates classifier results", async () => {
  let attempts = 0;
  const invalid = retryAsyncIterable<number>(() => {
    attempts += 1;
    return null as unknown as AsyncIterable<number>;
  }, { maxRetries: 5 });
  await assertRejects(
    () => invalid[Symbol.asyncIterator]().next(),
    AsyncIterableOperatorConfigurationError,
  );
  assertEquals(attempts, 1);
  assertEquals(invalid.inspect().retries, 0);

  const invalidClassifier = retryAsyncIterable<number>(() => ({
    async *[Symbol.asyncIterator]() {
      yield* [] as number[];
      throw new Error("retry me");
    },
  }), {
    maxRetries: 1,
    shouldRetry: (() => "yes") as unknown as () => boolean,
  });
  await assertRejects(
    () => invalidClassifier[Symbol.asyncIterator]().next(),
    AsyncIterableOperatorConfigurationError,
  );
  assertEquals(invalidClassifier.inspect().retries, 0);
});

Deno.test("retry snapshots scheduler and classifier options at construction", async () => {
  const scheduler = new VirtualTimerScheduler();
  const marker = new Error("transient");
  let attempts = 0;
  let originalClassifierCalls = 0;
  const options: {
    maxRetries: number;
    delayMs: number;
    scheduler: VirtualTimerScheduler | undefined;
    shouldRetry: (error: unknown, attempt: number) => boolean;
  } = {
    maxRetries: 1,
    delayMs: 5,
    scheduler,
    shouldRetry(error, attempt) {
      originalClassifierCalls += 1;
      return error === marker && attempt === 1;
    },
  };
  const retried = retryAsyncIterable<number>(() => {
    attempts += 1;
    return attempts === 1 ? rejectingSource(marker) : fromValues([42]);
  }, options);

  options.scheduler = undefined;
  options.shouldRetry = () => false;
  const next = retried[Symbol.asyncIterator]().next();
  await flushMicrotasks();
  assertEquals(scheduler.inspect().pending, 1);
  scheduler.advanceBy(5);
  assertEquals(await next, { done: false, value: 42 });
  assertEquals(originalClassifierCalls, 1);
  assertEquals(retried.inspect().retries, 1);
});

Deno.test("operator disposal aborts pending reads, closes upstream, and is idempotent", async () => {
  const source = new ManualSource<number>();
  const mapped = mapAsyncIterable(source, (value) => value);
  const iterator = mapped[Symbol.asyncIterator]();
  const pending = iterator.next();
  await flushMicrotasks();

  assertEquals(mapped.dispose("shutdown"), true);
  assertEquals(mapped.dispose("again"), false);
  const error = await assertRejects(() => pending, AsyncIterableOperatorAbortedError);
  assertEquals(error.cause, "shutdown");
  assertEquals(source.returnCalls, 1);
  assertEquals(mapped.inspect().disposed, true);
  assertThrows(() => mapped[Symbol.asyncIterator](), AsyncIterableOperatorDisposedError);
});

Deno.test("concurrent next return and operator disposal close upstream exactly once", async () => {
  const source = new ManualSource<number>();
  const mapped = mapAsyncIterable(source, (value) => value);
  const iterator = mapped[Symbol.asyncIterator]();
  const pending = iterator.next();
  await flushMicrotasks();

  const returning = iterator.return();
  assertEquals(mapped.dispose("concurrent-dispose"), true);
  await assertRejects(() => pending, AsyncIterableOperatorAbortedError);
  assertEquals(await returning, { done: true, value: undefined });
  await flushMicrotasks();

  assertEquals(source.returnCalls, 1);
  assertEquals(mapped.inspect().activeIterators, 0);
  assertEquals(mapped.inspect().cancelledIterators, 1);
});

Deno.test("external cancellation before and during iteration uses the same disposal path", async () => {
  const already = new AbortController();
  already.abort("before");
  const neverStarted = mapAsyncIterable(fromValues([1]), (value) => value, { signal: already.signal });
  assertEquals(neverStarted.inspect().disposed, true);
  assertThrows(() => neverStarted[Symbol.asyncIterator](), AsyncIterableOperatorDisposedError);

  const controller = new AbortController();
  const source = new ManualSource<number>();
  const active = mapAsyncIterable(source, (value) => value, { signal: controller.signal });
  const pending = active[Symbol.asyncIterator]().next();
  await flushMicrotasks();
  controller.abort("during");
  const error = await assertRejects(() => pending, AsyncIterableOperatorAbortedError);
  assertEquals(error.cause, "during");
  assertEquals(source.returnCalls, 1);
  assertEquals(active.inspect().disposed, true);
});

Deno.test("timer scheduling failure clears timer metrics and closes the source", async () => {
  const scheduler = new VirtualTimerScheduler();
  scheduler.dispose();
  const source = new ManualSource<number>();
  const debounced = debounceAsyncIterable(source, { scheduler, delayMs: 1 });
  const next = debounced[Symbol.asyncIterator]().next();
  source.push(1);
  await assertRejects(() => next);
  assertEquals(debounced.inspect().pendingTimers, 0);
  assertEquals(source.returnCalls, 1);
});

Deno.test("merge source snapshots inspect only bounded length and indexed descriptors", async () => {
  let ownKeysCalls = 0;
  let descriptorCalls = 0;
  const sources = new Proxy([fromValues([1])], {
    ownKeys() {
      ownKeysCalls += 1;
      throw new Error("unbounded enumeration must not run");
    },
    getOwnPropertyDescriptor(target, property) {
      descriptorCalls += 1;
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });

  assertEquals(await collect(mergeAsyncIterables(sources, { maxSources: 1 })), [1]);
  assertEquals(ownKeysCalls, 0);
  assertEquals(descriptorCalls, 2);
});

Deno.test("strict iterator-result validation fails closed and releases upstream", async () => {
  let primitiveReturnCalls = 0;
  const primitiveResult: AsyncIterable<number> = {
    [Symbol.asyncIterator](): AsyncIterator<number> {
      return {
        next: () => Promise.resolve(7 as unknown as IteratorResult<number>),
        return: () => {
          primitiveReturnCalls += 1;
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
  const mapped = mapAsyncIterable(primitiveResult, (value) => value);
  await assertRejects(
    () => mapped[Symbol.asyncIterator]().next(),
    AsyncIterableOperatorConfigurationError,
  );
  assertEquals(primitiveReturnCalls, 1);
  assertEquals(mapped.inspect().failedIterators, 1);
  assertEquals(mapped.inspect().activeIterators, 0);

  const hostileResult = new Proxy({ done: false, value: 1 }, {
    getOwnPropertyDescriptor() {
      throw new Error("result descriptor trap");
    },
  });
  const hostileSource: AsyncIterable<number> = {
    [Symbol.asyncIterator](): AsyncIterator<number> {
      return {
        next: () => Promise.resolve(hostileResult),
        return: () => Promise.resolve({ done: true, value: undefined }),
      };
    },
  };
  await assertRejects(
    () => mapAsyncIterable(hostileSource, (value) => value)[Symbol.asyncIterator]().next(),
    AsyncIterableOperatorConfigurationError,
  );
});

Deno.test("construction rejects invalid bounds, timers, sources, and retry policy", () => {
  assertThrows(
    () => bufferAsyncIterable(fromValues([]), { size: 0 }),
    AsyncIterableOperatorConfigurationError,
  );
  assertThrows(
    () => debounceAsyncIterable(fromValues([]), { scheduler: new VirtualTimerScheduler(), delayMs: -1 }),
    AsyncIterableOperatorConfigurationError,
  );
  assertThrows(
    () =>
      throttleAsyncIterable(fromValues([]), {
        scheduler: new VirtualTimerScheduler(),
        intervalMs: 1,
        leading: false,
        trailing: false,
      }),
    AsyncIterableOperatorConfigurationError,
  );
  assertThrows(
    () => retryAsyncIterable(() => fromValues([]), { delayMs: 1 }),
    AsyncIterableOperatorConfigurationError,
  );
  assertThrows(
    () => mergeAsyncIterables([fromValues([]), fromValues([])], { maxSources: 1 }),
    AsyncIterableOperatorConfigurationError,
  );

  const hostile = new Proxy([fromValues<number>([])], {
    getOwnPropertyDescriptor() {
      throw new Error("descriptor trap");
    },
  });
  assertThrows(
    () => mergeAsyncIterables(hostile),
    AsyncIterableOperatorConfigurationError,
  );
});

Deno.test("inspection is frozen clone-safe bounded and sanitizes hostile errors", async () => {
  const observed: unknown[] = [];
  const hostile = new Error("hidden");
  Object.defineProperties(hostile, {
    name: {
      get: () => {
        throw new Error("name getter");
      },
    },
    message: {
      get: () => {
        throw new Error("message getter");
      },
    },
  });
  const source = new ManualSource<number>();
  const mapped = mapAsyncIterable(source, (value) => value, {
    onError(error) {
      observed.push(error);
      throw new Error("observer failure is isolated");
    },
  });
  const next = mapped[Symbol.asyncIterator]().next();
  source.fail(hostile);
  assertStrictEquals(await assertRejects(() => next), hostile);

  const inspection = mapped.inspect();
  assert(Object.isFrozen(inspection));
  assert(Object.isFrozen(inspection.lastError));
  assertEquals(inspection.lastError, {
    name: "Error",
    message: "Async-iterable operator failed.",
  });
  assertEquals(structuredClone(inspection), inspection);
  assertEquals(observed.length, 1);
});

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  const notRejected = Symbol("not-rejected");
  let rejection: unknown = notRejected;
  try {
    await promise;
  } catch (error) {
    rejection = error;
  }
  assert(rejection !== notRejected, "Expected promise to reject.");
  return rejection;
}

function rejectingSource<Value>(error: unknown): AsyncIterable<Value> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<Value> {
      return {
        next: () => Promise.reject(error),
        return: () => Promise.resolve({ done: true, value: undefined }),
      };
    },
  };
}

async function collect<Value>(source: AsyncIterable<Value>): Promise<Value[]> {
  const output: Value[] = [];
  for await (const value of source) output.push(value);
  return output;
}

function fromValues<Value>(values: readonly Value[]): AsyncIterable<Value> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) yield value;
    },
  };
}

type ManualOutcome<Value> =
  | { kind: "value"; value: Value }
  | { kind: "done" }
  | { kind: "error"; error: unknown };

class ManualSource<Value> implements AsyncIterable<Value> {
  readonly #queue: ManualOutcome<Value>[] = [];
  readonly #waiters: Array<(outcome: ManualOutcome<Value>) => void> = [];
  #closed = false;
  #pendingReads = 0;
  returnCalls = 0;
  maxPendingReads = 0;

  push(value: Value): void {
    if (this.#closed) return;
    this.#settle({ kind: "value", value });
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#settleAll({ kind: "done" });
  }

  fail(error: unknown): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#settleAll({ kind: "error", error });
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<Value> {
    return {
      next: async (): Promise<IteratorResult<Value>> => {
        this.#pendingReads += 1;
        this.maxPendingReads = Math.max(this.maxPendingReads, this.#pendingReads);
        try {
          const outcome = this.#queue.shift() ?? await new Promise<ManualOutcome<Value>>((resolve) => {
            this.#waiters.push(resolve);
          });
          if (outcome.kind === "error") throw outcome.error;
          if (outcome.kind === "done") return { done: true, value: undefined };
          return { done: false, value: outcome.value };
        } finally {
          this.#pendingReads -= 1;
        }
      },
      return: (): Promise<IteratorResult<Value>> => {
        this.returnCalls += 1;
        this.close();
        return Promise.resolve({ done: true, value: undefined });
      },
      [Symbol.asyncIterator](): AsyncIterableIterator<Value> {
        return this;
      },
    };
  }

  #settle(outcome: ManualOutcome<Value>): void {
    const waiter = this.#waiters.shift();
    if (waiter) waiter(outcome);
    else this.#queue.push(outcome);
  }

  #settleAll(outcome: ManualOutcome<Value>): void {
    if (this.#waiters.length === 0) {
      this.#queue.push(outcome);
      return;
    }
    for (const waiter of this.#waiters.splice(0)) waiter(outcome);
  }
}

async function flushMicrotasks(turns = 8): Promise<void> {
  for (let index = 0; index < turns; index++) await Promise.resolve();
}
