import { assertEquals, assertInstanceOf, assertThrows } from "./deps.ts";
import {
  HostTimerScheduler,
  MAX_MONOTONIC_TIME,
  MonotonicClockRegressionError,
  TimerAdvanceLimitError,
  type TimerHandle,
  TimerSchedulerDisposedError,
  TimerSchedulerReentrancyError,
  VirtualTimerScheduler,
} from "../src/runtime/clock.ts";

Deno.test("virtual time advances deterministically with deadline order and stable FIFO ties", () => {
  const scheduler = new VirtualTimerScheduler({ startTimeMs: 10 });
  const order: string[] = [];
  const observedTimes: number[] = [];

  scheduler.scheduleAt(20, () => {
    order.push("first tie");
    observedTimes.push(scheduler.now());
  });
  scheduler.scheduleAfter(10, () => {
    order.push("second tie");
    observedTimes.push(scheduler.now());
  });
  scheduler.scheduleAfter(5, () => {
    order.push("early");
    observedTimes.push(scheduler.now());
  });

  const result = scheduler.advanceTo(20);

  assertEquals(order, ["early", "first tie", "second tie"]);
  assertEquals(observedTimes, [15, 20, 20]);
  assertEquals(result, {
    fromMs: 10,
    requestedToMs: 20,
    reachedMs: 20,
    callbacks: 3,
    limitReached: false,
    disposed: false,
    pending: 0,
    nextDeadlineMs: undefined,
  });
  assertEquals(scheduler.inspect(), {
    scheduler: "virtual",
    now: 20,
    disposed: false,
    pending: 0,
    running: 0,
    awaiting: 0,
    scheduled: 3,
    completed: 3,
    failed: 0,
    cancelled: 0,
    disposedTimers: 0,
    clockRegressions: 0,
    advanceLimitHits: 0,
    inspectionLimit: 100,
    truncated: 0,
    timers: [],
  });
});

Deno.test("callbacks may schedule and cancel within the same deterministic advance", () => {
  const scheduler = new VirtualTimerScheduler();
  const order: string[] = [];

  scheduler.scheduleAt(5, () => {
    order.push("outer");
    scheduler.scheduleAt(5, () => order.push("nested tie"));
    scheduler.scheduleAfter(1, () => order.push("nested later"));
    cancelled.cancel();
  });
  scheduler.scheduleAt(5, () => order.push("existing tie"));
  const cancelled = scheduler.scheduleAt(6, () => order.push("cancelled"));

  const result = scheduler.advanceTo(10);

  assertEquals(order, ["outer", "existing tie", "nested tie", "nested later"]);
  assertEquals(cancelled.inspect().status, "cancelled");
  assertEquals(result.callbacks, 4);
  assertEquals(result.reachedMs, 10);
  assertEquals(scheduler.inspect().cancelled, 1);
});

Deno.test("handles, disposal, and bounded inspection remain defensive", () => {
  const scheduler = new VirtualTimerScheduler({
    startTimeMs: 7,
    maxInspectionEntries: 1,
  });
  const first = scheduler.scheduleAfter(3, () => undefined);
  const second = scheduler.scheduleAfter(4, () => undefined);

  const snapshot = scheduler.inspect();
  assertEquals(snapshot.pending, 2);
  assertEquals(snapshot.timers.length, 1);
  assertEquals(snapshot.truncated, 1);
  snapshot.timers[0]!.status = "failed";
  snapshot.timers.length = 0;
  assertEquals(scheduler.inspect().timers[0]?.status, "scheduled");

  assertEquals(first.cancel(), true);
  assertEquals(first.cancel(), false);
  assertEquals(first.inspect().status, "cancelled");

  scheduler.dispose();
  scheduler.dispose();
  assertEquals(second.inspect().status, "disposed");
  assertEquals(scheduler.now(), 7);
  assertEquals(scheduler.inspect().disposedTimers, 1);
  assertEquals(scheduler.inspect().pending, 0);
  assertThrows(
    () => scheduler.scheduleAfter(0, () => undefined),
    TimerSchedulerDisposedError,
  );
  assertThrows(() => scheduler.advanceBy(1), TimerSchedulerDisposedError);
});

Deno.test("virtual scheduler rejects invalid, backwards, and overflowing time", () => {
  assertThrows(() => new VirtualTimerScheduler({ startTimeMs: Number.NaN }), RangeError);
  assertThrows(() => new VirtualTimerScheduler({ maxCallbacksPerAdvance: 0 }), RangeError);
  assertThrows(() => new VirtualTimerScheduler({ maxInspectionEntries: -1 }), RangeError);

  const scheduler = new VirtualTimerScheduler({ startTimeMs: 1 });
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, MAX_MONOTONIC_TIME + 1]) {
    assertThrows(() => scheduler.scheduleAt(invalid, () => undefined), RangeError);
    assertThrows(() => scheduler.scheduleAfter(invalid, () => undefined), RangeError);
  }
  assertThrows(() => scheduler.advanceTo(0), RangeError);
  assertThrows(() => scheduler.advanceBy(MAX_MONOTONIC_TIME), RangeError);
  assertThrows(() => scheduler.runDue({ maxCallbacks: 0 }), RangeError);
  assertThrows(
    () => scheduler.scheduleAfter(0, undefined as unknown as () => void),
    TypeError,
  );

  const past = scheduler.scheduleAt(0, () => undefined);
  assertEquals(past.deadlineMs, 1);
  assertEquals(scheduler.runDue().callbacks, 1);
});

Deno.test("virtual advances stop bounded zero-delay rescheduling loops", () => {
  const errors: Array<[unknown, string]> = [];
  const scheduler = new VirtualTimerScheduler({
    maxCallbacksPerAdvance: 3,
    onError: (error, context) => errors.push([error, context.phase]),
  });
  let runs = 0;
  let latest!: TimerHandle;
  const spin = () => {
    runs += 1;
    latest = scheduler.scheduleAfter(0, spin);
  };
  latest = scheduler.scheduleAfter(0, spin);

  const result = scheduler.runDue();

  assertEquals(runs, 3);
  assertEquals(result.limitReached, true);
  assertEquals(result.callbacks, 3);
  assertEquals(result.reachedMs, 0);
  assertEquals(result.pending, 1);
  assertEquals(result.nextDeadlineMs, 0);
  assertEquals(scheduler.inspect().advanceLimitHits, 1);
  assertInstanceOf(errors[0]?.[0], TimerAdvanceLimitError);
  assertEquals(errors[0]?.[1], "advance-limit");
  assertEquals(latest.cancel(), true);
  assertEquals(scheduler.runDue().callbacks, 0);
});

Deno.test("callback errors and reentrant advancement are isolated from later timers", () => {
  const marker = new Error("timer callback rejected work");
  const errors: Array<[unknown, string]> = [];
  const scheduler = new VirtualTimerScheduler({
    onError: (error, context) => errors.push([error, context.phase]),
  });
  const order: string[] = [];
  const thrown = scheduler.scheduleAfter(0, () => {
    throw marker;
  });
  const reentrant = scheduler.scheduleAfter(0, () => scheduler.runDue());
  const healthy = scheduler.scheduleAfter(0, () => order.push("healthy"));

  const result = scheduler.runDue();

  assertEquals(result.callbacks, 3);
  assertEquals(order, ["healthy"]);
  assertEquals(thrown.inspect().status, "failed");
  assertEquals(reentrant.inspect().status, "failed");
  assertEquals(healthy.inspect().status, "completed");
  assertEquals(errors[0], [marker, "callback"]);
  assertInstanceOf(errors[1]?.[0], TimerSchedulerReentrancyError);
  assertEquals(errors[1]?.[1], "callback");

  const observerThrows = new VirtualTimerScheduler({
    onError: () => {
      throw new Error("diagnostic sink rejected work");
    },
  });
  let continued = false;
  observerThrows.scheduleAfter(0, () => {
    throw marker;
  });
  observerThrows.scheduleAfter(0, () => {
    continued = true;
  });
  assertEquals(observerThrows.runDue().callbacks, 2);
  assertEquals(continued, true);
});

Deno.test("async callback results are observed without blocking virtual advancement", async () => {
  const rejection = new Error("async timer rejection");
  const errors: Array<[unknown, string]> = [];
  const scheduler = new VirtualTimerScheduler({
    onError: (error, context) => errors.push([error, context.phase]),
  });
  const rejected = scheduler.scheduleAfter(0, () => Promise.reject(rejection));
  const resolved = scheduler.scheduleAfter(0, () => Promise.resolve("done"));
  let synchronous = false;
  scheduler.scheduleAfter(0, () => {
    synchronous = true;
  });

  const result = scheduler.runDue();
  assertEquals(result.callbacks, 3);
  assertEquals(synchronous, true);
  assertEquals(rejected.inspect().status, "awaiting");
  assertEquals(resolved.inspect().status, "awaiting");
  assertEquals(scheduler.inspect().awaiting, 2);

  await Promise.resolve();
  await Promise.resolve();

  assertEquals(rejected.inspect().status, "failed");
  assertEquals(resolved.inspect().status, "completed");
  assertEquals(scheduler.inspect().awaiting, 0);
  assertEquals(scheduler.inspect().failed, 1);
  assertEquals(scheduler.inspect().completed, 2);
  assertEquals(errors, [[rejection, "async-callback"]]);
});

Deno.test("thenable callbacks are assimilated through one isolated then read", async () => {
  const errors: Array<[unknown, string]> = [];
  const scheduler = new VirtualTimerScheduler({
    onError: (error, context) => errors.push([error, context.phase]),
  });
  let thenReads = 0;
  let thenCalls = 0;
  const thenable = Object.defineProperty({}, "then", {
    get() {
      thenReads += 1;
      if (thenReads > 1) throw new Error("then getter was read twice");
      return (resolve: (value: string) => void) => {
        thenCalls += 1;
        resolve("done");
        resolve("ignored");
        throw new Error("throw after resolution must be ignored");
      };
    },
  });
  const oneShot = scheduler.scheduleAfter(0, () => thenable);
  const healthy = scheduler.scheduleAfter(0, () => undefined);

  assertEquals(scheduler.runDue().callbacks, 2);
  assertEquals(healthy.inspect().status, "completed");
  assertEquals(oneShot.inspect().status, "awaiting");

  await Promise.resolve();
  await Promise.resolve();

  assertEquals(thenReads, 1);
  assertEquals(thenCalls, 1);
  assertEquals(oneShot.inspect().status, "completed");
  assertEquals(scheduler.inspect().awaiting, 0);
  assertEquals(errors, []);
});

Deno.test("host adapter uses only injected primitives and re-arms early or long wakeups", () => {
  const host = new InjectedHostTimer(100);
  const errors: Array<[unknown, string]> = [];
  const scheduler = new HostTimerScheduler({
    now: () => host.nowMs,
    setTimeout: (callback, delay) => host.setTimeout(callback, delay),
    clearTimeout: (handle) => host.clearTimeout(handle),
    maxHostDelayMs: 10,
    onError: (error, context) => errors.push([error, context.phase]),
  });
  let runs = 0;
  scheduler.scheduleAt(125, () => {
    runs += 1;
  });

  assertEquals(host.delays(), [10]);
  host.fireNext();
  assertEquals(runs, 0);
  assertEquals(host.delays(), [10]);
  host.nowMs = 110;
  host.fireNext();
  assertEquals(host.delays(), [10]);
  host.nowMs = 120;
  host.fireNext();
  assertEquals(host.delays(), [5]);
  host.nowMs = 125;
  host.fireNext();
  assertEquals(runs, 1);

  const cancelled = scheduler.scheduleAfter(5, () => {
    runs += 100;
  });
  assertEquals(cancelled.cancel(), true);
  assertEquals(host.pendingCount(), 0);
  assertEquals(host.cleared.length, 1);

  host.nowMs = 124;
  assertEquals(scheduler.now(), 125);
  assertInstanceOf(errors[0]?.[0], MonotonicClockRegressionError);
  assertEquals(errors[0]?.[1], "clock");
  assertEquals(scheduler.inspect().clockRegressions, 2);
  assertEquals(scheduler.inspect().completed, 1);
  assertEquals(scheduler.inspect().cancelled, 1);
});

Deno.test("host scheduling, callback, cancellation, and disposal errors fail closed", () => {
  const setupHost = new InjectedHostTimer();
  setupHost.throwOnSet = true;
  const setupErrors: string[] = [];
  const setupScheduler = new HostTimerScheduler({
    now: () => setupHost.nowMs,
    setTimeout: (callback, delay) => setupHost.setTimeout(callback, delay),
    clearTimeout: (handle) => setupHost.clearTimeout(handle),
    onError: (_error, context) => setupErrors.push(context.phase),
  });
  assertThrows(() => setupScheduler.scheduleAfter(1, () => undefined), Error, "host schedule rejected work");
  assertEquals(setupErrors, ["schedule"]);
  assertEquals(setupScheduler.inspect().pending, 0);
  assertEquals(setupScheduler.inspect().failed, 1);

  const host = new InjectedHostTimer();
  const errors: Array<[unknown, string]> = [];
  const scheduler = new HostTimerScheduler({
    now: () => host.nowMs,
    setTimeout: (callback, delay) => host.setTimeout(callback, delay),
    clearTimeout: (handle) => host.clearTimeout(handle),
    onError: (error, context) => errors.push([error, context.phase]),
  });
  const marker = new Error("host callback rejected work");
  let healthy = false;
  scheduler.scheduleAfter(0, () => {
    throw marker;
  });
  scheduler.scheduleAfter(0, () => {
    healthy = true;
  });
  host.fireNext();
  host.fireNext();
  assertEquals(healthy, true);
  assertEquals(errors[0], [marker, "callback"]);

  const cancelled = scheduler.scheduleAfter(10, () => undefined);
  scheduler.scheduleAfter(20, () => undefined);
  host.throwOnClear = true;
  assertEquals(cancelled.cancel(), true);
  scheduler.dispose();
  assertEquals(errors.slice(1).map((entry) => entry[1]), ["cancel", "dispose"]);
  assertEquals(scheduler.inspect().pending, 0);

  while (host.pendingCount() > 0) host.fireNext();
  assertEquals(healthy, true);
});

class InjectedHostTimer {
  nowMs: number;
  throwOnSet = false;
  throwOnClear = false;
  readonly cleared: unknown[] = [];
  #nextId = 1;
  #pending = new Map<number, { callback: () => void; delayMs: number }>();

  constructor(nowMs = 0) {
    this.nowMs = nowMs;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    if (this.throwOnSet) throw new Error("host schedule rejected work");
    const id = this.#nextId++;
    this.#pending.set(id, { callback, delayMs });
    return id;
  }

  clearTimeout(handle: unknown): void {
    if (this.throwOnClear) throw new Error("host cancellation rejected work");
    this.cleared.push(handle);
    this.#pending.delete(handle as number);
  }

  fireNext(): void {
    const [id, pending] = this.#pending.entries().next().value ?? [];
    if (id === undefined || pending === undefined) return;
    this.#pending.delete(id);
    pending.callback();
  }

  delays(): number[] {
    return [...this.#pending.values()].map((pending) => pending.delayMs);
  }

  pendingCount(): number {
    return this.#pending.size;
  }
}
