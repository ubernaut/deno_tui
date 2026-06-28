import { AsyncScheduler, createCachedAsyncResource, MemoryStore } from "../mod.ts";

interface MetricSnapshot {
  id: string;
  value: number;
  label: string;
}

interface StoredMetric {
  value: number;
  label: string;
}

const store = new MemoryStore<StoredMetric>();
await store.set("metric:cpu", { value: 0.42, label: "cached cpu" });

const scheduler = new AsyncScheduler({ concurrency: 1 });
const metrics = createCachedAsyncResource<string, MetricSnapshot, StoredMetric>({
  store,
  scheduler,
  priority: (id) => id.length,
  key: (id) => `metric:${id}`,
  deserialize: (stored, id) => ({ id, value: stored.value, label: stored.label }),
  serialize: (snapshot) => ({ value: snapshot.value, label: snapshot.label }),
  loader: async ({ params, signal }) => {
    await Promise.resolve();
    if (signal.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    return {
      id: params,
      value: params === "cpu" ? 0.91 : 0.37,
      label: `live ${params}`,
    };
  },
});

console.log("Cached async resource demo");

const restored = await metrics.restore("cpu");
console.log(`restored: ${restored?.data?.label ?? "empty"} ${Math.round((restored?.data?.value ?? 0) * 100)}%`);

const loaded = await metrics.load("cpu");
console.log(`loaded: ${loaded.data?.label ?? "none"} ${Math.round((loaded.data?.value ?? 0) * 100)}%`);

const again = await metrics.restore("cpu");
console.log(`restored again: ${again?.data?.label ?? "empty"} ${Math.round((again?.data?.value ?? 0) * 100)}%`);
console.log(`inspection: ${JSON.stringify(metrics.inspect())}`);
