import { assertEquals, assertInstanceOf, assertStrictEquals, assertThrows } from "./deps.ts";
import { DeadlineBudget, DeadlineBudgetCancellationError, DeadlineExceededError } from "../src/runtime/deadline.ts";
import { MAX_MONOTONIC_TIME, VirtualTimerScheduler } from "../src/runtime/clock.ts";

Deno.test("deadline budgets expire only through the injected virtual scheduler", () => {
  const scheduler = new VirtualTimerScheduler({ startTimeMs: 10 });
  const budget = new DeadlineBudget({ scheduler, timeoutMs: 5 });

  assertEquals(budget.deadlineMs, 15);
  assertEquals(budget.remainingMs(), 5);
  assertEquals(budget.status, "active");
  scheduler.advanceBy(4);
  assertEquals(budget.remainingMs(), 1);
  assertEquals(budget.signal.aborted, false);

  scheduler.advanceBy(1);
  assertEquals(budget.status, "expired");
  assertEquals(budget.remainingMs(), 0);
  assertInstanceOf(budget.signal.reason, DeadlineExceededError);
  assertEquals(budget.signal.reason.deadlineMs, 15);
  assertEquals(budget.signal.reason.observedMs, 15);
  assertThrows(() => budget.throwIfExpired(), DeadlineExceededError);
  assertEquals(scheduler.inspect().pending, 0);
});

Deno.test("already-expired budgets fail synchronously and prior external abort wins deterministically", () => {
  const scheduler = new VirtualTimerScheduler({ startTimeMs: 50 });
  const expired = new DeadlineBudget({ scheduler, deadlineMs: 50 });

  assertEquals(expired.status, "expired");
  assertEquals(expired.signal.aborted, true);
  assertInstanceOf(expired.signal.reason, DeadlineExceededError);
  assertEquals(scheduler.inspect().scheduled, 0);

  const external = new AbortController();
  const marker = new Error("caller stopped before construction");
  external.abort(marker);
  const cancelled = new DeadlineBudget({
    scheduler,
    timeoutMs: 0,
    signal: external.signal,
  });
  assertEquals(cancelled.status, "cancelled");
  assertInstanceOf(cancelled.signal.reason, DeadlineBudgetCancellationError);
  assertEquals(cancelled.signal.reason.source, "signal");
  assertStrictEquals(cancelled.signal.reason.causalError, marker);
});

Deno.test("time validation rejects ambiguous, invalid, and overflowing constraints", () => {
  const scheduler = new VirtualTimerScheduler({ startTimeMs: 1 });
  assertThrows(() => new DeadlineBudget({} as never), TypeError);
  assertThrows(() => new DeadlineBudget({ scheduler }), TypeError);
  assertThrows(
    () => new DeadlineBudget({ scheduler, timeoutMs: 1, deadlineMs: 2 }),
    TypeError,
  );
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, MAX_MONOTONIC_TIME + 1]) {
    assertThrows(() => new DeadlineBudget({ scheduler, timeoutMs: invalid }), RangeError);
    assertThrows(() => new DeadlineBudget({ scheduler, deadlineMs: invalid }), RangeError);
  }
  assertThrows(
    () => new DeadlineBudget({ scheduler, timeoutMs: MAX_MONOTONIC_TIME }),
    RangeError,
  );

  const parent = new DeadlineBudget({ scheduler, deadlineMs: MAX_MONOTONIC_TIME });
  assertThrows(() => parent.createChild({ timeoutMs: MAX_MONOTONIC_TIME }), RangeError);
  const otherScheduler = new VirtualTimerScheduler({ startTimeMs: 1 });
  assertThrows(
    () => new DeadlineBudget({ parent, scheduler: otherScheduler }),
    TypeError,
  );
  parent.dispose();
});

Deno.test("children inherit or tighten but never extend a parent deadline", () => {
  const scheduler = new VirtualTimerScheduler({ startTimeMs: 10 });
  const parent = new DeadlineBudget({ scheduler, timeoutMs: 90 });
  const tight = parent.createChild({ timeoutMs: 20 });
  const loose = parent.createChild({ deadlineMs: 200 });
  const equal = parent.createChild({ deadlineMs: 100 });
  const inherited = parent.createChild();

  assertEquals(tight.deadlineMs, 30);
  assertEquals(tight.limitedByParent, false);
  assertEquals(loose.deadlineMs, 100);
  assertEquals(loose.requestedDeadlineMs, 200);
  assertEquals(loose.limitedByParent, true);
  assertEquals(equal.deadlineMs, 100);
  assertEquals(equal.limitedByParent, false);
  assertEquals(inherited.deadlineMs, 100);
  assertEquals(inherited.inherited, true);
  assertEquals(inherited.limitedByParent, true);
  assertEquals(parent.inspect().childCount, 4);
  assertEquals(scheduler.inspect().pending, 2);

  scheduler.advanceTo(30);
  assertEquals(tight.status, "expired");
  assertEquals(parent.status, "active");
  assertEquals(parent.inspect().childCount, 3);
  assertEquals(loose.remainingMs(), 70);
  parent.dispose();
});

Deno.test("parent cancellation preserves a typed causal chain through nested budgets", () => {
  const scheduler = new VirtualTimerScheduler();
  const transitions: string[] = [];
  const parent = new DeadlineBudget({
    scheduler,
    timeoutMs: 100,
    onTransition: (inspection) => {
      transitions.push(inspection.status);
      throw new Error("transition observer rejected work");
    },
  });
  const child = parent.createChild();
  const grandchild = child.createChild({ timeoutMs: 20 });
  const marker = new Error("operator cancellation");

  assertEquals(parent.cancel(marker), true);
  assertEquals(parent.cancel(marker), false);
  assertEquals(transitions, ["cancelled"]);
  assertEquals(parent.inspect().childCount, 0);
  assertEquals(child.inspect().childCount, 0);

  const parentReason = parent.signal.reason;
  const childReason = child.signal.reason;
  const grandchildReason = grandchild.signal.reason;
  assertInstanceOf(parentReason, DeadlineBudgetCancellationError);
  assertEquals(parentReason.source, "cancel");
  assertStrictEquals(parentReason.reason, marker);
  assertInstanceOf(childReason, DeadlineBudgetCancellationError);
  assertEquals(childReason.source, "parent");
  assertStrictEquals(childReason.causalError, parentReason);
  assertInstanceOf(grandchildReason, DeadlineBudgetCancellationError);
  assertEquals(grandchildReason.source, "parent");
  assertStrictEquals(grandchildReason.causalError, childReason);
  assertEquals(scheduler.inspect().pending, 0);
});

Deno.test("equal nested deadlines use one parent timer and retain timeout causality", () => {
  const scheduler = new VirtualTimerScheduler();
  const parent = new DeadlineBudget({ scheduler, timeoutMs: 10 });
  const child = parent.createChild({ deadlineMs: 10 });
  const grandchild = child.createChild();

  assertEquals(scheduler.inspect().pending, 1);
  scheduler.advanceBy(10);

  assertEquals(parent.status, "expired");
  assertEquals(child.status, "cancelled");
  assertEquals(grandchild.status, "cancelled");
  assertInstanceOf(parent.signal.reason, DeadlineExceededError);
  assertEquals(child.signal.reason.source, "parent");
  assertStrictEquals(child.signal.reason.causalError, parent.signal.reason);
  assertEquals(grandchild.signal.reason.source, "parent");
  assertStrictEquals(grandchild.signal.reason.causalError, child.signal.reason);
});

Deno.test("external signal links are removed on every terminal path", () => {
  const scheduler = new VirtualTimerScheduler();
  const firstSignal = new CountingAbortSignal();
  const first = new DeadlineBudget({
    scheduler,
    timeoutMs: 20,
    signal: firstSignal as unknown as AbortSignal,
  });
  assertEquals(firstSignal.listenerCount, 1);
  assertEquals(first.inspect().externalSignalLinked, true);
  assertEquals(first.cancel("done"), true);
  assertEquals(firstSignal.listenerCount, 0);
  assertEquals(first.inspect().externalSignalLinked, false);
  firstSignal.abort(new Error("late abort"));
  assertEquals(first.signal.reason.source, "cancel");

  const secondSignal = new CountingAbortSignal();
  const second = new DeadlineBudget({
    scheduler,
    timeoutMs: 20,
    signal: secondSignal as unknown as AbortSignal,
  });
  const marker = new Error("external abort");
  secondSignal.abort(marker);
  assertEquals(secondSignal.listenerCount, 0);
  assertEquals(second.status, "cancelled");
  assertEquals(second.signal.reason.source, "signal");
  assertStrictEquals(second.signal.reason.reason, marker);
  assertStrictEquals(second.signal.reason.causalError, marker);
});

Deno.test("child disposal unlinks ownership and never disposes the caller scheduler", () => {
  const scheduler = new VirtualTimerScheduler();
  const parent = new DeadlineBudget({ scheduler, timeoutMs: 100 });
  const child = parent.createChild({ timeoutMs: 10 });
  assertEquals(parent.inspect().childCount, 1);
  assertEquals(scheduler.inspect().pending, 2);

  assertEquals(child.dispose("resource complete"), true);
  assertEquals(child.dispose(), false);
  assertEquals(child.status, "disposed");
  assertEquals(child.signal.reason.source, "dispose");
  assertEquals(parent.inspect().childCount, 0);
  assertEquals(scheduler.inspect().pending, 1);

  assertEquals(parent.dispose(), true);
  assertEquals(parent.dispose(), false);
  assertEquals(scheduler.disposed, false);
  let ran = false;
  scheduler.scheduleAfter(1, () => {
    ran = true;
  });
  scheduler.advanceBy(1);
  assertEquals(ran, true);
});

Deno.test("abort reentrancy cannot revive parents or strand newly-created children", () => {
  const scheduler = new VirtualTimerScheduler();
  const parent = new DeadlineBudget({ scheduler, timeoutMs: 5 });
  const existing = parent.createChild();
  let late: DeadlineBudget | undefined;
  parent.signal.addEventListener("abort", () => {
    assertEquals(parent.cancel("reentrant"), false);
    assertEquals(parent.dispose(), false);
    late = parent.createChild();
  });
  existing.signal.addEventListener("abort", () => {
    assertEquals(existing.cancel("reentrant"), false);
  });

  scheduler.advanceBy(5);

  assertEquals(parent.status, "expired");
  assertEquals(existing.status, "cancelled");
  assertEquals(late?.status, "cancelled");
  assertEquals(late?.signal.reason.source, "parent");
  assertStrictEquals(late?.signal.reason.causalError, parent.signal.reason);
  assertEquals(parent.inspect().childCount, 0);
});

Deno.test("inspection is bounded defensive clone-safe and excludes raw causes", () => {
  const scheduler = new VirtualTimerScheduler();
  const marker = { secret: "RAW_CAUSE_MUST_NOT_APPEAR" };
  const budget = new DeadlineBudget({ scheduler, timeoutMs: 10 });
  budget.createChild();
  budget.cancel(marker);

  const snapshot = budget.inspect();
  assertEquals(snapshot.childCount, 0);
  assertEquals(snapshot.reason?.source, "cancel");
  assertEquals(JSON.stringify(snapshot).includes(marker.secret), false);
  assertEquals(structuredClone(snapshot), snapshot);

  snapshot.status = "active";
  snapshot.reason!.message = "mutated";
  const fresh = budget.inspect();
  assertEquals(fresh.status, "cancelled");
  assertEquals(fresh.reason?.message, "Deadline budget was cancelled.");
});

Deno.test("public deadline values cannot be reassigned to extend a live budget", () => {
  const scheduler = new VirtualTimerScheduler();
  const parent = new DeadlineBudget({ scheduler, timeoutMs: 5 });
  const child = parent.createChild();

  assertEquals(Object.hasOwn(parent, "deadlineMs"), false);
  assertThrows(() => {
    (parent as unknown as { deadlineMs: number }).deadlineMs = 100;
  }, TypeError);
  assertThrows(() => {
    (parent as unknown as { signal: AbortSignal }).signal = new AbortController().signal;
  }, TypeError);

  scheduler.advanceTo(5);
  assertEquals(parent.status, "expired");
  assertEquals(child.status, "cancelled");
});

Deno.test("hostile signal accessors cannot strand a child during construction or abort", () => {
  const scheduler = new VirtualTimerScheduler();
  const parent = new DeadlineBudget({ scheduler, timeoutMs: 100 });
  const abortedRead = new Error("aborted getter failed");
  const reasonRead = new Error("reason getter failed");

  const hostileAborted = {
    get aborted(): boolean {
      throw abortedRead;
    },
  } as AbortSignal;
  assertThrows(() => parent.createChild({ signal: hostileAborted }), Error, abortedRead.message);
  assertEquals(parent.inspect().childCount, 0);

  const alreadyAborted = {
    aborted: true,
    get reason(): unknown {
      throw reasonRead;
    },
  } as AbortSignal;
  assertThrows(() => parent.createChild({ signal: alreadyAborted }), Error, reasonRead.message);
  assertEquals(parent.inspect().childCount, 0);

  const eventSignal = new ThrowingReasonAbortSignal(reasonRead);
  const child = parent.createChild({ signal: eventSignal as unknown as AbortSignal });
  eventSignal.abort();
  assertEquals(child.status, "cancelled");
  assertEquals(child.signal.reason.source, "signal");
  assertStrictEquals(child.signal.reason.causalError, reasonRead);
  assertEquals(parent.inspect().childCount, 0);
  parent.dispose();
});

Deno.test("public clock reads fail closed with typed cancellation and coherent inspection", () => {
  const firstScheduler = new VirtualTimerScheduler();
  const first = new DeadlineBudget({ scheduler: firstScheduler, timeoutMs: 10 });
  const clockFailure = new Error("clock read failed");
  Object.defineProperty(firstScheduler, "now", {
    value: () => {
      throw clockFailure;
    },
  });
  assertEquals(first.remainingMs(), 0);
  assertEquals(first.status, "cancelled");
  assertEquals(first.signal.reason.source, "clock");
  assertStrictEquals(first.signal.reason.causalError, clockFailure);

  const secondScheduler = new VirtualTimerScheduler();
  const second = new DeadlineBudget({ scheduler: secondScheduler, timeoutMs: 10 });
  Object.defineProperty(secondScheduler, "now", {
    value: () => {
      throw clockFailure;
    },
  });
  assertThrows(() => second.throwIfExpired(), DeadlineBudgetCancellationError);
  assertEquals(second.status, "cancelled");

  const thirdScheduler = new VirtualTimerScheduler();
  const third = new DeadlineBudget({ scheduler: thirdScheduler, timeoutMs: 10 });
  const originalNow = thirdScheduler.now.bind(thirdScheduler);
  let reentered = false;
  Object.defineProperty(thirdScheduler, "now", {
    value: () => {
      if (!reentered) {
        reentered = true;
        third.cancel("clock observer reentered");
      }
      return originalNow();
    },
  });
  const snapshot = third.inspect();
  assertEquals(snapshot.status, "cancelled");
  assertEquals(snapshot.remainingMs, 0);
  assertEquals(snapshot.signalAborted, true);
  assertEquals(snapshot.timerArmed, false);
  assertEquals(snapshot.reason?.source, "cancel");
});

Deno.test("deep cancellation uses bounded stack while preserving every descendant", () => {
  const scheduler = new VirtualTimerScheduler();
  const root = new DeadlineBudget({ scheduler, timeoutMs: 100 });
  let leaf = root;
  for (let depth = 0; depth < 10_000; depth += 1) leaf = leaf.createChild();

  assertEquals(root.cancel("deep shutdown"), true);
  assertEquals(root.status, "cancelled");
  assertEquals(leaf.status, "cancelled");
  assertEquals(root.inspect().childCount, 0);
  assertEquals(scheduler.inspect().pending, 0);
});

class CountingAbortSignal {
  aborted = false;
  reason: unknown;
  readonly #listeners = new Set<EventListenerOrEventListenerObject>();

  get listenerCount(): number {
    return this.#listeners.size;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    _options?: boolean | AddEventListenerOptions,
  ): void {
    if (type === "abort" && listener) this.#listeners.add(listener);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    _options?: boolean | EventListenerOptions,
  ): void {
    if (type === "abort" && listener) this.#listeners.delete(listener);
  }

  abort(reason: unknown): void {
    if (this.aborted) return;
    this.aborted = true;
    this.reason = reason;
    const event = new Event("abort");
    for (const listener of [...this.#listeners]) {
      if (typeof listener === "function") listener.call(this, event);
      else listener.handleEvent(event);
    }
  }
}

class ThrowingReasonAbortSignal {
  #aborted = false;
  readonly #listeners = new Set<EventListenerOrEventListenerObject>();

  constructor(readonly reasonError: Error) {}

  get aborted(): boolean {
    return this.#aborted;
  }

  get reason(): unknown {
    throw this.reasonError;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    _options?: boolean | AddEventListenerOptions,
  ): void {
    if (type === "abort" && listener) this.#listeners.add(listener);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    _options?: boolean | EventListenerOptions,
  ): void {
    if (type === "abort" && listener) this.#listeners.delete(listener);
  }

  abort(): void {
    if (this.#aborted) return;
    this.#aborted = true;
    const event = new Event("abort");
    for (const listener of [...this.#listeners]) {
      if (typeof listener === "function") listener.call(this, event);
      else listener.handleEvent(event);
    }
  }
}
