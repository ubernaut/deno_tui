import { assertEquals } from "./deps.ts";
import { AsyncResourceParamsError, createAsyncResource } from "../src/runtime/resource.ts";
import { bindResourceParams } from "../src/runtime/resource_bindings.ts";
import { AsyncScheduler } from "../src/runtime/scheduler.ts";
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

  bindResourceParams(resource, params, { initialLoad: false, debounceMs: 5 });
  params.value = 1;
  params.value = 2;
  params.value = 3;

  await delay(15);
  await settle();

  assertEquals(loaded, [3]);
  assertEquals(resource.state.peek().data, 3);
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
