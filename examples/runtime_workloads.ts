import { AsyncScheduler, createRuntimeWorkloadRegistry, runTaskBatch, WorkerPool } from "../mod.ts";

const scheduler = new AsyncScheduler({ concurrency: 1 });
const pool = new WorkerPool<number[], number>({
  workerUrl: new URL("./workers/sum_worker.ts", import.meta.url),
  size: 2,
  name: "deno-tui-workload-demo",
});
const workloads = createRuntimeWorkloadRegistry([
  { id: "ui-scheduler", label: "UI Scheduler", inspect: () => scheduler.inspect() },
  { id: "sum-workers", label: "Sum Workers", inspect: () => pool.inspect() },
]);

try {
  const scheduled = runTaskBatch([
    { input: "visible-panel", priority: 20, task: async (id) => `${id}:${await delay(20)}` },
    { input: "background-panel", priority: 1, task: async (id) => `${id}:${await delay(20)}` },
  ], { scheduler });
  const workerJobs = [
    pool.run([1, 2, 3]),
    pool.run([10, 20, 30]),
    pool.run([100, 200, 300]),
  ];

  console.log("Runtime workload registry demo");
  console.log(workloads.markdown({ title: "Initial Runtime Pressure" }));
  console.log("");

  const [scheduledResults, workerResults] = await Promise.all([
    scheduled,
    Promise.all(workerJobs),
  ]);

  console.log("Scheduled results:");
  for (const result of scheduledResults) {
    console.log(`  ${result.index}: ${result.value}`);
  }
  console.log(`Worker results: ${workerResults.join(", ")}`);
  console.log("");
  console.log(workloads.markdown({ title: "Settled Runtime Pressure" }));
} finally {
  pool.terminate();
}

function delay(ms: number): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(`${ms}ms`), ms));
}
