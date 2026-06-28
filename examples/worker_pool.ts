import { formatRuntimeWorkloadMarkdown, WorkerPool } from "../mod.ts";

const pool = new WorkerPool<number[], number>({
  workerUrl: new URL("./workers/sum_worker.ts", import.meta.url),
  size: 2,
  name: "deno-tui-demo",
});

try {
  const jobs = [
    pool.run([1, 2, 3]),
    pool.run([10, 20, 30]),
    pool.run([100, 200, 300]),
  ];
  console.log(formatRuntimeWorkloadMarkdown({
    title: "Worker Pool Telemetry",
    sources: [{ id: "sum-workers", label: "Sum Workers", inspect: () => pool.inspect() }],
  }));
  console.log("");
  const results = await Promise.all(jobs);
  console.log(results.join(", "));
} finally {
  pool.terminate();
}
