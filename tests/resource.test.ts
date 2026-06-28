import { assertEquals } from "./deps.ts";
import { AsyncResourceParamsError, createAsyncResource, createCachedAsyncResource } from "../src/runtime/resource.ts";
import { bindResourceParams } from "../src/runtime/resource_bindings.ts";
import { AsyncScheduler } from "../src/runtime/scheduler.ts";
import { MemoryStore } from "../src/runtime/storage.ts";
import { Signal } from "../src/signals/mod.ts";

Deno.test("AsyncResource loads data into signal state", async () => {
  const resource = createAsyncResource({
    loader: ({ params }: { params: number }) => params * 2,
  });

  const state = await resource.load(21);

  assertEquals(state.status, "success");
  assertEquals(state.data, 42);
  assertEquals(resource.state.peek(), {
    status: "success",
    data: 42,
    params: 21,
    revision: 1,
  });
});

Deno.test("AsyncResource keeps latest result and aborts stale work", async () => {
  let firstAborted = false;
  let releaseFirst: (() => void) | undefined;
  const resource = createAsyncResource<number, number>({
    loader: async ({ params, signal }) => {
      if (params === 1) {
        signal.addEventListener("abort", () => {
          firstAborted = true;
        });
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return params * 10;
    },
  });

  const first = resource.load(1);
  const second = resource.load(2);

  assertEquals(firstAborted, true);
  assertEquals(await second, { status: "success", data: 20, params: 2, revision: 2 });
  releaseFirst?.();
  assertEquals(await first, { status: "success", data: 20, params: 2, revision: 2 });
});

Deno.test("AsyncResource records errors while preserving previous data", async () => {
  const error = new Error("nope");
  const resource = createAsyncResource<number, number>({
    initialData: 5,
    loader: () => {
      throw error;
    },
  });

  const state = await resource.load(1);

  assertEquals(state, {
    status: "error",
    data: 5,
    error,
    params: 1,
    revision: 1,
  });
});

Deno.test("AsyncResource can reload reset and require params", async () => {
  let calls = 0;
  const resource = createAsyncResource<number, number>({
    loader: ({ params }) => {
      calls += 1;
      return params + calls;
    },
  });

  try {
    await resource.reload();
    throw new Error("expected reload to fail");
  } catch (error) {
    assertEquals(error instanceof AsyncResourceParamsError, true);
  }

  assertEquals((await resource.load(10)).data, 11);
  assertEquals((await resource.reload()).data, 12);

  resource.reset();
  assertEquals(resource.state.peek(), { status: "idle", data: undefined, revision: 3 });
});

Deno.test("CachedAsyncResource restores and persists serialized resource data", async () => {
  const store = new MemoryStore<{ value: number; source: string }>();
  await store.set("metric:cpu", { value: 7, source: "cache" });
  const loaded: string[] = [];
  const resource = createCachedAsyncResource<string, number, { value: number; source: string }>({
    store,
    key: (params) => `metric:${params}`,
    deserialize: (stored) => stored.value,
    serialize: (value, params) => ({ value, source: params }),
    loader: ({ params }) => {
      loaded.push(params);
      return params.length * 10;
    },
  });

  const restored = await resource.restore("cpu");
  assertEquals(restored, { status: "success", data: 7, params: "cpu", revision: 1 });
  assertEquals(resource.inspect(), {
    status: "success",
    data: 7,
    params: "cpu",
    revision: 1,
    loading: false,
    hasData: true,
    hasError: false,
    aborted: false,
    cached: true,
    key: "metric:cpu",
  });

  const loadedState = await resource.load("cpu");
  assertEquals(loadedState, { status: "success", data: 30, params: "cpu", revision: 2 });
  assertEquals(loaded, ["cpu"]);
  assertEquals(await store.get("metric:cpu"), { value: 30, source: "cpu" });
  assertEquals(resource.inspect().cached, false);
});

Deno.test("CachedAsyncResource only persists the latest successful load", async () => {
  const store = new MemoryStore<number>();
  let releaseFirst: (() => void) | undefined;
  const resource = createCachedAsyncResource<number, number>({
    store,
    key: (params) => `value:${params}`,
    loader: async ({ params }) => {
      if (params === 1) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return params * 10;
    },
  });

  const first = resource.load(1);
  const second = resource.load(2);

  assertEquals(await second, { status: "success", data: 20, params: 2, revision: 2 });
  releaseFirst?.();
  assertEquals(await first, { status: "success", data: 20, params: 2, revision: 2 });
  assertEquals(await store.get("value:1"), undefined);
  assertEquals(await store.get("value:2"), 20);
});

Deno.test("CachedAsyncResource can clear cache entries and isolate cache errors", async () => {
  const errors: unknown[] = [];
  const store = {
    async get(_key: string): Promise<number | undefined> {
      throw new Error("read failed");
    },
    async set(_key: string, _value: number): Promise<void> {
      throw new Error("write failed");
    },
    async delete(_key: string): Promise<void> {
      throw new Error("delete failed");
    },
  };
  const resource = createCachedAsyncResource<number, number>({
    store,
    key: (params) => `n:${params}`,
    onCacheError: (error) => errors.push(error),
    loader: ({ params }) => params + 1,
  });

  assertEquals(await resource.restore(1), undefined);
  assertEquals((await resource.load(1)).data, 2);
  await resource.clear(1);
  assertEquals(errors.length, 3);

  const memory = new MemoryStore<number>();
  const cached = createCachedAsyncResource<number, number>({
    store: memory,
    key: (params) => `n:${params}`,
    loader: ({ params }) => params,
  });
  await cached.load(3);
  assertEquals(await memory.get("n:3"), 3);
  await cached.clear();
  assertEquals(await memory.get("n:3"), undefined);
  assertEquals(cached.inspect().key, undefined);
});

Deno.test("AsyncResource inspects current loading data and error state", async () => {
  const error = new Error("broken");
  const resource = createAsyncResource<number, number>({
    initialData: 7,
    loader: ({ params }) => {
      if (params < 0) throw error;
      return params * 2;
    },
  });

  assertEquals(resource.inspect(), {
    status: "success",
    data: 7,
    params: undefined,
    revision: 0,
    loading: false,
    hasData: true,
    hasError: false,
    aborted: false,
  });

  await resource.load(-1);
  assertEquals(resource.inspect(), {
    status: "error",
    data: 7,
    error,
    params: -1,
    revision: 1,
    loading: false,
    hasData: true,
    hasError: true,
    aborted: false,
  });
  resource.dispose();
});

Deno.test("AsyncResource can run loaders through a scheduler", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const order: string[] = [];
  const resource = createAsyncResource({
    scheduler,
    loader: async ({ params }: { params: string }) => {
      order.push(params);
      await Promise.resolve();
      return params.toUpperCase();
    },
  });

  assertEquals((await resource.load("a")).data, "A");
  assertEquals(order, ["a"]);
});

Deno.test("AsyncResource cancels stale queued scheduler work and applies priority", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const releaseBlocker = deferred<void>();
  const ran: string[] = [];
  const blocker = scheduler.run(() => releaseBlocker.promise);
  const resource = createAsyncResource<number, number>({
    scheduler,
    priority: (params) => params,
    loader: ({ params }) => {
      ran.push(`${params}`);
      return params * 10;
    },
  });

  const stale = resource.load(1);
  const latest = resource.load(5);

  assertEquals(scheduler.pending(), 1);
  assertEquals(await stale, { status: "loading", data: undefined, params: 5, revision: 2 });
  releaseBlocker.resolve();
  await blocker;

  assertEquals(await latest, { status: "success", data: 50, params: 5, revision: 2 });
  assertEquals(ran, ["5"]);
});

Deno.test("bindResourceParams loads resources from signal params", async () => {
  const loaded: number[] = [];
  const params = new Signal(2);
  const resource = createAsyncResource<number, number>({
    loader: ({ params }) => {
      loaded.push(params);
      return params * 2;
    },
  });

  const dispose = bindResourceParams(resource, params);
  await settle();

  assertEquals(resource.state.peek().data, 4);
  assertEquals(loaded, [2]);

  params.value = 7;
  await settle();

  assertEquals(resource.state.peek().data, 14);
  assertEquals(loaded, [2, 7]);

  dispose();
  params.value = 9;
  await settle();
  assertEquals(loaded, [2, 7]);
});

Deno.test("bindResourceParams debounces rapid param changes", async () => {
  const loaded: number[] = [];
  const params = new Signal(0);
  const resource = createAsyncResource<number, number>({
    loader: ({ params }) => {
      loaded.push(params);
      return params;
    },
  });

  const binding = bindResourceParams(resource, params, { initialLoad: false, debounceMs: 5 });
  params.value = 1;
  params.value = 2;
  params.value = 3;

  assertEquals(binding.inspect().pending, true);
  await delay(15);
  await settle();

  assertEquals(loaded, [3]);
  assertEquals(resource.state.peek().data, 3);
  assertEquals(binding.inspect().pending, false);
  binding.dispose();
});

Deno.test("bindResourceParams can abort active resources on dispose", async () => {
  let aborted = false;
  const release = deferred<void>();
  const params = new Signal("first");
  const resource = createAsyncResource<string, string>({
    loader: async ({ params, signal }) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        release.resolve();
      });
      await release.promise;
      return params;
    },
  });

  const dispose = bindResourceParams(resource, params, { abortOnDispose: true });
  await settle();
  dispose();
  await release.promise;

  assertEquals(aborted, true);
});

Deno.test("bindResourceParams exposes flush abort inspect and callable dispose", async () => {
  const loaded: number[] = [];
  const params = new Signal(1);
  const resource = createAsyncResource<number, number>({
    loader: ({ params }) => {
      loaded.push(params);
      return params * 10;
    },
  });

  const binding = bindResourceParams(resource, params, {
    initialLoad: false,
    debounceMs: 50,
    abortOnDispose: true,
  });
  params.value = 2;

  assertEquals(binding.inspect().pending, true);
  assertEquals(binding.inspect().disposed, false);
  binding.flush();
  await settle();

  assertEquals(loaded, [2]);
  assertEquals(binding.inspect().resource.data, 20);

  params.value = 3;
  binding.abort();
  assertEquals(binding.inspect().pending, false);
  await delay(60);
  assertEquals(loaded, [2]);

  binding();
  assertEquals(binding.inspect().disposed, true);
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function settle(): Promise<void> {
  return delay(0);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
