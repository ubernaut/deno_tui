import { AsyncScheduler, createCachedDataPipeline, filterRows, mapRows, MemoryStore, sortRows } from "../mod.ts";

interface ProcessSample {
  pid: number;
  name: string;
  cpu: number;
}

const source: ProcessSample[] = [
  { pid: 42, name: "renderer", cpu: 0.62 },
  { pid: 7, name: "worker", cpu: 0.81 },
  { pid: 13, name: "shell", cpu: 0.14 },
  { pid: 99, name: "indexer", cpu: 0.47 },
];

const store = new MemoryStore<string[]>();
const scheduler = new AsyncScheduler({ concurrency: 2 });
const pipeline = createCachedDataPipeline<ProcessSample[], string[], string[]>([
  filterRows<ProcessSample>((row) => row.cpu >= 0.25),
  sortRows<ProcessSample>((left, right) => right.cpu - left.cpu),
  mapRows<ProcessSample, string>((row) =>
    `${row.pid.toString().padStart(3, " ")} ${row.name.padEnd(8, " ")} ${
      Math.round(row.cpu * 100).toString().padStart(3, " ")
    }%`
  ),
], {
  store,
  scheduler,
  priority: 5,
  key: "processes:hot",
});

console.log("Cached data pipeline demo");
console.log(`initial restore: ${await pipeline.restore(source) ?? "empty"}`);

const first = await pipeline.run(source);
console.log(`first run: ${first.status} revision=${first.revision}`);
for (const row of first.value ?? []) {
  console.log(`  ${row}`);
}

const restored = await pipeline.restore(source);
console.log("");
console.log(`restored from cache: ${restored?.length ?? 0} rows`);
console.log(`inspection: ${JSON.stringify(pipeline.inspect())}`);
