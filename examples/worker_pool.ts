import { WorkerPool } from "../mod.ts";

const pool = new WorkerPool<number[], number>({
  workerUrl: new URL("./workers/sum_worker.ts", import.meta.url),
  size: 2,
  name: "deno-tui-demo",
});

try {
  const results = await Promise.all([
    pool.run([1, 2, 3]),
    pool.run([10, 20, 30]),
    pool.run([100, 200, 300]),
  ]);
  console.log(results.join(", "));
} finally {
  pool.terminate();
}
