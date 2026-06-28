import { assertEquals } from "./deps.ts";
import { detectRuntimeCapabilities } from "../src/runtime/capabilities.ts";
import { AsyncScheduler } from "../src/runtime/scheduler.ts";
import { createPersistentSignal, createRuntimeStore, MemoryStore } from "../src/runtime/storage.ts";
import { type WorkerLike, WorkerPool, WorkerPoolTerminatedError } from "../src/runtime/worker_pool.ts";

Deno.test("detectRuntimeCapabilities accepts an injected scope", () => {
  const scope = {
    Worker: class {},
    navigator: { gpu: {} },
    indexedDB: {},
  } as unknown as typeof globalThis;

  assertEquals(detectRuntimeCapabilities(scope), {
    workers: true,
    webgpu: true,
    webgl: false,
    offscreenCanvas: false,
    indexedDb: true,
  });
});

Deno.test("AsyncScheduler respects the configured concurrency limit", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const order: string[] = [];

  const first = scheduler.run(async () => {
    order.push("first:start");
    await Promise.resolve();
    order.push("first:end");
  });
  const second = scheduler.run(() => {
    order.push("second");
  });

  await Promise.all([first, second]);
  assertEquals(order, ["first:start", "first:end", "second"]);
});

Deno.test("AsyncScheduler runs higher priority queued tasks first", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const order: string[] = [];
  const releaseFirst = deferred<void>();

  const first = scheduler.run(async () => {
    order.push("first");
    await releaseFirst.promise;
  });
  const low = scheduler.run(() => order.push("low"), { priority: 0 });
  const high = scheduler.run(() => order.push("high"), { priority: 10 });

  assertEquals(scheduler.running(), 1);
  assertEquals(scheduler.pending(), 2);

  releaseFirst.resolve();
  await Promise.all([first, low, high]);

  assertEquals(order, ["first", "high", "low"]);
});

Deno.test("AsyncScheduler aborts pending tasks", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const releaseFirst = deferred<void>();
  const controller = new AbortController();
  let ran = false;

  const first = scheduler.run(() => releaseFirst.promise);
  const second = scheduler.run(() => {
    ran = true;
  }, { signal: controller.signal }).catch((error) => error);

  assertEquals(scheduler.pending(), 1);
  controller.abort();
  const error = await second;

  assertEquals(error.name, "AbortError");
  assertEquals(ran, false);
  assertEquals(scheduler.pending(), 0);

  releaseFirst.resolve();
  await first;
});

Deno.test("AsyncScheduler inspects capacity and waits for idle", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const releaseFirst = deferred<void>();
  const order: string[] = [];

  const first = scheduler.run(async () => {
    order.push("first:start");
    await releaseFirst.promise;
    order.push("first:end");
  });
  const second = scheduler.run(() => order.push("second"));
  const idle = scheduler.waitForIdle().then(() => order.push("idle"));

  assertEquals(scheduler.capacity(), 1);
  assertEquals(scheduler.idle(), false);
  assertEquals(scheduler.inspect(), { concurrency: 1, running: 1, pending: 1, idle: false });

  releaseFirst.resolve();
  await Promise.all([first, second, idle]);

  assertEquals(scheduler.inspect(), { concurrency: 1, running: 0, pending: 0, idle: true });
  assertEquals(order, ["first:start", "first:end", "second", "idle"]);
});

Deno.test("AsyncScheduler can clear queued work without stopping active work", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const releaseFirst = deferred<void>();
  let ran = false;
  const reason = new Error("cancel queued");

  const first = scheduler.run(() => releaseFirst.promise);
  const second = scheduler.run(() => {
    ran = true;
  }).catch((error) => error);

  assertEquals(scheduler.clearPending(reason), 1);
  assertEquals(await second, reason);
  assertEquals(ran, false);
  assertEquals(scheduler.inspect(), { concurrency: 1, running: 1, pending: 0, idle: false });

  releaseFirst.resolve();
  await first;
  await scheduler.waitForIdle();
  assertEquals(scheduler.idle(), true);
});

Deno.test("MemoryStore implements the async store contract", async () => {
  const store = new MemoryStore<number>();
  await store.set("answer", 42);
  assertEquals(await store.get("answer"), 42);
  await store.delete("answer");
  assertEquals(await store.get("answer"), undefined);
});

Deno.test("createRuntimeStore falls back to memory without IndexedDB", async () => {
  const store = createRuntimeStore<number>({
    databaseName: "deno-tui-test",
    scope: {} as typeof globalThis,
  });

  await store.set("answer", 42);
  assertEquals(await store.get("answer"), 42);
});

Deno.test("PersistentSignal loads, persists, and resets values", async () => {
  const store = new MemoryStore<number>();
  await store.set("count", 7);
  const persisted = createPersistentSignal({
    key: "count",
    initialValue: 0,
    store,
  });

  assertEquals(persisted.value.peek(), 0);
  assertEquals(await persisted.ready, 7);
  assertEquals(persisted.value.peek(), 7);

  persisted.update((value) => value + 1);
  await persisted.flush();
  assertEquals(await store.get("count"), 8);

  await persisted.reset();
  assertEquals(persisted.value.peek(), 0);
  assertEquals(await store.get("count"), undefined);
});

Deno.test("PersistentSignal preserves local changes made before storage is ready", async () => {
  const store = new DeferredStore<number>();
  const persisted = createPersistentSignal({
    key: "count",
    initialValue: 0,
    store,
  });

  persisted.set(5);
  store.resolveGet(2);

  assertEquals(await persisted.ready, 5);
  await persisted.flush();
  assertEquals(await store.get("count"), 5);
});

Deno.test("WorkerPool runs module worker jobs", async () => {
  const workerUrl = new URL("./fixtures/sum_worker.ts", import.meta.url);
  const permission = await Deno.permissions.query({ name: "read", path: workerUrl });
  if (permission.state !== "granted") {
    return;
  }

  const pool = new WorkerPool<number[], number>({
    workerUrl,
    size: 2,
    name: "deno-tui-test",
  });

  try {
    assertEquals(await Promise.all([pool.run([1, 2]), pool.run([3, 4])]), [3, 7]);
  } finally {
    pool.terminate();
  }
});

Deno.test("WorkerPool exposes pending work and ignores aborted worker responses", async () => {
  const workers: TestWorker[] = [];
  const pool = new WorkerPool<number, number>({
    workerUrl: new URL("./fixtures/sum_worker.ts", import.meta.url),
    size: 2,
    workerFactory: (_url, _options) => {
      const worker = new TestWorker();
      workers.push(worker);
      return worker;
    },
  });
  const controller = new AbortController();
  const aborted = pool.run(4, { signal: controller.signal }).catch((error) => error);

  assertEquals(pool.size, 2);
  assertEquals(pool.pendingCount(), 1);
  assertEquals(workers[0].messages, [{ id: 1, payload: 4 }]);

  controller.abort();
  const error = await aborted;
  assertEquals(error.name, "AbortError");
  assertEquals(pool.pendingCount(), 0);

  workers[0].respond({ id: 1, ok: true, result: 8 });
  assertEquals(pool.pendingCount(), 0);
  pool.terminate();
});

Deno.test("WorkerPool rejects queued work when terminated", async () => {
  const pool = new WorkerPool<number, number>({
    workerUrl: new URL("./fixtures/sum_worker.ts", import.meta.url),
    size: 1,
    workerFactory: () => new TestWorker(),
  });

  pool.terminate();
  const error = await pool.run(1).catch((caught) => caught);
  assertEquals(error instanceof WorkerPoolTerminatedError, true);
});

class DeferredStore<T> extends MemoryStore<T> {
  #deferred = false;
  #pendingGet:
    | {
      resolve: (value: T | undefined) => void;
      key: string;
    }
    | undefined;

  override get(key: string): Promise<T | undefined> {
    if (this.#deferred || this.#pendingGet) return super.get(key);
    this.#deferred = true;
    return new Promise((resolve) => {
      this.#pendingGet = { resolve, key };
    });
  }

  resolveGet(value: T | undefined): void {
    const pending = this.#pendingGet;
    if (!pending) return;
    this.#pendingGet = undefined;
    pending.resolve(value);
  }
}

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

class TestWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly messages: unknown[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(message: unknown): void {
    this.onmessage?.({ data: message } as MessageEvent<unknown>);
  }
}
