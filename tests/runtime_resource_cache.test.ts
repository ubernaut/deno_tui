import { assertEquals, assertInstanceOf, assertNotEquals, assertStrictEquals, assertThrows } from "./deps.ts";
import {
  canonicalResourceCacheKey,
  createResourceCacheCoordinator,
  ResourceCacheCapacityError,
  ResourceCacheCoordinator,
  ResourceCacheDiagnosticError,
  ResourceCacheDisposedError,
  ResourceCacheEventDrainLimitError,
  ResourceCacheHandle,
  ResourceCacheHandleReleasedError,
  ResourceCacheKeyError,
  ResourceCacheLimitError,
  ResourceCacheListenerLimitError,
  ResourceCacheRevisionExhaustedError,
} from "../src/runtime/resource_cache.ts";
import { type TimerScheduler, VirtualTimerScheduler } from "../src/runtime/clock.ts";

Deno.test("structurally equivalent requests share one ownership-counted entry", () => {
  const cache = createResourceCacheCoordinator<{ rows: number[] }>();
  const first = cache.acquire({
    page: 2,
    filters: { state: "up", tags: ["runtime", undefined] },
  });
  const filters = Object.create(null) as Record<string, unknown>;
  filters.tags = ["runtime", undefined];
  filters.state = "up";
  const second = cache.acquire({ filters, page: 2 });

  assertEquals(first.key, second.key);
  assertEquals(cache.size, 1);
  assertEquals(first.inspect().owners, 2);

  const published = { rows: [1, 2, 3] };
  first.set(published);
  assertStrictEquals(second.read(), published);
  assertEquals(first.release(), true);
  assertEquals(first.release(), false);
  assertEquals(second.inspect().owners, 1);
  assertStrictEquals(second.read(), published);
  assertEquals(cache.size, 1);

  const retainedReaderValue = second.read();
  assertEquals(second.release(), true);
  assertEquals(cache.size, 0);
  assertStrictEquals(retainedReaderValue, published);
  assertEquals(retainedReaderValue?.rows, [1, 2, 3]);
  assertThrows(() => first.read(), ResourceCacheHandleReleasedError);

  const replacement = cache.acquire({ filters: { tags: ["runtime", undefined], state: "up" }, page: 2 });
  assertEquals(replacement.read(), undefined);
  assertEquals(replacement.inspect().revision, 0);
  replacement.release();
});

Deno.test("canonical structural keys explicitly distinguish numeric edge cases", () => {
  assertEquals(canonicalResourceCacheKey({ value: Number.NaN }), canonicalResourceCacheKey({ value: Number.NaN }));
  assertNotEquals(canonicalResourceCacheKey({ value: 0 }), canonicalResourceCacheKey({ value: -0 }));
  assertNotEquals(
    canonicalResourceCacheKey({ value: Number.POSITIVE_INFINITY }),
    canonicalResourceCacheKey({ value: Number.NEGATIVE_INFINITY }),
  );
  assertNotEquals(canonicalResourceCacheKey({ value: 1 }), canonicalResourceCacheKey({ value: "1" }));
  assertEquals(canonicalResourceCacheKey(1), canonicalResourceCacheKey(1.0));
});

Deno.test("canonical structural keys preserve Unicode code units and enforce UTF-8 byte limits", () => {
  const distinct = ["é", "e\u0301", "😀", "\\ud83d\\ude00", "\u0000", "\\u0000", "\ud800", "\udc00"];
  assertEquals(new Set(distinct.map((value) => canonicalResourceCacheKey(value))).size, distinct.length);
  assertEquals(canonicalResourceCacheKey("😀"), canonicalResourceCacheKey("\ud83d\ude00"));
  assertEquals(
    canonicalResourceCacheKey({ "😀": "é", alpha: "β" }),
    canonicalResourceCacheKey({ alpha: "β", "😀": "é" }),
  );
  assertEquals(
    assertThrows(() => canonicalResourceCacheKey("😀", { maxKeyBytes: 6 }), ResourceCacheKeyError).code,
    "max-key-bytes",
  );
  assertEquals(canonicalResourceCacheKey("😀", { maxKeyBytes: 7 }), 's"😀"');
});

Deno.test("canonical structural framing prevents delimiter and container collisions", () => {
  const requests: unknown[] = [
    { a: "b:c,d" },
    { "a:b": "c,d" },
    { a: ["b", "c"] },
    ["a", { b: "c" }],
    { a: { b: "c" } },
    { a: undefined },
    {},
    [undefined],
    ["undefined"],
  ];
  const keys = requests.map((request) => canonicalResourceCacheKey(request));
  assertEquals(new Set(keys).size, requests.length);
});

Deno.test("keying rejects accessors without invoking getters or coercion hooks", () => {
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, "secret", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("must not run");
    },
  });
  const error = assertThrows(() => canonicalResourceCacheKey(accessor), ResourceCacheKeyError);
  assertEquals(error.code, "accessor");
  assertEquals(error.path, "$.secret");
  assertEquals(getterCalls, 0);

  let getCalls = 0;
  const proxy = new Proxy({ answer: 42 }, {
    get(target, property, receiver) {
      getCalls += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assertEquals(canonicalResourceCacheKey(proxy), canonicalResourceCacheKey({ answer: 42 }));
  assertEquals(getCalls, 0);

  let callbackCalls = 0;
  const callbackValue = {
    toJSON() {
      callbackCalls += 1;
      return "forged";
    },
  };
  assertThrows(() => canonicalResourceCacheKey(callbackValue), ResourceCacheKeyError);
  assertEquals(callbackCalls, 0);
});

Deno.test("hostile reflection failures become typed structural-key errors", () => {
  const proxy = new Proxy({}, {
    ownKeys() {
      throw new Error("opaque trap failure");
    },
  });
  const error = assertThrows(() => canonicalResourceCacheKey(proxy), ResourceCacheKeyError);
  assertEquals(error.code, "reflection");
  assertEquals(error.message, "Structural resource keys are not inspectable.");
  assertEquals(error.cause, undefined);

  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const revokedError = assertThrows(() => canonicalResourceCacheKey(revoked.proxy), ResourceCacheKeyError);
  assertEquals(revokedError.code, "reflection");
});

Deno.test("request reflection and acquired listeners cannot repopulate or return handles from disposal", () => {
  const reflected = new ResourceCacheCoordinator<number>();
  const request = new Proxy({}, {
    ownKeys() {
      reflected.dispose();
      return [];
    },
  });
  assertThrows(() => reflected.acquire(request), ResourceCacheDisposedError);
  assertEquals(reflected.disposed, true);
  assertEquals(reflected.size, 0);
  assertEquals(reflected.inspect().size, 0);

  const notified = new ResourceCacheCoordinator<number>();
  notified.subscribe((event) => {
    if (event.type === "acquired") notified.dispose();
  });
  assertThrows(() => notified.acquire("disposed-before-return"), ResourceCacheDisposedError);
  assertEquals(notified.disposed, true);
  assertEquals(notified.size, 0);
});

Deno.test("keying rejects cycles, unsupported leaves, exotics, sparse arrays, and extra properties", () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assertEquals(assertThrows(() => canonicalResourceCacheKey(cycle), ResourceCacheKeyError).code, "cycle");
  assertEquals(assertThrows(() => canonicalResourceCacheKey(1n), ResourceCacheKeyError).code, "unsupported");
  assertEquals(assertThrows(() => canonicalResourceCacheKey(Symbol("x")), ResourceCacheKeyError).code, "unsupported");
  assertEquals(assertThrows(() => canonicalResourceCacheKey(new Date(0)), ResourceCacheKeyError).code, "unsupported");

  const sparse = new Array(2);
  sparse[1] = "tail";
  assertEquals(assertThrows(() => canonicalResourceCacheKey(sparse), ResourceCacheKeyError).code, "invalid-shape");

  const augmented = ["value"] as string[] & { note?: string };
  augmented.note = "extra";
  assertEquals(assertThrows(() => canonicalResourceCacheKey(augmented), ResourceCacheKeyError).code, "invalid-shape");

  const hidden = Object.defineProperty({}, "hidden", { value: 1, enumerable: false });
  assertEquals(assertThrows(() => canonicalResourceCacheKey(hidden), ResourceCacheKeyError).code, "invalid-shape");
});

Deno.test("strict key and coordinator limits fail with typed bounded errors", () => {
  assertEquals(
    assertThrows(
      () => canonicalResourceCacheKey({ outer: { inner: 1 } }, { maxDepth: 1 }),
      ResourceCacheKeyError,
    ).code,
    "max-depth",
  );
  assertEquals(
    assertThrows(() => canonicalResourceCacheKey([1, 2], { maxNodes: 2 }), ResourceCacheKeyError).code,
    "max-nodes",
  );
  assertEquals(
    assertThrows(
      () => canonicalResourceCacheKey({ a: 1, b: 2 }, { maxContainerEntries: 1 }),
      ResourceCacheKeyError,
    ).code,
    "max-container-entries",
  );
  assertEquals(
    assertThrows(() => canonicalResourceCacheKey("long", { maxKeyBytes: 4 }), ResourceCacheKeyError).code,
    "max-key-bytes",
  );
  assertThrows(() => canonicalResourceCacheKey({}, { maxDepth: -1 }), ResourceCacheLimitError);
  assertThrows(() => new ResourceCacheCoordinator({ maxEntries: Number.POSITIVE_INFINITY }), ResourceCacheLimitError);
  assertThrows(() => new ResourceCacheCoordinator({ maxEventsPerDrain: 0 }), ResourceCacheLimitError);

  const zero = new ResourceCacheCoordinator({ maxEntries: 0 });
  assertThrows(() => zero.acquire("never"), ResourceCacheCapacityError);
});

Deno.test("entry capacity rejects only new keys and preserves equivalent owners", () => {
  const cache = new ResourceCacheCoordinator<string>({ maxEntries: 1 });
  const first = cache.acquire({ id: 1 });
  const equivalent = cache.acquire({ id: 1 });
  const error = assertThrows(() => cache.acquire({ id: 2 }), ResourceCacheCapacityError);
  assertEquals(error.capacity, 1);
  assertEquals(error.size, 1);
  first.set("still-live");
  assertEquals(equivalent.read(), "still-live");
  first.release();
  equivalent.release();
});

Deno.test("entry value, status, diagnostics, and revisions update atomically", () => {
  const cache = new ResourceCacheCoordinator<unknown>();
  const handle = cache.acquire("query");
  assertEquals(handle.inspect(), {
    key: handle.key,
    status: "idle",
    revision: 0,
    owners: 1,
    listeners: 0,
    hasValue: false,
    valueKind: "undefined",
  });

  const value = { payload: true };
  assertEquals(handle.set(value).revision, 1);
  assertEquals(handle.transition("loading"), {
    key: handle.key,
    status: "loading",
    revision: 2,
    owners: 1,
    listeners: 0,
    hasValue: true,
    valueKind: "object",
  });
  assertStrictEquals(handle.read(), value);

  const diagnostic = { code: "load-failed", message: "Retry is available." };
  const failed = handle.transition("error", diagnostic);
  diagnostic.message = "mutated later";
  assertEquals(failed.diagnostic, { code: "load-failed", message: "Retry is available." });
  assertEquals(handle.inspect().diagnostic, { code: "load-failed", message: "Retry is available." });
  assertEquals(handle.clear("idle").revision, 4);
  assertEquals(handle.inspect().hasValue, false);
  assertEquals(cache.inspect().updates, 4);

  handle.set(undefined);
  assertEquals(handle.inspect().hasValue, true);
  assertEquals(handle.inspect().valueKind, "undefined");

  const beforeInvalidStatus = handle.inspect();
  assertThrows(() => handle.set("not-published", "invalid" as "ready"), TypeError);
  assertEquals(handle.inspect(), beforeInvalidStatus);
  assertEquals(handle.read(), undefined);
  handle.release();
});

Deno.test("entry and coordinator subscriptions are ordered and reentrant updates drain FIFO", () => {
  const cache = new ResourceCacheCoordinator<string>();
  const handle = cache.acquire({ id: "ordered" });
  const observed: string[] = [];

  cache.subscribe((event) => {
    if (event.type === "updated") observed.push(`coordinator:${event.revision}:${event.value}`);
  });
  handle.subscribe((event) => {
    if (event.type !== "updated") return;
    observed.push(`first:${event.revision}:${event.value}`);
    if (event.revision === 1) handle.set("second");
  });
  handle.subscribe((event) => {
    if (event.type === "updated") observed.push(`second:${event.revision}:${event.value}`);
  });

  const firstMutation = handle.set("first");
  assertEquals(firstMutation.revision, 1);
  assertEquals(firstMutation.status, "ready");
  assertEquals(firstMutation.hasValue, true);
  assertEquals(observed, [
    "first:1:first",
    "second:1:first",
    "coordinator:1:first",
    "first:2:second",
    "second:2:second",
    "coordinator:2:second",
  ]);
  assertEquals(handle.inspect().revision, 2);
  handle.release();
});

Deno.test("transition and clear return their own immutable snapshot across reentrant updates", () => {
  const transitioning = new ResourceCacheCoordinator<string>();
  const transitionHandle = transitioning.acquire("transition-snapshot");
  transitionHandle.set("retained");
  transitionHandle.subscribe((event) => {
    if (event.type === "updated" && event.revision === 2) transitionHandle.clear("idle");
  });
  const transitionResult = transitionHandle.transition("loading");
  assertEquals(transitionResult.revision, 2);
  assertEquals(transitionResult.status, "loading");
  assertEquals(transitionResult.hasValue, true);
  assertEquals(transitionHandle.inspect().revision, 3);
  assertEquals(transitionHandle.inspect().hasValue, false);
  transitionHandle.release();

  const clearing = new ResourceCacheCoordinator<string>();
  const clearHandle = clearing.acquire("clear-snapshot");
  clearHandle.subscribe((event) => {
    if (event.type === "updated" && event.revision === 1) {
      clearHandle.transition("error", {
        code: "later",
        message: "later transition",
      });
    }
  });
  const clearResult = clearHandle.clear("loading");
  assertEquals(clearResult.revision, 1);
  assertEquals(clearResult.status, "loading");
  assertEquals(clearResult.diagnostic, undefined);
  assertEquals(clearHandle.inspect().revision, 2);
  assertEquals(clearHandle.inspect().status, "error");
  clearHandle.release();
});

Deno.test("listener failures are isolated, bounded, and never inspect opaque thrown values", () => {
  const cache = new ResourceCacheCoordinator<number>({ maxDiagnostics: 2 });
  const handle = cache.acquire("listener-errors");
  const survivor: number[] = [];
  let hostileReads = 0;
  const hostileReason = new Proxy({}, {
    get() {
      hostileReads += 1;
      throw new Error("do not inspect");
    },
  });
  handle.subscribe(() => {
    throw hostileReason;
  });
  handle.subscribe((event) => {
    if (event.type === "updated") survivor.push(event.revision);
  });

  handle.set(1);
  handle.set(2);
  handle.set(3);
  assertEquals(survivor, [1, 2, 3]);
  assertEquals(hostileReads, 0);
  const inspection = cache.inspect();
  assertEquals(inspection.listenerFailures, 3);
  assertEquals(inspection.diagnostics.length, 2);
  assertEquals(inspection.diagnosticsDropped, 1);
  assertEquals(inspection.diagnostics.map((entry) => entry.sequence), [2, 3]);
  assertEquals(inspection.diagnostics[0]?.message, "A resource cache listener threw; the opaque failure was isolated.");
  handle.release();
});

Deno.test("async and hostile-thenable listener failures are isolated without unhandled rejection", async () => {
  const cache = new ResourceCacheCoordinator<number>({ maxDiagnostics: 4 });
  const handle = cache.acquire("async-listener-errors");
  let survivor = 0;
  handle.subscribe(async () => {
    await Promise.resolve();
    throw new Error("asynchronous failure");
  });
  handle.subscribe(() =>
    Object.defineProperty({}, "then", {
      get() {
        throw new Error("hostile then getter");
      },
    })
  );
  handle.subscribe(() => survivor += 1);

  handle.set(1);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assertEquals(survivor, 1);
  assertEquals(cache.inspect().listenerFailures, 2);
  assertEquals(
    cache.inspect().diagnostics.map((entry) => entry.code),
    ["listener-threw", "listener-threw"],
  );
  handle.release();
});

Deno.test("subscription snapshots, explicit unsubscribe, and handle release are idempotent", () => {
  const cache = new ResourceCacheCoordinator<number>();
  const first = cache.acquire("shared");
  const second = cache.acquire("shared");
  const events: string[] = [];
  const unsubscribe = first.subscribe((event) => events.push(event.type), { emitCurrent: true });
  assertEquals(events, ["snapshot"]);
  unsubscribe();
  unsubscribe();
  second.set(1);
  assertEquals(events, ["snapshot"]);

  first.subscribe((event) => events.push(event.type));
  assertEquals(first.release(), true);
  second.set(2);
  assertEquals(events, ["snapshot"]);
  assertEquals(first.dispose(), false);
  second.release();
});

Deno.test("invalid subscription options fail atomically without invoking accessors or leaking listeners", () => {
  const cache = new ResourceCacheCoordinator<number>();
  const handle = cache.acquire("atomic-subscribe");
  let getterCalls = 0;
  let listenerCalls = 0;
  const options = Object.defineProperty({}, "emitCurrent", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("must not execute");
    },
  });

  assertThrows(
    () => handle.subscribe(() => listenerCalls += 1, options),
    TypeError,
  );
  assertEquals(getterCalls, 0);
  assertEquals(handle.inspect().listeners, 0);
  handle.set(1);
  assertEquals(listenerCalls, 0);

  assertThrows(
    () => handle.subscribe(() => {}, { emitCurrent: "yes" } as unknown as { emitCurrent: boolean }),
    TypeError,
  );
  assertEquals(handle.inspect().listeners, 0);
  handle.release();
});

Deno.test("bounded listener collections reject excess registrations without replacing listeners", () => {
  const cache = new ResourceCacheCoordinator({
    maxListenersPerEntry: 1,
    maxCoordinatorListeners: 1,
  });
  const handle = cache.acquire("limits");
  const removeEntry = handle.subscribe(() => {});
  assertThrows(() => handle.subscribe(() => {}), ResourceCacheListenerLimitError);
  const removeCoordinator = cache.subscribe(() => {});
  assertThrows(() => cache.subscribe(() => {}), ResourceCacheListenerLimitError);
  removeEntry();
  removeCoordinator();
  handle.release();
});

Deno.test("hostile or oversized diagnostics cannot execute getters or advance revision", () => {
  const cache = new ResourceCacheCoordinator({ maxDiagnosticText: 8 });
  const handle = cache.acquire("diagnostics");
  let calls = 0;
  const hostile = Object.defineProperties({}, {
    code: {
      enumerable: true,
      get() {
        calls += 1;
        return "bad";
      },
    },
    message: { enumerable: true, value: "bad" },
  }) as { code: string; message: string };
  assertThrows(() => handle.transition("error", hostile), ResourceCacheDiagnosticError);
  assertEquals(calls, 0);
  assertEquals(handle.inspect().revision, 0);
  assertThrows(
    () => handle.transition("error", { code: "too-long-code", message: "failure" }),
    ResourceCacheDiagnosticError,
  );
  assertEquals(handle.inspect().revision, 0);
  handle.release();
});

Deno.test("diagnostic reflection cannot mutate an entry after reentrant owner release", () => {
  for (const operation of ["transition", "clear"] as const) {
    const cache = new ResourceCacheCoordinator<number>();
    const handle = cache.acquire(operation);
    const events: string[] = [];
    cache.subscribe((event) => events.push(`${event.type}:${event.revision}:${event.status}`));
    const diagnostic = new Proxy({ code: "released", message: "released during reflection" }, {
      getOwnPropertyDescriptor(target, property) {
        if (property === "code") handle.release();
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });

    assertThrows(
      () => operation === "transition" ? handle.transition("error", diagnostic) : handle.clear("error", diagnostic),
      ResourceCacheHandleReleasedError,
    );
    assertEquals(handle.released, true);
    assertEquals(cache.size, 0);
    assertEquals(cache.inspect().updates, 0);
    assertEquals(events, ["evicted:0:idle"]);
  }
});

Deno.test("reentrant notification loops stop at the configured drain bound without mutating silently", () => {
  const cache = new ResourceCacheCoordinator<number>({ maxEventsPerDrain: 3, maxDiagnostics: 8 });
  const handle = cache.acquire("bounded-reentrancy");
  const revisions: number[] = [];
  handle.subscribe((event) => {
    if (event.type !== "updated") return;
    revisions.push(event.revision);
    if (event.revision < 10) handle.set(event.revision);
  });

  handle.set(0);
  assertEquals(revisions, [1, 2, 3]);
  assertEquals(handle.inspect().revision, 3);
  assertEquals(cache.inspect().droppedEvents, 1);
  assertEquals(cache.inspect().diagnostics.map((entry) => entry.code), ["event-drain-limit", "listener-threw"]);
  handle.release();
});

Deno.test("drain exhaustion rejects reentrant ownership changes before they mutate", () => {
  const acquiring = new ResourceCacheCoordinator<number>({ maxEventsPerDrain: 1, maxDiagnostics: 4 });
  const root = acquiring.acquire("root");
  let nestedHandle: ReturnType<typeof acquiring.acquire> | undefined;
  root.subscribe((event) => {
    if (event.type === "updated") nestedHandle = acquiring.acquire("nested");
  });
  root.set(1);
  assertEquals(nestedHandle, undefined);
  assertEquals(acquiring.size, 1);
  assertEquals(acquiring.inspect().acquires, 1);
  assertEquals(acquiring.inspect().droppedEvents, 1);
  assertEquals(acquiring.inspect().listenerFailures, 1);
  assertEquals(
    acquiring.inspect().diagnostics.map((entry) => entry.code),
    ["event-drain-limit", "listener-threw"],
  );
  root.release();

  const releasing = new ResourceCacheCoordinator<number>({ maxEventsPerDrain: 1, maxDiagnostics: 4 });
  const trigger = releasing.acquire("trigger");
  const retained = releasing.acquire("retained");
  trigger.subscribe((event) => {
    if (event.type === "updated") retained.release();
  });
  trigger.set(1);
  assertEquals(retained.released, false);
  assertEquals(releasing.size, 2);
  assertEquals(releasing.inspect().releases, 0);
  trigger.release();
  retained.release();

  const snapshots = new ResourceCacheCoordinator<number>({ maxEventsPerDrain: 1, maxDiagnostics: 4 });
  const snapshotHandle = snapshots.acquire("snapshot");
  let leakedUnsubscribe: (() => void) | undefined;
  snapshotHandle.subscribe((event) => {
    if (event.type === "updated") {
      leakedUnsubscribe = snapshotHandle.subscribe(() => {}, { emitCurrent: true });
    }
  });
  snapshotHandle.set(1);
  assertEquals(leakedUnsubscribe, undefined);
  assertEquals(snapshotHandle.inspect().listeners, 1);
  assertEquals(snapshots.inspect().listenerFailures, 1);
  snapshotHandle.release();
});

Deno.test("drain exhaustion rejects reentrant disposal atomically and preserves later lossless disposal", () => {
  const cache = new ResourceCacheCoordinator<number>({ maxEventsPerDrain: 1, maxDiagnostics: 4 });
  const handle = cache.acquire("reentrant-disposal");
  const events: string[] = [];
  handle.subscribe((event) => {
    if (event.type === "updated") cache.dispose();
  });
  cache.subscribe((event) => events.push(event.type));

  handle.set(1);

  assertEquals(cache.disposed, false);
  assertEquals(cache.size, 1);
  assertEquals(handle.released, false);
  assertEquals(handle.read(), 1);
  assertEquals(handle.inspect().owners, 1);
  assertEquals(events, ["updated"]);
  const rejected = cache.inspect();
  assertEquals(rejected.evictions, 0);
  assertEquals(rejected.droppedEvents, 1);
  assertEquals(rejected.listenerFailures, 1);
  assertEquals(
    rejected.diagnostics.map(({ code, phase, key }) => ({ code, phase, key })),
    [
      { code: "event-drain-limit", phase: "event-dispatch", key: handle.key },
      { code: "listener-threw", phase: "entry-listener", key: handle.key },
    ],
  );

  assertEquals(cache.dispose(), true);
  assertEquals(cache.dispose(), false);
  assertEquals(cache.disposed, true);
  assertEquals(cache.size, 0);
  assertEquals(handle.released, true);
  assertEquals(events, ["updated", "disposed"]);
  assertEquals(cache.inspect().droppedEvents, 1);
  assertEquals(cache.inspect().listenerFailures, 1);

  const ordinary = new ResourceCacheCoordinator<number>({ maxEventsPerDrain: 1 });
  const ordinaryFirst = ordinary.acquire("ordinary-first");
  const ordinarySecond = ordinary.acquire("ordinary-second");
  const disposedKeys: string[] = [];
  ordinary.subscribe((event) => {
    if (event.type === "disposed") disposedKeys.push(event.key);
  });
  assertEquals(ordinary.dispose(), true);
  assertEquals(ordinary.dispose(), false);
  assertEquals(disposedKeys, [ordinaryFirst.key, ordinarySecond.key]);
  assertEquals(ordinary.disposed, true);
  assertEquals(ordinary.size, 0);
});

Deno.test("revision exhaustion leaves entry state unchanged and emits no update", () => {
  const cache = new ResourceCacheCoordinator<string>({ initialRevision: Number.MAX_SAFE_INTEGER });
  const handle = cache.acquire("exhausted");
  let events = 0;
  handle.subscribe(() => events += 1);
  const error = assertThrows(() => handle.set("never"), ResourceCacheRevisionExhaustedError);
  assertEquals(error.revision, Number.MAX_SAFE_INTEGER);
  assertEquals(handle.inspect().status, "idle");
  assertEquals(handle.inspect().hasValue, false);
  assertEquals(events, 0);
  assertEquals(cache.inspect().updates, 0);
  handle.release();
});

Deno.test("inspection is sorted, bounded, immutable, value-free, and structured-clone-safe", () => {
  const cache = new ResourceCacheCoordinator<unknown>({
    maxEntries: 4,
    maxInspectionEntries: 2,
    maxDiagnostics: 2,
  });
  const third = cache.acquire({ id: "c" });
  const first = cache.acquire({ id: "a" });
  const second = cache.acquire({ id: "b" });
  first.set(() => "not clone safe");

  const inspection = cache.inspect({ maxEntries: 100, maxDiagnostics: 100 });
  assertEquals(inspection.size, 3);
  assertEquals(inspection.entries.length, 2);
  assertEquals(inspection.omittedEntries, 1);
  assertEquals(inspection.entries.map((entry) => entry.key), [...inspection.entries.map((entry) => entry.key)].sort());
  assertEquals(inspection.entries.some((entry) => Object.hasOwn(entry, "value")), false);
  assertEquals(Object.isFrozen(inspection), true);
  assertEquals(Object.isFrozen(inspection.entries), true);
  assertEquals(Object.isFrozen(inspection.entries[0]!), true);
  assertEquals(Object.isFrozen(inspection.keyLimits), true);
  assertEquals(structuredClone(inspection), inspection);
  assertThrows(() => (inspection.entries as unknown as ResourceCacheEntryInspectionForMutation[]).push({}));
  assertThrows(() => Object.assign(inspection, { size: 100 }));

  const target = {};
  const revoked = Proxy.revocable(target, {});
  const revokedHandle = cache.acquire({ id: "revoked" });
  revokedHandle.set(revoked.proxy);
  revoked.revoke();
  assertEquals(revokedHandle.inspect().valueKind, "object");

  third.release();
  first.release();
  second.release();
  revokedHandle.release();
});

Deno.test("handles, events, inspections, diagnostics, and lifecycle errors redact structural request content", () => {
  const cache = new ResourceCacheCoordinator<number>({ maxEventsPerDrain: 1, maxDiagnostics: 4 });
  const request = {
    authorization: "Bearer island-secret",
    nested: { token: "abc123" },
  };
  const canonicalKey = cache.keyOf(request);
  assertEquals(canonicalKey.includes("island-secret"), true);

  let acquiredKey = "";
  cache.subscribe((event) => {
    if (event.type === "acquired") acquiredKey = event.key;
  });
  const handle = cache.acquire(request);
  assertEquals(handle.key, acquiredKey);
  assertEquals(/^resource:[0-9]{16}$/.test(handle.key), true);
  assertEquals(handle.key.includes("island-secret"), false);
  assertEquals(handle.key.includes("abc123"), false);
  assertEquals(cache.inspect().entries[0]?.key, handle.key);
  assertEquals(JSON.stringify(cache.inspect()).includes("island-secret"), false);

  handle.subscribe((event) => {
    if (event.type === "updated") cache.acquire({ secret: "nested-secret" });
  });
  handle.set(1);
  assertEquals(JSON.stringify(cache.inspect().diagnostics).includes("secret"), false);
  handle.release();
  const released = assertThrows(() => handle.read(), ResourceCacheHandleReleasedError);
  assertEquals(released.key, acquiredKey);
  assertEquals(released.key.includes("island-secret"), false);
});

type ResourceCacheEntryInspectionForMutation = {
  key?: string;
};

Deno.test("coordinator disposal invalidates handles, emits deterministic events, and preserves prior reads", () => {
  const cache = new ResourceCacheCoordinator<{ id: string }>();
  const first = cache.acquire("first");
  const second = cache.acquire("second");
  const firstValue = { id: "first" };
  const secondValue = { id: "second" };
  const firstKey = first.key;
  const secondKey = second.key;
  first.set(firstValue);
  second.set(secondValue);
  const retained = [first.read(), second.read()];
  const events: string[] = [];
  first.subscribe((event) => events.push(`entry:${event.type}:${event.owners}`));
  cache.subscribe((event) => {
    if (event.type === "disposed") events.push(`coordinator:${event.key}:${event.owners}`);
  });

  assertEquals(cache.dispose(), true);
  assertEquals(cache.dispose(), false);
  assertEquals(first.released, true);
  assertEquals(second.released, true);
  assertEquals(first.release(), false);
  assertThrows(() => first.read(), ResourceCacheHandleReleasedError);
  assertThrows(() => cache.acquire("late"), ResourceCacheDisposedError);
  assertEquals(retained, [firstValue, secondValue]);
  assertEquals(events, [
    "entry:disposed:0",
    `coordinator:${firstKey}:0`,
    `coordinator:${secondKey}:0`,
  ]);
  const inspection = cache.inspect();
  assertEquals(inspection.disposed, true);
  assertEquals(inspection.size, 0);
  assertEquals(inspection.evictions, 2);
});

Deno.test("virtual stale time drives deterministic stale-while-revalidate focus and reconnect transitions", () => {
  const scheduler = new VirtualTimerScheduler({ startTimeMs: 100 });
  const cache = new ResourceCacheCoordinator<{ version: number }>({
    scheduler,
    staleTimeMs: 10,
    retentionTimeMs: 20,
    refreshOnFocus: true,
    refreshOnReconnect: true,
  });
  const handle = cache.acquire("temporal-query");
  const events: string[] = [];
  handle.subscribe((event) => {
    if (event.type === "updated" || event.type === "stale" || event.type === "refresh-requested") {
      events.push(`${event.type}:${event.revision}:${event.status}:${event.policy?.stale}:${event.policy?.refreshing}`);
    }
  });

  const firstValue = { version: 1 };
  handle.set(firstValue);
  assertEquals(handle.inspect().policy, {
    stale: false,
    refreshing: false,
    retained: false,
    updatedAtMs: 100,
    staleAtMs: 110,
  });
  scheduler.advanceBy(9);
  assertEquals(handle.inspect().policy?.stale, false);
  scheduler.advanceBy(1);
  assertEquals(handle.inspect().policy?.stale, true);
  assertStrictEquals(handle.read(), firstValue);

  assertEquals(cache.notifyFocus(), 1);
  assertEquals(cache.notifyFocus(), 0);
  assertStrictEquals(handle.read(), firstValue);
  assertEquals(handle.inspect().status, "loading");
  assertEquals(handle.inspect().hasValue, true);
  assertEquals(handle.inspect().policy?.refreshing, true);
  assertEquals(handle.inspect().policy?.refreshTrigger, "focus");

  handle.transition("error", { code: "offline", message: "Refresh failed." });
  assertStrictEquals(handle.read(), firstValue);
  assertEquals(handle.inspect().status, "error");
  assertEquals(handle.inspect().policy?.stale, true);
  assertEquals(handle.inspect().policy?.refreshing, false);
  assertEquals(cache.notifyReconnect(), 1);
  assertStrictEquals(handle.read(), firstValue);
  assertEquals(handle.inspect().policy?.refreshTrigger, "reconnect");

  const replacement = { version: 2 };
  handle.set(replacement);
  assertStrictEquals(handle.read(), replacement);
  assertEquals(handle.inspect().policy, {
    stale: false,
    refreshing: false,
    retained: false,
    updatedAtMs: 110,
    staleAtMs: 120,
  });
  assertEquals(events, [
    "updated:1:ready:false:false",
    "stale:1:ready:true:false",
    "refresh-requested:2:loading:true:true",
    "updated:3:error:true:false",
    "refresh-requested:4:loading:true:true",
    "updated:5:ready:false:false",
  ]);
  assertEquals(cache.inspect().policy, {
    staleTimeMs: 10,
    retentionTimeMs: 20,
    refreshOnFocus: true,
    refreshOnReconnect: true,
    staleEntries: 0,
    refreshingEntries: 0,
    retainedEntries: 0,
    staleTransitions: 1,
    refreshRequests: 2,
    clockRegressions: 0,
  });
  assertEquals(Object.isFrozen(handle.inspect().policy), true);
  assertEquals(structuredClone(cache.inspect()), cache.inspect());
  handle.release();
  cache.dispose();
});

Deno.test("republishing resets stale deadlines and cancelled generations cannot stale new data", () => {
  const scheduler = new VirtualTimerScheduler();
  const cache = new ResourceCacheCoordinator<string>({ scheduler, staleTimeMs: 5 });
  const handle = cache.acquire("reset-stale-deadline");
  const staleRevisions: number[] = [];
  handle.subscribe((event) => {
    if (event.type === "stale") staleRevisions.push(event.revision);
  });

  handle.set("first");
  scheduler.advanceBy(3);
  handle.set("second");
  assertEquals(handle.inspect().policy?.staleAtMs, 8);
  scheduler.advanceBy(2);
  assertEquals(handle.inspect().policy?.stale, false);
  assertEquals(staleRevisions, []);
  scheduler.advanceBy(3);
  assertEquals(handle.inspect().policy?.stale, true);
  assertEquals(staleRevisions, [2]);
  assertEquals(scheduler.inspect().pending, 0);
  handle.release();
});

Deno.test("retention resurrects exact data before expiry and evicts at the rescheduled boundary", () => {
  const scheduler = new VirtualTimerScheduler();
  const cache = new ResourceCacheCoordinator<{ id: number }>({
    scheduler,
    staleTimeMs: Number.POSITIVE_INFINITY,
    retentionTimeMs: 10,
  });
  const first = cache.acquire({ id: "retained" });
  const firstKey = first.key;
  const value = { id: 7 };
  first.set(value);
  assertEquals(first.release(), true);
  assertEquals(cache.size, 1);
  assertEquals(cache.inspectEntry({ id: "retained" })?.policy, {
    stale: false,
    refreshing: false,
    retained: true,
    updatedAtMs: 0,
    retainedAtMs: 0,
    retainedUntilMs: 10,
  });

  scheduler.advanceBy(5);
  const resurrected = cache.acquire({ id: "retained" });
  assertEquals(resurrected.key, firstKey);
  assertStrictEquals(resurrected.read(), value);
  assertEquals(resurrected.inspect().policy?.retained, false);
  scheduler.advanceBy(5);
  assertEquals(cache.size, 1);

  resurrected.release();
  assertEquals(cache.inspectEntry({ id: "retained" })?.policy?.retainedUntilMs, 20);
  scheduler.advanceBy(9);
  assertEquals(cache.size, 1);
  scheduler.advanceBy(1);
  assertEquals(cache.size, 0);
  assertEquals(cache.inspectEntry({ id: "retained" }), undefined);
  assertEquals(cache.inspect().evictions, 1);
});

Deno.test("infinite retention needs no scheduler and remains inspectable until idempotent disposal", () => {
  const cache = new ResourceCacheCoordinator<number>({
    staleTimeMs: Number.POSITIVE_INFINITY,
    retentionTimeMs: Number.POSITIVE_INFINITY,
  });
  const handle = cache.acquire("forever");
  handle.set(42);
  handle.release();
  assertEquals(cache.inspectEntry("forever")?.policy, {
    stale: false,
    refreshing: false,
    retained: true,
  });
  assertEquals(cache.inspect().policy?.retainedEntries, 1);
  assertEquals(cache.dispose(), true);
  assertEquals(cache.dispose(), false);
  assertEquals(cache.size, 0);
});

Deno.test("focus and reconnect policies are independent and manual refresh validates usable data", () => {
  const scheduler = new VirtualTimerScheduler();
  const cache = new ResourceCacheCoordinator<string>({
    scheduler,
    staleTimeMs: 0,
    refreshOnFocus: false,
    refreshOnReconnect: true,
  });
  const empty = cache.acquire("empty");
  assertEquals(empty.requestRefresh(), false);
  const handle = cache.acquire("policy-signals");
  handle.set("usable");
  assertEquals(handle.inspect().policy?.stale, true);
  assertEquals(cache.notifyFocus(), 0);
  assertEquals(cache.notifyReconnect(), 1);
  assertStrictEquals(handle.read(), "usable");
  assertEquals(handle.requestRefresh(), false);
  handle.transition("ready");
  assertEquals(handle.requestRefresh(), true);
  assertEquals(handle.inspect().policy?.refreshTrigger, "manual");
  assertThrows(() => handle.requestRefresh("invalid" as "manual"), TypeError);
  empty.release();
  handle.release();
});

Deno.test("temporal options snapshot data properties and reject invalid durations or accessors", () => {
  const scheduler = new VirtualTimerScheduler();
  const mutableOptions = {
    scheduler,
    staleTimeMs: 5,
    retentionTimeMs: 10,
    refreshOnFocus: true,
  };
  const cache = new ResourceCacheCoordinator<string>(mutableOptions);
  mutableOptions.staleTimeMs = 100;
  mutableOptions.retentionTimeMs = 100;
  mutableOptions.refreshOnFocus = false;
  const handle = cache.acquire("snapshotted-options");
  handle.set("value");
  assertEquals(handle.inspect().policy?.staleAtMs, 5);
  assertEquals(cache.staleTimeMs, 5);
  assertEquals(cache.retentionTimeMs, 10);
  assertEquals(cache.refreshOnFocus, true);
  handle.release();

  for (const duration of [Number.NaN, -1, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assertThrows(() => new ResourceCacheCoordinator({ scheduler, staleTimeMs: duration }), RangeError);
    assertThrows(() => new ResourceCacheCoordinator({ scheduler, retentionTimeMs: duration }), RangeError);
  }
  assertThrows(() => new ResourceCacheCoordinator({ staleTimeMs: 1 }), TypeError, "requires a scheduler");
  assertThrows(() => new ResourceCacheCoordinator({ retentionTimeMs: 1 }), TypeError, "requires a scheduler");
  assertInstanceOf(
    new ResourceCacheCoordinator({ staleTimeMs: Infinity, retentionTimeMs: Infinity }),
    ResourceCacheCoordinator,
  );

  let getterCalls = 0;
  const accessorOptions = Object.defineProperty({}, "staleTimeMs", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 1;
    },
  });
  assertThrows(
    () => new ResourceCacheCoordinator(accessorOptions),
    TypeError,
    "must be a data property",
  );
  assertEquals(getterCalls, 0);
});

Deno.test("clock regressions clamp timestamps and invalid clock reads fail atomically", () => {
  const backing = new VirtualTimerScheduler({ startTimeMs: 10 });
  let observedNow = 10;
  const scheduler: TimerScheduler = {
    get disposed() {
      return backing.disposed;
    },
    now: () => observedNow,
    scheduleAt: (deadlineMs, callback) => backing.scheduleAt(deadlineMs, callback),
    scheduleAfter: (delayMs, callback) => backing.scheduleAfter(delayMs, callback),
    inspect: () => backing.inspect(),
    dispose: () => backing.dispose(),
  };
  const cache = new ResourceCacheCoordinator<string>({ scheduler, staleTimeMs: 5 });
  const handle = cache.acquire("regressing-clock");
  handle.set("first");
  observedNow = 5;
  handle.set("second");
  assertEquals(handle.inspect().policy?.updatedAtMs, 10);
  assertEquals(handle.inspect().policy?.staleAtMs, 15);
  assertEquals(cache.inspect().policy?.clockRegressions, 1);
  assertEquals(cache.inspect().diagnostics.map((entry) => entry.code), ["clock-regression"]);

  observedNow = Number.NaN;
  const before = handle.inspect();
  assertThrows(() => handle.set("never"), RangeError, "scheduler.now()");
  assertEquals(handle.inspect(), before);
  assertStrictEquals(handle.read(), "second");
  handle.release();
});

Deno.test("reentrant stale timer exhaustion retries without a silent temporal mutation", () => {
  const scheduler = new VirtualTimerScheduler();
  const cache = new ResourceCacheCoordinator<string>({
    scheduler,
    staleTimeMs: 1,
    maxEventsPerDrain: 1,
  });
  const handle = cache.acquire("bounded-stale-timer");
  const events: string[] = [];
  handle.subscribe((event) => {
    events.push(event.type);
    if (event.type === "updated") scheduler.advanceTo(1);
  });

  handle.set("usable");
  assertEquals(handle.inspect().policy?.stale, false);
  assertEquals(cache.inspect().droppedEvents, 1);
  assertEquals(cache.inspect().diagnostics.map((entry) => entry.code), ["event-drain-limit"]);
  scheduler.advanceTo(2);
  assertEquals(handle.inspect().policy?.stale, true);
  assertEquals(events, ["updated", "stale"]);
  handle.release();
});

Deno.test("reentrant retention expiry retries and owner resurrection cancels obsolete eviction", () => {
  const retryScheduler = new VirtualTimerScheduler();
  const retryCache = new ResourceCacheCoordinator<string>({
    scheduler: retryScheduler,
    retentionTimeMs: 1,
    maxEventsPerDrain: 1,
  });
  const retryHandle = retryCache.acquire("bounded-retention-timer");
  retryCache.subscribe((event) => {
    if (event.type === "retained") retryScheduler.advanceTo(1);
  });
  retryHandle.release();
  assertEquals(retryCache.size, 1);
  assertEquals(retryCache.inspect().droppedEvents, 1);
  retryScheduler.advanceTo(2);
  assertEquals(retryCache.size, 0);

  const scheduler = new VirtualTimerScheduler();
  const cache = new ResourceCacheCoordinator<object>({ scheduler, retentionTimeMs: 5 });
  const first = cache.acquire("resurrection-race");
  const value = {};
  first.set(value);
  let resurrected: ResourceCacheHandle<object> | undefined;
  cache.subscribe((event) => {
    if (event.type === "retained") resurrected = cache.acquire("resurrection-race");
  });
  first.release();
  assertInstanceOf(resurrected, ResourceCacheHandle);
  assertStrictEquals(resurrected!.read(), value);
  scheduler.advanceBy(5);
  assertEquals(cache.size, 1);
  assertStrictEquals(resurrected!.read(), value);
  resurrected!.release();
  cache.dispose();
});

Deno.test("disposal cancels every cache-owned timer without disposing the injected scheduler", () => {
  const scheduler = new VirtualTimerScheduler();
  const cache = new ResourceCacheCoordinator<string>({
    scheduler,
    staleTimeMs: 5,
    retentionTimeMs: 10,
  });
  const handle = cache.acquire("timer-disposal");
  handle.set("value");
  handle.release();
  assertEquals(scheduler.inspect().pending, 2);
  assertEquals(cache.dispose(), true);
  assertEquals(cache.dispose(), false);
  assertEquals(scheduler.inspect().pending, 0);
  assertEquals(scheduler.disposed, false);
  scheduler.advanceBy(20);
  assertEquals(cache.size, 0);
  scheduler.dispose();
});

Deno.test("focus refresh batches queue every immutable snapshot before reentrant update and disposal", () => {
  const scheduler = new VirtualTimerScheduler();
  const cache = new ResourceCacheCoordinator<string>({
    scheduler,
    staleTimeMs: 0,
    refreshOnFocus: true,
    maxEventsPerDrain: 8,
  });
  const first = cache.acquire("batch-first");
  const second = cache.acquire("batch-second");
  first.set("first-value");
  second.set("second-value");
  const observed: string[] = [];
  let reentered = false;
  cache.subscribe((event) => {
    if (event.type !== "refresh-requested" && event.type !== "updated" && event.type !== "disposed") return;
    observed.push(`${event.type}:${event.key}:${event.revision}:${event.status}`);
    if (event.type === "refresh-requested" && event.key === first.key && !reentered) {
      reentered = true;
      second.transition("error", { code: "later", message: "Queued after refresh snapshots." });
      cache.dispose();
    }
  });

  assertEquals(cache.notifyFocus(), 2);
  assertEquals(observed, [
    `refresh-requested:${first.key}:2:loading`,
    `refresh-requested:${second.key}:2:loading`,
    `updated:${second.key}:3:error`,
    `disposed:${first.key}:2:loading`,
    `disposed:${second.key}:3:error`,
  ]);
  assertEquals(cache.disposed, true);
  assertEquals(first.released, true);
  assertEquals(second.released, true);
});

Deno.test("oversized focus refresh batches reject atomically before any state or event mutation", () => {
  const scheduler = new VirtualTimerScheduler();
  const cache = new ResourceCacheCoordinator<string>({
    scheduler,
    staleTimeMs: 0,
    refreshOnFocus: true,
    maxEventsPerDrain: 1,
  });
  const first = cache.acquire("bounded-batch-first");
  const second = cache.acquire("bounded-batch-second");
  first.set("first");
  second.set("second");
  const before = [first.inspect(), second.inspect()];
  const events: string[] = [];
  cache.subscribe((event) => events.push(event.type));

  assertThrows(() => cache.notifyFocus(), ResourceCacheEventDrainLimitError);
  assertEquals([first.inspect(), second.inspect()], before);
  assertEquals(first.inspect().status, "ready");
  assertEquals(second.inspect().status, "ready");
  assertEquals(events, []);
  assertEquals(cache.inspect().updates, 2);
  assertEquals(cache.inspect().policy?.refreshRequests, 0);
  assertEquals(cache.inspect().droppedEvents, 1);
  first.release();
  second.release();
});

Deno.test("acquire replaces logically expired retained data when timer delivery lags", () => {
  let now = 0;
  const scheduled: Array<{ active: boolean; callback: () => unknown }> = [];
  const scheduler = {
    now: () => now,
    scheduleAt: (_deadlineMs: number, callback: () => unknown) => {
      const timer = { active: true, callback };
      scheduled.push(timer);
      return {
        cancel() {
          timer.active = false;
          return true;
        },
      };
    },
  } as unknown as TimerScheduler;
  const cache = new ResourceCacheCoordinator<object>({
    scheduler,
    retentionTimeMs: 5,
    maxEntries: 1,
  });
  const events: string[] = [];
  cache.subscribe((event) => {
    if (event.type === "evicted" || event.type === "acquired") {
      events.push(`${event.type}:${event.key}:${event.hasValue}`);
    }
  });
  const first = cache.acquire("lagged-expiry");
  const oldKey = first.key;
  const oldValue = {};
  first.set(oldValue);
  first.release();
  events.length = 0;

  now = 5;
  const replacement = cache.acquire("lagged-expiry");
  assertNotEquals(replacement.key, oldKey);
  assertEquals(replacement.read(), undefined);
  assertEquals(replacement.inspect().revision, 0);
  assertEquals(cache.size, 1);
  assertEquals(cache.inspect().evictions, 1);
  assertEquals(events, [
    `evicted:${oldKey}:true`,
    `acquired:${replacement.key}:false`,
  ]);
  for (const timer of scheduled) timer.callback();
  assertEquals(cache.size, 1);
  assertEquals(replacement.inspect().revision, 0);
  replacement.release();
  cache.dispose();
});

Deno.test("expired replacement rejects atomically when its two-event lifecycle cannot fit", () => {
  let now = 0;
  const scheduler = {
    now: () => now,
    scheduleAt: (_deadlineMs: number, _callback: () => unknown) => ({ cancel: () => true }),
  } as unknown as TimerScheduler;
  const cache = new ResourceCacheCoordinator<string>({
    scheduler,
    retentionTimeMs: 5,
    maxEntries: 1,
    maxEventsPerDrain: 1,
  });
  const first = cache.acquire("bounded-expiry");
  first.set("retained-value");
  const oldKey = first.key;
  first.release();
  const before = cache.inspectEntry("bounded-expiry");
  now = 5;

  assertThrows(() => cache.acquire("bounded-expiry"), ResourceCacheEventDrainLimitError);
  assertEquals(cache.inspectEntry("bounded-expiry"), before);
  assertEquals(cache.inspectEntry("bounded-expiry")?.key, oldKey);
  assertEquals(cache.size, 1);
  assertEquals(cache.inspect().evictions, 0);
  assertEquals(cache.inspect().acquires, 1);
  cache.dispose();
});

Deno.test("synchronous retry scheduling is deferred nonrecursively for stale and retention timers", () => {
  const staleCallbacks: Array<() => unknown> = [];
  let staleNow = 0;
  let staleSchedules = 0;
  const staleScheduler = {
    now: () => staleNow,
    scheduleAt: (_deadlineMs: number, callback: () => unknown) => {
      staleSchedules += 1;
      let active = true;
      if (staleSchedules === 1) staleCallbacks.push(() => active && callback());
      else callback();
      return {
        cancel() {
          active = false;
          return true;
        },
      };
    },
  } as unknown as TimerScheduler;
  const staleCache = new ResourceCacheCoordinator<string>({
    scheduler: staleScheduler,
    staleTimeMs: 1,
    maxEventsPerDrain: 1,
  });
  const staleHandle = staleCache.acquire("sync-stale-retry");
  const staleEvents: string[] = [];
  staleHandle.subscribe((event) => {
    staleEvents.push(event.type);
    if (event.type === "updated") {
      staleNow = 1;
      staleCallbacks[0]!();
    }
  });
  staleHandle.set("usable");
  assertEquals(staleSchedules, 2);
  assertEquals(staleEvents, ["updated", "stale"]);
  assertEquals(staleHandle.inspect().policy?.stale, true);
  assertEquals(staleCache.inspect().droppedEvents, 1);
  staleHandle.release();

  const retentionCallbacks: Array<() => unknown> = [];
  let retentionNow = 0;
  let retentionSchedules = 0;
  const retentionScheduler = {
    now: () => retentionNow,
    scheduleAt: (_deadlineMs: number, callback: () => unknown) => {
      retentionSchedules += 1;
      let active = true;
      if (retentionSchedules === 1) retentionCallbacks.push(() => active && callback());
      else callback();
      return {
        cancel() {
          active = false;
          return true;
        },
      };
    },
  } as unknown as TimerScheduler;
  const retentionCache = new ResourceCacheCoordinator<string>({
    scheduler: retentionScheduler,
    retentionTimeMs: 1,
    maxEventsPerDrain: 1,
  });
  const retentionHandle = retentionCache.acquire("sync-retention-retry");
  retentionCache.subscribe((event) => {
    if (event.type === "retained") {
      retentionNow = 1;
      retentionCallbacks[0]!();
    }
  });
  retentionHandle.release();
  assertEquals(retentionSchedules, 2);
  assertEquals(retentionCache.size, 0);
  assertEquals(retentionCache.inspect().droppedEvents, 1);
});

Deno.test("scheduler data methods are snapshotted and accessor reflection fails without raw leakage", () => {
  const scheduler = new VirtualTimerScheduler();
  const cache = new ResourceCacheCoordinator<string>({ scheduler, staleTimeMs: 5 });
  Object.defineProperties(scheduler, {
    now: { configurable: true, value: () => 999 },
    scheduleAt: {
      configurable: true,
      value: () => {
        throw new Error("mutated scheduleAt must not run");
      },
    },
  });
  const handle = cache.acquire("bound-scheduler-methods");
  handle.set("value");
  assertEquals(handle.inspect().policy?.updatedAtMs, 0);
  assertEquals(handle.inspect().policy?.staleAtMs, 5);
  assertEquals(scheduler.inspect().pending, 1);
  handle.release();

  let getterCalls = 0;
  const accessorScheduler = Object.defineProperties({}, {
    now: {
      get() {
        getterCalls += 1;
        return () => 0;
      },
    },
    scheduleAt: { value: () => ({ cancel: () => true }) },
  });
  const accessorError = assertThrows(
    () =>
      new ResourceCacheCoordinator({
        scheduler: accessorScheduler as unknown as TimerScheduler,
        staleTimeMs: 1,
      }),
    TypeError,
    "now data method",
  );
  assertEquals(accessorError.cause, undefined);
  assertEquals(getterCalls, 0);

  const reflected = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error("opaque reflection failure");
    },
  });
  const reflectionError = assertThrows(
    () =>
      new ResourceCacheCoordinator({
        scheduler: reflected as unknown as TimerScheduler,
        staleTimeMs: 1,
      }),
    TypeError,
    "not safely inspectable",
  );
  assertEquals(reflectionError.cause, undefined);

  const throwingNowCache = new ResourceCacheCoordinator<string>({
    scheduler: {
      now: () => {
        throw new Error("opaque now failure");
      },
      scheduleAt: () => ({ cancel: () => true }),
    } as unknown as TimerScheduler,
    staleTimeMs: 1,
  });
  const throwingNowHandle = throwingNowCache.acquire("throwing-now");
  const nowError = assertThrows(
    () => throwingNowHandle.set("never"),
    TypeError,
    "scheduler now() failed",
  );
  assertEquals(nowError.cause, undefined);
  assertEquals(throwingNowHandle.inspect().revision, 0);

  const throwingScheduleCache = new ResourceCacheCoordinator<string>({
    scheduler: {
      now: () => 0,
      scheduleAt: () => {
        throw new Error("opaque schedule failure");
      },
    } as unknown as TimerScheduler,
    staleTimeMs: 1,
  });
  const throwingScheduleHandle = throwingScheduleCache.acquire("throwing-schedule");
  const scheduleError = assertThrows(
    () => throwingScheduleHandle.set("never"),
    TypeError,
    "scheduler scheduleAt() failed",
  );
  assertEquals(scheduleError.cause, undefined);
  assertEquals(throwingScheduleHandle.inspect().revision, 0);
  throwingNowHandle.release();
  throwingScheduleHandle.release();
});

Deno.test("timer handle validation is atomic and snapshotted cancellation severs late callbacks", () => {
  let invalidLateCallback: (() => unknown) | undefined;
  const invalidScheduler = {
    now: () => 0,
    scheduleAt: (_deadlineMs: number, callback: () => unknown) => {
      invalidLateCallback = callback;
      return {};
    },
  } as unknown as TimerScheduler;
  const invalidCache = new ResourceCacheCoordinator<string>({ scheduler: invalidScheduler, staleTimeMs: 1 });
  const invalidHandle = invalidCache.acquire("invalid-timer-handle");
  const invalidBefore = invalidHandle.inspect();
  assertThrows(() => invalidHandle.set("never"), TypeError, "timer handle");
  invalidLateCallback!();
  assertEquals(invalidHandle.inspect(), invalidBefore);
  assertEquals(invalidHandle.read(), undefined);
  assertEquals(invalidCache.inspect().updates, 0);

  let cancelGetterCalls = 0;
  let accessorLateCallback: (() => unknown) | undefined;
  const accessorScheduler = {
    now: () => 0,
    scheduleAt: (_deadlineMs: number, callback: () => unknown) => {
      accessorLateCallback = callback;
      return Object.defineProperty({}, "cancel", {
        get() {
          cancelGetterCalls += 1;
          return () => true;
        },
      });
    },
  } as unknown as TimerScheduler;
  const accessorCache = new ResourceCacheCoordinator<string>({ scheduler: accessorScheduler, staleTimeMs: 1 });
  const accessorHandle = accessorCache.acquire("accessor-timer-handle");
  assertThrows(() => accessorHandle.set("never"), TypeError, "cancel data method");
  accessorLateCallback!();
  assertEquals(cancelGetterCalls, 0);
  assertEquals(accessorHandle.inspect().revision, 0);

  let cancelCalls = 0;
  const rawHandles: Array<{ cancel: () => boolean }> = [];
  const lateCallbacks: Array<() => unknown> = [];
  const mutableHandleScheduler = {
    now: () => 0,
    scheduleAt: (_deadlineMs: number, callback: () => unknown) => {
      lateCallbacks.push(callback);
      const raw = {
        cancel() {
          cancelCalls += 1;
          return true;
        },
      };
      rawHandles.push(raw);
      return raw;
    },
  } as unknown as TimerScheduler;
  const mutableCache = new ResourceCacheCoordinator<string>({
    scheduler: mutableHandleScheduler,
    staleTimeMs: 1,
  });
  const mutableHandle = mutableCache.acquire("mutable-cancel-method");
  mutableHandle.set("first");
  rawHandles[0]!.cancel = () => {
    throw new Error("mutated cancel must not run");
  };
  mutableHandle.set("second");
  assertEquals(cancelCalls, 1);
  lateCallbacks[0]!();
  assertEquals(mutableHandle.inspect().policy?.stale, false);
  mutableHandle.release();
  assertEquals(cancelCalls, 2);

  invalidHandle.release();
  accessorHandle.release();
});

Deno.test("public construction and internal mutator calls reject forged owners without side effects", () => {
  const cache = new ResourceCacheCoordinator<number>();
  const events: string[] = [];
  cache.subscribe((event) => events.push(event.type));
  const forgedOwner = {
    active: true,
    subscriptions: new Set<number>(),
    entry: {
      key: "forged-secret-key",
      structuralKey: "forged-structural-key",
      owners: new Set(),
      listeners: new Map(),
      status: "idle",
      revision: 0,
      hasValue: false,
      value: undefined,
      dead: false,
    },
  };

  assertThrows(
    () => new ResourceCacheHandle(cache, forgedOwner, Symbol("forged")),
    TypeError,
    "cannot be constructed directly",
  );
  const unsafe = cache as unknown as {
    setOwnerValue(owner: unknown, value: number, status: "ready"): unknown;
    releaseOwner(owner: unknown): boolean;
    inspectOwnedEntry(owner: unknown): unknown;
  };
  assertThrows(() => unsafe.setOwnerValue(forgedOwner, 42, "ready"), TypeError, "not created");
  assertThrows(() => unsafe.releaseOwner(forgedOwner), TypeError, "not created");
  assertThrows(() => unsafe.inspectOwnedEntry(forgedOwner), TypeError, "not created");
  assertEquals(cache.size, 0);
  assertEquals(cache.inspect().updates, 0);
  assertEquals(cache.inspect().releases, 0);
  assertEquals(events, []);
});

Deno.test("factory calls create independent process-local coordinators with no singleton state", () => {
  const first = createResourceCacheCoordinator<number>();
  const second = createResourceCacheCoordinator<number>();
  const firstHandle = first.acquire({ id: 1 });
  const secondHandle = second.acquire({ id: 1 });
  firstHandle.set(42);
  assertEquals(secondHandle.read(), undefined);
  assertNotEquals(first.inspect().updates, second.inspect().updates);
  assertInstanceOf(first, ResourceCacheCoordinator);
  first.dispose();
  assertEquals(second.disposed, false);
  second.dispose();
});
