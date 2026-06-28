import { assertEquals } from "./deps.ts";
import {
  createRuntimePlan,
  detectRuntimeCapabilities,
  formatRuntimeCapabilities,
  formatRuntimePlan,
  runtimeCapabilityEntries,
  summarizeRuntimeCapabilities,
} from "../src/runtime/capabilities.ts";
import {
  createRuntimeProfileCatalogReport,
  createRuntimeProfileController,
  createRuntimeProfileRegistry,
  findRuntimeProfile,
  formatRuntimeProfileCatalogMarkdown,
  inspectRuntimeProfileCatalog,
  queryRuntimeProfiles,
  runtimeProfiles,
} from "../src/runtime/profiles.ts";
import {
  createRuntimeRendererBackendCatalogReport,
  createRuntimeRendererBackendRegistry,
  formatRuntimeRendererBackendCatalogMarkdown,
  inspectRuntimeRendererBackendCatalog,
  queryRuntimeRendererBackends,
  runtimeRendererBackends,
  selectRuntimeRendererBackend,
} from "../src/runtime/renderer_backends.ts";
import { AsyncScheduler, runTaskBatch } from "../src/runtime/scheduler.ts";
import {
  createRuntimeWorkloadReport,
  formatRuntimeWorkloadMarkdown,
  inspectRuntimeWorkload,
} from "../src/runtime/telemetry.ts";
import { createRenderLoop, RenderLoop } from "../src/runtime/render_loop.ts";
import { createPersistentSignal, createRuntimeStore, MemoryStore } from "../src/runtime/storage.ts";
import { runWorkerBatch, type WorkerLike, WorkerPool, WorkerPoolTerminatedError } from "../src/runtime/worker_pool.ts";

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

Deno.test("runtime capability helpers expose labeled summaries", () => {
  const capabilities = {
    workers: true,
    webgpu: false,
    webgl: true,
    offscreenCanvas: false,
    indexedDb: true,
  };

  assertEquals(runtimeCapabilityEntries(capabilities).map((entry) => [entry.id, entry.label, entry.available]), [
    ["workers", "Workers", true],
    ["webgpu", "WebGPU", false],
    ["webgl", "WebGL", true],
    ["offscreenCanvas", "OffscreenCanvas", false],
    ["indexedDb", "IndexedDB", true],
  ]);
  assertEquals(summarizeRuntimeCapabilities(capabilities).available, 3);
  assertEquals(summarizeRuntimeCapabilities(capabilities).missing, 2);
  assertEquals(
    formatRuntimeCapabilities(capabilities),
    [
      "Runtime capabilities: 3/5 available",
      "ok Workers",
      "missing WebGPU",
      "ok WebGL",
      "missing OffscreenCanvas",
      "ok IndexedDB",
    ].join("\n"),
  );
});

Deno.test("runtime plans choose worker storage and renderer strategies", () => {
  const fullPlan = createRuntimePlan({
    workers: true,
    webgpu: true,
    webgl: true,
    offscreenCanvas: true,
    indexedDb: true,
  });

  assertEquals(fullPlan.workers.strategy, "worker-pool");
  assertEquals(fullPlan.storage.strategy, "indexeddb");
  assertEquals(fullPlan.renderer.strategy, "webgpu");
  assertEquals(fullPlan.renderer.accelerated, true);

  const fallbackPlan = createRuntimePlan({
    workers: false,
    webgpu: false,
    webgl: true,
    offscreenCanvas: true,
    indexedDb: false,
  });

  assertEquals(fallbackPlan.workers.strategy, "main-thread");
  assertEquals(fallbackPlan.storage.strategy, "memory");
  assertEquals(fallbackPlan.renderer.strategy, "webgl");
  assertEquals(formatRuntimePlan(fallbackPlan).includes("renderer webgl"), true);

  const conservativePlan = createRuntimePlan({
    workers: true,
    webgpu: true,
    webgl: true,
    offscreenCanvas: true,
    indexedDb: true,
  }, {
    preferWorkers: false,
    preferPersistentStorage: false,
    preferGpuRenderer: false,
  });

  assertEquals(conservativePlan.workers.strategy, "main-thread");
  assertEquals(conservativePlan.storage.strategy, "memory");
  assertEquals(conservativePlan.renderer.strategy, "cpu");
});

Deno.test("runtime profiles expose named strategy policies", () => {
  const capabilities = {
    workers: true,
    webgpu: false,
    webgl: true,
    offscreenCanvas: true,
    indexedDb: false,
  };
  const registry = createRuntimeProfileRegistry();

  assertEquals(registry.ids(), ["balanced", "throughput", "portable", "ephemeral"]);
  assertEquals(runtimeProfiles().map((profile) => profile.id), [
    "balanced",
    "throughput",
    "portable",
    "ephemeral",
  ]);
  assertEquals(findRuntimeProfile("Throughput")?.id, "throughput");
  assertEquals(registry.plan("balanced", capabilities).renderer.strategy, "webgl");
  assertEquals(registry.plan("portable", capabilities), {
    capabilities,
    workers: {
      strategy: "main-thread",
      accelerated: false,
      reason: "Worker usage was disabled by runtime plan preferences.",
    },
    storage: {
      strategy: "memory",
      accelerated: false,
      reason: "IndexedDB is unavailable, so settings should use memory or a custom store.",
    },
    renderer: {
      strategy: "cpu",
      accelerated: false,
      reason: "GPU renderer usage was disabled by runtime plan preferences.",
    },
  });
  assertEquals(registry.unregister("ephemeral"), true);
  assertEquals(registry.has("ephemeral"), false);
});

Deno.test("RuntimeProfileController selects profiles and derives plans", () => {
  const invalid: string[] = [];
  const controller = createRuntimeProfileController({
    activeId: "throughput",
    capabilities: {
      workers: true,
      webgpu: false,
      webgl: true,
      offscreenCanvas: true,
      indexedDb: true,
    },
    onInvalidProfile: (id) => invalid.push(id),
  });

  assertEquals(controller.activeId.peek(), "throughput");
  assertEquals(controller.plan()?.renderer.strategy, "webgl");
  assertEquals(controller.nextProfile(), "portable");
  assertEquals(controller.previousProfile(), "throughput");
  assertEquals(controller.setProfile("missing"), false);
  assertEquals(invalid, ["missing"]);

  controller.activeId.value = "missing";
  assertEquals(controller.activeId.peek(), "balanced");
  assertEquals(invalid, ["missing", "missing"]);
  assertEquals(controller.inspect().active?.id, "balanced");
  assertEquals(controller.catalog({ tag: "performance" }).profiles.map((profile) => profile.id), ["throughput"]);
});

Deno.test("runtime profile catalogs filter inspect and format reports", () => {
  const capabilities = {
    workers: true,
    webgpu: true,
    webgl: true,
    offscreenCanvas: true,
    indexedDb: true,
  };
  const profiles = queryRuntimeProfiles(runtimeProfiles(), { rendererStrategy: "webgpu" }, capabilities);
  const portable = queryRuntimeProfiles(runtimeProfiles(), { search: "portable", accelerated: false }, {
    ...capabilities,
    indexedDb: false,
  });
  const report = createRuntimeProfileCatalogReport({
    capabilities,
    query: { tag: "performance" },
  });
  const markdown = formatRuntimeProfileCatalogMarkdown({
    capabilities,
    query: { storageStrategy: "memory" },
    title: "Memory Profiles",
  });

  assertEquals(profiles.map((profile) => profile.id), ["balanced", "throughput", "ephemeral"]);
  assertEquals(portable.map((profile) => profile.id), ["portable"]);
  assertEquals(report.profiles.map((profile) => profile.id), ["throughput"]);
  assertEquals(inspectRuntimeProfileCatalog(report.profiles), {
    count: 1,
    accelerated: 1,
    workerStrategies: ["worker-pool"],
    storageStrategies: ["indexeddb"],
    rendererStrategies: ["webgpu"],
    tags: ["performance", "visualization"],
  });
  assertEquals(
    markdown,
    [
      "# Memory Profiles",
      "",
      "1 profiles, 1 with at least one accelerated strategy.",
      "",
      "| Profile | Workers | Storage | Renderer | Tags |",
      "| --- | --- | --- | --- | --- |",
      "| Ephemeral | worker-pool | memory | webgpu | memory, testing |",
    ].join("\n"),
  );
});

Deno.test("runtime renderer backends select capability-aware render paths", () => {
  const capabilities = {
    workers: true,
    webgpu: false,
    webgl: true,
    offscreenCanvas: true,
    indexedDb: false,
  };
  const registry = createRuntimeRendererBackendRegistry();

  assertEquals(registry.ids(), ["webgpu-three-ascii", "webgl-canvas", "terminal-cpu"]);
  assertEquals(registry.select(capabilities)?.id, "webgl-canvas");
  assertEquals(registry.select({ ...capabilities, webgl: false })?.id, "terminal-cpu");
  assertEquals(registry.select({ ...capabilities, webgl: false }, { allowCpuFallback: false }), undefined);
  assertEquals(selectRuntimeRendererBackend(runtimeRendererBackends(), capabilities, { tag: "ascii" }), undefined);
  assertEquals(
    selectRuntimeRendererBackend(runtimeRendererBackends(), { ...capabilities, webgpu: true }, { tag: "ascii" })?.id,
    "webgpu-three-ascii",
  );

  registry.unregister("webgl-canvas");
  assertEquals(registry.has("webgl-canvas"), false);
});

Deno.test("runtime renderer backend catalogs query inspect and format reports", () => {
  const capabilities = {
    workers: false,
    webgpu: true,
    webgl: false,
    offscreenCanvas: false,
    indexedDb: false,
  };
  const queried = queryRuntimeRendererBackends(runtimeRendererBackends(), { search: "ascii gpu" }, capabilities);
  const report = createRuntimeRendererBackendCatalogReport({
    capabilities,
    query: { tag: "gpu" },
  });
  const markdown = formatRuntimeRendererBackendCatalogMarkdown({
    capabilities,
    query: { available: true },
    title: "Renderers",
  });

  assertEquals(queried.map((backend) => backend.id), ["webgpu-three-ascii"]);
  assertEquals(report.backends.map((backend) => [backend.id, backend.available, backend.missingCapabilities]), [
    ["webgpu-three-ascii", true, []],
    ["webgl-canvas", false, ["webgl"]],
  ]);
  assertEquals(inspectRuntimeRendererBackendCatalog(report.backends), {
    count: 2,
    available: 1,
    accelerated: 1,
    strategies: ["webgl", "webgpu"],
    capabilities: ["webgl", "webgpu"],
    tags: ["ascii", "canvas", "fallback", "gpu", "three", "visualization"],
  });
  assertEquals(
    markdown,
    [
      "# Renderers",
      "",
      "2 backends, 2 available, 1 accelerated.",
      "",
      "Selected: WebGPU Three ASCII.",
      "",
      "| Backend | Strategy | Available | Missing | Tags |",
      "| --- | --- | --- | --- | --- |",
      "| WebGPU Three ASCII | webgpu | yes | - | ascii, gpu, three, visualization |",
      "| Terminal CPU | cpu | yes | - | fallback, portable, terminal |",
    ].join("\n"),
  );
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

Deno.test("RenderLoop runs immediate ticks through an injectable timer", () => {
  const timer = new TestRenderLoopTimer();
  const frames: Array<[number, number]> = [];
  const loop = createRenderLoop({
    intervalMs: 25,
    timer,
    tick: ({ frame, deltaMs }) => frames.push([frame, deltaMs]),
  });

  loop.start();
  assertEquals(frames, [[1, 0]]);
  assertEquals(timer.pendingCount(), 1);

  timer.advance(25);
  timer.flushNext();
  assertEquals(frames, [[1, 0], [2, 25]]);
  assertEquals(loop.inspect(), {
    running: true,
    frame: 2,
    intervalMs: 25,
    lastStartedAt: 25,
    lastDurationMs: 0,
    lastError: undefined,
  });

  loop.stop();
  assertEquals(loop.running, false);
  assertEquals(timer.pendingCount(), 0);
});

Deno.test("RenderLoop supports delayed start manual steps and interval updates", () => {
  const timer = new TestRenderLoopTimer();
  const frames: number[] = [];
  const loop = new RenderLoop({
    intervalMs: 10,
    immediate: false,
    timer,
    tick: ({ frame }) => frames.push(frame),
  });

  loop.start();
  assertEquals(frames, []);
  assertEquals(timer.lastDelay(), 10);

  loop.intervalMs = 5;
  loop.step();
  assertEquals(frames, [1]);
  timer.advance(10);
  timer.flushNext();
  assertEquals(frames, [1, 2]);
  assertEquals(timer.lastDelay(), 5);
});

Deno.test("RenderLoop reports errors and stops after failed ticks", () => {
  const timer = new TestRenderLoopTimer();
  const errors: unknown[] = [];
  const failure = new Error("render failed");
  const loop = createRenderLoop({
    timer,
    onError: (error) => errors.push(error),
    tick: () => {
      throw failure;
    },
  });

  loop.start();
  assertEquals(loop.running, false);
  assertEquals(errors, [failure]);
  assertEquals(loop.inspect().lastError, failure);
  assertEquals(timer.pendingCount(), 0);
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

Deno.test("AsyncScheduler schedule exposes cancellable task handles", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const releaseFirst = deferred<void>();
  const cancelReason = new Error("no longer visible");
  let ran = false;

  const first = scheduler.schedule(() => releaseFirst.promise, { priority: 1 });
  const second = scheduler.schedule(() => {
    ran = true;
    return "second";
  }, { priority: 5 });

  assertEquals(first.inspect(), { priority: 1, sequence: 0, status: "running" });
  assertEquals(second.inspect(), { priority: 5, sequence: 1, status: "queued" });
  assertEquals(second.cancel(cancelReason), true);
  assertEquals(second.inspect(), { priority: 5, sequence: 1, status: "cancelled" });
  assertEquals(second.cancel(), false);
  assertEquals(await second.promise.catch((error) => error), cancelReason);
  assertEquals(ran, false);

  releaseFirst.resolve();
  await first.promise;
  assertEquals(first.inspect(), { priority: 1, sequence: 0, status: "settled" });
  assertEquals(scheduler.inspect(), { concurrency: 1, running: 0, pending: 0, idle: true });
});

Deno.test("AsyncScheduler schedule handles running and aborted task states", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const controller = new AbortController();
  const releaseFirst = deferred<void>();

  const first = scheduler.schedule(() => releaseFirst.promise);
  const aborted = scheduler.schedule(() => "never", { signal: controller.signal });
  controller.abort();

  assertEquals(aborted.inspect().status, "cancelled");
  assertEquals(await aborted.promise.catch((error) => error.name), "AbortError");
  assertEquals(first.cancel(), false);
  assertEquals(first.inspect().status, "running");

  releaseFirst.resolve();
  await first.promise;
  assertEquals(first.inspect().status, "settled");
});

Deno.test("runTaskBatch preserves input order while using scheduler priority", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const releaseFirst = deferred<void>();
  const execution: number[] = [];

  const batch = runTaskBatch([
    {
      input: 1,
      priority: 0,
      task: async (value) => {
        execution.push(value);
        await releaseFirst.promise;
        return value * 10;
      },
    },
    { input: 2, priority: 0 },
    { input: 3, priority: 10 },
  ], {
    scheduler,
    task: (value) => {
      execution.push(value);
      return value * 10;
    },
  });

  await Promise.resolve();
  assertEquals(scheduler.inspect(), { concurrency: 1, running: 1, pending: 2, idle: false });

  releaseFirst.resolve();
  const results = await batch;

  assertEquals(execution, [1, 3, 2]);
  assertEquals(results, [
    { input: 1, index: 0, value: 10 },
    { input: 2, index: 1, value: 20 },
    { input: 3, index: 2, value: 30 },
  ]);
});

Deno.test("runTaskBatch supports abortable batch work", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const releaseFirst = deferred<void>();
  const controller = new AbortController();

  const batch = runTaskBatch([1, 2], {
    scheduler,
    signal: controller.signal,
    task: async (value) => {
      if (value === 1) await releaseFirst.promise;
      return value;
    },
  }).catch((error) => error);

  await Promise.resolve();
  controller.abort();
  releaseFirst.resolve();

  const error = await batch;
  assertEquals(error.name, "AbortError");
  await scheduler.waitForIdle();
  assertEquals(scheduler.inspect(), { concurrency: 1, running: 0, pending: 0, idle: true });
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

Deno.test("WorkerPool inspects status and waits for idle", async () => {
  const workers: TestWorker[] = [];
  const pool = new WorkerPool<number, number>({
    workerUrl: new URL("./fixtures/sum_worker.ts", import.meta.url),
    size: 2,
    workerFactory: () => {
      const worker = new TestWorker();
      workers.push(worker);
      return worker;
    },
  });
  const order: string[] = [];

  const first = pool.run(1).then((value) => order.push(`first:${value}`));
  const second = pool.run(2).then((value) => order.push(`second:${value}`));
  const idle = pool.waitForIdle().then(() => order.push("idle"));

  assertEquals(pool.inspect(), {
    size: 2,
    pending: 2,
    idle: false,
    terminated: false,
    nextWorkerIndex: 0,
  });
  assertEquals(workers[0].messages, [{ id: 1, payload: 1 }]);
  assertEquals(workers[1].messages, [{ id: 2, payload: 2 }]);

  workers[1].respond({ id: 2, ok: true, result: 20 });
  await Promise.resolve();
  assertEquals(pool.inspect(), {
    size: 2,
    pending: 1,
    idle: false,
    terminated: false,
    nextWorkerIndex: 0,
  });

  workers[0].respond({ id: 1, ok: true, result: 10 });
  await Promise.all([first, second, idle]);

  assertEquals(order, ["second:20", "first:10", "idle"]);
  assertEquals(pool.inspect(), {
    size: 2,
    pending: 0,
    idle: true,
    terminated: false,
    nextWorkerIndex: 0,
  });
  pool.terminate();
});

Deno.test("runtime workload telemetry normalizes schedulers and worker pools", () => {
  const workers: TestWorker[] = [];
  const pool = new WorkerPool<number, number>({
    workerUrl: new URL("./fixtures/sum_worker.ts", import.meta.url),
    size: 2,
    workerFactory: () => {
      const worker = new TestWorker();
      workers.push(worker);
      return worker;
    },
  });
  const jobs = [
    pool.run(1).catch(() => undefined),
    pool.run(2).catch(() => undefined),
    pool.run(3).catch(() => undefined),
  ];

  const schedulerSource = {
    id: "ui-scheduler",
    label: "UI Scheduler",
    inspect: () => ({
      concurrency: 2,
      running: 2,
      pending: 1,
      idle: false,
    }),
  };
  const report = createRuntimeWorkloadReport({
    sources: [
      schedulerSource,
      { id: "workers", label: "Workers", inspect: () => pool.inspect() },
    ],
  });
  const markdown = formatRuntimeWorkloadMarkdown({
    title: "Runtime Pressure",
    sources: [schedulerSource],
  });

  assertEquals(inspectRuntimeWorkload(schedulerSource), {
    id: "ui-scheduler",
    label: "UI Scheduler",
    kind: "scheduler",
    capacity: 2,
    running: 2,
    queued: 1,
    pending: 3,
    saturation: 1.5,
    idle: false,
    terminated: false,
    state: "queued",
  });
  assertEquals(report.workloads.map((workload) => [workload.id, workload.kind, workload.state, workload.saturation]), [
    ["ui-scheduler", "scheduler", "queued", 1.5],
    ["workers", "worker-pool", "queued", 1.5],
  ]);
  assertEquals(report.inspection, {
    count: 2,
    running: 4,
    queued: 2,
    pending: 6,
    capacity: 4,
    saturated: 2,
    terminated: 0,
    idle: false,
    maxSaturation: 1.5,
  });
  assertEquals(
    markdown,
    [
      "# Runtime Pressure",
      "",
      "1 workloads, 3 pending, 1 saturated.",
      "",
      "| Workload | Kind | State | Running | Queued | Capacity | Saturation |",
      "| --- | --- | --- | ---: | ---: | ---: | ---: |",
      "| UI Scheduler | scheduler | queued | 2 | 1 | 2 | 1.50 |",
    ].join("\n"),
  );

  pool.terminate();
  assertEquals(inspectRuntimeWorkload({ id: "workers", inspect: () => pool.inspect() }).state, "terminated");
  void Promise.all(jobs);
});

Deno.test("runWorkerBatch preserves input order while dispatching through the pool", async () => {
  const workers: TestWorker[] = [];
  const pool = new WorkerPool<number, number>({
    workerUrl: new URL("./fixtures/sum_worker.ts", import.meta.url),
    size: 2,
    workerFactory: () => {
      const worker = new TestWorker();
      workers.push(worker);
      return worker;
    },
  });

  const batch = runWorkerBatch(pool, [1, 2, 3]);
  assertEquals(pool.pendingCount(), 3);
  assertEquals(workers[0].messages, [{ id: 1, payload: 1 }, { id: 3, payload: 3 }]);
  assertEquals(workers[1].messages, [{ id: 2, payload: 2 }]);

  workers[1].respond({ id: 2, ok: true, result: 20 });
  workers[0].respond({ id: 3, ok: true, result: 30 });
  workers[0].respond({ id: 1, ok: true, result: 10 });

  assertEquals(await batch, [
    { input: 1, index: 0, value: 10 },
    { input: 2, index: 1, value: 20 },
    { input: 3, index: 2, value: 30 },
  ]);
  assertEquals(pool.idle(), true);
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

class TestRenderLoopTimer {
  #now = 0;
  #nextId = 0;
  #pending = new Map<number, { callback: () => void; delay: number }>();
  #lastDelay = 0;

  setTimeout(callback: () => void, delay: number): number {
    const id = ++this.#nextId;
    this.#lastDelay = delay;
    this.#pending.set(id, { callback, delay });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.#pending.delete(handle as number);
  }

  now(): number {
    return this.#now;
  }

  advance(ms: number): void {
    this.#now += ms;
  }

  flushNext(): void {
    const [id, pending] = this.#pending.entries().next().value ?? [];
    if (id === undefined || pending === undefined) return;
    this.#pending.delete(id);
    pending.callback();
  }

  pendingCount(): number {
    return this.#pending.size;
  }

  lastDelay(): number {
    return this.#lastDelay;
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
