import { assertEquals } from "./deps.ts";
import { detectRuntimeCapabilities } from "../src/runtime/capabilities.ts";
import { AsyncScheduler } from "../src/runtime/scheduler.ts";
import { createPersistentSignal, createRuntimeStore, MemoryStore } from "../src/runtime/storage.ts";
import { WorkerPool } from "../src/runtime/worker_pool.ts";

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
