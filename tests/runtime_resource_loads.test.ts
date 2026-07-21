import { assertEquals, assertInstanceOf, assertRejects, assertStrictEquals, assertThrows } from "./deps.ts";
import { HostTimerScheduler, VirtualTimerScheduler } from "../src/runtime/clock.ts";
import { ResourceCacheCoordinator, ResourceCacheRevisionExhaustedError } from "../src/runtime/resource_cache.ts";
import {
  createResourceLoadCoordinator,
  ResourceLoadCancelledError,
  ResourceLoadCapacityError,
  ResourceLoadConfigurationError,
  ResourceLoadCoordinator,
  ResourceLoadCoordinatorDisposedError,
  ResourceLoadHandleLimitError,
  ResourceLoadRequestError,
  ResourceLoadSupersededError,
} from "../src/runtime/resource_loads.ts";

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value | PromiseLike<Value>) => void;
  readonly reject: (reason?: unknown) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function drainMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

Deno.test("equivalent join callers invoke one loader with an immutable request snapshot", async () => {
  const cache = new ResourceCacheCoordinator<{ rows: number[] }>();
  const owner = cache.acquire({ filters: { active: true }, page: 2 });
  const loads = new ResourceLoadCoordinator(cache);
  const gate = deferred<{ rows: number[] }>();
  const request = { page: 2, filters: { active: true } };
  let calls = 0;
  let received: unknown;
  const first = loads.load(request, (context) => {
    calls += 1;
    received = context.request;
    assertEquals(Object.isFrozen(context), true);
    assertEquals(Object.isFrozen(context.request), true);
    assertEquals(Object.isFrozen(context.request.filters), true);
    return gate.promise;
  });
  request.page = 99;
  request.filters.active = false;
  const second = loads.load(
    { filters: { active: true }, page: 2 },
    () => {
      throw new Error("joined loader must not run");
    },
  );

  await drainMicrotasks();
  assertEquals(calls, 1);
  assertEquals(received, { page: 2, filters: { active: true } });
  assertEquals(first.generation, second.generation);
  assertEquals(first.key, second.key);
  const value = { rows: [1, 2, 3] };
  gate.resolve(value);
  assertStrictEquals(await first.promise, value);
  assertStrictEquals(await second.promise, value);
  assertStrictEquals(owner.read(), value);
  assertEquals(loads.inspect().joined, 1);
  owner.release();
  loads.dispose();
});

Deno.test("joined handles cancel independently and preserve a shared settlement", async () => {
  const cache = new ResourceCacheCoordinator<number>();
  const loads = createResourceLoadCoordinator(cache);
  const gate = deferred<number>();
  let loaderSignal: AbortSignal | undefined;
  const first = loads.load("shared", ({ signal }) => {
    loaderSignal = signal;
    return gate.promise;
  });
  const second = loads.load("shared", () => 999);
  const third = loads.load("shared", () => 999);
  await drainMicrotasks();

  const reason = { caller: 2 };
  assertEquals(second.cancel(reason), true);
  assertEquals(second.cancel(reason), false);
  const cancellation = await assertRejects(() => second.promise, ResourceLoadCancelledError);
  assertStrictEquals(cancellation.cause, reason);
  assertEquals(loaderSignal?.aborted, false);
  gate.resolve(42);
  assertEquals(await first.promise, 42);
  assertEquals(await third.promise, 42);
  assertEquals(first.status, "fulfilled");
  assertEquals(second.status, "cancelled");
  assertEquals(loads.inspect().cancelledHandles, 1);
  loads.dispose();
});

Deno.test("the last cancelled handle aborts its generation before a loader can publish", async () => {
  const cache = new ResourceCacheCoordinator<number>();
  const owner = cache.acquire("cancel-all");
  const loads = new ResourceLoadCoordinator(cache);
  const gate = deferred<number>();
  let signal: AbortSignal | undefined;
  const handle = loads.load("cancel-all", (context) => {
    signal = context.signal;
    return gate.promise;
  });
  await drainMicrotasks();
  assertEquals(handle.cancel("gone"), true);
  await assertRejects(() => handle.promise, ResourceLoadCancelledError);
  assertEquals(signal?.aborted, true);
  gate.resolve(7);
  await drainMicrotasks();
  assertEquals(owner.read(), undefined);
  assertEquals(owner.inspect().status, "idle");
  assertEquals(loads.inFlightGenerations, 0);
  assertEquals(loads.inspect().abortedGenerations, 1);
  owner.release();
  loads.dispose();
});

Deno.test("supersede aborts every older joiner and only the replacement publishes", async () => {
  const cache = new ResourceCacheCoordinator<string>();
  const owner = cache.acquire({ id: 1 });
  const loads = new ResourceLoadCoordinator(cache);
  const oldGate = deferred<string>();
  const newGate = deferred<string>();
  let oldSignal: AbortSignal | undefined;
  const oldFirst = loads.load({ id: 1 }, ({ signal }) => {
    oldSignal = signal;
    return oldGate.promise;
  });
  const oldSecond = loads.load({ id: 1 }, () => "ignored");
  await drainMicrotasks();
  const replacement = loads.load({ id: 1 }, () => newGate.promise, { policy: "supersede" });

  const firstError = await assertRejects(() => oldFirst.promise, ResourceLoadSupersededError);
  const secondError = await assertRejects(() => oldSecond.promise, ResourceLoadSupersededError);
  assertStrictEquals(firstError, secondError);
  assertEquals(firstError.replacementGeneration, replacement.generation);
  assertEquals(oldSignal?.aborted, true);
  assertInstanceOf(oldSignal?.reason, ResourceLoadSupersededError);

  newGate.resolve("new");
  assertEquals(await replacement.promise, "new");
  oldGate.resolve("old");
  await drainMicrotasks();
  assertEquals(owner.read(), "new");
  assertEquals(loads.inspect().supersededGenerations, 1);
  assertEquals(loads.inspect().supersededHandles, 2);
  assertEquals(loads.inspect().staleCompletions, 1);
  owner.release();
  loads.dispose();
});

Deno.test("force-new settles concurrent callers independently while the newest generation wins publication", async () => {
  const cache = new ResourceCacheCoordinator<number>();
  const owner = cache.acquire("force");
  const loads = new ResourceLoadCoordinator(cache);
  const oldGate = deferred<number>();
  const newGate = deferred<number>();
  const old = loads.load("force", () => oldGate.promise);
  const fresh = loads.load("force", () => newGate.promise, { policy: "force-new" });
  await drainMicrotasks();
  assertEquals(loads.inFlightGenerations, 2);

  newGate.resolve(2);
  assertEquals(await fresh.promise, 2);
  oldGate.resolve(1);
  assertEquals(await old.promise, 1);
  assertEquals(owner.read(), 2);
  assertEquals(loads.inspect().forceNewGenerations, 1);
  assertEquals(loads.inspect().staleCompletions, 1);
  owner.release();
  loads.dispose();
});

Deno.test("loader rejection is shared exactly and preserves stale usable cache data", async () => {
  const cache = new ResourceCacheCoordinator<{ version: number }>();
  const owner = cache.acquire("reject");
  const prior = { version: 1 };
  owner.set(prior);
  const loads = new ResourceLoadCoordinator(cache);
  const failure = new Error("private server detail");
  const first = loads.load("reject", () => Promise.reject(failure));
  const second = loads.load("reject", () => ({ version: 99 }));
  const firstFailure = await assertRejects(() => first.promise);
  const secondFailure = await assertRejects(() => second.promise);
  assertStrictEquals(firstFailure, failure);
  assertStrictEquals(secondFailure, failure);
  assertStrictEquals(owner.read(), prior);
  assertEquals(owner.inspect().status, "error");
  assertEquals(owner.inspect().diagnostic, {
    code: "loader-rejected",
    message: "Resource loader rejected.",
  });
  assertEquals(loads.inspect().diagnostics[0]?.message.includes("private"), false);
  owner.release();
  loads.dispose();
});

Deno.test("generation and handle bounds reject without invoking extra loaders", async () => {
  const capacityCache = new ResourceCacheCoordinator<number>();
  const capacityLoads = new ResourceLoadCoordinator(capacityCache, { maxInFlightGenerations: 1 });
  const gate = deferred<number>();
  let calls = 0;
  const first = capacityLoads.load("bounded", () => {
    calls += 1;
    return gate.promise;
  });
  assertThrows(
    () => capacityLoads.load("bounded", () => ++calls, { policy: "force-new" }),
    ResourceLoadCapacityError,
  );
  await drainMicrotasks();
  assertEquals(calls, 1);
  gate.resolve(1);
  await first.promise;

  const handleCache = new ResourceCacheCoordinator<number>();
  const handleLoads = new ResourceLoadCoordinator(handleCache, {
    maxActiveHandles: 1,
    maxHandlesPerGeneration: 1,
  });
  const handleGate = deferred<number>();
  const only = handleLoads.load("bounded", () => handleGate.promise);
  assertThrows(() => handleLoads.load("bounded", () => 2), ResourceLoadHandleLimitError);
  assertEquals(handleLoads.inspect().activeHandles, 1);
  assertEquals(handleLoads.inspect().joined, 0);
  handleGate.resolve(1);
  await only.promise;
  capacityLoads.dispose();
  handleLoads.dispose();
});

Deno.test("loads reserve terminal revision headroom before entering loading", () => {
  const cache = new ResourceCacheCoordinator<number>({
    initialRevision: Number.MAX_SAFE_INTEGER - 2,
  });
  const owner = cache.acquire("revision-headroom");
  owner.set(7);
  const before = owner.inspect();
  const loads = new ResourceLoadCoordinator(cache);
  let calls = 0;

  const error = assertThrows(
    () => loads.load("revision-headroom", () => ++calls),
    ResourceCacheRevisionExhaustedError,
  );
  assertEquals(error.revision, Number.MAX_SAFE_INTEGER - 1);
  assertEquals(calls, 0);
  assertEquals(owner.inspect(), before);
  assertEquals(owner.read(), 7);
  assertEquals(loads.inFlightGenerations, 0);
  assertEquals(loads.inspect().activeHandles, 0);

  owner.release();
  loads.dispose();
});

Deno.test("failed force-new at handle capacity leaves the older generation publishable", async () => {
  const cache = new ResourceCacheCoordinator<number>();
  const owner = cache.acquire("handle-capacity-atomic");
  const loads = new ResourceLoadCoordinator(cache, { maxActiveHandles: 1 });
  const gate = deferred<number>();
  let originalCalls = 0;
  let rejectedCalls = 0;
  const original = loads.load("handle-capacity-atomic", () => {
    originalCalls += 1;
    return gate.promise;
  });
  const loading = owner.inspect();

  assertThrows(
    () =>
      loads.load("handle-capacity-atomic", () => {
        rejectedCalls += 1;
        return 99;
      }, { policy: "force-new" }),
    ResourceLoadHandleLimitError,
  );
  assertEquals(owner.inspect(), loading);
  assertEquals(loads.inspect().generationsStarted, 1);
  assertEquals(loads.inspect().forceNewGenerations, 0);

  gate.resolve(17);
  assertEquals(await original.promise, 17);
  assertEquals(originalCalls, 1);
  assertEquals(rejectedCalls, 0);
  assertEquals(owner.read(), 17);
  assertEquals(owner.inspect().status, "ready");
  assertEquals(loads.inspect().staleCompletions, 0);
  owner.release();
  loads.dispose();
});

Deno.test("join reuses a same-key generation installed by an acquired listener", async () => {
  const cache = new ResourceCacheCoordinator<string>();
  const owner = cache.acquire("acquired-reentry");
  const loads = new ResourceLoadCoordinator(cache);
  const gate = deferred<string>();
  let inner: ReturnType<ResourceLoadCoordinator<string>["load"]> | undefined;
  let innerCalls = 0;
  let outerCalls = 0;
  let reenter = true;
  const unsubscribe = cache.subscribe((event) => {
    if (!reenter || event.type !== "acquired") return;
    reenter = false;
    inner = loads.load("acquired-reentry", () => {
      innerCalls += 1;
      return gate.promise;
    });
  });

  const outer = loads.load("acquired-reentry", () => {
    outerCalls += 1;
    return "outer";
  });
  await drainMicrotasks();
  assertInstanceOf(inner, Object);
  assertEquals(outer.generation, inner!.generation);
  assertEquals(innerCalls, 1);
  assertEquals(outerCalls, 0);

  gate.resolve("inner");
  assertEquals(await inner!.promise, "inner");
  assertEquals(await outer.promise, "inner");
  assertEquals(owner.read(), "inner");
  assertEquals(owner.inspect().status, "ready");
  assertEquals(loads.inspect().joined, 1);
  assertEquals(loads.inspect().staleCompletions, 0);
  unsubscribe();
  owner.release();
  loads.dispose();
});

Deno.test("acquired-listener reentry keeps the newer publisher for force-new and supersede", async () => {
  for (const policy of ["force-new", "supersede"] as const) {
    const cache = new ResourceCacheCoordinator<string>();
    const owner = cache.acquire(`acquired-${policy}`);
    const loads = new ResourceLoadCoordinator(cache);
    let inner: ReturnType<ResourceLoadCoordinator<string>["load"]> | undefined;
    let reenter = true;
    let innerCalls = 0;
    let outerCalls = 0;
    const unsubscribe = cache.subscribe((event) => {
      if (!reenter || event.type !== "acquired") return;
      reenter = false;
      inner = loads.load(`acquired-${policy}`, () => {
        innerCalls += 1;
        return "inner";
      });
    });

    const outer = loads.load(`acquired-${policy}`, () => {
      outerCalls += 1;
      return "outer";
    }, { policy });
    assertEquals(await inner!.promise, "inner");
    assertEquals(await outer.promise, "outer");
    assertEquals(inner!.generation > outer.generation, true);
    assertEquals(innerCalls, 1);
    assertEquals(outerCalls, 1);
    assertEquals(owner.read(), "inner");
    assertEquals(owner.inspect().status, "ready");
    assertEquals(loads.inspect().staleCompletions, 1);
    unsubscribe();
    owner.release();
    loads.dispose();
  }
});

Deno.test("cancellation restores ready data and promotes an older force-new generation", async () => {
  const cache = new ResourceCacheCoordinator<number>();
  const owner = cache.acquire("promote-after-cancel");
  owner.set(7);
  const loads = new ResourceLoadCoordinator(cache);
  const oldGate = deferred<number>();
  const freshGate = deferred<number>();
  const old = loads.load("promote-after-cancel", () => oldGate.promise);
  const fresh = loads.load("promote-after-cancel", () => freshGate.promise, { policy: "force-new" });
  await drainMicrotasks();

  assertEquals(fresh.cancel("newest-left"), true);
  await assertRejects(() => fresh.promise, ResourceLoadCancelledError);
  oldGate.resolve(8);
  assertEquals(await old.promise, 8);
  freshGate.resolve(9);
  await drainMicrotasks();
  assertEquals(owner.read(), 8);
  assertEquals(owner.inspect().status, "ready");
  assertEquals(loads.inspect().staleCompletions, 1);
  owner.release();
  loads.dispose();
});

Deno.test("cancelled supersede and disposed force-new chains restore their pre-load baseline", async () => {
  const supersedeCache = new ResourceCacheCoordinator<string>();
  const supersedeOwner = supersedeCache.acquire("supersede-rollback");
  supersedeOwner.set("baseline");
  const supersedeLoads = new ResourceLoadCoordinator(supersedeCache);
  const oldGate = deferred<string>();
  const replacementGate = deferred<string>();
  const old = supersedeLoads.load("supersede-rollback", () => oldGate.promise);
  const replacement = supersedeLoads.load("supersede-rollback", () => replacementGate.promise, {
    policy: "supersede",
  });
  await assertRejects(() => old.promise, ResourceLoadSupersededError);
  assertEquals(replacement.cancel("replacement-left"), true);
  await assertRejects(() => replacement.promise, ResourceLoadCancelledError);
  assertEquals(supersedeOwner.read(), "baseline");
  assertEquals(supersedeOwner.inspect().status, "ready");
  oldGate.resolve("old");
  replacementGate.resolve("replacement");
  await drainMicrotasks();
  supersedeOwner.release();
  supersedeLoads.dispose();

  const disposeCache = new ResourceCacheCoordinator<number>();
  const disposeOwner = disposeCache.acquire("dispose-chain");
  disposeOwner.set(11);
  const disposeLoads = new ResourceLoadCoordinator(disposeCache);
  const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
  const handles = gates.map((gate, index) =>
    disposeLoads.load("dispose-chain", () => gate.promise, {
      policy: index === 0 ? "join" : "force-new",
    })
  );
  await drainMicrotasks();
  disposeLoads.dispose();
  await Promise.all(handles.map((handle) => assertRejects(() => handle.promise, ResourceLoadCoordinatorDisposedError)));
  assertEquals(disposeOwner.read(), 11);
  assertEquals(disposeOwner.inspect().status, "ready");
  gates.forEach((gate, index) => gate.resolve(index));
  disposeOwner.release();
});

Deno.test("nested cancellation during a loading transition preserves the surviving latest publisher", async () => {
  const cache = new ResourceCacheCoordinator<string>();
  const owner = cache.acquire("nested-transition-cancel");
  owner.set("base");
  const loads = new ResourceLoadCoordinator(cache);
  const oldGate = deferred<string>();
  const newestGate = deferred<string>();
  const thirdGate = deferred<string>();
  const old = loads.load("nested-transition-cancel", () => oldGate.promise);
  const newest = loads.load("nested-transition-cancel", () => newestGate.promise, { policy: "force-new" });
  const newestFailure = newest.promise.catch((error) => error);
  await drainMicrotasks();

  let phase = 0;
  let nested: ReturnType<ResourceLoadCoordinator<string>["load"]> | undefined;
  let nestedFailure: Promise<unknown> | undefined;
  const unsubscribe = cache.subscribe((event) => {
    if (event.key !== owner.key) return;
    if (phase === 0 && event.type === "updated" && event.status === "loading") {
      phase = 1;
      newest.cancel("drop newest");
    } else if (phase === 1 && event.type === "released") {
      phase = 2;
      nested = loads.load("nested-transition-cancel", () => "nested");
      nestedFailure = nested.promise.catch((error) => error);
    }
  });

  const third = loads.load("nested-transition-cancel", () => thirdGate.promise, { policy: "force-new" });
  assertInstanceOf(nested, Object);
  assertEquals(nested!.cancel("drop nested"), true);
  assertInstanceOf(await nestedFailure, ResourceLoadCancelledError);
  assertInstanceOf(await newestFailure, ResourceLoadCancelledError);
  oldGate.resolve("a");
  thirdGate.resolve("c");
  assertEquals(await old.promise, "a");
  assertEquals(await third.promise, "c");
  await drainMicrotasks();
  assertEquals(owner.read(), "c");
  assertEquals(owner.inspect().status, "ready");
  assertEquals(loads.inspect().staleCompletions, 1);

  newestGate.resolve("b");
  await drainMicrotasks();
  unsubscribe();
  owner.release();
  loads.dispose();
});

Deno.test("external cache mutation during loading starts a separate rollback epoch", async () => {
  const cache = new ResourceCacheCoordinator<string>();
  const owner = cache.acquire("external-transition");
  owner.set("base");
  const loads = new ResourceLoadCoordinator(cache);
  let phase = 0;
  let nested: ReturnType<ResourceLoadCoordinator<string>["load"]> | undefined;
  let nestedFailure: Promise<unknown> | undefined;
  const unsubscribe = cache.subscribe((event) => {
    if (event.key !== owner.key) return;
    if (phase === 0 && event.type === "updated" && event.status === "loading") {
      phase = 1;
      owner.clear("idle");
    } else if (phase === 1 && event.type === "updated" && event.status === "idle") {
      phase = 2;
      nested = loads.load("external-transition", () => "nested", { policy: "force-new" });
      nestedFailure = nested.promise.catch((error) => error);
    }
  });

  const outer = loads.load("external-transition", () => "outer", { policy: "force-new" });
  const outerFailure = outer.promise.catch((error) => error);
  assertInstanceOf(nested, Object);
  assertEquals(nested!.cancel("drop nested"), true);
  assertEquals(outer.cancel("drop outer"), true);
  assertInstanceOf(await nestedFailure, ResourceLoadCancelledError);
  assertInstanceOf(await outerFailure, ResourceLoadCancelledError);
  assertEquals(owner.read(), undefined);
  assertEquals(owner.inspect().status, "idle");
  assertEquals(owner.inspect().hasValue, false);
  unsubscribe();
  owner.release();
  loads.dispose();
});

Deno.test("options and request reflection reject hostile data without invoking accessors", () => {
  const cache = new ResourceCacheCoordinator<number>();
  const loads = new ResourceLoadCoordinator(cache);
  let optionGetter = 0;
  const options = Object.defineProperty({}, "policy", {
    enumerable: true,
    get() {
      optionGetter += 1;
      return "join";
    },
  });
  assertThrows(
    () => loads.load("x", () => 1, options as never),
    ResourceLoadConfigurationError,
  );
  assertEquals(optionGetter, 0);

  let requestGetter = 0;
  const request = Object.defineProperty({}, "secret", {
    enumerable: true,
    get() {
      requestGetter += 1;
      throw new Error("must not run");
    },
  });
  assertThrows(() => loads.load(request, () => 1), ResourceLoadRequestError);
  assertEquals(requestGetter, 0);

  const reflected = new Proxy({}, {
    ownKeys() {
      throw new Error("opaque");
    },
  });
  assertThrows(() => loads.load(reflected, () => 1), ResourceLoadRequestError);
  assertEquals(loads.inspect().requests, 0);
  assertEquals(loads.inFlightGenerations, 0);
  loads.dispose();
});

Deno.test("request and option entry bounds run before per-property descriptor reflection", () => {
  const cache = new ResourceCacheCoordinator<number>();
  const loads = new ResourceLoadCoordinator(cache, { maxContainerEntries: 1 });
  let requestDescriptors = 0;
  const request = new Proxy({}, {
    ownKeys: () => ["one", "two"],
    getOwnPropertyDescriptor() {
      requestDescriptors += 1;
      return { configurable: true, enumerable: true, value: 1 };
    },
  });
  const requestError = assertThrows(() => loads.load(request, () => 1), ResourceLoadRequestError);
  assertEquals(requestError.reason, "max-container-entries");
  assertEquals(requestDescriptors, 0);

  let optionDescriptors = 0;
  const options = new Proxy({}, {
    ownKeys: () => ["policy", "signal", "excess"],
    getOwnPropertyDescriptor() {
      optionDescriptors += 1;
      return { configurable: true, enumerable: true, value: undefined };
    },
  });
  assertThrows(() => loads.load("options", () => 1, options), ResourceLoadConfigurationError);
  assertEquals(optionDescriptors, 0);
  loads.dispose();
});

Deno.test("request snapshots reject cycles, sparse arrays, symbols, and configured excess", () => {
  const cache = new ResourceCacheCoordinator<number>();
  const loads = new ResourceLoadCoordinator(cache, {
    maxDepth: 1,
    maxNodes: 4,
    maxContainerEntries: 2,
  });
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assertEquals(assertThrows(() => loads.load(cycle, () => 1), ResourceLoadRequestError).reason, "cycle");
  assertEquals(
    assertThrows(() => loads.load({ one: { two: 2 } }, () => 1), ResourceLoadRequestError).reason,
    "max-depth",
  );
  assertEquals(
    assertThrows(() => loads.load({ one: 1, two: 2, three: 3 }, () => 1), ResourceLoadRequestError).reason,
    "max-container-entries",
  );
  assertEquals(
    assertThrows(() => loads.load(new Array(1), () => 1), ResourceLoadRequestError).reason,
    "invalid-shape",
  );
  assertEquals(assertThrows(() => loads.load(Symbol("x"), () => 1), ResourceLoadRequestError).reason, "unsupported");
  loads.dispose();
});

Deno.test("already-aborted and forged signals are rejected before cache or loader mutation", () => {
  const cache = new ResourceCacheCoordinator<number>();
  const loads = new ResourceLoadCoordinator(cache);
  const controller = new AbortController();
  const reason = { stopped: true };
  controller.abort(reason);
  let calls = 0;
  const cancelled = assertThrows(
    () => loads.load("signal", () => ++calls, { signal: controller.signal }),
    ResourceLoadCancelledError,
  );
  assertStrictEquals(cancelled.cause, reason);
  assertThrows(
    () => loads.load("signal", () => ++calls, { signal: {} as AbortSignal }),
    ResourceLoadConfigurationError,
  );
  assertEquals(calls, 0);
  assertEquals(cache.size, 0);
  assertEquals(loads.inspect().requests, 0);
  loads.dispose();
});

Deno.test("an external AbortSignal cancels only its joined handle", async () => {
  const cache = new ResourceCacheCoordinator<number>();
  const loads = new ResourceLoadCoordinator(cache);
  const gate = deferred<number>();
  const controller = new AbortController();
  const signalled = loads.load("external", () => gate.promise, { signal: controller.signal });
  const survivor = loads.load("external", () => 2);
  await drainMicrotasks();
  controller.abort("caller-left");
  const error = await assertRejects(() => signalled.promise, ResourceLoadCancelledError);
  assertEquals(error.cause, "caller-left");
  gate.resolve(8);
  assertEquals(await survivor.promise, 8);
  assertEquals(survivor.status, "fulfilled");
  loads.dispose();
});

Deno.test("coordinator disposal aborts work, rejects handles, and leaves the cache usable", async () => {
  const cache = new ResourceCacheCoordinator<number>();
  const loads = new ResourceLoadCoordinator(cache);
  const gate = deferred<number>();
  let signal: AbortSignal | undefined;
  const handle = loads.load("dispose", (context) => {
    signal = context.signal;
    return gate.promise;
  });
  await drainMicrotasks();
  assertEquals(loads.dispose(), true);
  assertEquals(loads.dispose(), false);
  await assertRejects(() => handle.promise, ResourceLoadCoordinatorDisposedError);
  assertEquals(handle.status, "coordinator-disposed");
  assertEquals(signal?.aborted, true);
  assertEquals(cache.disposed, false);
  const owner = cache.acquire("still-usable");
  owner.set(3);
  assertEquals(owner.read(), 3);
  owner.release();
  assertThrows(() => loads.load("late", () => 1), ResourceLoadCoordinatorDisposedError);
  gate.resolve(7);
});

Deno.test("disposal settles handles before rollback listeners can cancel them", async () => {
  const cache = new ResourceCacheCoordinator<number>();
  const owner = cache.acquire("dispose-terminal-order");
  owner.set(11);
  const loads = new ResourceLoadCoordinator(cache);
  const gate = deferred<number>();
  const handle = loads.load("dispose-terminal-order", () => gate.promise);
  let rollbackCancellation: boolean | undefined;
  const stop = cache.subscribe((event) => {
    if (
      event.key === owner.key && event.type === "updated" &&
      event.status === "ready"
    ) {
      rollbackCancellation = handle.cancel("too-late");
    }
  });

  assertEquals(loads.dispose(), true);
  assertEquals(rollbackCancellation, false);
  await assertRejects(() => handle.promise, ResourceLoadCoordinatorDisposedError);
  assertEquals(handle.status, "coordinator-disposed");
  assertEquals(loads.inspect().cancelledHandles, 0);
  assertEquals(owner.read(), 11);
  assertEquals(owner.inspect().status, "ready");

  stop();
  owner.release();
  gate.resolve(12);
});

Deno.test("inspection is bounded, frozen, clone-safe, and redacts loader failures", async () => {
  const cache = new ResourceCacheCoordinator<number>();
  const loads = new ResourceLoadCoordinator(cache, {
    maxInFlightGenerations: 3,
    maxInspectionGenerations: 1,
    maxDiagnostics: 1,
  });
  const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
  const handles = gates.map((gate, index) =>
    loads.load("inspect", () => gate.promise, { policy: index === 0 ? "join" : "force-new" })
  );
  await drainMicrotasks();
  const live = loads.inspect();
  assertEquals(live.generations.length, 1);
  assertEquals(live.omittedGenerations, 2);
  assertEquals(Object.isFrozen(live), true);
  assertEquals(Object.isFrozen(live.generations), true);
  assertEquals(Object.isFrozen(live.generations[0]), true);
  assertEquals(structuredClone(live), live);

  loads.dispose();
  await Promise.all(handles.map((handle) => assertRejects(() => handle.promise)));

  const diagnosticCache = new ResourceCacheCoordinator<number>();
  const diagnosticLoads = new ResourceLoadCoordinator(diagnosticCache, { maxDiagnostics: 1 });
  await assertRejects(() => diagnosticLoads.load("a", () => Promise.reject("secret-a")).promise);
  await assertRejects(() => diagnosticLoads.load("b", () => Promise.reject("secret-b")).promise);
  const diagnostics = diagnosticLoads.inspect();
  assertEquals(diagnostics.diagnostics.length, 1);
  assertEquals(diagnostics.diagnosticsDropped, 1);
  assertEquals(JSON.stringify(diagnostics).includes("secret"), false);
  assertEquals(structuredClone(diagnostics), diagnostics);
  diagnosticLoads.dispose();
});

Deno.test("revision-guarded publication defeats injected-clock reentrancy", async () => {
  let replacement: ReturnType<ResourceLoadCoordinator<string>["load"]> | undefined;
  let reenter = false;
  const scheduler = new HostTimerScheduler({
    now: (): number => {
      if (reenter) {
        reenter = false;
        replacement = loads.load("clock", () => "new", { policy: "force-new" });
      }
      return 0;
    },
    setTimeout: () => Object.freeze({ timer: true }),
    clearTimeout: () => undefined,
  });
  const cache = new ResourceCacheCoordinator<string>({ scheduler, staleTimeMs: 10 });
  const owner = cache.acquire("clock");
  const loads = new ResourceLoadCoordinator(cache);
  reenter = true;
  const old = loads.load("clock", () => "old");
  assertEquals(await old.promise, "old");
  await drainMicrotasks();
  assertInstanceOf(replacement, Object);
  assertEquals(await replacement!.promise, "new");
  assertEquals(owner.read(), "new");
  assertEquals(loads.inspect().staleCompletions, 1);
  owner.release();
  loads.dispose();
});

Deno.test("publication retries when clock reentry creates and cancels a newer generation", async () => {
  let replacement: ReturnType<ResourceLoadCoordinator<string>["load"]> | undefined;
  let replacementFailure: Promise<unknown> | undefined;
  let reenter = false;
  const scheduler = new HostTimerScheduler({
    now: (): number => {
      if (reenter) {
        reenter = false;
        replacement = loads.load("clock-cancel", () => "new", { policy: "force-new" });
        replacementFailure = replacement.promise.catch((error) => error);
        replacement.cancel("transient");
      }
      return 0;
    },
    setTimeout: () => Object.freeze({ timer: true }),
    clearTimeout: () => undefined,
  });
  const cache = new ResourceCacheCoordinator<string>({ scheduler, staleTimeMs: 10 });
  const owner = cache.acquire("clock-cancel");
  owner.set("base");
  const loads = new ResourceLoadCoordinator(cache);
  const old = loads.load("clock-cancel", () => "old");
  reenter = true;

  assertEquals(await old.promise, "old");
  assertInstanceOf(await replacementFailure, ResourceLoadCancelledError);
  assertEquals(owner.read(), "old");
  assertEquals(owner.inspect().status, "ready");
  assertEquals(loads.inFlightGenerations, 0);
  assertEquals(loads.inspect().staleCompletions, 0);
  owner.release();
  loads.dispose();
});

Deno.test("cache-listener disposal during setup is exception-atomic and skips loader invocation", () => {
  const cache = new ResourceCacheCoordinator<number>();
  const owner = cache.acquire("reentrant-dispose");
  cache.subscribe((event) => {
    if (event.type === "updated" && event.status === "loading") loads.dispose();
  });
  const loads = new ResourceLoadCoordinator(cache);
  let calls = 0;
  assertThrows(() => loads.load("reentrant-dispose", () => ++calls), ResourceLoadCoordinatorDisposedError);
  assertEquals(calls, 0);
  assertEquals(loads.inFlightGenerations, 0);
  assertEquals(loads.inspect().activeHandles, 0);
  assertEquals(owner.read(), undefined);
  assertEquals(owner.inspect().status, "idle");
  owner.release();
});

Deno.test("loading-listener abort and post-transition handle exhaustion roll back setup", async () => {
  const abortCache = new ResourceCacheCoordinator<number>();
  const abortOwner = abortCache.acquire("abort-during-loading");
  const abortLoads = new ResourceLoadCoordinator(abortCache);
  const controller = new AbortController();
  let abortCalls = 0;
  const stopAbort = abortCache.subscribe((event) => {
    if (event.key === abortOwner.key && event.type === "updated" && event.status === "loading") {
      controller.abort("listener");
    }
  });
  assertThrows(
    () => abortLoads.load("abort-during-loading", () => ++abortCalls, { signal: controller.signal }),
    ResourceLoadCancelledError,
  );
  assertEquals(abortCalls, 0);
  assertEquals(abortOwner.inspect().status, "idle");
  stopAbort();
  abortOwner.release();
  abortLoads.dispose();

  const capacityCache = new ResourceCacheCoordinator<number>();
  const outerOwner = capacityCache.acquire("outer-capacity");
  const capacityLoads = new ResourceLoadCoordinator(capacityCache, { maxActiveHandles: 1 });
  const innerGate = deferred<number>();
  let inner: ReturnType<ResourceLoadCoordinator<number>["load"]> | undefined;
  let reenter = true;
  const stopCapacity = capacityCache.subscribe((event) => {
    if (
      reenter && event.key === outerOwner.key && event.type === "updated" &&
      event.status === "loading"
    ) {
      reenter = false;
      inner = capacityLoads.load("inner-capacity", () => innerGate.promise);
    }
  });
  assertThrows(
    () => capacityLoads.load("outer-capacity", () => 1),
    ResourceLoadHandleLimitError,
  );
  assertEquals(outerOwner.inspect().status, "idle");
  innerGate.resolve(2);
  assertEquals(await inner!.promise, 2);
  stopCapacity();
  outerOwner.release();
  capacityLoads.dispose();
});

Deno.test("setIfRevision checks after scheduler reentrancy and leaves newer data untouched", () => {
  let reenter = false;
  const scheduler = new HostTimerScheduler({
    now: (): number => {
      if (reenter) {
        reenter = false;
        handle.transition("loading");
      }
      return 0;
    },
    setTimeout: () => Object.freeze({ timer: true }),
    clearTimeout: () => undefined,
  });
  const cache = new ResourceCacheCoordinator<string>({ scheduler, staleTimeMs: 5 });
  const handle = cache.acquire("cas");
  const initial = handle.transition("loading");
  reenter = true;
  assertEquals(handle.setIfRevision(initial.revision, "stale"), undefined);
  assertEquals(handle.read(), undefined);
  assertEquals(handle.inspect().revision, initial.revision + 1);
  assertThrows(() => handle.setIfRevision(-1, "invalid"), RangeError);
  handle.release();
});

Deno.test("constructor snapshots limits and validates every hard bound", () => {
  const cache = new ResourceCacheCoordinator<number>();
  const options = {
    maxInFlightGenerations: 2,
    maxActiveHandles: 3,
    maxHandlesPerGeneration: 2,
    maxInspectionGenerations: 1,
    maxDiagnostics: 0,
    maxDepth: 4,
    maxNodes: 8,
    maxContainerEntries: 4,
  };
  const loads = new ResourceLoadCoordinator(cache, options);
  options.maxInFlightGenerations = 99;
  assertEquals(loads.inspect().maxInFlightGenerations, 2);
  assertEquals(loads.inspect().snapshotLimits, {
    maxDepth: 4,
    maxNodes: 8,
    maxContainerEntries: 4,
  });
  assertThrows(() => new ResourceLoadCoordinator(cache, { maxInFlightGenerations: 0 }), ResourceLoadConfigurationError);
  assertThrows(
    () => new ResourceLoadCoordinator(cache, { maxActiveHandles: Infinity }),
    ResourceLoadConfigurationError,
  );
  assertThrows(() => new ResourceLoadCoordinator(cache, { maxDepth: -1 }), ResourceLoadConfigurationError);
  assertThrows(
    () => new ResourceLoadCoordinator(cache, { unknown: true } as never),
    ResourceLoadConfigurationError,
  );
  loads.dispose();

  const timerCache = new ResourceCacheCoordinator<number>({
    scheduler: new VirtualTimerScheduler(),
    staleTimeMs: 5,
  });
  const timerLoads = new ResourceLoadCoordinator(timerCache);
  timerLoads.dispose();
});
